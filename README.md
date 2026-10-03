# Wishlistify

Shareable wishlists. Each person gets their own list at their own link
(`…/#/claudia`, `…/#/anna`) with their own items and tags. Anyone with the link
can browse it; only that person can change it.

Runs entirely on free tiers: **GitHub Pages** for the site, **Supabase** for the
database and image storage.

---

## How access works

There is no login screen. Instead:

| Who | Can do |
| --- | --- |
| Anyone with the link | View any wishlist |
| A list's owner, after tapping the lock and entering their passphrase | Add, edit, delete, upload pictures — on their own list only |

Each list belongs to one Supabase account; the passphrase is that account's
password. The browser remembers it, so it's typed once per device. One browser
holds one unlocked list at a time.

The bare site link (`…/#/`) lists every wishlist, or jumps straight to it when
there is only one.

> **Why it's built this way.** Vite bakes `VITE_SUPABASE_ANON_KEY` into the
> published JavaScript, so that key is public no matter what you do — anyone can
> read it out of the page source. The [Row Level Security policies](supabase/migrations/0001_init.sql)
> are the actual protection: they let the anonymous role *read* and nothing else.
> Every write requires a signed-in session belonging to that list's owner.
>
> The one key you must never publish is the **`service_role`** key. It bypasses
> RLS entirely. It belongs only in your local shell when running the import
> script, never in `.env.local`, the repo, or GitHub.

---

## Setup

### 1. Create the Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a project (free tier).
2. Open **SQL Editor**, paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it.
   That creates the `wishlist_items` table, the RLS policies, and the
   `wishlist-images` storage bucket.
3. Do the same with
   [`supabase/migrations/0002_multiple_wishlists.sql`](supabase/migrations/0002_multiple_wishlists.sql).
   **Edit the three `EDIT` lines in step 4 first** (your link name, page title
   and the email you unlock with). That creates your list and moves any
   existing items onto it. If the account doesn't exist yet, do step 2 below
   first.

### 2. Create an account per person

1. Go to **Authentication → Users → Add user**.
2. Enter an email and a password. **The password is that person's edit passphrase.**
3. Tick *Auto Confirm User* so nobody has to click a confirmation email.

Then turn off public signups, so nobody can mint their own write-access account:
**Authentication → Sign In / Providers → Email →** turn *Allow new users to sign up* **off**.

### 3. Point the app at it

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase → Project
Settings → API).

```bash
npm install
npm run dev
```

### 4. Publish to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** select **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New variable**,
   add both:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://YOUR-REF.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |

   These are *Variables*, not *Secrets*, deliberately — they end up in the public
   bundle regardless, and variables stay readable for debugging.

4. Push to `main`. [The workflow](.github/workflows/deploy.yml) builds and
   publishes to `https://<your-username>.github.io/<repo-name>/`.

---

## Adding someone else's wishlist

Create their account as above, then in the **SQL Editor** run:

```sql
select public.create_wishlist('anna', 'Anna''s Wishlist', 'anna@example.com');
```

Their list is now at `…/#/anna`. The first argument is the end of the link
(lowercase letters, digits and dashes); the second is the title on the page.
Tags are per list automatically — every list only sees its own.

---

## Bringing your Base44 items across

1. In the Base44 dashboard, export the `WishlistItem` entity as JSON.
2. Run the importer with your **service_role** key (Supabase → Project Settings
   → API). It bypasses RLS, which is why it runs locally and never ships:

```bash
SUPABASE_URL=https://YOUR-REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/import-from-base44.mjs ~/Downloads/export.json claudia
```

Base44's image URLs die once you leave the platform, so the script downloads each
picture and re-uploads it to Supabase Storage. The last argument is the list to
import into. Re-running is safe — items already on that list are matched on
their link and skipped.

---

## Project layout

| Path | What |
| --- | --- |
| `src/api/` | Supabase client, wishlist CRUD, storage upload |
| `src/lib/OwnerContext.jsx` | Unlock/lock state |
| `src/pages/Wishlist.jsx` | One list (`/#/<slug>`) |
| `src/pages/WishlistDirectory.jsx` | The bare link (`/#/`): all lists |
| `supabase/migrations/` | Schema + RLS. Run in the SQL editor |
| `scripts/import-from-base44.mjs` | One-time data migration |

## Commands

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run lint
```

## Good to know

- **Free Supabase projects pause after 7 days with no activity.** Opening the
  dashboard or the site wakes it back up. If your wishlist ever loads empty with
  an error, that's usually why.
- Routing uses `HashRouter` (`/#/`) because GitHub Pages can't rewrite deep
  links to `index.html`.
- Free GitHub Pages requires a public repo. That's fine here — the only
  credential in the repo is the anon key, which is public by design.
