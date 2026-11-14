export type DashboardRoleAccess = Readonly<{
  clients: boolean;
  policies: boolean;
  claims: boolean;
}>;

export function getDashboardRoleAccess(role: unknown): DashboardRoleAccess;
