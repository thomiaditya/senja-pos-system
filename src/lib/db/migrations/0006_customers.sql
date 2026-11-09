ALTER TABLE orders ADD COLUMN customer_name TEXT CHECK (customer_name IS NULL OR length(customer_name) <= 60);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 60),
  order_count INTEGER NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  last_order_at TEXT NOT NULL
);

CREATE INDEX idx_customers_frequent ON customers (order_count DESC, last_order_at DESC);
