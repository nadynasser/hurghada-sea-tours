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

function withSecurityHeaders(response) {
  if (!response) return response;

  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  const ct = headers.get('Content-Type');
  if (ct && ct.includes('text/html') && !ct.includes('charset')) {
    headers.set('Content-Type', `${ct}; charset=utf-8`);
  }

  const status = response.status;
  const isNoBody = status === 204 || status === 205 || status === 304;
  return new Response(isNoBody ? null : response.body, {
    status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx) {
    const response = await this.handleRequest(request, env, ctx);
    return withSecurityHeaders(response);
  },

  async handleRequest(request, env, ctx) {
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
