ALTER TABLE products ADD COLUMN station TEXT NOT NULL DEFAULT 'Barista' CHECK (station IN ('Kitchen', 'Barista'));

UPDATE products SET station = 'Kitchen' WHERE category = 'Makanan';

INSERT OR IGNORE INTO settings (key, value)
VALUES ('setup_completed', CASE WHEN EXISTS (SELECT 1 FROM products) THEN '1' ELSE '0' END);
