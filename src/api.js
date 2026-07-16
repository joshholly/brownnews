import { Router } from 'express';
import { query } from './db.js';

const DISCLAIMER =
  'Data sourced from openFDA and may be incomplete or delayed. Not medical advice. ' +
  'This is not an official recall alert system — always confirm against the official FDA recall record.';

export const router = Router();

router.get('/recalls', async (req, res) => {
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
  const limitValue = Math.min(Number(limit) || 100, 1000);
  params.push(limitValue);

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
});

router.get('/recalls/:recall_number', async (req, res) => {
  const { rows } = await query('SELECT * FROM recalls WHERE recall_number = $1', [
    req.params.recall_number,
  ]);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'Recall not found' });
  }

  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ meta: { disclaimer: DISCLAIMER }, result: rows[0] });
});

router.get('/stats', async (req, res) => {
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
});
