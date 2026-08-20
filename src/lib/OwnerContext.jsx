import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, OWNER_EMAIL } from '@/api/supabaseClient';

// Who can edit. Reading the wishlist needs nothing at all (RLS lets the anon
// role select), so this context only ever gates the add/edit/delete controls.
// "Unlocking" is a normal Supabase password sign-in against the one owner
// account — the session lands in localStorage and refreshes itself, so the
// passphrase is typed once per browser and not again.
const OwnerContext = createContext(null);

export function OwnerProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setChecking(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const unlock = useCallback(async (passphrase) => {
    if (!OWNER_EMAIL) {
      throw new Error('VITE_OWNER_EMAIL is not set — rebuild the site with it configured.');
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: passphrase,
    });
    // Don't leak whether the account exists; the only useful signal here is
    // "that passphrase was wrong".
    if (error) throw new Error('That passphrase did not work.');
  }, []);

  const lock = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ isOwner: !!session, checking, unlock, lock }),
    [session, checking, unlock, lock]
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used within an OwnerProvider');
  return ctx;
}
