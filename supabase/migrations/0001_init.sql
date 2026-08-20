-- Wishlistify schema.
--
-- Access model: the app ships with no sign-in screen. The Supabase anon key is
-- baked into the published JavaScript and is therefore public, so RLS is the
-- only thing standing between the internet and this table. The rules below give
-- the anon role READ ONLY, and reserve every write to an authenticated session
-- (the single owner account, unlocked with the passphrase in the app UI).
--
-- Never add an `anon` policy for insert/update/delete here.

create extension if not exists "pgcrypto";

create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  title       text        not null,
  description text        not null default '',
  price       text        not null default '',
  image_url   text        not null default '',
  source_url  text        not null,
  category    text[]      not null default '{}',
  bought      boolean     not null default false
);

-- The list is always read newest-first and filtered on `bought`.
create index if not exists wishlist_items_created_at_idx
  on public.wishlist_items (created_at desc);

-- Keep updated_at honest without the client having to remember to send it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wishlist_items_touch_updated_at on public.wishlist_items;
create trigger wishlist_items_touch_updated_at
  before update on public.wishlist_items
  for each row execute function public.touch_updated_at();

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist readable by everyone"   on public.wishlist_items;
drop policy if exists "wishlist insert by owner"        on public.wishlist_items;
drop policy if exists "wishlist update by owner"        on public.wishlist_items;
drop policy if exists "wishlist delete by owner"        on public.wishlist_items;

-- Public read: anyone with the site URL can browse the wishlist.
create policy "wishlist readable by everyone"
  on public.wishlist_items for select
  to anon, authenticated
  using (true);

-- Writes require a real signed-in session, never the anon key.
create policy "wishlist insert by owner"
  on public.wishlist_items for insert
  to authenticated
  with check (true);

create policy "wishlist update by owner"
  on public.wishlist_items for update
  to authenticated
  using (true) with check (true);

create policy "wishlist delete by owner"
  on public.wishlist_items for delete
  to authenticated
  using (true);


-- ---------------------------------------------------------------------------
-- Storage: uploaded item pictures.
-- Public bucket so <img src> works straight from the static site; same
-- read-everyone / write-owner split as the table above.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wishlist-images',
  'wishlist-images',
  true,
  10485760, -- 10 MB
  array['image/jpeg','image/png','image/webp','image/gif','image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "wishlist images readable by everyone" on storage.objects;
drop policy if exists "wishlist images insert by owner"      on storage.objects;
drop policy if exists "wishlist images update by owner"      on storage.objects;
drop policy if exists "wishlist images delete by owner"      on storage.objects;

create policy "wishlist images readable by everyone"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'wishlist-images');

create policy "wishlist images insert by owner"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'wishlist-images');

create policy "wishlist images update by owner"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'wishlist-images')
  with check (bucket_id = 'wishlist-images');

create policy "wishlist images delete by owner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'wishlist-images');
