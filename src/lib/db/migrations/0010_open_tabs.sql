CREATE TABLE table_tabs (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL COLLATE NOCASE CHECK (length(table_name) BETWEEN 1 AND 32),
  customer_name TEXT NOT NULL COLLATE NOCASE CHECK (length(customer_name) BETWEEN 1 AND 60),
  status TEXT NOT NULL CHECK (status IN ('Open', 'Closed')),
  opened_by TEXT NOT NULL REFERENCES users (id),
  opened_at TEXT NOT NULL,
  closed_by TEXT REFERENCES users (id),
  closed_at TEXT,
  payment_method TEXT CHECK (payment_method IN ('Cash', 'QRIS', 'Debit/Kredit', 'Kasbon')),
  cash_received INTEGER CHECK (cash_received IS NULL OR cash_received >= 0),
  change_amount INTEGER CHECK (change_amount IS NULL OR change_amount >= 0),
  shift_id TEXT REFERENCES cash_shifts (id) ON DELETE RESTRICT,
  CHECK (
    (status = 'Open' AND closed_at IS NULL AND closed_by IS NULL)
    OR (status = 'Closed' AND closed_at IS NOT NULL AND closed_by IS NOT NULL)
  )
);

CREATE UNIQUE INDEX table_tabs_one_open_per_table ON table_tabs (table_name) WHERE status = 'Open';

ALTER TABLE orders ADD COLUMN tab_id TEXT REFERENCES table_tabs (id) ON DELETE RESTRICT;

CREATE INDEX orders_tab_idx ON orders (tab_id);
