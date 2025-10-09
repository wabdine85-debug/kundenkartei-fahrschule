import fs from 'fs';
import { parse } from 'csv-parse';
import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER ? { rejectUnauthorized: false } : false
});

const seen = new Map(); // Cache für Kundennamen

async function upsertCustomer(full_name) {
  const name = full_name.trim();
  if (seen.has(name)) return seen.get(name);
  const sel = await pool.query('SELECT id FROM customers WHERE full_name = $1', [name]);
  if (sel.rows[0]) {
    seen.set(name, sel.rows[0].id);
    return sel.rows[0].id;
  }
  const ins = await pool.query('INSERT INTO customers(full_name) VALUES ($1) RETURNING id', [name]);
  seen.set(name, ins.rows[0].id);
  return ins.rows[0].id;
}

async function main() {
  await pool.query('BEGIN');
  try {
    const parser = fs
      .createReadStream('./kunden_rettung.csv')
      .pipe(parse({ columns: true, skip_empty_lines: true }));

    for await (const rec of parser) {
      const full_name = rec['Kunde'];
      const date = rec['Datum'];
      const amountRaw = rec['Betrag'];
      const note = rec['Notiz'] || null;
      if (!full_name || !date || !amountRaw) continue;
      const amount = Number(String(amountRaw).replace(',', '.'));
      if (Number.isNaN(amount)) continue;

      const customer_id = await upsertCustomer(full_name);
      await pool.query(
        'INSERT INTO entries(customer_id, date, amount, note) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [customer_id, date, amount, note]
      );
    }

    await pool.query('COMMIT');
    console.log('✅ Import abgeschlossen.');
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('❌ Import-Fehler:', e.message);
  } finally {
    await pool.end();
  }
}

main();
