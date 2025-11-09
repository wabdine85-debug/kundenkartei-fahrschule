console.log("✅ script.js gestartet");

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM geladen – Script startet Initialisierung...");

  // --- Grund-Elemente der Startseite ---
  const searchForm = document.getElementById("searchForm");
  const firstInput = document.getElementById("first");
  const lastInput = document.getElementById("last");
  const resultsDiv = document.getElementById("results");
  const countSpan = document.getElementById("count");
  const createBtn = document.getElementById("createBtn");
  const minutesPageBtn = document.getElementById("minutesPageBtn");

  if (!searchForm || !firstInput || !lastInput || !resultsDiv || !countSpan) {
    console.error("❌ Notwendige DOM-Elemente nicht gefunden. Script bricht ab.");
    return;
  }

  console.log("✅ DOM-Elemente gefunden – Script läuft...");

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

  // --- Gesamtanzahl Kunden laden ---
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

  // --- Kunde suchen ---
  searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const first = firstInput.value.trim().toLowerCase();
    const last = lastInput.value.trim().toLowerCase();

    resultsDiv.innerHTML = "<p class='muted'>Suche läuft...</p>";

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

        const createNewBtn = document.getElementById("createNew");
        if (createNewBtn) {
          createNewBtn.addEventListener("click", async () => {
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
        }
        return;
      }

      // Trefferliste anzeigen
      resultsDiv.innerHTML = matches
        .map(
          (c) => `
            <div class="customer" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid #ccc;">
              <span>${c.full_name}</span>
              <button class="openBtn" data-id="${c.id}" style="padding:4px 8px;">Kunde öffnen</button>
            </div>
          `
        )
        .join("");

      document.querySelectorAll(".openBtn").forEach((btn) => {
        btn.addEventListener("click", () => openCustomer(btn.dataset.id));
      });
    } catch (err) {
      resultsDiv.innerHTML = "<p>Fehler bei der Suche.</p>";
      console.error("Fehler bei der Suche:", err);
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

      // Tabelle Einträge
      html += `
        <table>
          <thead>
            <tr><th>Datum</th><th>Betrag (€)</th><th>Notiz</th><th>Fahrlehrer</th><th></th></tr>
          </thead>
          <tbody>
            ${entries
              .map(
                (e) => `
                  <tr data-id="${e.id}">
                    <td class="editable date">${e.date ? new Date(e.date).toLocaleDateString("de-DE") : ""}</td>
                    <td class="editable amount">${Number(e.amount || 0).toFixed(2)}</td>
                    <td class="editable note">${e.note || ""}</td>
                    <td class="editable fahrlehrer" data-f="${e.fahrlehrer_id || 1}">
                      ${(instructors.find((f) => f.id === e.fahrlehrer_id)?.name) || "k.A."}
                    </td>
                    <td>
                      <button class="edit-entry">✏️</button>
                      <button class="delete-btn" data-id="${e.id}">🗑️</button>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
        <p class="summe"><strong>Gesamtsumme:</strong> ${Number(total).toFixed(2)} €</p>
      `;

      // Formular neuer Eintrag + Zurück-Button
      html += `
        <h3>➕ Neuer Eintrag</h3>
        <form id="entryForm">
          <input type="date" id="entryDate" required />
          <input type="number" step="0.01" id="entryAmount" placeholder="Betrag (€)" required />
          <input type="text" id="entryNote" placeholder="Notiz (optional)" />
          <select id="entryInstructor">
            ${instructors
              .sort((a, b) =>
                a.name === "k.A."
                  ? 1
                  : b.name === "k.A."
                  ? -1
                  : 0
              )
              .map((f) => {
                const selected = f.name === "k.A." ? "selected" : "";
                return `<option value="${f.id}" ${selected}>${f.name}</option>`;
              })
              .join("")}
          </select>
          <button type="submit">Eintrag speichern</button>
        </form>

        <div style="margin-top:20px; text-align:center;">
          <button id="backBtn" class="secondary" style="padding:6px 12px;">
            ⬅️ Zurück zur Startseite
          </button>
        </div>
      `;

      resultsDiv.innerHTML = html;

      // Zurück-Button
      const backBtn = document.getElementById("backBtn");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          window.location.href = "/";
        });
      }

      // Neuer Eintrag speichern
      const entryForm = document.getElementById("entryForm");
      if (entryForm) {
        entryForm.addEventListener("submit", async (e) => {
          e.preventDefault();
          const date = document.getElementById("entryDate").value;
          const amount = parseFloat(document.getElementById("entryAmount").value);
          const note = document.getElementById("entryNote").value;
          const fahrlehrer_id = parseInt(
            document.getElementById("entryInstructor").value,
            10
          );

          await fetch("/api/entry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customer_id: id,
              date,
              amount,
              note,
              fahrlehrer_id,
            }),
          });

          openCustomer(id);
        });
      }

      // Kundenname bearbeiten
      const editBtn = document.getElementById("editCustomerBtn");
      const saveBtn = document.getElementById("saveCustomerBtn");
      const cancelBtn = document.getElementById("cancelCustomerBtn");
      const nameSpan = document.getElementById("customerName");

      if (editBtn && saveBtn && cancelBtn && nameSpan) {
        editBtn.addEventListener("click", () => {
          const current = nameSpan.textContent.trim();
          nameSpan.innerHTML = `<input id="editCustomerName" type="text" value="${current}" />`;
          editBtn.style.display = "none";
          saveBtn.style.display = "inline";
          cancelBtn.style.display = "inline";
        });

        saveBtn.addEventListener("click", async () => {
          const newName = document
            .getElementById("editCustomerName")
            .value.trim();
          if (!newName) return alert("Name darf nicht leer sein.");

          await fetch(`/api/customer/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ full_name: newName }),
          });

          openCustomer(id);
        });

        cancelBtn.addEventListener("click", () => openCustomer(id));
      }

      // Kunden löschen
      const deleteCustomerBtn = document.getElementById("deleteCustomerBtn");
      if (deleteCustomerBtn) {
        deleteCustomerBtn.addEventListener("click", async () => {
          if (
            !confirm(
              "Diesen Kunden inklusive aller Einträge wirklich löschen?"
            )
          )
            return;

          await fetch(`/api/customer/${id}`, { method: "DELETE" });
          window.location.href = "/";
        });
      }
    } catch (err) {
      resultsDiv.innerHTML =
        "<p>❌ Fehler beim Laden des Kunden.</p>";
      console.error("Fehler in openCustomer:", err);
    }
  }

  // --- Einträge löschen oder bearbeiten (Delegation für dynamischen Inhalt) ---
resultsDiv.addEventListener("click", async (event) => {
  const target = event.target;

  // 🗑️ Löschen
  if (target.classList.contains("delete-btn")) {
    const id = target.dataset.id;
    if (!id) return;
    if (!confirm("Eintrag wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/entry/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Fehler beim Löschen");
      target.closest("tr")?.remove();
      console.log("🗑️ Eintrag gelöscht:", id);
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
    }
  }
});


  // --- Globaler Click-Handler für dynamische Buttons (Einträge + Inline-Edit) ---
  document.addEventListener("click", async (event) => {
    const target = event.target;

    // Eintrag löschen
    if (target.classList.contains("delete-btn")) {
      const id = target.dataset.id;
      if (!id) return;
      if (!confirm("Eintrag wirklich löschen?")) return;

      try {
        await fetch(`/api/entry/${id}`, { method: "DELETE" });
        const row = target.closest("tr");
        if (row) row.remove();
        console.log("🗑️ Eintrag gelöscht:", id);
      } catch (err) {
        console.error("Fehler beim Löschen des Eintrags:", err);
      }
    }

    // Inline-Bearbeitung starten
    if (target.classList.contains("edit-entry")) {
      const row = target.closest("tr");
      if (!row) return;

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

      target.outerHTML = `
        <button class="save-entry">💾</button>
        <button class="cancel-entry">❌</button>
      `;
    }

    // Inline-Bearbeitung speichern
    if (target.classList.contains("save-entry")) {
      const row = target.closest("tr");
      if (!row) return;
      const id = row.dataset.id;
      if (!id) return;

      const dateInput = row.querySelector(".date input");
      const amountInput = row.querySelector(".amount input");
      const noteInput = row.querySelector(".note input");
      const fahrSel = row.querySelector(".fahrSelect");

      let isoDate = dateInput.value.trim();
      if (isoDate.includes(".")) {
        const [t, m, j] = isoDate.split(".");
        isoDate = `${j}-${m}-${t}`;
      }

      const updated = {
        date: isoDate,
        amount: parseFloat(amountInput.value),
        note: noteInput.value.trim(),
        fahrlehrer_id: parseInt(fahrSel.value, 10),
      };

      try {
        await fetch(`/api/entry/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });

        const currentCustomer =
          document.getElementById("customerName")?.dataset.id;
        if (currentCustomer) openCustomer(currentCustomer);
      } catch (err) {
        console.error("Fehler beim Speichern der Bearbeitung:", err);
      }
    }

    // Inline-Bearbeitung abbrechen
    if (target.classList.contains("cancel-entry")) {
      const currentCustomer =
        document.getElementById("customerName")?.dataset.id;
      if (currentCustomer) openCustomer(currentCustomer);
    }
  });

  // --- Button "Tätigkeiten / Minuten" (oben auf Hauptseite) ---
if (minutesPageBtn) {
  minutesPageBtn.addEventListener("click", () => {
    const openedCustomer = document.getElementById("customerName");
    if (openedCustomer && openedCustomer.dataset.id) {
      const id = openedCustomer.dataset.id;
      console.log("🪟 Öffne Minuten-Seite in neuem Tab für Kunde:", id);

      // ✅ Erstelle einen echten <a>-Link → öffnet garantiert neuen Tab
      const link = document.createElement("a");
      link.href = `/minutes.html?customer_id=${id}`;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } else {
      alert("Bitte zuerst einen Kunden öffnen, um Tätigkeiten zu erfassen.");
    }
  });
}




  // --- App-Start ---
  async function initApp() {
    await loadInstructors();
    await loadCount();
  }

  initApp();
  console.log("🏁 Initialisierung abgeschlossen");
});
