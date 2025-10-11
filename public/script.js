// --- Script für Kundenkartei-Fahrschule ---

const searchForm = document.getElementById("searchForm");
const firstInput = document.getElementById("first");
const lastInput = document.getElementById("last");
const resultsDiv = document.getElementById("results");
const countSpan = document.getElementById("count");
const createBtn = document.getElementById("createBtn");

// --- Gesamtanzahl laden ---
async function loadCount() {
  try {
    const res = await fetch("/api/customers");
    const customers = await res.json();
    countSpan.textContent = customers.length;
  } catch (err) {
    console.error("Fehler beim Laden der Kunden:", err);
    countSpan.textContent = "–";
  }
}

// --- Suche nach Kunde ---
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const first = firstInput.value.trim().toLowerCase();
  const last = lastInput.value.trim().toLowerCase();

  resultsDiv.innerHTML = "<p class='muted'>Suche läuft...</p>";

  try {
    const res = await fetch("/api/customers");
    const customers = await res.json();

    const matches = customers.filter(c => {
      const name = c.full_name.toLowerCase();
      return (
        (first && name.includes(first)) ||
        (last && name.includes(last))
      );
    });

    if (matches.length === 0) {
      resultsDiv.innerHTML = `
        <p>❌ Kein Kunde gefunden.</p>
        <button id="createNew">Neuen Kunden '${firstInput.value} ${lastInput.value}' anlegen</button>
      `;
      document.getElementById("createNew").addEventListener("click", async () => {
        const full_name = `${firstInput.value} ${lastInput.value}`.trim();
        const res = await fetch("/api/customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name })
        });
        const data = await res.json();
        if (data.created) {
          alert(`✅ Neuer Kunde '${full_name}' angelegt.`);
        } else {
          alert(`ℹ️ Kunde '${full_name}' existiert bereits.`);
        }
        loadCount();
        openCustomer(data.id);
      });
      return;
    }

    // Ergebnisse anzeigen mit Button rechts
    resultsDiv.innerHTML = matches
      .map(c => `
        <div class="customer" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #ccc;">
          <span>${c.full_name}</span>
          <button class="openBtn" data-id="${c.id}" style="padding:4px 8px;">Kunde öffnen</button>
        </div>
      `)
      .join("");

    // Klick-Event für "Kunde öffnen"
    document.querySelectorAll(".openBtn").forEach(btn => {
      btn.addEventListener("click", () => openCustomer(btn.dataset.id));
    });

  } catch (err) {
    resultsDiv.innerHTML = "<p>Fehler bei der Suche.</p>";
    console.error(err);
  }
});

// --- Kunde + Einträge laden ---
async function openCustomer(id) {
  try {
    const res = await fetch(`/api/customer/${id}`);
    const data = await res.json();

    if (!data || !data.customer) {
      resultsDiv.innerHTML = "<p>❌ Kunde nicht gefunden.</p>";
      return;
    }

    // Sicherheit: Fallbacks für leere oder fehlende Felder
    const entries = Array.isArray(data.entries) ? data.entries : [];
    const total = data.total ?? 0;

    let html = `
      <h2>${data.customer.full_name}</h2>
      <p><strong>ID:</strong> ${data.customer.id}</p>
    `;

    if (entries.length > 0) {
      html += `
        <table>
          <thead>
            <tr><th>Datum</th><th>Betrag (€)</th><th>Notiz</th><th></th></tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr>
                <td>${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
                <td>${Number(e.amount || 0).toFixed(2)}</td>
                <td>${e.note || ""}</td>
                <td><button class="delete-btn" data-id="${e.id}">🗑️</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p class="summe"><strong>Gesamtsumme:</strong> ${Number(total).toFixed(2)} €</p>
      `;
    } else {
      html += "<p>Keine Einträge vorhanden.</p>";
      html += `<p class="summe"><strong>Gesamtsumme:</strong> 0.00 €</p>`;
    }

    // Formular für neuen Eintrag
    html += `
      <h3>➕ Neuer Eintrag</h3>
      <form id="entryForm">
        <input type="date" id="entryDate" required />
        <input type="number" step="0.01" id="entryAmount" placeholder="Betrag (€)" required />
        <input type="text" id="entryNote" placeholder="Notiz (optional)" />
        <button type="submit">Eintrag speichern</button>
      </form>
    `;

    resultsDiv.innerHTML = html;

    // --- Formular-Funktion ---
    document.getElementById("entryForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = document.getElementById("entryDate").value;
      const amount = parseFloat(document.getElementById("entryAmount").value);
      const note = document.getElementById("entryNote").value;

      await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: id, date, amount, note })
      });

      alert("✅ Eintrag gespeichert!");
      openCustomer(id); // neu laden
    });

 // --- Nach dem Rendern: Zurück-Button sofort einfügen ---
setTimeout(() => {
  if (!document.getElementById("backBtn")) {
    const backBtn = document.createElement("button");
    backBtn.id = "backBtn";
    backBtn.className = "floating-btn";
    backBtn.textContent = "⬅️ Zurück zur Startseite";
    backBtn.onclick = () => window.location.href = "/";
    document.body.appendChild(backBtn);
    console.log("✅ Button hinzugefügt!");
  }
}, 500); // kleine Verzögerung, bis DOM gerendert ist


  } catch (err) {
    console.error("Fehler in openCustomer:", err);
    resultsDiv.innerHTML = "<p>❌ Fehler beim Laden des Kunden.</p>";
  }
}

// --- Neuen Kunden anlegen ---
createBtn.addEventListener("click", async () => {
  const full_name = prompt("Name des neuen Kunden:");
  if (!full_name) return;

  const res = await fetch("/api/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name })
  });
  const data = await res.json();

  if (data.created) {
    alert(`✅ Neuer Kunde '${full_name}' angelegt.`);
  } else {
    alert(`ℹ️ Kunde '${full_name}' existiert bereits.`);
  }

  loadCount();
});

// --- Initialer Aufruf ---
loadCount();

// --- Eintrag löschen ---
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("delete-btn")) {
    const id = event.target.dataset.id;
    if (confirm("Eintrag wirklich löschen?")) {
      try {
        const res = await fetch(`/api/entry/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          event.target.closest("tr").remove();
        } else {
          alert("Fehler beim Löschen!");
        }
      } catch (err) {
        console.error("Fehler:", err);
        alert("Verbindungsfehler beim Löschen.");
      }
    }
  }
});
// --- Button-Fix: Überwache alle Änderungen im DOM ---
const observer = new MutationObserver(() => {
  const entryForm = document.getElementById("entryForm");
  const backBtn = document.getElementById("backBtn");

  // Wenn Kundenseite aktiv und kein Button vorhanden -> hinzufügen
  if (entryForm && !backBtn) {
    const btn = document.createElement("button");
    btn.id = "backBtn";
    btn.className = "floating-btn";
    btn.textContent = "⬅️ Zurück zur Startseite";
    btn.onclick = () => window.location.href = "/";
    document.body.appendChild(btn);
    console.log("✅ Floating-Button automatisch hinzugefügt (über Observer)");
  }
});

// DOM-Überwachung starten (reagiert auf dynamische Kundenwechsel)
observer.observe(document.body, { childList: true, subtree: true });
console.log("🔍 Script aktiv auf Seite:", window.location.href);

document.addEventListener("click", (e) => {
  console.log("🖱️ Klick erkannt auf:", e.target);
});

const observer = new MutationObserver(() => {
  console.log("👀 DOM verändert – prüfen auf entryForm…");
  const entryForm = document.getElementById("entryForm");
  if (entryForm && !document.getElementById("backBtn")) {
    console.log("✅ entryForm erkannt – Button wird hinzugefügt!");
    const btn = document.createElement("button");
    btn.id = "backBtn";
    btn.className = "floating-btn";
    btn.textContent = "⬅️ Zurück zur Startseite";
    btn.onclick = () => window.location.href = "/";
    document.body.appendChild(btn);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
