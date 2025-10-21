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
      return (first && name.includes(first)) || (last && name.includes(last));
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

    // Ergebnisse anzeigen
    resultsDiv.innerHTML = matches.map(c => `
      <div class="customer" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #ccc;">
        <span>${c.full_name}</span>
        <button class="openBtn" data-id="${c.id}" style="padding:4px 8px;">Kunde öffnen</button>
      </div>
    `).join("");

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
    <tr data-id="${e.id}">
      <td class="editable date">${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
      <td class="editable amount">${Number(e.amount || 0).toFixed(2)}</td>
      <td class="editable note">${e.note || ""}</td>
      <td>
        <button class="edit-entry">✏️</button>
        <button class="delete-btn" data-id="${e.id}">🗑️</button>
      </td>
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

    // Eintrag speichern
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
      openCustomer(id);
    });

  } catch (err) {
    console.error("Fehler in openCustomer:", err);
    resultsDiv.innerHTML = "<p>❌ Fehler beim Laden des Kunden.</p>";
  }
}

// --- Kunden anlegen ---
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

// --- Floating "Zurück zur Startseite"-Button ---
const observer = new MutationObserver(() => {
  const entryForm = document.getElementById("entryForm");
  const backBtn = document.getElementById("backBtn");

  if (entryForm && !backBtn) {
    const btn = document.createElement("button");
    btn.id = "backBtn";
    btn.className = "floating-btn";
    btn.textContent = "⬅️ Zurück zur Startseite";
    btn.onclick = () => window.location.href = "/";
    document.body.appendChild(btn);
    console.log("✅ Floating-Button hinzugefügt");
  }
});

observer.observe(document.body, { childList: true, subtree: true });

// --- Initialisierung ---
loadCount();
console.log("🔍 Script aktiv:", window.location.href);

// --- Inline-Bearbeitung für Einträge ---
document.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const id = row.dataset.id;

  // --- Bearbeiten aktivieren ---
  if (e.target.classList.contains("edit-entry")) {
    const cells = row.querySelectorAll(".editable");
    cells.forEach((cell) => {
      const oldValue = cell.textContent.trim();
      cell.innerHTML = `<input type="text" value="${oldValue}" />`;
    });

    // Buttons austauschen
    e.target.outerHTML = `<button class="save-entry">💾</button><button class="cancel-entry">❌</button>`;
  }

  // --- Änderungen speichern ---
  if (e.target.classList.contains("save-entry")) {
    const inputs = row.querySelectorAll("input");
    const [dateInput, amountInput, noteInput] = inputs;

    // Datum umwandeln in ISO
    const parts = dateInput.value.split(".");
    const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateInput.value;

    const updated = {
      date: isoDate,
      amount: parseFloat(amountInput.value),
      note: noteInput.value
    };

    await fetch(`/api/entry/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });

    // Neue Werte anzeigen
    row.querySelector(".date").textContent = new Date(updated.date).toLocaleDateString("de-DE");
    row.querySelector(".amount").textContent = updated.amount.toFixed(2);
    row.querySelector(".note").textContent = updated.note;

    // Buttons wiederherstellen
    row.querySelector(".save-entry").outerHTML = `<button class="edit-entry">✏️</button>`;
    const cancelBtn = row.querySelector(".cancel-entry");
    if (cancelBtn) cancelBtn.remove();
  }

  // --- Bearbeitung abbrechen ---
  if (e.target.classList.contains("cancel-entry")) {
    const customerId = document.querySelector("p strong + span, h2 + p strong + span")?.textContent || "";
    openCustomer(customerId);
  }
});

