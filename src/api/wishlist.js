import { supabase } from '@/api/supabaseClient';

const TABLE = 'wishlist_items';

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

export async function listItems(limit = 200) {
  return unwrap(
    await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
  );
}

export async function createItem(data) {
  return unwrap(await supabase.from(TABLE).insert(toRow(data)).select().single());
}

export async function updateItem(id, data) {
  return unwrap(await supabase.from(TABLE).update(toRow(data)).eq('id', id).select().single());
}

export async function deleteItem(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
