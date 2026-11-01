export interface FirebaseTokenVerificationInput {
  apiKey: string;
  idToken: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

export interface VerifiedFirebaseCaller {
  uid: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Verifies a Firebase ID token with the Identity Toolkit account lookup API.
 * Disabled users are explicitly rejected. Network/provider failures are kept
 * distinct from invalid credentials so the caller can return a safe 503.
 */
export async function verifyFirebaseIdToken(
  input: FirebaseTokenVerificationInput,
): Promise<VerifiedFirebaseCaller> {
  const apiKey = typeof input.apiKey === "string" ? input.apiKey.trim() : "";
  const idToken = typeof input.idToken === "string" ? input.idToken.trim() : "";
  const fetcher = input.fetcher ?? fetch;
  const timeoutMs = Number.isInteger(input.timeoutMs) && (input.timeoutMs ?? 0) > 0
    ? Math.min(input.timeoutMs!, 20_000)
    : 10_000;

  if (!apiKey) throw new Error("TOKEN_VERIFICATION_UNAVAILABLE");
  if (!idToken || idToken.length > 16_384) throw new Error("INVALID_TOKEN");

  const url = new URL("https://identitytoolkit.googleapis.com/v1/accounts:lookup");
  url.searchParams.set("key", apiKey);

  let response: Response;
  try {
    response = await fetcher(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new Error("TOKEN_VERIFICATION_UNAVAILABLE");
  }

  if (response.status === 429 || response.status >= 500) {
    throw new Error("TOKEN_VERIFICATION_UNAVAILABLE");
  }
  if (!response.ok) throw new Error("INVALID_TOKEN");

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("TOKEN_VERIFICATION_UNAVAILABLE");
  }

  if (!isRecord(payload) || !Array.isArray(payload.users)) {
    throw new Error("INVALID_TOKEN");
  }
  const user = payload.users[0];
  if (
    !isRecord(user) ||
    typeof user.localId !== "string" ||
    !user.localId.trim() ||
    user.disabled === true
  ) {
    throw new Error("INVALID_TOKEN");
  }

  return { uid: user.localId };
}
