import { verifyFirebaseIdToken } from "./firebase-token-verification.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function expectRejects(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof Error && error.message === code, "unexpected error code");
    return;
  }
  throw new Error("expected rejection: " + code);
}

Deno.test("valid Firebase ID token resolves only the stable caller UID", async () => {
  let requestBody: Record<string, unknown> = {};
  let requestAuthorization: string | null = null;
  const caller = await verifyFirebaseIdToken({
    apiKey: "server-api-key",
    idToken: "valid-firebase-id-token",
    fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      assert(url.origin === "https://identitytoolkit.googleapis.com", "must use Firebase Identity Toolkit");
      assert(url.pathname === "/v1/accounts:lookup", "must use account lookup endpoint");
      assert(url.searchParams.get("key") === "server-api-key", "must use server-side API key");
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      requestAuthorization = new Headers(init?.headers).get("Authorization");
      return Response.json({ users: [{ localId: "firebase-uid-1", disabled: false }] });
    }) as typeof fetch,
  });

  assert(caller.uid === "firebase-uid-1", "verified UID should be returned");
  assert(requestBody.idToken === "valid-firebase-id-token", "ID token must be sent only to token verification endpoint");
  assert(requestAuthorization === null, "the token must not be sent as a bearer authorization header");
});

Deno.test("disabled Firebase users are rejected", async () => {
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "server-api-key",
      idToken: "disabled-user-token",
      fetcher: (async () => Response.json({
        users: [{ localId: "disabled-uid", disabled: true }],
      })) as typeof fetch,
    }),
    "INVALID_TOKEN",
  );
});

Deno.test("missing, malformed or oversized token responses fail closed", async () => {
  await expectRejects(
    verifyFirebaseIdToken({ apiKey: "server-api-key", idToken: "" }),
    "INVALID_TOKEN",
  );
  await expectRejects(
    verifyFirebaseIdToken({ apiKey: "server-api-key", idToken: "x".repeat(16_385) }),
    "INVALID_TOKEN",
  );
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "server-api-key",
      idToken: "token",
      fetcher: (async () => Response.json({ users: [{ email: "missing-uid@example.invalid" }] })) as typeof fetch,
    }),
    "INVALID_TOKEN",
  );
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "",
      idToken: "token",
    }),
    "TOKEN_VERIFICATION_UNAVAILABLE",
  );
});

Deno.test("invalid credentials and disabled user responses are distinguished from provider outages", async () => {
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "server-api-key",
      idToken: "invalid-token",
      fetcher: (async () => new Response("invalid", { status: 400 })) as typeof fetch,
    }),
    "INVALID_TOKEN",
  );
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "server-api-key",
      idToken: "token",
      fetcher: (async () => new Response("unavailable", { status: 503 })) as typeof fetch,
    }),
    "TOKEN_VERIFICATION_UNAVAILABLE",
  );
  await expectRejects(
    verifyFirebaseIdToken({
      apiKey: "server-api-key",
      idToken: "token",
      fetcher: (async () => { throw new Error("private network detail"); }) as typeof fetch,
    }),
    "TOKEN_VERIFICATION_UNAVAILABLE",
  );
});
