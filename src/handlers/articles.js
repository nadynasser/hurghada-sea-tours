import {
  commitGitHubFiles,
  escapeHtml,
  githubGetTextFile,
  jsonResponse,
  requireAuth,
  safeSlug
} from '../utils.js';

const SITE_ORIGIN = 'https://hurghadaseatours.com';

export async function handleGetArticles(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const { env } = context;
  if (!env || !env.HST_KV) {
    return jsonResponse({ ok: true, source: 'static', articles: null });
  }

  try {
    const articles = await env.HST_KV.get('articles', 'json');
    if (!Array.isArray(articles)) {
      return jsonResponse({ ok: true, source: 'static', articles: null });
    }
    return jsonResponse({ ok: true, source: 'kv', articles });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

export async function handleSaveArticles(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  let articles;
  try {
    articles = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON payload.' }, 400);
  }

  if (!Array.isArray(articles)) {
    return jsonResponse({ ok: false, error: 'Expected an array of articles.' }, 400);
  }

  if (env && env.HST_KV) {
    await env.HST_KV.put('articles', JSON.stringify(articles));
    return jsonResponse({ ok: true, status: 'success', source: 'kv', count: articles.length });
  }

  return jsonResponse({
    ok: false,
    configured: false,
    error: 'HST_KV binding is not connected yet.'
  }, 503);
}

function upsertArticlesHubCard(hubHtml, article, slug, relativeImgSrc) {
  const en = (article.translations && article.translations.en) || {};
  const title = escapeHtml(en.title || 'Hurghada Sea Guide');
  const excerpt = escapeHtml(en.excerpt || en.metaDesc || '');
  const category = escapeHtml(article.category || 'Guides');
  const readingTime = escapeHtml(article.readingTime || '5 min read');
  const geoArea = escapeHtml((article.geo && article.geo.area) || 'Hurghada, Red Sea');
  const coverAlt = escapeHtml(article.coverAlt || en.title || 'Hurghada Sea Tours');
  const pubDate = article.publishDate ? new Date(article.publishDate) : new Date();
  const dateLabel = Number.isNaN(pubDate.getTime())
    ? 'Nov 2026'
    : pubDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const cardHtml = [
    `      <!-- Article: ${slug} -->`,
    `      <a href="${slug}.html" class="article-card" data-category="${category}">`,
    `        <div class="article-card-cover">`,
    `          <img src="${relativeImgSrc}" alt="${coverAlt}" width="600" height="375" loading="lazy">`,
    `          <span class="article-cat-badge">${category}</span>`,
    `        </div>`,
    `        <div class="article-card-body">`,
    `          <div class="article-meta-row">`,
    `            <span>⏱️ ${readingTime}</span>`,
    `            <span>·</span>`,
    `            <span>📍 ${geoArea}</span>`,
    `            <span>·</span>`,
    `            <span>📅 ${dateLabel}</span>`,
    `          </div>`,
    `          <h2 class="article-card-title">${title}</h2>`,
    `          <p class="article-card-excerpt">${excerpt}</p>`,
    `          <div class="article-card-footer">`,
    `            <span>Read Complete Guide →</span>`,
    `            <span style="color:var(--wa-green);">Bookable Tours Included</span>`,
    `          </div>`,
    `        </div>`,
    `      </a>`
  ].join('\n');

  const existingCardRegex = new RegExp(
    `(?:\\s*<!-- Article(?:: ${slug}| \\d+) -->)?\\s*<a\\s+href="${slug}\\.html"[\\s\\S]*?<\\/a>`,
    'i'
  );
  if (existingCardRegex.test(hubHtml)) {
    return hubHtml.replace(existingCardRegex, `\n\n${cardHtml}`);
  }

  const gridMarker = '<div class="articles-grid" id="articlesGrid">';
  const idx = hubHtml.indexOf(gridMarker);
  if (idx === -1) return hubHtml;

  const insertPos = idx + gridMarker.length;
  return `${hubHtml.slice(0, insertPos)}\n\n${cardHtml}${hubHtml.slice(insertPos)}`;
}

function upsertSitemapUrl(sitemapXml, article, slug, imageAbsoluteUrl) {
  const en = (article.translations && article.translations.en) || {};
  const title = escapeHtml(en.title || slug);
  const lastmod = new Date().toISOString().slice(0, 10);
  const locUrl = `${SITE_ORIGIN}/articles/${slug}.html`;

  const urlBlock = [
    `  <url>`,
    `    <loc>${locUrl}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>monthly</changefreq>`,
    `    <priority>0.85</priority>`,
    `    <image:image>`,
    `      <image:loc>${escapeHtml(imageAbsoluteUrl)}</image:loc>`,
    `      <image:title>${title}</image:title>`,
    `    </image:image>`,
    `  </url>`
  ].join('\n');

  const existingUrlRegex = new RegExp(
    `\\s*<url>\\s*<loc>${locUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/loc>[\\s\\S]*?<\\/url>`,
    'i'
  );
  if (existingUrlRegex.test(sitemapXml)) {
    return sitemapXml.replace(existingUrlRegex, `\n${urlBlock}`);
  }

  return sitemapXml.replace('</urlset>', `${urlBlock}\n\n</urlset>`);
}

function upsertArticlesJson(existingJsonText, publishedArticle) {
  let list = [];
  if (existingJsonText) {
    try {
      const parsed = JSON.parse(existingJsonText);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }

  const idx = list.findIndex(item => item && (item.id === publishedArticle.id || item.slug === publishedArticle.slug));
  if (idx >= 0) {
    list[idx] = publishedArticle;
  } else {
    list.unshift(publishedArticle);
  }
  return JSON.stringify(list, null, 2);
}

export async function handlePublishArticle(context) {
  const auth = await requireAuth(context);
  if (!auth.ok) return auth.response;

  const { request, env } = context;
  if (!env || !env.GITHUB_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        configured: false,
        error: 'GITHUB_TOKEN is not configured in Cloudflare Worker Variables and Secrets.'
      },
      503
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON request.' }, 400);
  }

  const article = payload && payload.article;
  let htmlContent = payload && payload.htmlContent;
  if (!article || typeof htmlContent !== 'string' || !htmlContent.includes('<html')) {
    return jsonResponse({ ok: false, error: 'Missing article data or valid HTML content.' }, 400);
  }

  const slug = safeSlug(article.slug || article.id);
  if (!slug) {
    return jsonResponse({ ok: false, error: 'Invalid article slug. Use lowercase letters, numbers, and hyphens.' }, 400);
  }

  const filesToCommit = [];
  const normalizedArticle = {
    ...article,
    slug,
    status: 'published',
    publishDate: article.publishDate || new Date().toISOString()
  };

  let relativeImgSrc = '../assets/images/tours/tour-snorkeling.jpg';
  let absoluteImgUrl = `${SITE_ORIGIN}/assets/images/tours/tour-snorkeling.jpg`;
  let uploadedImagePath = null;

  const coverRaw = String(article.coverImage || '').trim();
  const dataUriMatch = coverRaw.match(/^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/i);

  if (dataUriMatch) {
    const rawExt = dataUriMatch[1].toLowerCase();
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const base64Data = dataUriMatch[2].replace(/\s+/g, '');
    const repoImagePath = `assets/images/articles/${slug}.${ext}`;

    filesToCommit.push({
      path: repoImagePath,
      content: base64Data,
      encoding: 'base64'
    });

    uploadedImagePath = `/${repoImagePath}`;
    normalizedArticle.coverImage = uploadedImagePath;
    relativeImgSrc = `../${repoImagePath}`;
    absoluteImgUrl = `${SITE_ORIGIN}${uploadedImagePath}`;

    htmlContent = htmlContent
      .replaceAll(coverRaw, relativeImgSrc)
      .replaceAll(`${SITE_ORIGIN}/assets/images/tours/tour-snorkeling.jpg`, absoluteImgUrl);
  } else if (coverRaw) {
    if (/^https?:\/\//i.test(coverRaw)) {
      relativeImgSrc = coverRaw;
      absoluteImgUrl = coverRaw;
    } else {
      const cleanRel = coverRaw.replace(/^\/+/, '');
      relativeImgSrc = `../${cleanRel}`;
      absoluteImgUrl = `${SITE_ORIGIN}/${cleanRel}`;
    }
  }

  filesToCommit.push({
    path: `articles/${slug}.html`,
    content: htmlContent,
    encoding: 'utf-8'
  });

  try {
    const [existingArticlesFile, existingHubFile, existingSitemapFile] = await Promise.all([
      githubGetTextFile(env, 'assets/data/articles.json'),
      githubGetTextFile(env, 'articles/index.html'),
      githubGetTextFile(env, 'sitemap.xml')
    ]);

    const updatedArticlesJson = upsertArticlesJson(
      existingArticlesFile ? existingArticlesFile.content : '[]',
      normalizedArticle
    );
    filesToCommit.push({
      path: 'assets/data/articles.json',
      content: updatedArticlesJson,
      encoding: 'utf-8'
    });

    if (existingHubFile && existingHubFile.content) {
      filesToCommit.push({
        path: 'articles/index.html',
        content: upsertArticlesHubCard(existingHubFile.content, normalizedArticle, slug, relativeImgSrc),
        encoding: 'utf-8'
      });
    }

    if (existingSitemapFile && existingSitemapFile.content) {
      filesToCommit.push({
        path: 'sitemap.xml',
        content: upsertSitemapUrl(existingSitemapFile.content, normalizedArticle, slug, absoluteImgUrl),
        encoding: 'utf-8'
      });
    }

    const commitSha = await commitGitHubFiles(env, {
      message: `feat(articles): publish SEO/GEO/AEO article "${slug}" via dashboard`,
      files: filesToCommit
    });

    if (env.HST_KV) {
      try {
        await env.HST_KV.put('articles', updatedArticlesJson);
      } catch {
        // Non-fatal
      }
    }

    return jsonResponse({
      ok: true,
      slug,
      commitSha,
      url: `${SITE_ORIGIN}/articles/${slug}.html`,
      imagePath: uploadedImagePath,
      updatedArticle: normalizedArticle
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 502);
  }
}
