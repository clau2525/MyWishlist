import { supabase } from '@/api/supabaseClient';

const TABLE = 'wishlist_items';
const LISTS = 'wishlists';

// Columns a client is allowed to write. Guards against handing Supabase the
// server-managed fields (id/created_at/updated_at) that ride along when an
// existing item is round-tripped through the edit form.
const WRITABLE = ['title', 'description', 'price', 'image_url', 'source_url', 'category', 'bought'];

const toRow = (data) => {
  const row = {};
  for (const key of WRITABLE) {
    if (data[key] === undefined) continue;
    row[key] = key === 'category' ? toArray(data[key]) : data[key];
  }
  return row;
};

const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

export async function listWishlists() {
  return unwrap(await supabase.from(LISTS).select('id, slug, name, owner_id').order('name'));
}

/** The list at /#/<slug>, or null if there is none. */
export async function getWishlist(slug) {
  return unwrap(
    await supabase
      .from(LISTS)
      .select('id, slug, name, owner_id')
      .eq('slug', slug.toLowerCase())
      .maybeSingle()
  );
}

export async function listItems(wishlistId, limit = 200) {
  return unwrap(
    await supabase
      .from(TABLE)
      .select('*')
      .eq('wishlist_id', wishlistId)
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

// wishlist_id is set here and nowhere else: it is fixed at creation, so it
// stays out of WRITABLE and an edit can never move an item between lists.
export async function createItem(wishlistId, data) {
  return unwrap(
    await supabase
      .from(TABLE)
      .insert({ ...toRow(data), wishlist_id: wishlistId })
      .select()
      .single()
  );
}

export async function updateItem(id, data) {
  return unwrap(await supabase.from(TABLE).update(toRow(data)).eq('id', id).select().single());
}

export async function deleteItem(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
