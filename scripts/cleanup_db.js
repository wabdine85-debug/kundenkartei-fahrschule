// scripts/cleanup_db.js
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
    // 1️⃣ "Gesamtsumme" oder Varianten (auch mit Punkt) entfernen
    const res1 = await pool.query(`
      UPDATE entries
      SET note = NULL
      WHERE note IS NOT NULL
        AND (
          note = 'Gesamtsumme'
          OR note = 'Gesamtsumme.'
          OR note ILIKE '%Gesamtsumme %'
          OR note ILIKE '%Gesamtsumme'
        )
    `);

    // 2️⃣ Leere oder reine Leerzeichen entfernen
    const res2 = await pool.query(`
      UPDATE entries
      SET note = NULL
      WHERE note IS NOT NULL AND btrim(note) = ''
    `);

    // 3️⃣ Kontrolle
    const check = await pool.query(`
      SELECT COUNT(*)::int AS cnt
      FROM entries
      WHERE note ILIKE '%Gesamtsumme%'
    `);

    console.log(`✅ Entfernt/angepasst: ${res1.rowCount + res2.rowCount} Notiz-Einträge`);
    console.log(`🔎 Übrig mit Muster "Gesamtsumme": ${check.rows[0].cnt}`);
  } catch (e) {
    console.error("❌ Cleanup-Fehler:", e.message);
  } finally {
    await pool.end();
  }
};

run();
