CREATE TABLE discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 60),
  kind TEXT NOT NULL CHECK (kind IN ('Percent', 'Fixed')),
  value INTEGER NOT NULL CHECK (value > 0),
  min_subtotal INTEGER NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
  max_amount INTEGER CHECK (max_amount IS NULL OR max_amount > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL
);

ALTER TABLE orders ADD COLUMN discount_id INTEGER REFERENCES discounts (id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN discount_name TEXT CHECK (discount_name IS NULL OR length(discount_name) <= 60);
ALTER TABLE orders ADD COLUMN discount_kind TEXT CHECK (discount_kind IS NULL OR discount_kind IN ('Percent', 'Fixed'));
ALTER TABLE orders ADD COLUMN discount_value INTEGER;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
