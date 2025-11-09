console.log("✅ script.js gestartet");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM geladen – Initialisierung...");

  // Basis-Elemente der Startseite
  const searchForm = document.getElementById("searchForm");
  const firstInput = document.getElementById("first");
  const lastInput = document.getElementById("last");
  const resultsDiv = document.getElementById("results");
  const countSpan = document.getElementById("count");
  const createBtn = document.getElementById("createBtn");
  const minutesTopBtn = document.getElementById("minutesPageBtn"); // Button oben neben "Neuen Kunden anlegen"

  if (!searchForm || !resultsDiv) {
    console.error("❌ Notwendige DOM-Elemente fehlen. Script abgebrochen.");
    return;
  }

  let instructors = [];

  // --- Fahrlehrer laden ---
  async function loadInstructors() {
    try {
      const res = await fetch("/api/instructors");
      instructors = await res.json();
    } catch (err) {
      console.error("❌ Fehler beim Laden der Fahrlehrer:", err);
    }
  }

  // --- Kundenanzahl laden ---
  async function loadCount() {
    try {
      const res = await fetch("/api/customers");
      const customers = await res.json();
      if (countSpan) countSpan.textContent = customers.length;
    } catch (err) {
      console.error("❌ Fehler beim Laden der Kunden:", err);
      if (countSpan) countSpan.textContent = "–";
    }
  }

  // --- Kunde in Detailansicht rendern ---
  async function openCustomer(id) {
    try {
      await loadInstructors();

      const res = await fetch(`/api/customer/${id}`);
      const data = await res.json();

      if (!data || !data.customer) {
        resultsDiv.innerHTML = "<p>❌ Kunde nicht gefunden.</p>";
        return;
      }

      const customer = data.customer;
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const total = Number(data.total || 0);

      let html = `
        <h2>
          <span id="customerName" data-id="${customer.id}">${customer.full_name}</span>
          <button id="editCustomerBtn">✏️</button>
          <button id="saveCustomerBtn" style="display:none;">💾</button>
          <button id="cancelCustomerBtn" style="display:none;">❌</button>
        </h2>
        <p><strong>ID:</strong> ${customer.id}</p>

        <div style="margin-bottom:10px;">
          <button id="deleteCustomerBtn" class="danger-btn">🗑️ Kunden löschen</button>
          <button id="minutesInlineBtn" class="secondary">⏱ Tätigkeiten / Minuten</button>
          <button id="backBtn" class="secondary">⬅️ Zurück zur Suche</button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Betrag (€)</th>
              <th>Notiz</th>
              <th>Fahrlehrer</th>
              <th>Aktion</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .map((e) => {
                const fahrName =
                  instructors.find((f) => f.id === e.fahrlehrer_id)?.name || "k.A.";
                return `
                  <tr data-id="${e.id}">
                    <td class="date">${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
                    <td class="amount">${Number(e.amount || 0).toFixed(2)}</td>
                    <td class="note">${e.note || ""}</td>
                    <td class="fahrlehrer" data-f="${e.fahrlehrer_id || ""}">${fahrName}</td>
                    <td>
                      <button class="edit-entry">✏️</button>
                      <button class="delete-btn" data-id="${e.id}">🗑️</button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>

        <p class="summe"><strong>Gesamtsumme:</strong> ${total.toFixed(2)} €</p>

        <h3>➕ Neuer Eintrag</h3>
        <form id="entryForm">
          <input type="date" id="entryDate" required />
          <input type="number" step="0.01" id="entryAmount" placeholder="Betrag (€)" required />
          <input type="text" id="entryNote" placeholder="Notiz (optional)" />
          <select id="entryInstructor">
            ${instructors
              .map((f) => `<option value="${f.id}" ${f.name === "k.A." ? "selected" : ""}>${f.name}</option>`)
              .join("")}
          </select>
          <button type="submit">Eintrag speichern</button>
        </form>
      `;

      resultsDiv.innerHTML = html;

      // --- Buttons in der Detailansicht ---

      // Zurück zur Suche
      document.getElementById("backBtn").addEventListener("click", () => {
        resultsDiv.innerHTML = "";
        firstInput.value = "";
        lastInput.value = "";
      });

      // Kunde löschen
      document.getElementById("deleteCustomerBtn").addEventListener("click", async () => {
        if (!confirm("Diesen Kunden inklusive aller Einträge wirklich löschen?")) return;
        await fetch(`/api/customer/${customer.id}`, { method: "DELETE" });
        resultsDiv.innerHTML = "<p>✅ Kunde gelöscht.</p>";
        await loadCount();
      });

      // Kunde bearbeiten (Name)
      const editBtn = document.getElementById("editCustomerBtn");
      const saveBtn = document.getElementById("saveCustomerBtn");
      const cancelBtn = document.getElementById("cancelCustomerBtn");
      const nameSpan = document.getElementById("customerName");

      editBtn.addEventListener("click", () => {
        const current = nameSpan.textContent.trim();
        nameSpan.innerHTML = `<input id="editCustomerName" type="text" value="${current}" />`;
        editBtn.style.display = "none";
        saveBtn.style.display = "inline-block";
        cancelBtn.style.display = "inline-block";
      });

      saveBtn.addEventListener("click", async () => {
        const newName = document.getElementById("editCustomerName").value.trim();
        if (!newName) return alert("Name darf nicht leer sein.");
        await fetch(`/api/customer/${customer.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: newName }),
        });
        openCustomer(customer.id);
      });

      cancelBtn.addEventListener("click", () => {
        openCustomer(customer.id);
      });

      // Neuer Eintrag speichern
      document.getElementById("entryForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const date = document.getElementById("entryDate").value;
        const amount = parseFloat(document.getElementById("entryAmount").value);
        const note = document.getElementById("entryNote").value;
        const fahrlehrer_id = parseInt(
          document.getElementById("entryInstructor").value,
          10
        );

        if (isNaN(amount)) {
          alert("Bitte gültigen Betrag eingeben.");
          return;
        }

        await fetch("/api/entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer_id: customer.id,
            date,
            amount,
            note: note && note.trim().length > 0 ? note.trim() : null,
            fahrlehrer_id,
          }),
        });

        openCustomer(customer.id);
      });

      // Inline-Minuten-Button in der Detailansicht (neuer Tab)
      document.getElementById("minutesInlineBtn").addEventListener("click", () => {
        const idVal = document.getElementById("customerName")?.dataset.id;
        if (!idVal) return alert("Kein Kunde geöffnet.");
        window.open(`/minutes.html?customer_id=${idVal}`, "_blank", "noopener,noreferrer");
      });

    } catch (err) {
      console.error("❌ Fehler in openCustomer:", err);
      resultsDiv.innerHTML = "<p>Fehler beim Laden des Kunden.</p>";
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

      const matches = customers.filter((c) => {
        const name = c.full_name.toLowerCase();
        return (first && name.includes(first)) || (last && name.includes(last));
      });

      if (matches.length === 0) {
        resultsDiv.innerHTML = `
          <p>❌ Kein Kunde gefunden.</p>
          <button id="createNew">Neuen Kunden '${firstInput.value} ${lastInput.value}' anlegen</button>
        `;
        const createNew = document.getElementById("createNew");
        if (createNew) {
          createNew.addEventListener("click", async () => {
            const full_name = `${firstInput.value} ${lastInput.value}`.trim();
            if (!full_name) return;
            const res = await fetch("/api/customer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ full_name }),
            });
            const data = await res.json();
            await loadCount();
            openCustomer(data.id);
          });
        }
        return;
      }

      // Trefferliste anzeigen
      resultsDiv.innerHTML = matches
        .map(
          (c) => `
          <div class="customer" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #ccc;">
            <span>${c.full_name}</span>
            <button class="openBtn" data-id="${c.id}">Kunde öffnen</button>
          </div>
        `
        )
        .join("");

      document.querySelectorAll(".openBtn").forEach((btn) => {
        btn.addEventListener("click", () => openCustomer(btn.dataset.id));
      });
    } catch (err) {
      console.error("❌ Fehler bei Suche:", err);
      resultsDiv.innerHTML = "<p>Fehler bei der Suche.</p>";
    }
  });

  // --- Oben: "Neuen Kunden anlegen"-Button ---
  if (createBtn) {
    createBtn.addEventListener("click", async () => {
      const full_name = prompt("Name des neuen Kunden:");
      if (!full_name || !full_name.trim()) return;
      const res = await fetch("/api/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: full_name.trim() }),
      });
      const data = await res.json();
      await loadCount();
      openCustomer(data.id);
    });
  }

// --- Tätigkeiten / Minuten (oberer Button) ---
// 👉 Test: gleiche Seite öffnen (um Browserblocker auszuschließen)
const minutesPageBtn = document.getElementById("minutesPageBtn");
if (minutesPageBtn) {
  minutesPageBtn.addEventListener("click", (e) => {
    e.preventDefault();

    const openedCustomer = document.getElementById("customerName");
    if (!openedCustomer || !openedCustomer.dataset.id) {
      alert("Bitte zuerst einen Kunden öffnen, um Tätigkeiten zu erfassen.");
      return;
    }

    const id = openedCustomer.dataset.id;
    const url = `/minutes.html?customer_id=${id}`;
    console.log("🌐 Test: Weiterleitung im selben Tab zu", url);

    // 👉 Testweise im selben Tab öffnen
    window.location.href = url;
  });
}



// --- 🗑️ Papierkorb / Eintrag löschen + Inline-Bearbeitung ---
document.addEventListener("click", async (event) => {
  const target = event.target;
  const btn = target.closest("button");
  const row = target.closest("tr");
  if (!btn) return;

  // 🗑️ Eintrag löschen
  if (btn.classList.contains("delete-btn")) {
    const id = btn.dataset.id;
    if (!id) return;
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/entry/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      if (row) row.remove();
      console.log(`🗑️ Eintrag ${id} gelöscht`);
    } catch (err) {
      console.error("❌ Fehler beim Löschen:", err);
    }
    return;
  }

  // ✏️ Inline-Bearbeitung starten
  if (btn.classList.contains("edit-entry") && row) {
    const dateCell = row.querySelector(".date");
    const amountCell = row.querySelector(".amount");
    const noteCell = row.querySelector(".note");
    const fahrCell = row.querySelector(".fahrlehrer");

    const currentF = parseInt(fahrCell.dataset.f || "0", 10);

    dateCell.innerHTML = `<input type="date" value="${toISODate(
      dateCell.textContent.trim()
    )}" />`;
    amountCell.innerHTML = `<input type="number" step="0.01" value="${amountCell.textContent.trim()}" />`;
    noteCell.innerHTML = `<input type="text" value="${noteCell.textContent.trim()}" />`;

    fahrCell.innerHTML = `
      <select class="fahrSelect">
        ${instructors
          .map(
            (f) =>
              `<option value="${f.id}" ${
                f.id === currentF ? "selected" : ""
              }>${f.name}</option>`
          )
          .join("")}
      </select>
    `;

    btn.outerHTML = `
      <button class="save-entry">💾</button>
      <button class="cancel-entry">❌</button>
    `;
    return;
  }

  // 💾 Inline speichern
  if (btn.classList.contains("save-entry") && row) {
    const id = row.dataset.id;
    const dateInput = row.querySelector(".date input");
    const amountInput = row.querySelector(".amount input");
    const noteInput = row.querySelector(".note input");
    const fahrSel = row.querySelector(".fahrSelect");

    const updated = {
      date: dateInput.value,
      amount: parseFloat(amountInput.value),
      note: noteInput.value.trim(),
      fahrlehrer_id: parseInt(fahrSel.value, 10),
    };

    const currentCustomer = document.getElementById("customerName")?.dataset.id;

    try {
      await fetch(`/api/entry/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (currentCustomer) openCustomer(currentCustomer);
    } catch (err) {
      console.error("❌ Fehler beim Speichern des Eintrags:", err);
    }
    return;
  }

  // ❌ Inline abbrechen
  if (btn.classList.contains("cancel-entry")) {
    const currentCustomer = document.getElementById("customerName")?.dataset.id;
    if (currentCustomer) openCustomer(currentCustomer);
    return;
  }
});

// --- Hilfsfunktion: deutsches Datum → ISO ---
function toISODate(deDate) {
  if (!deDate) return "";
  const parts = deDate.split(".");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

// --- Start ---
(async () => {
  await loadInstructors();
  await loadCount();
  console.log("🏁 Initialisierung abgeschlossen");
})();
});
