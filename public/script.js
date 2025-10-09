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
      resultsDiv.innerHTML = "<p>❌ Kein Kunde gefunden.</p>";
      return;
    }

    resultsDiv.innerHTML = matches
      .map(c => `<div class="customer" data-id="${c.id}">${c.full_name}</div>`)
      .join("");

    // Klick auf Kunde
    document.querySelectorAll(".customer").forEach(div => {
      div.addEventListener("click", () => openCustomer(div.dataset.id));
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

    if (!data.customer) {
      resultsDiv.innerHTML = "<p>❌ Kunde nicht gefunden.</p>";
      return;
    }

    let html = `
      <h2>${data.customer.full_name}</h2>
      <p><strong>ID:</strong> ${data.customer.id}</p>
    `;

    if (data.entries.length > 0) {
      html += `
        <table>
          <thead>
            <tr><th>Datum</th><th>Betrag (€)</th><th>Notiz</th></tr>
          </thead>
          <tbody>
            ${data.entries
              .map(e => `
                <tr>
                  <td>${new Date(e.date).toLocaleDateString("de-DE")}</td>
                  <td>${e.amount}</td>
                  <td>${e.note || ""}</td>
                </tr>
              `)
              .join("")}
          </tbody>
        </table>
      `;
    } else {
      html += "<p>Keine Einträge vorhanden.</p>";
    }

    resultsDiv.innerHTML = html;
  } catch (err) {
    console.error(err);
    resultsDiv.innerHTML = "<p>❌ Fehler beim Laden des Kunden.</p>";
  }
}

// --- Dummy für Neu anlegen (noch nicht aktiv) ---
createBtn.addEventListener("click", () => {
  alert("Funktion 'Neuen Kunden anlegen' kommt bald 😊");
});

// --- Initialer Aufruf ---
loadCount();
