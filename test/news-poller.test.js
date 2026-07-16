import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchNewsAPI, isBlockedSource, normalizeArticle, upsertArticle } from '../src/news-poller.js';

const SAMPLE_RAW_ARTICLE = {
  source: { id: null, name: 'Reuters' },
  author: 'Jane Reporter',
  title: 'Cyclospora outbreak spreads across four states',
  description: 'Health officials are investigating a growing multistate outbreak.',
  url: 'https://example.com/articles/cyclospora-outbreak',
  urlToImage: 'https://example.com/images/outbreak.jpg',
  publishedAt: '2026-07-15T14:32:00Z',
  content: 'Full article content here... [+1234 chars]',
};

test('fetchNewsAPI throws on a non-ok NewsAPI error response', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({
      status: 'error',
      code: 'rateLimited',
      message: 'You have made too many requests recently.',
    }),
  });
  t.after(() => {
    global.fetch = originalFetch;
  });

  await assert.rejects(() => fetchNewsAPI('fake-key', '2026-07-16'));
});

test('isBlockedSource filters out Biztoc.com articles', () => {
  assert.strictEqual(isBlockedSource({ source: { name: 'Biztoc.com' } }), true);
  assert.strictEqual(isBlockedSource(SAMPLE_RAW_ARTICLE), false);
});

test('upsertArticle targets ON CONFLICT (url) DO UPDATE and is repeatable', async () => {
  const calls = [];
  const mockClient = {
    query: async (text, params) => {
      calls.push({ text, params });
      return { rows: [] };
    },
  };
  const article = normalizeArticle(SAMPLE_RAW_ARTICLE);

  await upsertArticle(mockClient, article);
  await upsertArticle(mockClient, article);

  assert.strictEqual(calls.length, 2);
  for (const call of calls) {
    assert.match(call.text, /ON CONFLICT \(url\) DO UPDATE/);
    assert.strictEqual(call.params[0], article.url);
  }
});
