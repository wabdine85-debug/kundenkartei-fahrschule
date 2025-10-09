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
    const customerResult = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    const entriesResult = await pool.query(
      "SELECT date, amount, note FROM entries WHERE customer_id = $1 ORDER BY date DESC",
      [id]
    );
    res.json({
      customer: customerResult.rows[0],
      entries: entriesResult.rows,
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

// --- Server starten ---
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
