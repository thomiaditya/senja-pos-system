CREATE TABLE order_cancel_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 160),
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  requested_by TEXT NOT NULL REFERENCES users (id),
  requested_at TEXT NOT NULL,
  decided_by TEXT REFERENCES users (id),
  decided_at TEXT,
  CHECK (
    (status = 'Pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('Approved', 'Rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX order_cancel_requests_one_pending_per_order ON order_cancel_requests (order_id) WHERE status = 'Pending';

CREATE INDEX order_cancel_requests_status_idx ON order_cancel_requests (status);
