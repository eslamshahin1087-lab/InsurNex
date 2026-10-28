import { authorizeCopilotWorkspace } from "./workspace-authorization.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function firestoreDocument(fields: Record<string, string>): Response {
  return Response.json({
    fields: Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [key, { stringValue: value }]),
    ),
  });
}

function fetchFor(documents: Record<string, Response | null>, seen: string[] = []): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push(url + "|" + new Headers(init?.headers).get("Authorization"));
    const key = url.slice(url.indexOf("/documents/") + "/documents/".length);
    const response = documents[key];
    return response ? response.clone() : new Response(null, { status: 404 });
  }) as typeof fetch;
}

async function expectRejects(promise: Promise<unknown>, expected: string) {
  try {
    await promise;
  } catch (error) {
    assert(error instanceof Error && error.message === expected, "unexpected rejection; expected " + expected);
    return;
  }
  throw new Error("expected rejection " + expected);
}

Deno.test("active organization members can use only their own organization scope", async () => {
  const seen: string[] = [];
  const fetcher = fetchFor({
    "users/uid-1": firestoreDocument({
      organizationId: "org-1",
      status: "active",
      role: "broker",
    }),
  }, seen);

  const result = await authorizeCopilotWorkspace({
    projectId: "demo-project",
    uid: "uid-1",
    idToken: "firebase-token",
    requestedScope: "org-1",
    fetcher,
  });

  assert(result.scopeType === "organization", "member should use organization scope");
  assert(result.organizationId === "org-1", "verified organization ID should be returned");
  assert(result.allowClientContext, "active organization members may use filtered context");
  assert(seen[0].includes("/documents/admin/uid-1|Bearer firebase-token"), "platform-admin membership must be checked first");
  assert(seen[1].includes("/documents/users/uid-1|Bearer firebase-token"), "profile lookup must use the verified caller token");
});

Deno.test("organization mismatch and inactive or unsupported roles are denied", async () => {
  const activeProfile = firestoreDocument({
    organizationId: "org-1",
    status: "active",
    role: "broker",
  });
  await expectRejects(
    authorizeCopilotWorkspace({
      projectId: "demo-project", uid: "uid-1", idToken: "token",
      requestedScope: "org-2", fetcher: fetchFor({ "users/uid-1": activeProfile }),
    }),
    "ORGANIZATION_ACCESS_DENIED",
  );

  await expectRejects(
    authorizeCopilotWorkspace({
      projectId: "demo-project", uid: "uid-1", idToken: "token",
      requestedScope: "org-1",
      fetcher: fetchFor({ "users/uid-1": firestoreDocument({
        organizationId: "org-1", status: "disabled", role: "broker",
      }) }),
    }),
    "WORKSPACE_ACCESS_DENIED",
  );

  await expectRejects(
    authorizeCopilotWorkspace({
      projectId: "demo-project", uid: "uid-1", idToken: "token",
      requestedScope: "org-1",
      fetcher: fetchFor({ "users/uid-1": firestoreDocument({
        organizationId: "org-1", status: "active", role: "platform_admin",
      }) }),
    }),
    "WORKSPACE_ACCESS_DENIED",
  );
});

Deno.test("platform admins without an organization profile are restricted to private scope", async () => {
  const fetcher = fetchFor({
    "users/admin-1": firestoreDocument({ organizationId: "org-1", status: "active", role: "admin" }),
    "admin/admin-1": firestoreDocument({ enabled: "true" }),
  });

  const result = await authorizeCopilotWorkspace({
    projectId: "demo-project",
    uid: "admin-1",
    idToken: "admin-token",
    requestedScope: "admin-1",
    fetcher,
  });

  assert(result.scopeType === "platform-admin", "admin should use private scope");
  assert(result.organizationId === null, "admin private scope must not be an organization");
  assert(!result.allowClientContext, "admin private scope must not receive tenant context");

  await expectRejects(
    authorizeCopilotWorkspace({
      projectId: "demo-project",
      uid: "admin-1",
      idToken: "admin-token",
      requestedScope: "org-1",
      fetcher,
    }),
    "WORKSPACE_ACCESS_DENIED",
  );
});

Deno.test("authorization lookup errors fail closed", async () => {
  const fetcher = (async () => new Response(null, { status: 403 })) as typeof fetch;
  await expectRejects(
    authorizeCopilotWorkspace({
      projectId: "demo-project",
      uid: "uid-1",
      idToken: "token",
      requestedScope: "org-1",
      fetcher,
    }),
    "WORKSPACE_AUTHORIZATION_UNAVAILABLE",
  );
});
