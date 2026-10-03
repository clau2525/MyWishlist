#!/usr/bin/env node
/**
 * Import wishlist items exported from Base44 into Supabase.
 *
 * Base44's image URLs (media.base44.com) stop resolving once you leave the
 * platform, so this also downloads each picture and re-uploads it to Supabase
 * Storage, rewriting image_url to the new public URL.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/import-from-base44.mjs path/to/export.json <wishlist-slug>
 *
 * <wishlist-slug> is the end of the list's link (/#/claudia -> claudia). The
 * list must already exist; see create_wishlist() in the 0002 migration.
 *
 * The service_role key bypasses RLS, which is why this runs locally from your
 * shell and never ships to the browser or into the repo.
 *
 * Re-running is safe: items already on that list (matched on source_url) are
 * skipped rather than duplicated.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPath = process.argv[2];
const slug = process.argv[3];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then re-run.');
  console.error('Find both in the Supabase dashboard under Project Settings -> API.');
  process.exit(1);
}
if (!inputPath || !slug) {
  console.error('Usage: node scripts/import-from-base44.mjs <export.json> <wishlist-slug>');
  process.exit(1);
}

const BUCKET = 'wishlist-images';
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const toArray = (v) => {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) {
    // Base44 CSV exports collapse the tag array into a delimited string.
    return v.split(/[;,|]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

/** Pull a picture off its old host and park it in Supabase Storage. */
async function rehostImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType || 'unknown'})`);

    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${crypto.randomUUID()}.${EXT_BY_TYPE[contentType] || 'jpg'}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType,
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error(error.message);

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn(`  ! image failed (${e.message}) — keeping original URL`);
    return url;
  }
}

function parseExport(text) {
  const data = JSON.parse(text);
  // Base44 exports either a bare array or wraps it in { records } / { data }.
  const rows = Array.isArray(data) ? data : data.records || data.data || data.items;
  if (!Array.isArray(rows)) {
    throw new Error('Expected a JSON array of items, or an object with a "records"/"data"/"items" array.');
  }
  return rows;
}

const rows = parseExport(readFileSync(inputPath, 'utf8'));
console.log(`Found ${rows.length} item(s) in ${inputPath}\n`);

const { data: list, error: listError } = await supabase
  .from('wishlists')
  .select('id, name')
  .eq('slug', slug.toLowerCase())
  .maybeSingle();
if (listError) {
  console.error(`Could not read the wishlists table: ${listError.message}`);
  console.error('Did you run the migrations in supabase/migrations/ yet?');
  process.exit(1);
}
if (!list) {
  console.error(`No wishlist with slug "${slug}". Create it with create_wishlist() first.`);
  process.exit(1);
}
console.log(`Importing into "${list.name}"\n`);

// One round-trip to find what is already there, so re-runs don't duplicate.
const { data: existing, error: existingError } = await supabase
  .from('wishlist_items')
  .select('source_url')
  .eq('wishlist_id', list.id);
if (existingError) {
  console.error(`Could not read the wishlist_items table: ${existingError.message}`);
  process.exit(1);
}
const seen = new Set((existing || []).map((r) => r.source_url));

let imported = 0;
let skipped = 0;
let failed = 0;

for (const [i, row] of rows.entries()) {
  const title = String(row.title || '').trim();
  const sourceUrl = String(row.source_url || '').trim();
  const label = title || sourceUrl || `row ${i + 1}`;

  if (!title || !sourceUrl) {
    console.warn(`[${i + 1}/${rows.length}] skipped "${label}" — needs both a title and a source_url`);
    skipped += 1;
    continue;
  }
  if (seen.has(sourceUrl)) {
    console.log(`[${i + 1}/${rows.length}] already imported: ${label}`);
    skipped += 1;
    continue;
  }

  console.log(`[${i + 1}/${rows.length}] ${label}`);
  const imageUrl = await rehostImage(String(row.image_url || '').trim());

  const record = {
    wishlist_id: list.id,
    title,
    description: String(row.description || ''),
    price: String(row.price || ''),
    image_url: imageUrl,
    source_url: sourceUrl,
    category: toArray(row.category),
    bought: row.bought === true || row.bought === 'true',
  };
  // Preserve the original ordering of the list where Base44 recorded it.
  const created = row.created_date || row.created_at;
  if (created && !Number.isNaN(Date.parse(created))) {
    record.created_at = new Date(created).toISOString();
  }

  const { error } = await supabase.from('wishlist_items').insert(record);
  if (error) {
    console.error(`  ! failed: ${error.message}`);
    failed += 1;
  } else {
    seen.add(sourceUrl);
    imported += 1;
  }
}

console.log(`\nDone. ${imported} imported, ${skipped} skipped, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
