# AGENTS.md

## Project Context

Wishlistify: a static React wishlist app on GitHub Pages, backed by Supabase
(Postgres + Storage + Edge Functions). Treat it as user-owned application code,
keep changes focused on the user's request, and preserve existing conventions.

Start with `README.md` for setup, environment variables, and the deploy flow.

## Access model — read before touching auth or RLS

The app has **no login screen**. Anyone with the URL can read the wishlist;
writes require unlocking with a passphrase, which is a plain Supabase password
sign-in against one owner account (`VITE_OWNER_EMAIL`).

`VITE_SUPABASE_ANON_KEY` is inlined into the published bundle and is therefore
public. The RLS policies in `supabase/migrations/0001_init.sql` are the only
access control. Two rules follow:

- Never add an `anon` policy for `insert`/`update`/`delete` on `wishlist_items`
  or the `wishlist-images` bucket.
- Never put the `service_role` key anywhere the frontend or the repo can see it.
  It belongs only in the shell that runs `scripts/import-from-base44.mjs`.

## Key Files

- `src/api/supabaseClient.js`: the single Supabase client. Sessions persist in
  localStorage; `detectSessionInUrl` is off because HashRouter owns the URL hash.
- `src/api/wishlist.js`: all `wishlist_items` reads and writes. The `WRITABLE`
  allowlist keeps server-managed columns out of client payloads.
- `src/lib/OwnerContext.jsx`: unlock/lock state; `isOwner` gates every edit control.
- `supabase/migrations/0001_init.sql`: schema, RLS, storage bucket.
- `supabase/functions/scrape-url/index.ts`: Deno Edge Function. Runs its own auth
  check (`verify_jwt = false` in `supabase/config.toml`) because the anon key
  passes Supabase's built-in JWT verification — the manual `getUser` call is what
  distinguishes a real owner session.

## Working Notes

- `npm run dev` for the frontend; it needs `.env.local` (see `.env.example`).
- Edge Function changes need a redeploy: `supabase functions deploy scrape-url`.
- Schema changes: add a new numbered file in `supabase/migrations/` and run it in
  the Supabase SQL editor. Nothing applies migrations automatically.
- Vite's `base` comes from `BASE_PATH`, set by CI to `/<repo-name>/`. Leave it
  unset locally.
- Run `npm run lint` and `npm run build` before finishing code changes.
