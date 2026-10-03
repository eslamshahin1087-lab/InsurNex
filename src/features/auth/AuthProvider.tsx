import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../../firebase/config';
import { loadProfile } from './auth.service';
import { AuthContext, type AuthState } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, profile: null, loading: true });
  useEffect(() => onAuthStateChanged(auth, async user => {
    try { setState({ user, profile: user ? await loadProfile(user.uid) : null, loading: false }); }
    catch { setState({ user, profile: null, loading: false }); }
  }), []);
  const value = useMemo(() => state, [state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
