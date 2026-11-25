import { DEFAULT_REPO, jsonResponse, verifySession } from '../utils.js';

export async function handleStatus(context) {
  const { request, env } = context;
  const session = await verifySession(request, env);

  return jsonResponse({
    ok: true,
    cloudKv: Boolean(env && env.HST_KV),
    authConfigured: Boolean(env && env.ADMIN_PASSWORD),
    githubPublish: Boolean(env && env.GITHUB_TOKEN),
    aiSeo: Boolean(env && env.GEMINI_API_KEY),
    repo: (env && env.GITHUB_REPO) || DEFAULT_REPO,
    loggedInUser: session ? session.u : null
  });
}
