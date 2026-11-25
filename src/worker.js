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

const CANONICAL_HOST = 'hurghadaseatours.com';
const DIRECTORY_SLASH_PATHS = new Set(['/de', '/ru', '/pl', '/ar', '/articles']);

function getCanonicalRedirectUrl(requestUrl) {
  const lowerHost = requestUrl.hostname.toLowerCase();
  const isWww = lowerHost === `www.${CANONICAL_HOST}`;
  let targetPath = requestUrl.pathname;
  let pathChanged = false;

  if (targetPath === '/index.html') {
    targetPath = '/';
    pathChanged = true;
  } else if (targetPath.endsWith('/index.html')) {
    targetPath = targetPath.slice(0, -'index.html'.length);
    pathChanged = true;
  } else if (targetPath.endsWith('.html')) {
    targetPath = targetPath.slice(0, -'.html'.length);
    pathChanged = true;
  } else if (DIRECTORY_SLASH_PATHS.has(targetPath)) {
    targetPath = `${targetPath}/`;
    pathChanged = true;
  }

  if (!isWww && !pathChanged) {
    return null;
  }

  const targetOrigin = isWww ? `https://${CANONICAL_HOST}` : requestUrl.origin;
  return `${targetOrigin}${targetPath}${requestUrl.search}`;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'GET' || method === 'HEAD') {
      const redirectTarget = getCanonicalRedirectUrl(url);
      if (redirectTarget) {
        return new Response(null, {
          status: 301,
          headers: {
            Location: redirectTarget,
            'Cache-Control': 'public, max-age=3600'
          }
        });
      }
    }

    if (url.pathname.startsWith('/api/')) {
      const key = `${method} ${url.pathname}`;
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
