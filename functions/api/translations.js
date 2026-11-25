import { jsonResponse } from '../_shared/utils.js';

/**
 * Serves live website copy translations stored in Cloudflare KV (when saved from dashboard).
 */
export async function onRequestGet(context) {
  const { env } = context;
  if (!env || !env.HST_KV) {
    return jsonResponse({ ok: true, source: 'static', translations: null });
  }

  try {
    const translations = await env.HST_KV.get('translations', 'json');
    if (!translations) {
      return jsonResponse({ ok: true, source: 'static', translations: null });
    }
    return jsonResponse({ ok: true, source: 'kv', translations });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
