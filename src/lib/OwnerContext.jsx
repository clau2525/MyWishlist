import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

// Who can edit. Reading any wishlist needs nothing at all (RLS lets the anon
// role select), so this context only ever gates the add/edit/delete controls.
// "Unlocking" a list is a normal Supabase password sign-in against the account
// that owns it — the session lands in localStorage and refreshes itself, so the
// passphrase is typed once per browser and not again. One browser holds one
// session, so unlocking a second list locks the first.
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

  const unlock = useCallback(async (slug, passphrase) => {
    // Don't leak whether the account exists; the only useful signal here is
    // "that passphrase was wrong".
    const fail = new Error('That passphrase did not work.');
    const { data: email, error: lookupError } = await supabase.rpc('wishlist_login_email', {
      p_slug: slug,
    });
    if (lookupError || !email) throw fail;

    const { error } = await supabase.auth.signInWithPassword({ email, password: passphrase });
    if (error) throw fail;
  }, []);

  const lock = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const userId = session?.user?.id ?? null;
  // Pass the wishlist row being viewed; true only for the account that owns it.
  const isOwnerOf = useCallback(
    (wishlist) => !!userId && !!wishlist && wishlist.owner_id === userId,
    [userId]
  );

  const value = useMemo(
    () => ({ isOwnerOf, checking, unlock, lock }),
    [isOwnerOf, checking, unlock, lock]
  );

  return <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>;
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error('useOwner must be used within an OwnerProvider');
  return ctx;
}
