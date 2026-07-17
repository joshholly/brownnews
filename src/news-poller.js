import { pool } from './db.js';

const NEWSAPI_URL = 'https://newsapi.org/v2/everything';
const BLOCKED_SOURCE_NAME = 'Biztoc.com';
const NIGHTLY_PAGE_SIZE = 30;
const FIRST_RUN_PAGE_SIZE = 60;
const FIRST_RUN_FROM_DATE = '2026-07-14';

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

export async function fetchNewsAPI(apiKey, fromDate, pageSize = NIGHTLY_PAGE_SIZE) {
  const params = new URLSearchParams({
    q: 'Cyclospora',
    from: fromDate,
    sortBy: 'publishedAt',
    language: 'en',
    pageSize: String(pageSize),
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

export async function isNewsArticlesTableEmpty(client) {
  const { rows } = await client.query('SELECT COUNT(*) AS total FROM news_articles');
  return Number(rows[0].total) === 0;
}

export async function pollNewsOnce() {
  let isFirstRun;
  try {
    isFirstRun = await isNewsArticlesTableEmpty(pool);
  } catch (err) {
    console.error('Failed to check news_articles table state, defaulting to the nightly page size:', err.message);
    isFirstRun = false;
  }

  const pageSize = isFirstRun ? FIRST_RUN_PAGE_SIZE : NIGHTLY_PAGE_SIZE;
  const fromDate = isFirstRun ? FIRST_RUN_FROM_DATE : todayInCentralTime();

  let rawArticles;
  try {
    rawArticles = await fetchNewsAPI(process.env.NEWSAPI_KEY, fromDate, pageSize);
  } catch (err) {
    console.error('NewsAPI poll failed, skipping this run:', err.message);
    return;
  }

  const filtered = rawArticles.filter((raw) => !isBlockedSource(raw));
  const blockedCount = rawArticles.length - filtered.length;

  console.log(
    `NewsAPI returned ${rawArticles.length} article(s) (from=${fromDate}, pageSize=${pageSize}${isFirstRun ? ', first run' : ''}), ${blockedCount} filtered (Biztoc.com)`
  );

  for (const raw of filtered) {
    const article = normalizeArticle(raw);
    await upsertArticle(pool, article);
  }

  console.log(`Upserted ${filtered.length} article(s)`);
}
