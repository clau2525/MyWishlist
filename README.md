# Wishlistify

A shareable wishlist. Paste a product link, it pulls the picture, title and
price. Anyone with the link can browse it; only you can change it.

Runs entirely on free tiers: **GitHub Pages** for the site, **Supabase** for the
database, image storage and the link scraper.

---

## How access works

There is no login screen. Instead:

| Who | Can do |
| --- | --- |
| Anyone with the link | View the wishlist |
| You, after entering the passphrase once | Add, edit, delete, upload pictures |

The passphrase unlocks a single Supabase account and the browser remembers it,
so you type it once per device.

> **Why it's built this way.** Vite bakes `VITE_SUPABASE_ANON_KEY` into the
> published JavaScript, so that key is public no matter what you do — anyone can
> read it out of the page source. The [Row Level Security policies](supabase/migrations/0001_init.sql)
> are the actual protection: they let the anonymous role *read* and nothing else.
> Every write requires a real signed-in session.
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

### 2. Create your owner account

1. Go to **Authentication → Users → Add user**.
2. Enter an email and a password. **The password is your edit passphrase.**
3. Tick *Auto Confirm User* so you don't have to click a confirmation email.

Then turn off public signups, so nobody can mint their own write-access account:
**Authentication → Sign In / Providers → Email →** turn *Allow new users to sign up* **off**.

### 3. Point the app at it

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase → Project
Settings → API) and `VITE_OWNER_EMAIL` (the email from step 2).

```bash
npm install
npm run dev
```

### 4. Deploy the link scraper

Product pages don't send CORS headers, so the browser can't fetch them directly.
A Supabase Edge Function does it instead — 500K invocations/month on the free tier.

```bash
npm install -g supabase
```

```bash
supabase login
```

```bash
supabase link --project-ref YOUR-PROJECT-REF
```

```bash
supabase functions deploy scrape-url
```

Your project ref is the subdomain of your Supabase URL
(`https://abcdefgh.supabase.co` → `abcdefgh`).

Without this step everything still works — pasting a link just falls back to the
manual "type it in yourself" form.

### 5. Publish to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** select **GitHub Actions**.
3. **Settings → Secrets and variables → Actions → Variables → New variable**,
   add all three:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://YOUR-REF.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | your anon key |
   | `VITE_OWNER_EMAIL` | your owner email |

   These are *Variables*, not *Secrets*, deliberately — they end up in the public
   bundle regardless, and variables stay readable for debugging.

4. Push to `main`. [The workflow](.github/workflows/deploy.yml) builds and
   publishes to `https://<your-username>.github.io/<repo-name>/`.

---

## Bringing your Base44 items across

1. In the Base44 dashboard, export the `WishlistItem` entity as JSON.
2. Run the importer with your **service_role** key (Supabase → Project Settings
   → API). It bypasses RLS, which is why it runs locally and never ships:

```bash
SUPABASE_URL=https://YOUR-REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/import-from-base44.mjs ~/Downloads/export.json
```

Base44's image URLs die once you leave the platform, so the script downloads each
picture and re-uploads it to Supabase Storage. Re-running is safe — items already
imported are matched on their link and skipped.

---

## Project layout

| Path | What |
| --- | --- |
| `src/api/` | Supabase client, wishlist CRUD, storage upload, scraper call |
| `src/lib/OwnerContext.jsx` | Unlock/lock state |
| `src/pages/Wishlist.jsx` | The one page |
| `supabase/migrations/` | Schema + RLS. Run in the SQL editor |
| `supabase/functions/scrape-url/` | Link scraper (Deno) |
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
