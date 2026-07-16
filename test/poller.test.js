import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchOpenFDA, normalizeRecall, upsertRecall } from '../src/poller.js';

const SAMPLE_RAW_RECALL = {
  recall_number: 'F-1234-2026',
  recalling_firm: 'Sample Produce Co.',
  brand_name: 'Sample Brand',
  product_description: 'Fresh basil, 4oz clamshell',
  reason_for_recall: 'Potential contamination with Cyclospora',
  distribution_pattern: 'Nationwide',
  state: 'CA',
  classification: 'Class II',
  status: 'Ongoing',
  recall_initiation_date: '20260601',
  report_date: '20260605',
  code_info: 'Lot 12345',
  product_quantity: '2,400 clamshells',
};

test('fetchOpenFDA treats a 404 NOT_FOUND response as an empty result set', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    status: 404,
    ok: false,
    json: async () => ({ error: { code: 'NOT_FOUND' } }),
  });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const results = await fetchOpenFDA('');

  assert.deepStrictEqual(results, []);
});

test('upsertRecall targets ON CONFLICT (recall_number) DO UPDATE and is repeatable', async () => {
  const calls = [];
  const mockClient = {
    query: async (text, params) => {
      calls.push({ text, params });
      return { rows: [] };
    },
  };
  const record = normalizeRecall(SAMPLE_RAW_RECALL);

  await upsertRecall(mockClient, record);
  await upsertRecall(mockClient, record);

  assert.strictEqual(calls.length, 2);
  for (const call of calls) {
    assert.match(call.text, /ON CONFLICT \(recall_number\) DO UPDATE/);
    assert.strictEqual(call.params[0], record.recall_number);
  }
});
