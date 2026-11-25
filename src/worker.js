import { jsonResponse } from './utils.js';
import { handleStatus } from './handlers/status.js';
import { handleAuth } from './handlers/auth.js';
import {
  handleGetWhatsAppSettings,
  handleSaveWhatsAppSettings,
  handleGetTranslations,
  handleSaveTranslations
} from './handlers/settings.js';
import { handleGetArticles, handleSaveArticles, handlePublishArticle } from './handlers/articles.js';
import { handleAiSeo } from './handlers/ai-seo.js';

const ROUTES = {
  'GET /api/status': handleStatus,
  'GET /api/auth': handleAuth,
  'POST /api/auth': handleAuth,
  'GET /api/whatsapp-settings': handleGetWhatsAppSettings,
  'POST /api/save-whatsapp-settings': handleSaveWhatsAppSettings,
  'GET /api/translations': handleGetTranslations,
  'POST /api/save-translations': handleSaveTranslations,
  'GET /api/articles': handleGetArticles,
  'POST /api/articles': handleSaveArticles,
  'POST /api/publish-article': handlePublishArticle,
  'POST /api/ai-seo': handleAiSeo
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const key = `${request.method.toUpperCase()} ${url.pathname}`;
      const handler = ROUTES[key];
      if (!handler) {
        return jsonResponse({ ok: false, error: 'API endpoint not found.' }, 404);
      }
      return handler({ request, env, ctx });
    }

    if (env && env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response('Static assets binding not configured.', { status: 500 });
  }
};
