/**
 * Shared utilities for Hurghada Sea Tours Cloudflare Worker
 * Handles auth session cookies, KV helpers, and atomic GitHub Data API commits.
 */

export const DEFAULT_REPO = 'nadynasser/hurghada-sea-tours';
export const DEFAULT_BRANCH = 'main';
export const SESSION_COOKIE_NAME = 'hst_session';

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function safeSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
}

export function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(String(str || ''));
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToUtf8(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function toBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function constantTimeEqual(a, b) {
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a || ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b || '')))
  ]);
  const bytesA = new Uint8Array(hashA);
  const bytesB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const pairs = header.split(';');
  for (const part of pairs) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function createSessionCookieHeader(username, ttlSeconds, env, request) {
  const secret = env.SESSION_SECRET || env.ADMIN_PASSWORD;
  const payloadBytes = new TextEncoder().encode(
    JSON.stringify({ u: username, exp: Date.now() + ttlSeconds * 1000 })
  );
  const payloadPart = toBase64Url(payloadBytes);
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadPart));
  const token = `${payloadPart}.${toBase64Url(new Uint8Array(sig))}`;

  const isHttps = new URL(request.url).protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttlSeconds}${secureFlag}`;
}

export function clearSessionCookieHeader(request) {
  const isHttps = new URL(request.url).protocol === 'https:';
  const secureFlag = isHttps ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

export async function verifySession(request, env) {
  const secret = env && (env.SESSION_SECRET || env.ADMIN_PASSWORD);
  if (!secret) return null;

  const token = getCookie(request, SESSION_COOKIE_NAME);
  if (!token || !token.includes('.')) return null;

  const [payloadPart, sigPart] = token.split('.');
  if (!payloadPart || !sigPart) return null;

  try {
    const key = await getHmacKey(secret);
    const sigBytes = fromBase64Url(sigPart);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(payloadPart)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)));
    if (!payload || !payload.u || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function requireAuth(context) {
  const { request, env } = context;
  if (!env || !env.ADMIN_PASSWORD) {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          configured: false,
          error: 'ADMIN_PASSWORD is not set in Cloudflare Worker Settings -> Variables and Secrets.'
        },
        503
      )
    };
  }

  const session = await verifySession(request, env);
  if (!session) {
    return {
      ok: false,
      response: jsonResponse({ ok: false, error: 'Unauthorized. Please log in.' }, 401)
    };
  }
  return { ok: true, user: session.u };
}

async function githubFetch(env, path, init = {}) {
  const token = env && env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is not set in Cloudflare Worker Variables and Secrets.');
  }
  const repo = (env && env.GITHUB_REPO) || DEFAULT_REPO;
  return fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'HurghadaSeaTours-CloudflareWorker/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers || {})
    }
  });
}

export async function githubGetTextFile(env, filePath) {
  const branch = (env && env.GITHUB_BRANCH) || DEFAULT_BRANCH;
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const res = await githubFetch(env, `/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub read failed (${res.status}) for ${filePath}: ${errText}`);
  }
  const data = await res.json();
  return {
    sha: data.sha,
    content: base64ToUtf8(data.content)
  };
}

export async function commitGitHubFiles(env, { message, files }) {
  const branch = (env && env.GITHUB_BRANCH) || DEFAULT_BRANCH;

  const refRes = await githubFetch(env, `/git/ref/heads/${encodeURIComponent(branch)}`);
  if (!refRes.ok) {
    throw new Error(`GitHub ref lookup failed (${refRes.status}): ${await refRes.text()}`);
  }
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  const commitRes = await githubFetch(env, `/git/commits/${latestCommitSha}`);
  if (!commitRes.ok) {
    throw new Error(`GitHub commit lookup failed (${commitRes.status}): ${await commitRes.text()}`);
  }
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  const treeEntries = [];
  for (const file of files) {
    const b64Content = file.encoding === 'base64' ? file.content : utf8ToBase64(file.content);
    const blobRes = await githubFetch(env, '/git/blobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: b64Content, encoding: 'base64' })
    });
    if (!blobRes.ok) {
      throw new Error(`GitHub blob failed (${blobRes.status}) for ${file.path}: ${await blobRes.text()}`);
    }
    const blobData = await blobRes.json();
    treeEntries.push({
      path: file.path,
      mode: '100644',
      type: 'blob',
      sha: blobData.sha
    });
  }

  const treeRes = await githubFetch(env, '/git/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries })
  });
  if (!treeRes.ok) {
    throw new Error(`GitHub tree creation failed (${treeRes.status}): ${await treeRes.text()}`);
  }
  const treeData = await treeRes.json();

  const newCommitRes = await githubFetch(env, '/git/commits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeData.sha,
      parents: [latestCommitSha]
    })
  });
  if (!newCommitRes.ok) {
    throw new Error(`GitHub commit creation failed (${newCommitRes.status}): ${await newCommitRes.text()}`);
  }
  const newCommitData = await newCommitRes.json();

  const patchRes = await githubFetch(env, `/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: newCommitData.sha })
  });
  if (!patchRes.ok) {
    throw new Error(`GitHub ref update failed (${patchRes.status}): ${await patchRes.text()}`);
  }

  return newCommitData.sha;
}
