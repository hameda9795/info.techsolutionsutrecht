import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Track the current Firebase Authentication user. `loading` is true until the
 * first auth-state callback fires, so route guards don't flash the login page
 * during the initial session check (Firebase restores the session from storage).
 */
export const useAuthUser = (): { user: User | null; loading: boolean } => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { user, loading };
};
