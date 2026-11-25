import { jsonResponse, requireAuth } from '../utils.js';

const SEO_ARTICLE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Compelling H1 article headline.' },
    slug: { type: 'string', description: 'Short lowercase hyphenated URL slug.' },
    excerpt: { type: 'string', description: 'Concise 1-2 sentence article summary.' },
    seoTitle: { type: 'string', description: 'Google title tag (50-60 characters including Hurghada).' },
    metaDesc: { type: 'string', description: 'Google meta description (140-155 characters with booking CTA).' },
    keywords: { type: 'string', description: '5-8 comma-separated SEO focus keywords.' },
    coverAlt: { type: 'string', description: 'Descriptive image alt text with Hurghada Red Sea context.' },
    geoArea: {
      type: 'string',
      enum: [
        'Shaab El Erg & Giftun National Park',
        'Orange Bay Beach, Giftun Island',
        'Hula Hula Beach, Giftun Island',
        'Hurghada Coastal Reefs & Islands',
        'Makadi Bay & Sahl Hasheesh',
        'El Gouna Red Sea Lagoons'
      ]
    },
    relatedTrips: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['orange-bay', 'hula-hula', 'dolphin-house', 'coral-reef', 'semi-submarine']
      }
    },
    takeaways: {
      type: 'array',
      items: { type: 'string' },
      description: '4 concise factual AEO summary bullets suitable for AI Overviews.'
    },
    faqs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          a: { type: 'string' }
        },
        required: ['q', 'a']
      }
    },
    content: {
      type: 'string',
      description: 'Full Markdown article with direct answer intro, ## H2 headings, tips, and 1-2 :::trip-cta shortcodes.'
    }
  },
  required: [
    'title', 'slug', 'excerpt', 'seoTitle', 'metaDesc',
    'keywords', 'coverAlt', 'geoArea', 'relatedTrips', 'takeaways', 'faqs', 'content'
  ]
};

export async function handleAiSeo(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  if (!env || !env.GEMINI_API_KEY) {
    return jsonResponse(
      {
        ok: false,
        configured: false,
        error: 'GEMINI_API_KEY is not set in Cloudflare Worker Variables and Secrets.'
      },
      503
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  const topic = String((body && body.topic) || '').trim();
  const category = String((body && body.category) || 'Guides').trim();
  const lang = String((body && body.lang) || 'en').trim();

  if (!topic) {
    return jsonResponse({ ok: false, error: 'Please provide an article topic or keyword.' }, 400);
  }

  const langLabel = {
    en: 'English',
    ar: 'Arabic',
    de: 'German',
    ru: 'Russian',
    pl: 'Polish'
  }[lang] || 'English';

  const prompt = [
    `You are an expert SEO, GEO (Local Search), and AEO (Answer Engine Optimization) marine tourism strategist for Hurghada Sea Tours (hurghadaseatours.com).`,
    `Write a high-converting ${langLabel} article draft about: "${topic}" (Category: ${category}).`,
    `Always keep the slug in lowercase English kebab-case.`,
    `Available excursions to reference naturally using :::trip-cta id="TOUR_ID"\\n::: blocks (and in relatedTrips):`,
    `- orange-bay (€30, Orange Bay Island on Giftun Island, 2h white sand beach + 2 snorkeling stops)`,
    `- hula-hula (€32, Hula Hula Island cruise, island time first then 2 snorkeling stops + banana boat/water games)`,
    `- dolphin-house (€25, Shaab El Erg wild dolphin sanctuary + 2 snorkeling stops + water sports)`,
    `- coral-reef (€35, Living Coral Reef small-group snorkeling & marine sanctuary)`,
    `- semi-submarine (€20, Panoramic underwater coral viewing at 3m depth, ideal for families & non-swimmers)`,
    `All tours include free air-conditioned Hurghada hotel pickup and pay on arrival.`,
    `Structure content with: a direct answer in the first 50 words, clear ## H2 question headings, practical local Red Sea captain tips, and 1-2 embedded :::trip-cta shortcodes.`
  ].join('\n');

  try {
    const model = env.GEMINI_MODEL || 'gemini-4-hydrogen';
    const apiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GEMINI_API_KEY,
        'Api-Revision': '2026-05-20'
      },
      body: JSON.stringify({
        model,
        input: prompt,
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: SEO_ARTICLE_SCHEMA
        }
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return jsonResponse({ ok: false, error: `Gemini API error (${apiRes.status}): ${errText}` }, apiRes.status);
    }

    const data = await apiRes.json();
    let jsonText = '';
    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (step.type === 'model_output' && Array.isArray(step.content)) {
          const txtPart = step.content.find(c => c.type === 'text' && c.text);
          if (txtPart) {
            jsonText = txtPart.text;
            break;
          }
        }
      }
    }

    if (!jsonText) {
      return jsonResponse({ ok: false, error: 'Gemini returned an empty response.' }, 502);
    }

    const generated = JSON.parse(jsonText);
    return jsonResponse({ ok: true, model, generated });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
