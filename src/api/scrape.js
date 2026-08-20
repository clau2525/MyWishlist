import { supabase } from '@/api/supabaseClient';

/**
 * Ask the scrape-url Edge Function to read a product page and pull out
 * title / price / image. Needs an unlocked session: the function rejects the
 * bare anon key so it can't be used as an open URL proxy.
 */
export async function scrapeUrl(url) {
  const { data, error } = await supabase.functions.invoke('scrape-url', { body: { url } });

  if (error) {
    // Edge Functions surface a non-2xx as FunctionsHttpError with the body
    // still attached; the body carries our human-readable reason.
    const detail = await readErrorBody(error);
    throw new Error(detail || error.message || 'Could not read that link.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

async function readErrorBody(error) {
  try {
    const body = await error.context?.json();
    return body?.error;
  } catch {
    return null;
  }
}
