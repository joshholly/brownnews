import { pool } from './db.js';

const OPENFDA_URL = 'https://api.fda.gov/food/enforcement.json';

export async function fetchOpenFDA(apiKey) {
  const params = new URLSearchParams({
    search: 'reason_for_recall:cyclospora',
    sort: 'recall_initiation_date:desc',
    limit: '1000',
  });
  if (apiKey) {
    params.set('api_key', apiKey);
  }

  const response = await fetch(`${OPENFDA_URL}?${params.toString()}`);

  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`openFDA request failed with status ${response.status}`);
  }

  const body = await response.json();
  return body.results ?? [];
}

function parseFdaDate(value) {
  if (!value || value.length !== 8) {
    return null;
  }
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${year}-${month}-${day}`;
}

export function normalizeRecall(raw) {
  return {
    recall_number: raw.recall_number,
    firm: raw.recalling_firm ?? null,
    brand: raw.brand_name || raw.product_description || null,
    product: raw.product_description ?? null,
    reason: raw.reason_for_recall ?? null,
    distribution: raw.distribution_pattern ?? null,
    state: raw.state ?? null,
    classification: raw.classification ?? null,
    status: raw.status ?? null,
    initiation_date: parseFdaDate(raw.recall_initiation_date),
    report_date: parseFdaDate(raw.report_date),
    code_info: raw.code_info ?? null,
    quantity: raw.product_quantity ?? null,
    raw,
  };
}

const UPSERT_SQL = `
  INSERT INTO recalls (
    recall_number, firm, brand, product, reason, distribution, state,
    classification, status, initiation_date, report_date, code_info, quantity, raw
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  ON CONFLICT (recall_number) DO UPDATE SET
    firm = EXCLUDED.firm,
    brand = EXCLUDED.brand,
    product = EXCLUDED.product,
    reason = EXCLUDED.reason,
    distribution = EXCLUDED.distribution,
    state = EXCLUDED.state,
    classification = EXCLUDED.classification,
    status = EXCLUDED.status,
    initiation_date = EXCLUDED.initiation_date,
    report_date = EXCLUDED.report_date,
    code_info = EXCLUDED.code_info,
    quantity = EXCLUDED.quantity,
    raw = EXCLUDED.raw,
    fetched_at = now()
`;

export async function upsertRecall(client, record) {
  await client.query(UPSERT_SQL, [
    record.recall_number,
    record.firm,
    record.brand,
    record.product,
    record.reason,
    record.distribution,
    record.state,
    record.classification,
    record.status,
    record.initiation_date,
    record.report_date,
    record.code_info,
    record.quantity,
    record.raw,
  ]);
}

export async function pollOnce() {
  let rawResults;
  try {
    rawResults = await fetchOpenFDA(process.env.OPENFDA_API_KEY);
  } catch (err) {
    console.error('openFDA poll failed, skipping this run:', err.message);
    return;
  }

  console.log(`openFDA returned ${rawResults.length} record(s)`);

  for (const raw of rawResults) {
    const record = normalizeRecall(raw);
    await upsertRecall(pool, record);
  }

  console.log(`Upserted ${rawResults.length} recall(s)`);
}
