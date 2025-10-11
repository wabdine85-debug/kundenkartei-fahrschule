// scripts/cleanup_duplicates.js
import dotenv from "dotenv";
import pkg from "pg";
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const run = async () => {
  try {
    // löscht nur wirklich identische Einträge (gleicher Kunde, Betrag, Datum, Notiz)
    const result = await pool.query(`
      DELETE FROM entries e
      USING entries d
      WHERE e.ctid < d.ctid
        AND e.customer_id = d.customer_id
        AND e.date = d.date
        AND e.amount = d.amount
        AND COALESCE(e.note, '') = COALESCE(d.note, '');
    `);

    console.log(`✅ Echte Duplikate gelöscht: ${result.rowCount}`);
  } catch (e) {
    console.error("❌ Fehler beim Duplikat-Cleanup:", e.message);
  } finally {
    await pool.end();
  }
};

run();
