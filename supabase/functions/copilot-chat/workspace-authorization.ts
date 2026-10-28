type FirestoreField = {
  stringValue?: unknown;
};

type FirestoreDocument = {
  fields?: Record<string, FirestoreField | undefined>;
};

export type CopilotWorkspaceAuthorization =
  | { scopeType: "organization"; organizationId: string; allowClientContext: true }
  | { scopeType: "platform-admin"; organizationId: null; allowClientContext: false };

const ALLOWED_ORG_ROLES = new Set([
  "owner",
  "admin",
  "broker",
  "sales",
  "claims",
  "finance",
  "staff",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(document: FirestoreDocument, key: string): string | undefined {
  const value = document.fields?.[key]?.stringValue;
  return typeof value === "string" ? value : undefined;
}

async function readCallerDocument(
  projectId: string,
  collectionName: "users" | "admin",
  uid: string,
  idToken: string,
  fetcher: typeof fetch,
): Promise<FirestoreDocument | null> {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${collectionName}/${encodeURIComponent(uid)}`,
  );
  // Only fetch fields required for authorization; do not load contact/profile data.
  if (collectionName === "users") {
    for (const fieldPath of ["organizationId", "status", "role"]) {
      url.searchParams.append("mask.fieldPaths", fieldPath);
    }
  }
  const response = await fetcher(url.toString(), {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (response.status === 404) return null;
  if (!response.ok) throw new Error("WORKSPACE_AUTHORIZATION_UNAVAILABLE");

  const document: unknown = await response.json();
  return isRecord(document) ? document as FirestoreDocument : null;
}

export async function authorizeCopilotWorkspace(input: {
  projectId: string;
  uid: string;
  idToken: string;
  requestedScope: unknown;
  fetcher?: typeof fetch;
}): Promise<CopilotWorkspaceAuthorization> {
  const { projectId, uid, idToken, requestedScope } = input;
  const fetcher = input.fetcher ?? fetch;

  if (
    typeof projectId !== "string" ||
    !projectId.trim() ||
    typeof uid !== "string" ||
    !uid.trim() ||
    typeof idToken !== "string" ||
    !idToken.trim() ||
    typeof requestedScope !== "string" ||
    !requestedScope.trim() ||
    requestedScope.length > 128
  ) {
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  // Check the dedicated platform-admin membership first so a platform admin
  // cannot use a tenant profile to bypass the private admin-only scope.
  const adminMembership = await readCallerDocument(projectId, "admin", uid, idToken, fetcher);
  if (adminMembership) {
    if (requestedScope === uid) {
      return { scopeType: "platform-admin", organizationId: null, allowClientContext: false };
    }
    throw new Error("WORKSPACE_ACCESS_DENIED");
  }

  const profile = await readCallerDocument(projectId, "users", uid, idToken, fetcher);
  if (profile) {
    const organizationId = stringField(profile, "organizationId");
    const status = stringField(profile, "status");
    const role = stringField(profile, "role");

    if (!organizationId || status !== "active" || !ALLOWED_ORG_ROLES.has(role ?? "")) {
      throw new Error("WORKSPACE_ACCESS_DENIED");
    }
    if (requestedScope !== organizationId) {
      throw new Error("ORGANIZATION_ACCESS_DENIED");
    }

    return { scopeType: "organization", organizationId, allowClientContext: true };
  }

  throw new Error("WORKSPACE_ACCESS_DENIED");
}
