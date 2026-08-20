import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function decodeHtml(str) {
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

function getMeta(html, prop) {
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

function absoluteUrl(url, base) {
  if (!url) return null;
  try {
    return new URL(url, base).href;
  } catch (e) {
    return url;
  }
}

// Country / region code -> ISO currency. Used to read the currency the buyer
// actually sees from the locale segment of the URL (e.g. /de-ch/ -> CHF),
// which is the only reliable signal for multi-currency shops whose server
// HTML is rendered in the store's base currency.
const COUNTRY_CURRENCY = {
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

function inferLocaleCurrency(url) {
  try {
    const u = new URL(url);
    const segs = u.pathname.split('/').filter(Boolean);
    for (const s of segs) {
      const m = s.toLowerCase().match(/^[a-z]{2}[-_]([a-z]{2,3})$/);
      if (m) {
        const cc = m[1];
        if (COUNTRY_CURRENCY[cc]) return COUNTRY_CURRENCY[cc];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

const CURRENCY_SYMBOLS = {
  EUR: '€', USD: '$', GBP: '£', JPY: '¥', CHF: 'CHF',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč', HUF: 'Ft',
  RON: 'lei', CAD: 'C$', AUD: 'A$', NZD: 'NZ$', INR: '₹', CNY: '¥',
  RUB: '₽', BRL: 'R$', MXN: 'MX$', ZAR: 'R', SGD: 'S$', HKD: 'HK$',
  TRY: '₺', AED: 'AED', SAR: 'SAR', ILS: '₪', THB: '฿', KRW: '₩',
  TWD: 'NT$', IDR: 'Rp', MYR: 'RM', PHP: '₱', VND: '₫', BGN: 'лв',
};

// Turn a raw price string ("1,290.00", "7,90", "1290") into a plain numeric
// string ("1290.00", "7.90", "1290") that Number() can parse.
function sanitizeAmount(raw) {
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

function formatPrice(amount, currency) {
  const cur = String(currency || '').toUpperCase();
  const sym = CURRENCY_SYMBOLS[cur] || currency || '';
  const num = Number(amount);
  if (!isFinite(num)) {
    return sym ? `${sym} ${amount}`.trim() : String(amount);
  }
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
function extractJsonLdPrice(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      const obj = JSON.parse(raw);
      const candidates = Array.isArray(obj) ? obj : [obj];
      for (const c of candidates) {
        const nodes = c && c['@graph'] && Array.isArray(c['@graph']) ? c['@graph'] : [c];
        for (const n of nodes) {
          if (!n) continue;
          const offers = n.offers;
          if (!offers) continue;
          const offerList = Array.isArray(offers) ? offers : [offers];
          for (const o of offerList) {
            if (!o) continue;
            const p = o.price !== undefined ? o.price : (o.lowPrice !== undefined ? o.lowPrice : o.highPrice);
            const cur = o.priceCurrency || o.currency;
            if (p !== undefined && p !== null) {
              return { price: String(p), currency: cur ? String(cur) : null };
            }
          }
        }
      }
    } catch (e) {
      // malformed JSON-LD — skip this block
    }
  }
  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const url = (body && body.url && String(body.url).trim()) || '';
    if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

    let validUrl;
    try {
      validUrl = new URL(url).href;
    } catch (e) {
      return Response.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const fetchResponse = await fetch(validUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    const contentType = fetchResponse.headers.get('content-type') || '';
    let html = '';
    if (contentType.includes('text/') || contentType.includes('xml') || contentType.includes('html')) {
      html = await fetchResponse.text();
    } else {
      return Response.json({
        title: validUrl,
        description: '',
        image_url: '',
        price: '',
        source_url: validUrl,
      });
    }

    const ogTitle = getMeta(html, 'og:title');
    const twitterTitle = getMeta(html, 'twitter:title');
    const docTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title =
      ogTitle || twitterTitle || (docTitleMatch ? decodeHtml(docTitleMatch[1]).trim() : validUrl);

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
    const blockedContent =
      /cf-challenge|cdn-cgi\/challenge|<title[^>]*>\s*(Access Denied|Just a moment|Attention Required|Enable JavaScript and cookies|Checking your browser)/i.test(
        headSnippet
      ) ||
      /Access Denied|Just a moment|Attention Required|Enable JavaScript and cookies|Checking your browser/i.test(
        title
      );
    if (blockedStatus || blockedContent) {
      return Response.json(
        { error: "This site blocks automated access, so we couldn't read the page. Try another link." },
        { status: 422 }
      );
    }

    const rawImage =
      getMeta(html, 'og:image') ||
      getMeta(html, 'og:image:secure_url') ||
      getMeta(html, 'twitter:image') ||
      getMeta(html, 'twitter:image:src') ||
      null;
    const image = absoluteUrl(rawImage, validUrl);

    // --- Price + currency ---
    const localeCurrency = inferLocaleCurrency(validUrl);

    let amount = null; // numeric string
    let pageCurrency = null; // currency code/symbol from the page (base currency)

    const jsonLd = extractJsonLdPrice(html);
    if (jsonLd) {
      amount = sanitizeAmount(jsonLd.price);
      pageCurrency = jsonLd.currency;
    }

    if (!amount) {
      const ogAmt = getMeta(html, 'og:price:amount');
      const ogCur = getMeta(html, 'og:price:currency');
      if (ogAmt) {
        amount = sanitizeAmount(ogAmt);
        if (!pageCurrency) pageCurrency = ogCur;
      }
    }

    if (!amount) {
      // LLM fallback — ask for the numeric price and the currency as displayed.
      try {
        const snippet = html.slice(0, 20000);
        const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt:
            'From the following HTML page snippet, extract the product price as displayed on the page. ' +
            'Return ONLY a JSON object with two string fields: ' +
            '"amount" = the numeric price with no currency symbol (e.g. "19.90", "1290.00"), and ' +
            '"currency" = the currency exactly as shown on the page (e.g. "€", "CHF", "Fr.", "$", "USD"). ' +
            'Preserve the currency the page actually shows — do NOT default to USD or a dollar sign. ' +
            'If you cannot find a clear product price, return {"amount":"","currency":""}. No explanation.\n\nHTML:\n' +
            snippet,
          response_json_schema: {
            type: 'object',
            properties: {
              amount: { type: 'string' },
              currency: { type: 'string' },
            },
            required: ['amount', 'currency'],
          },
        });
        if (llmRes) {
          amount = sanitizeAmount(llmRes.amount);
          if (!pageCurrency && llmRes.currency) pageCurrency = String(llmRes.currency).trim();
        }
      } catch (e) {
        // ignore
      }
    }

    // The currency the buyer sees (from the URL locale) takes priority over the
    // store's base currency baked into the server HTML.
    const finalCurrency = localeCurrency || pageCurrency;
    let price = '';
    if (amount && finalCurrency) {
      price = formatPrice(amount, finalCurrency);
    } else if (amount) {
      price = amount;
    }

    return Response.json({
      title: title || validUrl,
      description: description || '',
      image_url: image || '',
      price: price,
      source_url: validUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}