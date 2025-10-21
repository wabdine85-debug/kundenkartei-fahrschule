import express from "express";
import pkg from "pg";                // PostgreSQL-Paket
const { Pool } = pkg;                // Pool extrahieren
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
console.log("📦 Datenbank-URL erkannt:", process.env.DATABASE_URL ? "✅ ja" : "❌ nein");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// --- PostgreSQL-Verbindung ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // SSL aktiviert für Render & lokal
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
      "SELECT id, date, amount, note FROM entries WHERE customer_id = $1 ORDER BY date DESC",
      [id]
    );

    // Notizen säubern
    const cleanedEntries = entriesResult.rows.map(e => ({
      id: e.id,
      date: e.date,
      amount: e.amount,
      note: e.note && typeof e.note === "string" ? e.note.trim() : ""
    }));

    // Gesamtsumme berechnen
    const sumResult = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM entries WHERE customer_id = $1",
      [id]
    );

    // Antwort
    res.json({
      customer: customerResult.rows[0],
      entries: cleanedEntries,
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

// --- Kundennamen aktualisieren (PUT) ---
app.put("/api/customer/:id", async (req, res) => {
  const { id } = req.params;
  const { full_name } = req.body;

  try {
    await pool.query("UPDATE customers SET full_name = $1 WHERE id = $2", [full_name, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Fehler beim Aktualisieren des Kunden:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Kunden & Einträge löschen (DELETE) ---
app.delete("/api/customer/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM entries WHERE customer_id = $1", [id]);
    await pool.query("DELETE FROM customers WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Fehler beim Löschen des Kunden:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Neuen Eintrag hinzufügen ---
app.post("/api/entry", async (req, res) => {
  try {
    const { customer_id, date, amount, note } = req.body;

    const cleanNote = note && note.trim().length > 0 ? note.trim() : null;

    await pool.query(
      "INSERT INTO entries (customer_id, date, amount, note) VALUES ($1,$2,$3,$4)",
      [customer_id, date, amount, cleanNote]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Speichern des Eintrags" });
  }
});

// --- Eintrag löschen ---
app.delete("/api/entry/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM entries WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Fehler beim Löschen des Eintrags:", err.message);
    res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

// --- Server starten ---
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
