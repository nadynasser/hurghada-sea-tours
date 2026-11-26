import {
  clearSessionCookieHeader,
  constantTimeEqual,
  createSessionCookieHeader,
  jsonResponse,
  verifySession
} from '../utils.js';

function getClientIp(request) {
  return request.headers.get('cf-connecting-ip') ||
         request.headers.get('x-real-ip') ||
         (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
         'unknown_client';
}

export async function handleAuth(context) {
  const { request, env } = context;

  if (request.method.toUpperCase() === 'GET') {
    const session = await verifySession(request, env);
    return jsonResponse({
      ok: true,
      authConfigured: Boolean(env && env.ADMIN_PASSWORD),
      authenticated: Boolean(session),
      user: session ? session.u : null,
      role: session ? session.r : null
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

  const clientIp = getClientIp(request);
  const rateLimitKey = `rate_auth_${clientIp.replace(/[^a-zA-Z0-9_.-]/g, '_')}`;

  // Check Brute-Force lockout if KV is bound
  if (env && env.HST_KV) {
    try {
      const lockData = await env.HST_KV.get(rateLimitKey, 'json');
      if (lockData && lockData.lockedUntil && Date.now() < lockData.lockedUntil) {
        const waitSec = Math.ceil((lockData.lockedUntil - Date.now()) / 1000);
        return jsonResponse({
          ok: false,
          locked: true,
          error: `تم إيقاف محاولات الدخول مؤقتاً لحماية الحساب من التخمين. يرجى الانتظار ${waitSec} ثانية.`
        }, 429);
      }
    } catch (_) {}
  }

  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const remember = Boolean(body.remember);

  if (!username || !password) {
    return jsonResponse({ ok: false, error: 'Username and password are required.' }, 400);
  }

  let authorized = false;
  let assignedRole = 'support';

  // Strict username-to-role binding: No anonymous roles
  if (username === 'nadynasser') {
    authorized = await constantTimeEqual(password, env.ADMIN_PASSWORD);
    assignedRole = 'super_admin';
  } else if (username === 'admin') {
    const staffPass = env.STAFF_PASSWORD || env.ADMIN_PASSWORD;
    authorized = await constantTimeEqual(password, staffPass);
    assignedRole = 'operations';
  } else if (env.EXTRA_USERS_JSON) {
    try {
      const extraMap = JSON.parse(env.EXTRA_USERS_JSON);
      if (extraMap && Object.prototype.hasOwnProperty.call(extraMap, username)) {
        const userConfig = extraMap[username];
        if (typeof userConfig === 'object' && userConfig !== null) {
          authorized = await constantTimeEqual(password, String(userConfig.password || ''));
          assignedRole = userConfig.role === 'operations' ? 'operations' : 'support';
        } else {
          authorized = await constantTimeEqual(password, String(userConfig));
          assignedRole = 'support';
        }
      }
    } catch {
      // Ignore malformed optional map
    }
  }

  if (!authorized) {
    // Record failed attempt for rate limiting
    if (env && env.HST_KV) {
      try {
        const prev = (await env.HST_KV.get(rateLimitKey, 'json')) || { attempts: 0 };
        const attempts = (prev.attempts || 0) + 1;
        if (attempts >= 5) {
          // Lock for 15 minutes (900s)
          await env.HST_KV.put(
            rateLimitKey,
            JSON.stringify({ attempts, lockedUntil: Date.now() + 15 * 60 * 1000 }),
            { expirationTtl: 900 }
          );
        } else {
          await env.HST_KV.put(
            rateLimitKey,
            JSON.stringify({ attempts, lockedUntil: 0 }),
            { expirationTtl: 900 }
          );
        }
      } catch (_) {}
    }
    return jsonResponse({ ok: false, error: 'Invalid username or password.' }, 401);
  }

  // Clear failed attempts upon successful login
  if (env && env.HST_KV) {
    try {
      await env.HST_KV.delete(rateLimitKey);
    } catch (_) {}
  }

  const ttlSeconds = remember ? 60 * 60 * 24 * 7 : 60 * 60 * 12;
  const setCookie = await createSessionCookieHeader(username, assignedRole, ttlSeconds, env, request);

  return jsonResponse(
    { ok: true, authenticated: true, user: username, role: assignedRole },
    200,
    { 'Set-Cookie': setCookie }
  );
}
