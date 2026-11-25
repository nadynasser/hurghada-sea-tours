import { jsonResponse, requireAuth, requireKv } from '../_shared/utils.js';

/**
 * Saves multi-language website copy translations into Cloudflare KV.
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const kvCheck = requireKv(context);
  if (!kvCheck.ok) return kvCheck.response;

  let translations;
  try {
    translations = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    return jsonResponse({ ok: false, error: 'Invalid translations object.' }, 400);
  }

  await kvCheck.kv.put('translations', JSON.stringify(translations));
  return jsonResponse({ ok: true, status: 'success', source: 'kv' });
}
