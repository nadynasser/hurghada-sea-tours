import { jsonResponse, requireAuth, requireKv } from '../_shared/utils.js';

/**
 * Persists WhatsApp numbers, routing rules, and templates into Cloudflare KV.
 */
export async function onRequestPost(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const kvCheck = requireKv(context);
  if (!kvCheck.ok) return kvCheck.response;

  let settings;
  try {
    settings = await context.request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  if (!settings || !Array.isArray(settings.numbers) || settings.numbers.length === 0) {
    return jsonResponse({ ok: false, error: 'Settings must include a non-empty numbers list.' }, 400);
  }

  const normalized = {
    ...settings,
    version: Math.max(Number(settings.version || 2), 2),
    updatedAt: new Date().toISOString(),
    updatedBy: auth.user
  };

  await kvCheck.kv.put('whatsapp_settings', JSON.stringify(normalized));

  return jsonResponse({
    ok: true,
    status: 'success',
    source: 'kv',
    updatedAt: normalized.updatedAt
  });
}
