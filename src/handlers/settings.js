import { commitGitHubFiles, jsonResponse, requireAuth } from '../utils.js';

export async function handleGetWhatsAppSettings(context) {
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

export async function handleSaveWhatsAppSettings(context) {
  const auth = await requireAuth(context, ['super_admin', 'operations']);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  let settings;
  try {
    settings = await request.json();
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
  const serialized = JSON.stringify(normalized, null, 2);

  if (env && env.HST_KV) {
    await env.HST_KV.put('whatsapp_settings', serialized);
    return jsonResponse({ ok: true, status: 'success', source: 'kv', updatedAt: normalized.updatedAt });
  }

  if (env && env.GITHUB_TOKEN) {
    const commitSha = await commitGitHubFiles(env, {
      message: 'chore(whatsapp): update WhatsApp routing settings via dashboard',
      files: [{ path: 'assets/data/whatsapp-settings.json', content: serialized, encoding: 'utf-8' }]
    });
    return jsonResponse({ ok: true, status: 'success', source: 'github', commitSha, updatedAt: normalized.updatedAt });
  }

  return jsonResponse({
    ok: false,
    configured: false,
    error: 'Configure HST_KV binding or GITHUB_TOKEN in Cloudflare Worker settings.'
  }, 503);
}

export async function handleGetTranslations(context) {
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

export async function handleSaveTranslations(context) {
  const auth = await requireAuth(context, ['super_admin', 'operations']);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  let translations;
  try {
    translations = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    return jsonResponse({ ok: false, error: 'Invalid translations object.' }, 400);
  }

  const serialized = JSON.stringify(translations, null, 2);

  if (env && env.HST_KV) {
    await env.HST_KV.put('translations', serialized);
    return jsonResponse({ ok: true, status: 'success', source: 'kv' });
  }

  if (env && env.GITHUB_TOKEN) {
    const commitSha = await commitGitHubFiles(env, {
      message: 'chore(i18n): update translations via dashboard',
      files: [{ path: 'assets/data/translations.json', content: serialized, encoding: 'utf-8' }]
    });
    return jsonResponse({ ok: true, status: 'success', source: 'github', commitSha });
  }

  return jsonResponse({
    ok: false,
    configured: false,
    error: 'Configure HST_KV binding or GITHUB_TOKEN in Cloudflare Worker settings.'
  }, 503);
}
