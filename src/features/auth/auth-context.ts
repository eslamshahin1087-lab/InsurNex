import { createContext, useContext } from 'react';
import type { User } from 'firebase/auth';
import type { AppUser } from '../../types/auth';
export type AuthState = { user: User | null; profile: AppUser | null; loading: boolean };
export const AuthContext = createContext<AuthState>({ user: null, profile: null, loading: true });
export const useAuth = () => useContext(AuthContext);
