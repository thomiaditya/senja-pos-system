CREATE TABLE cash_shifts (
  id TEXT PRIMARY KEY,
  opened_by TEXT NOT NULL REFERENCES users(id),
  opened_at TEXT NOT NULL,
  opening_float INTEGER NOT NULL CHECK (opening_float >= 0),
  closed_by TEXT REFERENCES users(id),
  closed_at TEXT,
  expected_cash INTEGER CHECK (expected_cash IS NULL OR expected_cash >= 0),
  counted_cash INTEGER CHECK (counted_cash IS NULL OR counted_cash >= 0),
  difference INTEGER,
  close_note TEXT NOT NULL DEFAULT '' CHECK (length(close_note) <= 240),
  open_key INTEGER UNIQUE CHECK (open_key IS NULL OR open_key = 1),
  CHECK ((closed_at IS NULL AND open_key = 1) OR (closed_at IS NOT NULL AND open_key IS NULL))
);

ALTER TABLE payments ADD COLUMN shift_id TEXT REFERENCES cash_shifts (id) ON DELETE RESTRICT;

CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  shift_id TEXT REFERENCES cash_shifts (id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('Drawer', 'Non-cash')),
  pic_name TEXT NOT NULL CHECK (length(pic_name) BETWEEN 1 AND 60),
  ingredient_id TEXT NOT NULL REFERENCES ingredients (id) ON DELETE RESTRICT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  total INTEGER NOT NULL CHECK (total > 0),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 240),
  receipt_file TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  created_by TEXT NOT NULL REFERENCES users (id),
  created_at TEXT NOT NULL,
  decided_by TEXT REFERENCES users (id),
  decided_at TEXT,
  CHECK ((source = 'Drawer' AND shift_id IS NOT NULL) OR source = 'Non-cash')
);

CREATE INDEX expenses_shift_idx ON expenses (shift_id);
CREATE INDEX expenses_status_idx ON expenses (status);
CREATE INDEX payments_shift_idx ON payments (shift_id);

INSERT OR IGNORE INTO settings (key, value) VALUES ('expense_approval_threshold', '500000');
