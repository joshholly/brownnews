import { Router } from 'express';
import { query } from './db.js';

const DISCLAIMER =
  'Data sourced from openFDA and may be incomplete or delayed. Not medical advice. ' +
  'This is not an official recall alert system — always confirm against the official FDA recall record.';

export const router = Router();

function parseLimit(rawLimit) {
  const parsed = Math.trunc(Number(rawLimit));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(parsed, 1000);
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
