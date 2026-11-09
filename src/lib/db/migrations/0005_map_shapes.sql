CREATE TABLE map_shapes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('rectangle', 'ellipse', 'wall', 'counter')),
  label TEXT CHECK (label IS NULL OR length(label) <= 32),
  x REAL NOT NULL DEFAULT 0 CHECK (x >= 0 AND x <= 100),
  y REAL NOT NULL DEFAULT 0 CHECK (y >= 0 AND y <= 100),
  width REAL NOT NULL DEFAULT 10 CHECK (width >= 2 AND width <= 100),
  height REAL NOT NULL DEFAULT 10 CHECK (height >= 2 AND height <= 100),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
