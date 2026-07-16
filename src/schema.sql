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
