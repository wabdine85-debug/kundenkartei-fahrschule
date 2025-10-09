import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER ? { rejectUnauthorized: false } : false
});

// ---- API ROUTES ----
app.get('/api/health', async (_req, res) => {
  try {
    const r = await pool.query('SELECT 1');
    res.json({ ok: true, db: r.rows[0] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/stats/count', async (_req, res) => {
  const r = await pool.query('SELECT COUNT(*)::int AS count FROM customers');
  res.json(r.rows[0]);
});

app.get('/api/customers', async (req, res) => {
  const { first, last, q } = req.query;
  let sql = 'SELECT id, full_name, created_at FROM customers WHERE 1=1';
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    sql += ` AND full_name ILIKE $${params.length}`;
  } else {
    if (first) { params.push(`%${first}%`); sql += ` AND full_name ILIKE $${params.length}`; }
    if (last)  { params.push(`%${last}%`);  sql += ` AND full_name ILIKE $${params.length}`; }
  }
  sql += ' ORDER BY full_name LIMIT 50';
  const r = await pool.query(sql, params);
  res.json(r.rows);
});

app.post('/api/customers', async (req, res) => {
  const { full_name } = req.body;
  if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'full_name required' });
  const r = await pool.query(
    'INSERT INTO customers (full_name) VALUES ($1) RETURNING id, full_name, created_at',
    [full_name.trim()]
  );
  res.status(201).json(r.rows[0]);
});

app.get('/api/customers/:id', async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    `SELECT c.id, c.full_name, c.created_at,
            COALESCE(SUM(e.amount),0)::numeric(12,2) AS total
     FROM customers c
     LEFT JOIN entries e ON e.customer_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(r.rows[0]);
});

app.get('/api/customers/:id/entries', async (req, res) => {
  const { id } = req.params;
  const r = await pool.query(
    'SELECT id, date, amount::numeric(12,2) AS amount, note FROM entries WHERE customer_id=$1 ORDER BY date DESC, id DESC',
    [id]
  );
  res.json(r.rows);
});

app.post('/api/customers/:id/entries', async (req, res) => {
  const { id } = req.params;
  const { date, amount, note } = req.body;
  if (!date || amount === undefined) return res.status(400).json({ error: 'date and amount required' });
  const r = await pool.query(
    'INSERT INTO entries (customer_id, date, amount, note) VALUES ($1,$2,$3,$4) RETURNING id, date, amount::numeric(12,2) AS amount, note',
    [id, date, amount, note ?? null]
  );
  res.status(201).json(r.rows[0]);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Kundenkartei läuft auf Port ${PORT}`));
