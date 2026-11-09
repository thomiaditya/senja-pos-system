CREATE TABLE credit_accounts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders (id) ON DELETE RESTRICT,
  customer_name TEXT NOT NULL COLLATE NOCASE CHECK (length(customer_name) BETWEEN 1 AND 60),
  total INTEGER NOT NULL CHECK (total > 0),
  status TEXT NOT NULL CHECK (status IN ('Open', 'Settled', 'Cancelled')),
  created_at TEXT NOT NULL,
  settled_at TEXT,
  cancelled_at TEXT,
  CHECK (
    (status = 'Open' AND settled_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'Settled' AND settled_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'Cancelled' AND cancelled_at IS NOT NULL)
  )
);

CREATE TABLE credit_payments (
  id TEXT PRIMARY KEY,
  credit_id TEXT NOT NULL REFERENCES credit_accounts (id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('Cicilan', 'Refund')),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'QRIS', 'Debit/Kredit')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL UNIQUE,
  cash_received INTEGER CHECK (cash_received IS NULL OR cash_received >= 0),
  change_amount INTEGER CHECK (change_amount IS NULL OR change_amount >= 0),
  shift_id TEXT REFERENCES cash_shifts (id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users (id),
  CHECK (method <> 'Cash' OR shift_id IS NOT NULL)
);

CREATE INDEX credit_accounts_customer_idx ON credit_accounts (customer_name, status);
CREATE INDEX credit_payments_credit_idx ON credit_payments (credit_id);
CREATE INDEX credit_payments_shift_idx ON credit_payments (shift_id);

INSERT OR IGNORE INTO settings (key, value) VALUES ('kasbon_limit', '100000');
