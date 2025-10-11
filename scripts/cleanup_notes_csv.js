import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "kunden_rettung.csv");

// CSV-Datei lesen
const csv = fs.readFileSync(filePath, "utf8");
const lines = csv.trim().split("\n");

// Erste Zeile sind die Spaltenüberschriften
const header = lines.shift().split(",");

// Index der Spalte „Notizen“ finden
const noteIndex = header.findIndex(h => h.toLowerCase().includes("notiz"));

if (noteIndex === -1) {
  console.error("❌ Keine Spalte mit 'Notiz' gefunden!");
  process.exit(1);
}

// Jede Zeile prüfen und doppelte Notizen entfernen
const cleaned = lines.map(line => {
  const cols = line.split(",");
  let notes = cols[noteIndex];

  if (notes) {
    // Trenne Einträge anhand von Semikolon, Komma oder |
    let noteArray = notes.split(/[;|]/).map(n => n.trim()).filter(n => n.length > 0);
    // Doppelte entfernen
    noteArray = [...new Set(noteArray)];
    cols[noteIndex] = noteArray.join("; ");
  }

  return cols.join(",");
});

// Neue Datei speichern
const outputPath = path.join(process.cwd(), "kunden_rettung_bereinigt.csv");
fs.writeFileSync(outputPath, [header.join(","), ...cleaned].join("\n"), "utf8");

console.log("✅ 'kunden_rettung_bereinigt.csv' erstellt – doppelte Notizen entfernt!");
