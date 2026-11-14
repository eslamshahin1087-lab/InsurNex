export type OperationsRoleAccess = Readonly<{
  operations: boolean;
  clientRecords: boolean;
  rfqWorkspace: boolean;
  clientOnboarding: boolean;
  emails: boolean;
}>;

export function getOperationsRoleAccess(role: unknown): OperationsRoleAccess;
