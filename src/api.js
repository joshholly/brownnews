import { readFileSync } from 'node:fs';
import { Router } from 'express';
import { query } from './db.js';

// Firm name (exactly as openFDA reports it) -> company domain. Firms listed here
// get their logo looked up by domain instead of by logo.dev's fuzzy name search.
const LOGO_DOMAINS = JSON.parse(
  readFileSync(new URL('../config/logo-domains.json', import.meta.url), 'utf8')
);

const DISCLAIMER =
  'Data sourced from openFDA and may be incomplete or delayed. Not medical advice. ' +
  'This is not an official recall alert system — always confirm against the official FDA recall record.';

const NEWS_DISCLAIMER =
  'News articles are pulled automatically from third-party sources via NewsAPI.org. ' +
  'They are independent news coverage, not official CDC or FDA data, and are not verified by Brown News.';

const NEWS_PAGE_SIZE = 30;

export const router = Router();

function parseLimit(rawLimit) {
  const parsed = Math.trunc(Number(rawLimit));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(parsed, 1000);
}

function parsePage(rawPage) {
  const parsed = Math.trunc(Number(rawPage));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
}

router.get('/recalls', async (req, res) => {
  try {
    const { state, status, since, limit } = req.query;
    const conditions = [];
    const params = [];

    if (state) {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (since) {
      params.push(since);
      conditions.push(`initiation_date >= $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(parseLimit(limit));

    const { rows } = await query(
      `SELECT recall_number, firm, brand, product, reason, distribution, state,
              classification, status, initiation_date, report_date, code_info, quantity
       FROM recalls
       ${where}
       ORDER BY initiation_date DESC NULLS LAST
       LIMIT $${params.length}`,
      params
    );

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ meta: { disclaimer: DISCLAIMER }, results: rows });
  } catch (err) {
    console.error('GET /api/recalls failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/recalls/:recall_number', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM recalls WHERE recall_number = $1', [
      req.params.recall_number,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Recall not found' });
    }

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ meta: { disclaimer: DISCLAIMER }, result: rows[0] });
  } catch (err) {
    console.error('GET /api/recalls/:recall_number failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/news', async (req, res) => {
  try {
    const page = parsePage(req.query.page);
    const offset = (page - 1) * NEWS_PAGE_SIZE;

    const [articlesResult, countResult] = await Promise.all([
      query(
        `SELECT url, title, description, content, url_to_image, source_name, author, published_at
         FROM news_articles
         ORDER BY published_at DESC NULLS LAST
         LIMIT $1 OFFSET $2`,
        [NEWS_PAGE_SIZE, offset]
      ),
      query('SELECT COUNT(*) AS total FROM news_articles'),
    ]);

    const total = Number(countResult.rows[0].total);
    const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      meta: { disclaimer: NEWS_DISCLAIMER },
      results: articlesResult.rows,
      pagination: { page, pageSize: NEWS_PAGE_SIZE, total, totalPages },
    });
  } catch (err) {
    console.error('GET /api/news failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/logo', async (req, res) => {
  const { firm } = req.query;

  if (!firm) {
    return res.status(400).json({ error: 'Missing firm query parameter' });
  }

  try {
    const domain = LOGO_DOMAINS[firm];
    const lookup = domain ? encodeURIComponent(domain) : `name/${encodeURIComponent(firm)}`;
    const logoUrl = `https://img.logo.dev/${lookup}?token=${process.env.LOGO_DEV_TOKEN}`;
    const logoResponse = await fetch(logoUrl);

    if (!logoResponse.ok) {
      return res.status(404).end();
    }

    const contentType = logoResponse.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await logoResponse.arrayBuffer());

    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    console.error('GET /api/logo failed:', err);
    res.status(502).end();
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [byClassification, byState, totals] = await Promise.all([
      query('SELECT classification, COUNT(*) AS count FROM recalls GROUP BY classification'),
      query('SELECT state, COUNT(*) AS count FROM recalls GROUP BY state'),
      query('SELECT COUNT(*) AS total, MAX(initiation_date) AS most_recent FROM recalls'),
    ]);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({
      meta: { disclaimer: DISCLAIMER },
      total: Number(totals.rows[0].total),
      most_recent_date: totals.rows[0].most_recent,
      by_classification: byClassification.rows,
      by_state: byState.rows,
    });
  } catch (err) {
    console.error('GET /api/stats failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
