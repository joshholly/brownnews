import { pool } from './db.js';

const NEWSAPI_URL = 'https://newsapi.org/v2/everything';
const BLOCKED_SOURCE_NAME = 'Biztoc.com';

function formatDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function todayInCentralTime() {
  return formatDateInTimeZone(new Date(), 'America/Chicago');
}

export async function fetchNewsAPI(apiKey, fromDate) {
  const params = new URLSearchParams({
    q: 'Cyclospora',
    from: fromDate,
    sortBy: 'publishedAt',
    language: 'en',
    pageSize: '30',
    apiKey,
  });

  const response = await fetch(`${NEWSAPI_URL}?${params.toString()}`);
  const body = await response.json();

  if (!response.ok || body.status !== 'ok') {
    throw new Error(`NewsAPI request failed: ${body.message ?? response.status}`);
  }

  return body.articles ?? [];
}

export function isBlockedSource(rawArticle) {
  return rawArticle.source?.name === BLOCKED_SOURCE_NAME;
}

export function normalizeArticle(raw) {
  return {
    url: raw.url,
    title: raw.title ?? null,
    description: raw.description ?? null,
    content: raw.content ?? null,
    url_to_image: raw.urlToImage ?? null,
    source_name: raw.source?.name ?? null,
    author: raw.author ?? null,
    published_at: raw.publishedAt ?? null,
    raw,
  };
}

const UPSERT_SQL = `
  INSERT INTO news_articles (
    url, title, description, content, url_to_image, source_name, author, published_at, raw
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
  ON CONFLICT (url) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    content = EXCLUDED.content,
    url_to_image = EXCLUDED.url_to_image,
    source_name = EXCLUDED.source_name,
    author = EXCLUDED.author,
    published_at = EXCLUDED.published_at,
    raw = EXCLUDED.raw,
    fetched_at = now()
`;

export async function upsertArticle(client, article) {
  await client.query(UPSERT_SQL, [
    article.url,
    article.title,
    article.description,
    article.content,
    article.url_to_image,
    article.source_name,
    article.author,
    article.published_at,
    article.raw,
  ]);
}

export async function pollNewsOnce() {
  let rawArticles;
  try {
    rawArticles = await fetchNewsAPI(process.env.NEWSAPI_KEY, todayInCentralTime());
  } catch (err) {
    console.error('NewsAPI poll failed, skipping this run:', err.message);
    return;
  }

  const filtered = rawArticles.filter((raw) => !isBlockedSource(raw));
  const blockedCount = rawArticles.length - filtered.length;

  console.log(`NewsAPI returned ${rawArticles.length} article(s), ${blockedCount} filtered (Biztoc.com)`);

  for (const raw of filtered) {
    const article = normalizeArticle(raw);
    await upsertArticle(pool, article);
  }

  console.log(`Upserted ${filtered.length} article(s)`);
}
