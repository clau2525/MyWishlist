import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// The account the passphrase unlocks. Not a secret — it is only half of a
// credential, and the password never leaves the browser it is typed into.
export const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase config. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Supabase dashboard → Project Settings → API).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // There is no OAuth redirect in this app — the only way in is the owner
    // passphrase. Leaving this off keeps Supabase from trying to parse the URL
    // hash, which HashRouter owns.
    detectSessionInUrl: false,
    storageKey: 'wishlistify.auth',
  },
});
