CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'cashier', 'barista', 'kitchen')),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  token_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 1000),
  icon TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  modifiers_json TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  on_hand REAL NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
  reserved REAL NOT NULL DEFAULT 0 CHECK (reserved >= 0 AND reserved <= on_hand),
  minimum REAL NOT NULL DEFAULT 0 CHECK (minimum >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE product_recipes (
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount_per_item REAL NOT NULL CHECK (amount_per_item > 0),
  PRIMARY KEY (product_id, ingredient_id)
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  order_type TEXT NOT NULL CHECK (order_type IN ('Dine-in', 'Takeaway')),
  table_number TEXT,
  status TEXT NOT NULL CHECK (status IN ('Queued', 'Preparing', 'Ready for pickup', 'Completed', 'Cancelled')),
  subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
  tax INTEGER NOT NULL CHECK (tax >= 0),
  total INTEGER NOT NULL CHECK (total >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  cancel_reason TEXT,
  cancelled_by TEXT REFERENCES users(id),
  collected_at TEXT,
  CHECK ((order_type = 'Dine-in' AND table_number IS NOT NULL) OR (order_type = 'Takeaway' AND table_number IS NULL))
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
  method TEXT NOT NULL CHECK (method IN ('Cash', 'QRIS', 'Debit/Kredit')),
  status TEXT NOT NULL CHECK (status IN ('Paid', 'Refunded')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reference TEXT NOT NULL UNIQUE,
  cash_received INTEGER,
  change_amount INTEGER,
  refunded_at TEXT,
  refund_reference TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  modifier TEXT NOT NULL DEFAULT '',
  station TEXT NOT NULL CHECK (station IN ('Kitchen', 'Barista'))
);

CREATE TABLE station_tickets (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  station TEXT NOT NULL CHECK (station IN ('Kitchen', 'Barista')),
  status TEXT NOT NULL CHECK (status IN ('Queued', 'Preparing', 'Ready', 'Cancelled')),
  started_at TEXT,
  ready_at TEXT,
  UNIQUE (order_id, station)
);

CREATE TABLE ticket_items (
  ticket_id TEXT NOT NULL REFERENCES station_tickets(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (ticket_id, order_item_id)
);

CREATE TABLE ticket_reservations (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES station_tickets(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  amount REAL NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('Reserved', 'Consumed', 'Released')),
  created_at TEXT NOT NULL,
  UNIQUE (ticket_id, ingredient_id)
);

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES ingredients(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('Stock In', 'Stock Reserved', 'Stock Out', 'Stock Adjustment', 'Reservation Released', 'Audit / Waste')),
  amount REAL NOT NULL,
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  ticket_id TEXT REFERENCES station_tickets(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE order_sequences (
  business_date TEXT PRIMARY KEY,
  next_value INTEGER NOT NULL CHECK (next_value > 0)
);

CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_tickets_order_status ON station_tickets(order_id, status);
CREATE INDEX idx_reservations_status ON ticket_reservations(status);
CREATE INDEX idx_movements_created_at ON inventory_movements(created_at DESC);
