import { jsonResponse, requireAuth, requireKv } from '../_shared/utils.js';

/**
 * Loads all articles (drafts + published) synced in Cloudflare KV.
 */
export async function onRequestGet(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const kvCheck = requireKv(context);
  if (!kvCheck.ok) return kvCheck.response;

  try {
    const articles = await kvCheck.kv.get('articles', 'json');
    if (!Array.isArray(articles)) {
      return jsonResponse({ ok: true, source: 'static', articles: null });
    }
    return jsonResponse({ ok: true, source: 'kv', articles });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

/**
 * Syncs dashboard articles array (including drafts and AEO/GEO metadata) to Cloudflare KV.
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const kvCheck = requireKv(context);
  if (!kvCheck.ok) return kvCheck.response;

  let articles;
  try {
    articles = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  if (!Array.isArray(articles)) {
    return jsonResponse({ ok: false, error: 'Expected an array of articles.' }, 400);
  }

  await kvCheck.kv.put('articles', JSON.stringify(articles));
  return jsonResponse({
    ok: true,
    status: 'success',
    source: 'kv',
    count: articles.length
  });
}
