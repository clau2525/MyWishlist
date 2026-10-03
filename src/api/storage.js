import { supabase } from '@/api/supabaseClient';

const BUCKET = 'wishlist-images';

/**
 * Upload a picture and return its public URL.
 * Requires an unlocked session. The bucket's RLS policy only accepts uploads
 * into a folder named after the signed-in user's id.
 */
export async function uploadImage(file) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) throw new Error('Unlock editing first.');

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${auth.user.id}/${crypto.randomUUID()}.${ext || 'jpg'}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
