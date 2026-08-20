// Reads a product page and pulls out title / description / image / price.
//
// This runs server-side for two reasons: shops don't send CORS headers, so the
// browser can't fetch them directly; and it keeps a URL-fetching endpoint
// behind an authenticated session instead of exposing an open proxy.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

function decodeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"');
}

function getMeta(html: string, prop: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${prop}["']`, 'i'),
    new RegExp(`<meta[^>]*name=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${prop}["']`, 'i'),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m && m[1]) return decodeHtml(m[1]).trim();
  }
  return null;
}

function absoluteUrl(url: string | null, base: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

// Country / region code -> ISO currency. Used to read the currency the buyer
// actually sees from the locale segment of the URL (e.g. /de-ch/ -> CHF),
// which is the only reliable signal for multi-currency shops whose server
// HTML is rendered in the store's base currency.
const COUNTRY_CURRENCY: Record<string, string> = {
  eu: 'EUR',
  ch: 'CHF',
  de: 'EUR', fr: 'EUR', it: 'EUR', es: 'EUR', nl: 'EUR', be: 'EUR', at: 'EUR',
  ie: 'EUR', fi: 'EUR', pt: 'EUR', gr: 'EUR', lu: 'EUR', sk: 'EUR', si: 'EUR',
  ee: 'EUR', lv: 'EUR', lt: 'EUR', cy: 'EUR', mt: 'EUR', hr: 'EUR',
  gb: 'GBP', uk: 'GBP',
  us: 'USD', ca: 'CAD', au: 'AUD', nz: 'NZD',
  jp: 'JPY', cn: 'CNY', hk: 'HKD', sg: 'SGD', kr: 'KRW', tw: 'TWD',
  se: 'SEK', no: 'NOK', dk: 'DKK', pl: 'PLN', cz: 'CZK', hu: 'HUF',
  ro: 'RON', bg: 'BGN', tr: 'TRY', in: 'INR', br: 'BRL', mx: 'MXN',
  za: 'ZAR', ae: 'AED', sa: 'SAR', il: 'ILS', th: 'THB', id: 'IDR',
  my: 'MYR', ph: 'PHP', vn: 'VND',
};

function inferLocaleCurrency(url: string): string | null {
  try {
    const u = new URL(url);
    for (const s of u.pathname.split('/').filter(Boolean)) {
      const m = s.toLowerCase().match(/^[a-z]{2}[-_]([a-z]{2,3})$/);
      if (m && COUNTRY_CURRENCY[m[1]]) return COUNTRY_CURRENCY[m[1]];
    }
    return null;
  } catch {
    return null;
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
  RON: 'lei', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', INR: '₹', CNY: '¥',
  RUB: '₽', BRL: 'R$', MXN: 'MX$', ZAR: 'R', SGD: 'S$', HKD: 'HK$',
  TRY: '₺', AED: 'AED', SAR: 'SAR', ILS: '₪', THB: '฿', KRW: '₩',
  TWD: 'NT$', IDR: 'Rp', MYR: 'RM', PHP: '₱', VND: '₫', BGN: 'лв',
};

// Turn a raw price string ("1,290.00", "7,90", "1290") into a plain numeric
// string ("1290.00", "7.90", "1290") that Number() can parse.
function sanitizeAmount(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[^0-9.,]/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    // comma = thousands separator
    s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    const parts = s.split(',');
    // trailing two digits after comma -> decimal comma ("7,90")
    if (parts.length === 2 && parts[1].length === 2) {
      s = parts[0] + '.' + parts[1];
    } else {
      s = s.replace(/,/g, '');
    }
  }
  return s;
}

function formatPrice(amount: string, currency: string): string {
  const cur = String(currency || '').toUpperCase();
  const sym = CURRENCY_SYMBOLS[cur] || currency || '';
  const num = Number(amount);
  if (!isFinite(num)) return sym ? `${sym} ${amount}`.trim() : String(amount);

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (cur === 'CHF') return `CHF ${formatted}`;
  if (sym === 'kr') return `${formatted} kr`;
  return `${sym}${formatted}`;
}

// schema.org Product/Offer — reliable for the price NUMBER even on
// multi-currency shops (the currency field there is the store's base currency,
// so we override it with the URL-locale currency when available).
function extractJsonLdPrice(html: string): { price: string; currency: string | null } | null {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1].trim());
      const candidates = Array.isArray(obj) ? obj : [obj];
      for (const c of candidates) {
        const nodes = c && Array.isArray(c['@graph']) ? c['@graph'] : [c];
        for (const n of nodes) {
          if (!n?.offers) continue;
          const offerList = Array.isArray(n.offers) ? n.offers : [n.offers];
          for (const o of offerList) {
            if (!o) continue;
            const p = o.price ?? o.lowPrice ?? o.highPrice;
            const cur = o.priceCurrency || o.currency;
            if (p !== undefined && p !== null) {
              return { price: String(p), currency: cur ? String(cur) : null };
            }
          }
        }
      }
    } catch {
      // malformed JSON-LD — skip this block
    }
  }
  return null;
}

// Last resort when there is no structured markup: read the price the way a
// shopper does. Microdata first (still structured), then the first
// currency-tagged number in the visible body. Deliberately ignores
// `data-price` / inline JSON `"price"` fields — Shopify and friends store
// those in cents, which silently yields a 100x wrong number.
function extractPriceHeuristic(html: string): { price: string; currency: string | null } | null {
  const itemprop =
    html.match(/<[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  if (itemprop) {
    const curMatch =
      html.match(/<[^>]*itemprop=["']priceCurrency["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<[^>]*content=["']([^"']+)["'][^>]*itemprop=["']priceCurrency["']/i);
    return { price: itemprop[1], currency: curMatch ? curMatch[1] : null };
  }

  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );

  // Symbol before the number ("€19,90", "CHF 760.00") or after it ("19,90 €").
  const symbols = '€|\\$|£|¥|₹|₺|₽|₪|฿|₩|₱|₫|zł|Kč|CHF|Fr\\.|SEK|NOK|DKK|USD|EUR|GBP';
  const amount = '\\d{1,3}(?:[.,\\s]\\d{3})*(?:[.,]\\d{2})?|\\d+(?:[.,]\\d{2})?';
  const patterns = [
    new RegExp(`(${symbols})\\s?(${amount})`, 'i'),
    new RegExp(`(${amount})\\s?(${symbols})`, 'i'),
  ];

  for (const [i, re] of patterns.entries()) {
    const m = text.match(re);
    if (!m) continue;
    const [sym, raw] = i === 0 ? [m[1], m[2]] : [m[2], m[1]];
    const cleaned = sanitizeAmount(raw);
    // A bare "1" or "12" next to a symbol is far more often a rating, a
    // shipping blurb or a size than a price. Require something price-shaped.
    if (cleaned && Number(cleaned) >= 1) return { price: cleaned, currency: sym };
  }
  return null;
}

// Keep this from being usable to probe the platform's internal network.
function isPubliclyRoutable(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return false;
  if (/^(127\.|10\.|169\.254\.|192\.168\.|0\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === '::1' || host === '[::1]') return false;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // Writes are owner-only, so scraping is too. The anon key is a valid JWT
    // but carries no `sub`, so getUser rejects it — exactly what we want.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const raw = (body?.url ? String(body.url).trim() : '');
    if (!raw) return json({ error: 'URL is required' }, 400);

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return json({ error: 'Invalid URL' }, 400);
    }
    if (!isPubliclyRoutable(parsed)) return json({ error: 'That URL is not reachable.' }, 400);
    const validUrl = parsed.href;

    const fetchResponse = await fetch(validUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    const contentType = fetchResponse.headers.get('content-type') || '';
    if (!/text\/|xml|html/.test(contentType)) {
      return json({ title: validUrl, description: '', image_url: '', price: '', source_url: validUrl });
    }
    const html = await fetchResponse.text();

    const ogTitle = getMeta(html, 'og:title');
    const twitterTitle = getMeta(html, 'twitter:title');
    const docTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = ogTitle || twitterTitle || (docTitleMatch ? decodeHtml(docTitleMatch[1]).trim() : validUrl);

    const description =
      getMeta(html, 'og:description') ||
      getMeta(html, 'twitter:description') ||
      getMeta(html, 'description') ||
      '';

    // Some shops (e.g. behind Cloudflare) return a bot-challenge page to
    // server-side fetches. Detect that and bail out instead of saving a
    // junk item titled "Access Denied".
    const blockedStatus = fetchResponse.status === 403 || fetchResponse.status === 429;
    const headSnippet = html.slice(0, 6000);
    const challenge = /Access Denied|Just a moment|Attention Required|Enable JavaScript and cookies|Checking your browser/i;
    if (blockedStatus || /cf-challenge|cdn-cgi\/challenge/i.test(headSnippet) || challenge.test(headSnippet) || challenge.test(title)) {
      return json(
        { error: "This site blocks automated access, so we couldn't read the page. Try another link." },
        422
      );
    }

    const image = absoluteUrl(
      getMeta(html, 'og:image') ||
        getMeta(html, 'og:image:secure_url') ||
        getMeta(html, 'twitter:image') ||
        getMeta(html, 'twitter:image:src'),
      validUrl
    );

    // --- Price + currency ---
    const localeCurrency = inferLocaleCurrency(validUrl);
    let amount: string | null = null;
    let pageCurrency: string | null = null; // currency from the page (base currency)

    const jsonLd = extractJsonLdPrice(html);
    if (jsonLd) {
      amount = sanitizeAmount(jsonLd.price);
      pageCurrency = jsonLd.currency;
    }

    if (!amount) {
      const ogAmt = getMeta(html, 'og:price:amount');
      if (ogAmt) {
        amount = sanitizeAmount(ogAmt);
        pageCurrency = pageCurrency || getMeta(html, 'og:price:currency');
      }
    }

    if (!amount) {
      const guess = extractPriceHeuristic(html);
      if (guess) {
        amount = sanitizeAmount(guess.price);
        pageCurrency = pageCurrency || guess.currency;
      }
    }

    // The currency the buyer sees (from the URL locale) takes priority over the
    // store's base currency baked into the server HTML.
    const finalCurrency = localeCurrency || pageCurrency;
    let price = '';
    if (amount && finalCurrency) price = formatPrice(amount, finalCurrency);
    else if (amount) price = amount;

    return json({
      title: title || validUrl,
      description: description || '',
      image_url: image || '',
      price,
      source_url: validUrl,
    });
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
