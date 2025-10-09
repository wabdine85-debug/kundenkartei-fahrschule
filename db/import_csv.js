import fs from "fs";
import { parse } from "csv-parse";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER ? { rejectUnauthorized: false } : false,
});

const seen = new Map();

async function upsertCustomer(full_name) {
  const name = full_name.trim();
  if (seen.has(name)) return seen.get(name);

  const sel = await pool.query("SELECT id FROM customers WHERE full_name = $1", [name]);
  if (sel.rows[0]) {
    seen.set(name, sel.rows[0].id);
    return sel.rows[0].id;
  }

  const ins = await pool.query("INSERT INTO customers(full_name) VALUES ($1) RETURNING id", [name]);
  seen.set(name, ins.rows[0].id);
  return ins.rows[0].id;
}

async function main() {
  console.log("🚀 Import gestartet...");
  await pool.query("BEGIN");

  try {
    const parser = fs
      .createReadStream("./kunden_rettung.csv")
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }));

    let count = 0;

    for await (const rec of parser) {
      const full_name = rec["Kunde"]?.trim();
      const date = rec["Datum"]?.trim();
      const amountRaw = rec["Betrag"];
      const note = rec["Notiz"]?.trim() || null;
      const totalRaw = rec["Gesamtsumme"];

      if (!full_name) continue;

      const customer_id = await upsertCustomer(full_name);

      // Betrag korrekt umwandeln (egal ob String oder Komma)
      const amount = parseFloat(String(amountRaw).replace(",", "."));
      const total = parseFloat(String(totalRaw).replace(",", "."));

      // Wenn Datum oder Betrag fehlt, überspringen
      if (!isNaN(amount) && date) {
        await pool.query(
          "INSERT INTO entries(customer_id, date, amount, note) VALUES ($1, $2, $3, $4)",
          [customer_id, date, amount, note]
        );
        count++;
      }

      // Optionale Gesamtsumme ebenfalls als Hinweis speichern
      if (!isNaN(total) && total !== amount) {
        await pool.query(
          "INSERT INTO entries(customer_id, date, amount, note) VALUES ($1, $2, $3, $4)",
          [customer_id, date, total, "Gesamtsumme"]
        );
      }
    }

    await pool.query("COMMIT");
    console.log(`✅ Import abgeschlossen (${count} Einträge hinzugefügt).`);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("❌ Import-Fehler:", err.message);
  } finally {
    await pool.end();
  }
}

main();
