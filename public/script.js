console.log("✅ script.js gestartet");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM geladen – Initialisierung gestartet...");

  const searchForm = document.getElementById("searchForm");
  const firstInput = document.getElementById("first");
  const lastInput = document.getElementById("last");
  const resultsDiv = document.getElementById("results");
  const countSpan = document.getElementById("count");

  if (!searchForm || !resultsDiv) {
    console.error("❌ DOM-Elemente fehlen. Script abgebrochen.");
    return;
  }

  let instructors = [];

  // --- Fahrlehrer laden ---
  async function loadInstructors() {
    try {
      const res = await fetch("/api/instructors");
      instructors = await res.json();
      console.log("👨‍🏫 Fahrlehrer geladen:", instructors.length);
    } catch (err) {
      console.error("❌ Fehler beim Laden der Fahrlehrer:", err);
    }
  }

  // --- Kundenanzahl laden ---
  async function loadCount() {
    try {
      const res = await fetch("/api/customers");
      const customers = await res.json();
      countSpan.textContent = customers.length;
    } catch (err) {
      console.error("❌ Fehler beim Laden der Kunden:", err);
      countSpan.textContent = "–";
    }
  }

  // --- Suche nach Kunden ---
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const first = firstInput.value.trim().toLowerCase();
    const last = lastInput.value.trim().toLowerCase();

    resultsDiv.innerHTML = "<p class='muted'>🔍 Suche läuft...</p>";

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
            body: JSON.stringify({ full_name }),
          });
          const data = await res.json();
          if (data.created) {
            alert(`✅ Neuer Kunde '${full_name}' angelegt.`);
          } else {
            alert(`ℹ️ Kunde '${full_name}' existiert bereits.`);
          }
          await loadCount();
          openCustomer(data.id);
        });
        return;
      }

      // --- Ergebnisse anzeigen ---
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
      console.error("❌ Fehler bei der Kundensuche:", err);
      resultsDiv.innerHTML = "<p>Fehler bei der Suche.</p>";
    }
  });

  // --- Kunde + Einträge laden ---
  async function openCustomer(id) {
    try {
      await loadInstructors();
      const res = await fetch(`/api/customer/${id}`);
      const data = await res.json();
      console.log("📄 Kunde geladen:", data.customer?.full_name);

      if (!data || !data.customer) {
        resultsDiv.innerHTML = "<p>❌ Kunde nicht gefunden.</p>";
        return;
      }

      const entries = Array.isArray(data.entries) ? data.entries : [];
      const total = data.total ?? 0;

      let html = `
        <h2>
          <span id="customerName" data-id="${data.customer.id}">${data.customer.full_name}</span>
          <button id="editCustomerBtn">✏️</button>
          <button id="saveCustomerBtn" style="display:none;">💾</button>
          <button id="cancelCustomerBtn" style="display:none;">❌</button>
        </h2>
        <p><strong>ID:</strong> ${data.customer.id}</p>
        <button id="deleteCustomerBtn" class="danger-btn">🗑️ Kunden löschen</button>
        <button id="minutesPageBtn" class="secondary">⏱ Tätigkeiten / Minuten</button>
      `;

      // --- Tabelle der Einträge ---
      html += `
        <table>
          <thead>
            <tr><th>Datum</th><th>Betrag (€)</th><th>Notiz</th><th>Fahrlehrer</th><th></th></tr>
          </thead>
          <tbody>
            ${entries.map(e => `
              <tr data-id="${e.id}">
                <td>${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
                <td>${Number(e.amount || 0).toFixed(2)}</td>
                <td>${e.note || ""}</td>
                <td>${(instructors.find(f => f.id === e.fahrlehrer_id)?.name) || "k.A."}</td>
                <td><button class="delete-btn" data-id="${e.id}">🗑️</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <p class="summe"><strong>Gesamtsumme:</strong> ${Number(total).toFixed(2)} €</p>

        <h3>➕ Neuer Eintrag</h3>
        <form id="entryForm">
          <input type="date" id="entryDate" required />
          <input type="number" step="0.01" id="entryAmount" placeholder="Betrag (€)" required />
          <input type="text" id="entryNote" placeholder="Notiz (optional)" />
          <select id="entryInstructor">
            ${instructors.map(f => `<option value="${f.id}" ${f.name === "k.A." ? "selected" : ""}>${f.name}</option>`).join("")}
          </select>
          <button type="submit">Eintrag speichern</button>
        </form>

        <div style="margin-top:20px; text-align:center;">
          <button id="backBtn" class="secondary">⬅️ Zurück zur Startseite</button>
        </div>
      `;

      resultsDiv.innerHTML = html;

      // --- Zurück ---
      document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = "/";
      });

      // --- Tätigkeiten-Seite in neuem Tab ---
      document.getElementById("minutesPageBtn").addEventListener("click", (e) => {
        e.preventDefault();
        console.log("🪟 Öffne Minuten-Seite (neuer Tab):", id);
        window.open(`/minutes.html?customer_id=${id}`, "_blank", "noopener,noreferrer");
      });

      // --- Kunden löschen ---
      document.getElementById("deleteCustomerBtn").addEventListener("click", async () => {
        if (!confirm("Diesen Kunden inklusive aller Einträge wirklich löschen?")) return;
        await fetch(`/api/customer/${id}`, { method: "DELETE" });
        window.location.href = "/";
      });

      // --- Neuer Eintrag speichern ---
      document.getElementById("entryForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const date = document.getElementById("entryDate").value;
        const amount = parseFloat(document.getElementById("entryAmount").value);
        const note = document.getElementById("entryNote").value;
        const fahrlehrer_id = parseInt(document.getElementById("entryInstructor").value, 10);

        await fetch("/api/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customer_id: id, date, amount, note, fahrlehrer_id }),
        });

        openCustomer(id);
      });

    } catch (err) {
      console.error("❌ Fehler in openCustomer:", err);
      resultsDiv.innerHTML = "<p>Fehler beim Laden des Kunden.</p>";
    }
  }

  // --- Papierkorb (Event Delegation global) ---
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("delete-btn")) {
      const id = e.target.dataset.id;
      if (!confirm("Eintrag wirklich löschen?")) return;

      try {
        await fetch(`/api/entry/${id}`, { method: "DELETE" });
        console.log("🗑️ Eintrag gelöscht:", id);
        e.target.closest("tr").remove();
      } catch (err) {
        console.error("❌ Fehler beim Löschen des Eintrags:", err);
      }
    }
  });

  // --- App-Start ---
  async function initApp() {
    await loadInstructors();
    await loadCount();
  }
  initApp();

  console.log("🏁 Initialisierung abgeschlossen");
});
