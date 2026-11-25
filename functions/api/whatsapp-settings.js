import { jsonResponse } from '../_shared/utils.js';

/**
 * Serves live WhatsApp routing settings stored in Cloudflare KV for public site visitors.
 * Gracefully reports source='static' when KV has not been written yet.
 */
export async function onRequestGet(context) {
  const { env } = context;
  if (!env || !env.HST_KV) {
    return jsonResponse({ ok: true, source: 'static', settings: null });
  }

  try {
    const settings = await env.HST_KV.get('whatsapp_settings', 'json');
    if (!settings) {
      return jsonResponse({ ok: true, source: 'static', settings: null });
    }
    return jsonResponse({ ok: true, source: 'kv', settings });
  } catch (err) {
    return jsonResponse({ ok: false, source: 'static', error: err.message }, 500);
  }
}
