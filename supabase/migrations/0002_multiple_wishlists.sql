-- Multiple wishlists, one owner each.
--
-- Each wishlist lives at its own URL (/#/<slug>) and belongs to one Supabase
-- account. Anyone can read every list; an unlocked session can only write to
-- the list(s) its own account owns. Tags are per-list for free: they are just
-- the `category` values of that list's items.
--
-- BEFORE RUNNING: edit the three lines marked EDIT in step 4 so your existing
-- items are moved onto your own list. Everything here runs as one transaction,
-- so if something is wrong nothing is changed.
--
-- Never add an `anon` policy for insert/update/delete here.

-- ---------------------------------------------------------------------------
-- 1. The lists themselves.
-- ---------------------------------------------------------------------------

create table if not exists public.wishlists (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  -- The bit at the end of the URL. Lowercase letters, digits and dashes only,
  -- so it never needs escaping in a link.
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade
);

alter table public.wishlists enable row level security;

drop policy if exists "wishlists readable by everyone" on public.wishlists;

-- Public read; no write policies at all. Lists are created from the SQL editor
-- with create_wishlist() below, which runs as the database owner.
create policy "wishlists readable by everyone"
  on public.wishlists for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- 2. Helpers.
-- ---------------------------------------------------------------------------

-- The unlock dialog only asks for a passphrase, so the app needs to know which
-- account a list's passphrase belongs to. Same exposure as the old
-- VITE_OWNER_EMAIL, which was baked into the public bundle: one email per slug
-- you already know, and no way to list them all.
create or replace function public.wishlist_login_email(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.wishlists w
  join auth.users u on u.id = w.owner_id
  where w.slug = lower(trim(p_slug));
$$;

revoke execute on function public.wishlist_login_email(text) from public;
grant execute on function public.wishlist_login_email(text) to anon, authenticated;

-- Give someone a list. Run from the SQL editor after adding their account under
-- Authentication -> Users:
--   select public.create_wishlist('anna', 'Anna''s Wishlist', 'anna@example.com');
create or replace function public.create_wishlist(p_slug text, p_name text, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_slug  text := lower(trim(p_slug));
begin
  select id into v_owner from auth.users where lower(email) = lower(trim(p_email));
  if v_owner is null then
    raise exception 'No account with email %. Add it first under Authentication -> Users.', p_email;
  end if;

  insert into public.wishlists (slug, name, owner_id)
  values (v_slug, trim(p_name), v_owner);

  return 'Created. Link: <your site>/#/' || v_slug;
end;
$$;

-- SQL editor only. Supabase grants new public functions to anon/authenticated
-- by default, which would let anyone hand out lists.
revoke execute on function public.create_wishlist(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Items belong to a list.
-- ---------------------------------------------------------------------------

alter table public.wishlist_items
  add column if not exists wishlist_id uuid references public.wishlists (id) on delete cascade;

drop index if exists public.wishlist_items_created_at_idx;
create index if not exists wishlist_items_list_created_at_idx
  on public.wishlist_items (wishlist_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Move the existing items onto your list.
-- ---------------------------------------------------------------------------

do $$
declare
  v_slug  text := 'claudia';               -- EDIT: the end of your link
  v_name  text := 'Claudia''s Wishlist';   -- EDIT: the title shown on the page
  v_email text := 'you@example.com';       -- EDIT: the account you unlock with today
  v_list  uuid;
begin
  if v_email = 'you@example.com' then
    if exists (select 1 from public.wishlist_items where wishlist_id is null) then
      raise exception 'You have existing items. Edit the three EDIT lines in step 4 of this file, then run it again.';
    end if;
    return;
  end if;

  if not exists (select 1 from public.wishlists where slug = v_slug) then
    perform public.create_wishlist(v_slug, v_name, v_email);
  end if;
  select id into v_list from public.wishlists where slug = v_slug;

  update public.wishlist_items set wishlist_id = v_list where wishlist_id is null;
end;
$$;

alter table public.wishlist_items alter column wishlist_id set not null;

-- ---------------------------------------------------------------------------
-- 5. Writes only to your own list.
-- ---------------------------------------------------------------------------

drop policy if exists "wishlist insert by owner" on public.wishlist_items;
drop policy if exists "wishlist update by owner" on public.wishlist_items;
drop policy if exists "wishlist delete by owner" on public.wishlist_items;

create policy "wishlist insert by owner"
  on public.wishlist_items for insert
  to authenticated
  with check (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.owner_id = (select auth.uid())
  ));

-- The check clause stops an owner moving an item onto someone else's list.
create policy "wishlist update by owner"
  on public.wishlist_items for update
  to authenticated
  using (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.owner_id = (select auth.uid())
  ));

create policy "wishlist delete by owner"
  on public.wishlist_items for delete
  to authenticated
  using (exists (
    select 1 from public.wishlists w
    where w.id = wishlist_id and w.owner_id = (select auth.uid())
  ));

-- ---------------------------------------------------------------------------
-- 6. Pictures: each account uploads into its own folder (<user id>/...) and can
-- only change or remove files it uploaded itself.
-- ---------------------------------------------------------------------------

drop policy if exists "wishlist images insert by owner" on storage.objects;
drop policy if exists "wishlist images update by owner" on storage.objects;
drop policy if exists "wishlist images delete by owner" on storage.objects;

create policy "wishlist images insert by owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'wishlist-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "wishlist images update by owner"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'wishlist-images' and owner_id = (select auth.uid()::text))
  with check (
    bucket_id = 'wishlist-images'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "wishlist images delete by owner"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'wishlist-images' and owner_id = (select auth.uid()::text));
