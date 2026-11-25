import {
  clearSessionCookieHeader,
  constantTimeEqual,
  createSessionCookieHeader,
  jsonResponse,
  verifySession
} from '../utils.js';

export async function handleAuth(context) {
  const { request, env } = context;

  if (request.method.toUpperCase() === 'GET') {
    const session = await verifySession(request, env);
    return jsonResponse({
      ok: true,
      authConfigured: Boolean(env && env.ADMIN_PASSWORD),
      authenticated: Boolean(session),
      user: session ? session.u : null
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON request.' }, 400);
  }

  if (body && body.action === 'logout') {
    return jsonResponse(
      { ok: true, authenticated: false },
      200,
      { 'Set-Cookie': clearSessionCookieHeader(request) }
    );
  }

  if (!env || !env.ADMIN_PASSWORD) {
    return jsonResponse(
      {
        ok: false,
        configured: false,
        error: 'ADMIN_PASSWORD is not configured in Cloudflare Worker Variables and Secrets.'
      },
      503
    );
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const remember = Boolean(body.remember);

  if (!username || !password) {
    return jsonResponse({ ok: false, error: 'Username and password are required.' }, 400);
  }

  let authorized = false;
  if (username === 'nadynasser') {
    authorized = await constantTimeEqual(password, env.ADMIN_PASSWORD);
  } else if (username === 'admin') {
    const staffPass = env.STAFF_PASSWORD || env.ADMIN_PASSWORD;
    authorized = await constantTimeEqual(password, staffPass);
  } else if (env.EXTRA_USERS_JSON) {
    try {
      const extraMap = JSON.parse(env.EXTRA_USERS_JSON);
      if (extraMap && Object.prototype.hasOwnProperty.call(extraMap, username)) {
        authorized = await constantTimeEqual(password, String(extraMap[username]));
      }
    } catch {
      // Ignore malformed optional map
    }
  }

  if (!authorized) {
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401);
  }

  const ttlSeconds = remember ? 60 * 60 * 24 * 7 : 60 * 60 * 12;
  const setCookie = await createSessionCookieHeader(username, ttlSeconds, env, request);

  return jsonResponse(
    { ok: true, authenticated: true, user: username },
    200,
    { 'Set-Cookie': setCookie }
  );
}
