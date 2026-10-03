# AGENTS.md

## Project Context

Wishlistify: a static React wishlist app on GitHub Pages, backed by Supabase
(Postgres + Storage + Edge Functions). Treat it as user-owned application code,
keep changes focused on the user's request, and preserve existing conventions.

Start with `README.md` for setup, environment variables, and the deploy flow.

## Access model — read before touching auth or RLS

The app has **no login screen**. There are several wishlists, each at
`/#/<slug>` and owned by one Supabase account (`wishlists.owner_id`). Anyone
with the URL can read any list; writes require unlocking with a passphrase,
which is a plain Supabase password sign-in against the owner account of the list
being viewed (email looked up via the `wishlist_login_email` RPC).

`VITE_SUPABASE_ANON_KEY` is inlined into the published bundle and is therefore
public. The RLS policies in `supabase/migrations/0001_init.sql` are the only
access control. Two rules follow:

- Never add an `anon` policy for `insert`/`update`/`delete` on `wishlists`,
  `wishlist_items` or the `wishlist-images` bucket. Write policies must check
  ownership (`wishlists.owner_id = auth.uid()`), not merely `authenticated`.
- Never put the `service_role` key anywhere the frontend or the repo can see it.
  It belongs only in the shell that runs `scripts/import-from-base44.mjs`.

## Key Files

- `src/api/supabaseClient.js`: the single Supabase client. Sessions persist in
  localStorage; `detectSessionInUrl` is off because HashRouter owns the URL hash.
- `src/api/wishlist.js`: all `wishlist_items` reads and writes. The `WRITABLE`
  allowlist keeps server-managed columns out of client payloads.
- `src/lib/OwnerContext.jsx`: unlock/lock state; `isOwnerOf(wishlist)` gates
  every edit control.
- `supabase/migrations/0001_init.sql`: original schema, storage bucket.
- `supabase/migrations/0002_multiple_wishlists.sql`: `wishlists` table,
  per-owner RLS, `create_wishlist()` (SQL editor only), per-user image folders.
- Adding an item is deliberately manual (link, then details). There is no page
  scraper; don't reintroduce one.

## Working Notes

- `npm run dev` for the frontend; it needs `.env.local` (see `.env.example`).
- Schema changes: add a new numbered file in `supabase/migrations/` and run it in
  the Supabase SQL editor. Nothing applies migrations automatically.
- Vite's `base` comes from `BASE_PATH`, set by CI to `/<repo-name>/`. Leave it
  unset locally.
- Run `npm run lint` and `npm run build` before finishing code changes.
