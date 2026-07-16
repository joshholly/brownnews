CREATE TABLE IF NOT EXISTS recalls (
  recall_number    TEXT PRIMARY KEY,
  firm             TEXT,
  brand            TEXT,
  product          TEXT,
  reason           TEXT,
  distribution     TEXT,
  state            TEXT,
  classification   TEXT,
  status           TEXT,
  initiation_date  DATE,
  report_date      DATE,
  code_info        TEXT,
  quantity         TEXT,
  raw              JSONB,          -- keep full original record
  fetched_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recalls_initiation ON recalls (initiation_date DESC);
CREATE INDEX IF NOT EXISTS idx_recalls_state ON recalls (state);

CREATE TABLE IF NOT EXISTS news_articles (
  url              TEXT PRIMARY KEY,
  title            TEXT,
  description      TEXT,
  content          TEXT,
  url_to_image     TEXT,
  source_name      TEXT,
  author           TEXT,
  published_at     TIMESTAMPTZ,
  raw              JSONB,          -- keep full original NewsAPI article object
  fetched_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_articles_published ON news_articles (published_at DESC);
