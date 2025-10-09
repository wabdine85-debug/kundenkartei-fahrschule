import express from "express";
import pkg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL-Verbindung
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.RENDER ? { rejectUnauthorized: false } : false,
});

// --- Static files (Frontend) ---
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// --- API: alle Kunden ---
app.get("/api/customers", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY full_name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler /api/customers:", err.message);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// --- API: Ein Kunde + Einträge ---
app.get("/api/customer/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Kunde laden
    const customerResult = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: "Kunde nicht gefunden" });
    }

    // Einträge laden
    const entriesResult = await pool.query(
      "SELECT date, amount, note FROM entries WHERE customer_id = $1 ORDER BY date DESC",
      [id]
    );

    // Gesamtsumme berechnen
    const sumResult = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM entries WHERE customer_id = $1",
      [id]
    );

    // Daten zurückgeben
    res.json({
      customer: customerResult.rows[0],
      entries: entriesResult.rows,
      total: sumResult.rows[0].total,
    });
  } catch (err) {
    console.error("Fehler /api/customer/:id:", err.message);
    res.status(500).json({ error: "Serverfehler" });
  }
});


// --- Startseite ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Neuen Kunden anlegen oder vorhandenen laden ---
app.post("/api/customer", async (req, res) => {
  try {
    const { full_name } = req.body;
    const existing = await pool.query(
      "SELECT id FROM customers WHERE LOWER(full_name) = LOWER($1)",
      [full_name]
    );
    if (existing.rows.length > 0) {
      return res.json({ id: existing.rows[0].id, created: false });
    } else {
      const insert = await pool.query(
        "INSERT INTO customers (full_name) VALUES ($1) RETURNING id",
        [full_name]
      );
      return res.json({ id: insert.rows[0].id, created: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Anlegen des Kunden" });
  }
});

// --- Neuen Eintrag hinzufügen ---
app.post("/api/entry", async (req, res) => {
  try {
    const { customer_id, date, amount, note } = req.body;
    await pool.query(
      "INSERT INTO entries (customer_id, date, amount, note) VALUES ($1,$2,$3,$4)",
      [customer_id, date, amount, note]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Speichern des Eintrags" });
  }
});


// --- Server starten ---
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
