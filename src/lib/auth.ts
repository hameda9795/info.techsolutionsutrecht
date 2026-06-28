import { useEffect, useState } from 'react';
import { checkSession, login as apiLogin, logout as apiLogout } from './db';

/**
 * Track whether there's a valid session with the backend (replaces the old
 * Firebase onAuthStateChanged listener). `loading` is true until the first
 * check resolves, so route guards don't flash the login page during the
 * initial session check.
 */
export const useAuthUser = (): { user: boolean; loading: boolean } => {
  const [user, setUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
};

export const login = async (password: string): Promise<void> => {
  await apiLogin(password);
};

export const logout = async (): Promise<void> => {
  await apiLogout();
};
