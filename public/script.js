// --- Script für Kundenkartei-Fahrschule ---

const searchForm = document.getElementById("searchForm");
const firstInput = document.getElementById("first");
const lastInput = document.getElementById("last");
const resultsDiv = document.getElementById("results");
const countSpan = document.getElementById("count");
const createBtn = document.getElementById("createBtn");

let instructors = [];

// --- Fahrlehrer laden ---
async function loadInstructors() {
  try {
    const res = await fetch("/api/instructors");
    instructors = await res.json();
  } catch (err) {
    console.error("Fehler beim Laden der Fahrlehrer:", err);
  }
}

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
    await loadInstructors();
    const res = await fetch(`/api/customer/${id}`);
    const data = await res.json();

    if (!data || !data.customer) {
      resultsDiv.innerHTML = "<p>❌ Kunde nicht gefunden.</p>";
      return;
    }

    const entries = Array.isArray(data.entries) ? data.entries : [];
    const total = data.total ?? 0;

    let html = `
      <h2>
        <span id="customerName" data-id="${data.customer.id}">
          ${data.customer.full_name}
        </span>
        <button id="editCustomerBtn">✏️</button>
        <button id="saveCustomerBtn" style="display:none;">💾</button>
        <button id="cancelCustomerBtn" style="display:none;">❌</button>
      </h2>
      <p><strong>ID:</strong> ${data.customer.id}</p>
      <button id="deleteCustomerBtn" class="danger-btn">🗑️ Kunden löschen</button>
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
              <td class="editable date">${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
              <td class="editable amount">${Number(e.amount || 0).toFixed(2)}</td>
              <td class="editable note">${e.note || ""}</td>
              <td class="editable fahrlehrer" data-f="${e.fahrlehrer_id || 1}">
                ${(instructors.find(f => f.id === e.fahrlehrer_id)?.name) || "k.A."}
              </td>
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

    // --- Formular für neuen Eintrag ---
    html += `
      <h3>➕ Neuer Eintrag</h3>
      <form id="entryForm">
        <input type="date" id="entryDate" required />
        <input type="number" step="0.01" id="entryAmount" placeholder="Betrag (€)" required />
        <input type="text" id="entryNote" placeholder="Notiz (optional)" />
        <select id="entryInstructor">
  ${instructors
    .sort((a, b) => (a.name === "k.A." ? 1 : b.name === "k.A." ? -1 : 0))
    .map(f => {
      const selected = f.name === "k.A." ? "selected" : "";
      return `<option value="${f.id}" ${selected}>${f.name}</option>`;
    })
    .join("")}
</select>

        <button type="submit">Eintrag speichern</button>
      </form>
    `;

    resultsDiv.innerHTML = html;

    // --- Neuen Eintrag speichern ---
    document.getElementById("entryForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const date = document.getElementById("entryDate").value;
      const amount = parseFloat(document.getElementById("entryAmount").value);
      const note = document.getElementById("entryNote").value;
      const fahrlehrer_id = parseInt(document.getElementById("entryInstructor").value, 10);

      await fetch("/api/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: id, date, amount, note, fahrlehrer_id })
      });

      openCustomer(id);
    });

    // --- Kundenname bearbeiten ---
    const editBtn = document.getElementById("editCustomerBtn");
    const saveBtn = document.getElementById("saveCustomerBtn");
    const cancelBtn = document.getElementById("cancelCustomerBtn");
    const nameSpan = document.getElementById("customerName");

    editBtn.addEventListener("click", () => {
      const current = nameSpan.textContent.trim();
      nameSpan.innerHTML = `<input id="editCustomerName" type="text" value="${current}" />`;
      editBtn.style.display = "none";
      saveBtn.style.display = "inline";
      cancelBtn.style.display = "inline";
    });

    saveBtn.addEventListener("click", async () => {
      const newName = document.getElementById("editCustomerName").value.trim();
      if (!newName) return alert("Name darf nicht leer sein.");

      await fetch(`/api/customer/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newName })
      });

      openCustomer(id);
    });

    cancelBtn.addEventListener("click", () => openCustomer(id));

    // --- Kunden löschen ---
    document.getElementById("deleteCustomerBtn").addEventListener("click", async () => {
      if (!confirm("Diesen Kunden inklusive aller Einträge wirklich löschen?")) return;

      await fetch(`/api/customer/${id}`, { method: "DELETE" });
      window.location.href = "/";
    });

  } catch (err) {
    resultsDiv.innerHTML = "<p>❌ Fehler beim Laden des Kunden.</p>";
    console.error("Fehler in openCustomer:", err);
  }
}

// --- Eintrag löschen ---
document.addEventListener("click", async (event) => {
  if (event.target.classList.contains("delete-btn")) {
    const id = event.target.dataset.id;
    if (!confirm("Eintrag wirklich löschen?")) return;

    await fetch(`/api/entry/${id}`, { method: "DELETE" });
    event.target.closest("tr").remove();
  }
});

// --- Inline-Bearbeitung inkl. Fahrlehrer ---
document.addEventListener("click", async (e) => {
  const row = e.target.closest("tr");
  if (!row) return;
  const id = row.dataset.id;

  if (e.target.classList.contains("edit-entry")) {
    const dateCell = row.querySelector(".date");
    const amountCell = row.querySelector(".amount");
    const noteCell = row.querySelector(".note");
    const fahrCell = row.querySelector(".fahrlehrer");
    const currentF = parseInt(fahrCell.getAttribute("data-f") || "1", 10);

    dateCell.innerHTML = `<input type="text" value="${dateCell.textContent.trim()}" />`;
    amountCell.innerHTML = `<input type="text" value="${amountCell.textContent.trim()}" />`;
    noteCell.innerHTML = `<input type="text" value="${noteCell.textContent.trim()}" />`;

    fahrCell.innerHTML = `
      <select class="fahrSelect">
        ${instructors.map(f => `<option value="${f.id}" ${f.id === currentF ? "selected" : ""}>${f.name}</option>`).join("")}
      </select>
    `;

    e.target.outerHTML = `<button class="save-entry">💾</button><button class="cancel-entry">❌</button>`;
    return;
  }

  if (e.target.classList.contains("save-entry")) {
    const dateInput = row.querySelector(".date input");
    const amountInput = row.querySelector(".amount input");
    const noteInput = row.querySelector(".note input");
    const fahrSel = row.querySelector(".fahrSelect");

    let isoDate = dateInput.value;
    if (isoDate.includes(".")) {
      const [t, m, j] = isoDate.split(".");
      isoDate = `${j}-${m}-${t}`;
    }

    const updated = {
      date: isoDate,
      amount: parseFloat(amountInput.value),
      note: noteInput.value.trim(),
      fahrlehrer_id: parseInt(fahrSel.value, 10)
    };

    await fetch(`/api/entry/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });

    openCustomer(document.getElementById("customerName").dataset.id);
  }

  if (e.target.classList.contains("cancel-entry")) {
    openCustomer(document.getElementById("customerName").dataset.id);
  }
});

// --- App-Start ---
async function initApp() {
  await loadInstructors();   // Fahrlehrer zuerst laden
  await loadCount();         // Danach Kundenanzahl laden
}
initApp();

