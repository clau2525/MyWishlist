import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
    // There is no OAuth redirect in this app — the only way in is a list
    // owner's passphrase. Leaving this off keeps Supabase from trying to parse the URL
    // hash, which HashRouter owns.
    detectSessionInUrl: false,
    storageKey: 'wishlistify.auth',
  },
});
