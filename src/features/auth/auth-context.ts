import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { AppUser } from '../../types/auth';
export type AuthState = { user: User | null; profile: AppUser | null; loading: boolean };
export const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(AuthContext);


export const CLIENT_360_ALLOWED_ROLES = ['owner', 'admin', 'broker'] as const;
export type Client360AllowedRole = (typeof CLIENT_360_ALLOWED_ROLES)[number];
export const OPERATIONS_ALLOWED_ROLES = ['owner', 'admin', 'broker', 'claims'] as const;
export type OperationsAllowedRole = (typeof OPERATIONS_ALLOWED_ROLES)[number];
export const ANALYTICS_ALLOWED_ROLES = CLIENT_360_ALLOWED_ROLES;
export type AnalyticsAllowedRole = (typeof ANALYTICS_ALLOWED_ROLES)[number];
export const FINANCE_ALLOWED_ROLES = ['owner', 'admin', 'finance'] as const;
export type FinanceAllowedRole = (typeof FINANCE_ALLOWED_ROLES)[number];

/**
 * The legacy clients record contains mixed-sensitivity data. Only roles
 * explicitly approved for the full Client 360 workspace may open it.
 */
export function canAccessClient360(role: unknown): role is Client360AllowedRole {
  return typeof role === 'string'
    && (CLIENT_360_ALLOWED_ROLES as readonly string[]).includes(role);
}

/**
 * Operations supports Claims while its loader skips Client 360 and RFQ
 * queries that Claims is not authorized to read.
 */
export function canAccessOperations(role: unknown): role is OperationsAllowedRole {
  return typeof role === 'string'
    && (OPERATIONS_ALLOWED_ROLES as readonly string[]).includes(role);
}

/**
 * Portfolio analytics combines clients, policies, claims, leads and tasks;
 * only Owner/Admin/Broker can read every collection in that snapshot.
 */
export function canAccessAnalytics(role: unknown): role is AnalyticsAllowedRole {
  return typeof role === 'string'
    && (ANALYTICS_ALLOWED_ROLES as readonly string[]).includes(role);
}

/** Finance reads are limited by Firestore Rules to Owner, Admin and Finance. */
export function canAccessFinance(role: unknown): role is FinanceAllowedRole {
  return typeof role === 'string'
    && (FINANCE_ALLOWED_ROLES as readonly string[]).includes(role);
}

