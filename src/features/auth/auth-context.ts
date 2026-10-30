import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { AppUser } from '../../types/auth';
export type AuthState = { user: User | null; profile: AppUser | null; loading: boolean };
export const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(AuthContext);


export const CLIENT_360_ALLOWED_ROLES = ['owner', 'admin', 'broker'] as const;
export type Client360AllowedRole = (typeof CLIENT_360_ALLOWED_ROLES)[number];

/**
 * The legacy clients record contains mixed-sensitivity data. Only roles
 * explicitly approved for the full Client 360 workspace may open it.
 */
export function canAccessClient360(role: unknown): role is Client360AllowedRole {
  return typeof role === 'string'
    && (CLIENT_360_ALLOWED_ROLES as readonly string[]).includes(role);
}
