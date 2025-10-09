async function fetchCount() {
  const r = await fetch('/api/stats/count');
  const { count } = await r.json();
  document.getElementById('count').textContent = count;
}

async function search(first, last) {
  const params = new URLSearchParams();
  if (first) params.set('first', first);
  if (last) params.set('last', last);
  const r = await fetch('/api/customers?' + params.toString());
  return await r.json();
}

function renderResults(list) {
  const el = document.getElementById('results');
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = '<div class="muted">Keine Treffer</div>';
    return;
  }
  for (const c of list) {
    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `<div>${c.full_name}</div><a href="/kunde.html?id=${c.id}">Öffnen →</a>`;
    el.appendChild(div);
  }
}

async function createCustomer(full_name) {
  const r = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name })
  });
  if (!r.ok) throw new Error('Fehler beim Anlegen');
  return await r.json();
}

const form = document.getElementById('searchForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const first = document.getElementById('first').value.trim();
  const last = document.getElementById('last').value.trim();
  const list = await search(first, last);
  renderResults(list);
  if (!list.length && (first || last)) {
    const name = [first, last].filter(Boolean).join(' ').trim();
    if (name && confirm(`Kein Kunde gefunden.\nNeuen Kunden anlegen: \"${name}\"?`)) {
      const c = await createCustomer(name);
      location.href = `/kunde.html?id=${c.id}`;
    }
  }
});

document.getElementById('createBtn').addEventListener('click', async () => {
  const first = document.getElementById('first').value.trim();
  const last = document.getElementById('last').value.trim();
  const name = [first, last].filter(Boolean).join(' ').trim();
  if (!name) return alert('Bitte Vor- und/oder Nachname eingeben');
  const c = await createCustomer(name);
  location.href = `/kunde.html?id=${c.id}`;
});

fetchCount();
