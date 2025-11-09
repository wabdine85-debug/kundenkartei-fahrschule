import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
console.log("📦 Datenbank-URL erkannt:", process.env.DATABASE_URL ? "✅ ja" : "❌ nein");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.use(express.json());

/* ✅ TEST-ROUTE – zur Überprüfung, ob Express aktiv ist */
app.get("/ping", (req, res) => {
  console.log("✅ /ping erreicht");
  res.json({ message: "Server läuft & API erreichbar ✅" });
});

/* --- DEBUG: zeigt Spaltennamen aus der Tabelle instructors --- */
app.get("/api/debug/instructors", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM instructors LIMIT 1");
    console.log("🧩 DEBUG instructors:", result.rows[0]);
    res.json(result.rows[0] || { info: "Keine Daten gefunden" });
  } catch (err) {
    console.error("❌ Fehler in /api/debug/instructors:", err.message);
    res.status(500).json({ error: err.message });
  }
});



/* --- API: alle Kunden --- */
app.get("/api/customers", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customers ORDER BY full_name ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler /api/customers:", err.message);
    res.status(500).json({ error: "Serverfehler" });
  }
});

// 🔹 Minuten abrufen (nach customer_id)
app.get("/api/minutes/:customer_id", async (req, res) => {
  try {
    const { customer_id } = req.params;
    const result = await pool.query(
      "SELECT * FROM minutes WHERE customer_id = $1 ORDER BY datum DESC",
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler beim Laden der Minuten:", err);
    res.status(500).json({ error: "Fehler beim Laden der Minuten" });
  }
});
// 🔹 Gesamtminuten + dezimale Stunden eines Kunden abrufen
app.get("/api/minutes/sum/:customer_id", async (req, res) => {
  try {
    const { customer_id } = req.params;
    const result = await pool.query(
      "SELECT COALESCE(SUM(minuten), 0) AS total_minutes FROM minutes WHERE customer_id = $1",
      [customer_id]
    );

    const totalMinutes = result.rows[0].total_minutes;

    // 🔹 Dezimal-Umrechnung (z. B. 90 min = 1,30 Std)
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const decimalHours = (hours + minutes / 100).toFixed(2);

    res.json({ total_minutes: totalMinutes, total_hours: decimalHours });
} catch (err) {
  console.error("❌ Fehler bei /api/minutes/sum/:customer_id:", err.message);
  res.status(500).json({ error: err.message });
}

});


// 🔹 Neue Minute speichern
app.post("/api/minutes", async (req, res) => {
  try {
    const { customer_id, taetigkeit, minuten, fahrlehrer, datum } = req.body;
    const result = await pool.query(
      "INSERT INTO minutes (customer_id, taetigkeit, minuten, fahrlehrer, datum) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [customer_id, taetigkeit, minuten, fahrlehrer, datum]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Fehler beim Speichern der Minute:", err);
    res.status(500).json({ error: "Fehler beim Speichern der Minute" });
  }
});
// 🔹 Minute-Eintrag aktualisieren
app.put("/api/minutes/:id", async (req, res) => {
  try {
    const { datum, taetigkeit, minuten, fahrlehrer } = req.body;
    const { id } = req.params;
    await pool.query(
      "UPDATE minutes SET datum = $1, taetigkeit = $2, minuten = $3, fahrlehrer = $4 WHERE id = $5",
      [datum, taetigkeit, minuten, fahrlehrer, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Aktualisieren eines Minuten-Eintrags:", err);
    res.status(500).json({ error: "Update fehlgeschlagen" });
  }
});

// 🔹 Minute-Eintrag löschen
app.delete("/api/minutes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM minutes WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Löschen eines Minuten-Eintrags:", err);
    res.status(500).json({ error: "Löschen fehlgeschlagen" });
  }
});


/* --- API: alle Fahrlehrer --- */
app.get("/api/instructors", async (req, res) => {
  console.log("👉 /api/instructors wurde aufgerufen");
  try {
    const result = await pool.query(`
      SELECT * FROM instructors
      ORDER BY CASE name
        WHEN 'Hasieb' THEN 1
        WHEN 'Taner' THEN 2
        WHEN 'Berat' THEN 3
        WHEN 'Sefa' THEN 4
        WHEN 'Momo' THEN 5
        WHEN 'Tamer' THEN 6
        WHEN 'Onur' THEN 7
        WHEN 'k.A.' THEN 8
      END;
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler /api/instructors:", err.message);
    res.status(500).json({ error: "Serverfehler" });
  }
});

/* --- API: Alle Schüler eines Fahrlehrers --- */
app.get("/api/instructors/:id/customers", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT DISTINCT c.*
      FROM customers c
      JOIN entries e ON e.customer_id = c.id
      WHERE e.fahrlehrer_id = $1
      ORDER BY c.full_name ASC
    `;
    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error("Fehler /api/instructors/:id/customers:", err.message);
    res.status(500).json({ error: "Serverfehler" });
  }
});

/* --- API: Ein Kunde + Einträge --- */
app.get("/api/customer/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const customerResult = await pool.query("SELECT * FROM customers WHERE id = $1", [id]);
    if (customerResult.rows.length === 0) {
      return res.status(404).json({ error: "Kunde nicht gefunden" });
    }

    const entriesResult = await pool.query(
      "SELECT id, date, amount, note, fahrlehrer_id FROM entries WHERE customer_id = $1 ORDER BY date DESC",
      [id]
    );

    const cleanedEntries = entriesResult.rows.map((e) => ({
      id: e.id,
      date: e.date,
      amount: e.amount,
      note: e.note && typeof e.note === "string" ? e.note.trim() : "",
      fahrlehrer_id: e.fahrlehrer_id,
    }));

    const sumResult = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM entries WHERE customer_id = $1",
      [id]
    );

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

/* --- Neuen Kunden anlegen --- */
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

/* --- Kundennamen aktualisieren --- */
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

/* --- Kunden & Einträge löschen --- */
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

/* --- Eintrag bearbeiten --- */
app.put("/api/entry/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date, amount, note, fahrlehrer_id } = req.body;

    if (!id || !date || isNaN(amount)) {
      return res.status(400).json({ success: false, error: "Ungültige Daten" });
    }

    const cleanNote = note && note.trim().length > 0 ? note.trim() : null;

    const result = await pool.query(
      "UPDATE entries SET date = $1, amount = $2, note = $3, fahrlehrer_id = $4 WHERE id = $5 RETURNING *",
      [date, amount, cleanNote, fahrlehrer_id || 1, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Eintrag nicht gefunden" });
    }

    res.json({ success: true, entry: result.rows[0] });
  } catch (err) {
    console.error("Fehler beim Aktualisieren des Eintrags:", err.message);
    res.status(500).json({ success: false, error: "Serverfehler beim Aktualisieren" });
  }
});

/* --- Neuen Eintrag hinzufügen --- */
app.post("/api/entry", async (req, res) => {
  try {
    const { customer_id, date, amount, note, fahrlehrer_id } = req.body;
    const cleanNote = note && note.trim().length > 0 ? note.trim() : null;

    await pool.query(
      "INSERT INTO entries (customer_id, date, amount, note, fahrlehrer_id) VALUES ($1,$2,$3,$4,$5)",
      [customer_id, date, amount, cleanNote, fahrlehrer_id || 1]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fehler beim Speichern des Eintrags" });
  }
});

/* --- Eintrag löschen --- */
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

/* --- Startseite & statische Dateien --- */
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Keine Cache-Header für HTML & JS
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

/* ✅ Server starten – GANZ AM ENDE */
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));


