CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entries (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers USING gin (to_tsvector('simple', full_name));
CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
