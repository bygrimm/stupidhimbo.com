/* Moodshuffle public client. Pinterest credentials stay in the Cloudflare
   Worker; this browser only asks for a category and receives one credited Pin. */
const API = 'https://moodshuffle-api.stupidhimbo.workers.dev/api/draw';
const CATEGORIES = [
  { id: 'settings-everything', label: 'everything', jar: true },
  { id: 'settings-unsorted', label: 'unsorted' },
  { id: 'settings-urban', label: 'urban / city' },
  { id: 'settings-luxury', label: 'luxury' },
  { id: 'settings-nature', label: 'rural / nature' },
  { id: 'settings-historical-fantasy', label: 'historical / fantasy' },
  { id: 'settings-futuristic', label: 'futuristic' },
  { id: 'settings-apocalyptic', label: 'apocalyptic' },
  { id: 'settings-gothic', label: 'haunted / gothic' },
  { id: 'settings-cozy', label: 'cozy / domestic' },
];
const LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

const chips = document.querySelector('#chips'), button = document.querySelector('#draw'),
      message = document.querySelector('#message'), preview = document.querySelector('#preview');
let selected = CATEGORIES[0].id;

for (const c of CATEGORIES) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = c.jar ? 'chip jar' : 'chip';
  chip.dataset.category = c.id;
  chip.textContent = c.label;
  chip.setAttribute('aria-pressed', String(c.id === selected));
  chips.append(chip);
}
chips.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  selected = chip.dataset.category;
  for (const other of chips.querySelectorAll('.chip')) other.setAttribute('aria-pressed', String(other === chip));
});

button.addEventListener('click', async () => {
  button.disabled = true;
  message.className = 'status';
  message.textContent = selected === 'settings-everything' ? 'Reaching into the jar…' : `Drawing from ${LABELS[selected]}…`;
  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: selected }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Draw failed.');
    const img = document.createElement('img');
    img.src = data.image;
    img.alt = data.alt;
    img.loading = 'eager';
    const link = document.createElement('a');
    link.href = data.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.append(img);
    const caption = document.createElement('p');
    caption.className = 'caption';
    const from = selected === 'settings-everything' ? `the jar · ${LABELS[data.category] || data.category}` : LABELS[data.category] || data.category;
    caption.textContent = `${data.title || 'open this Pin on Pinterest'} — ${from} · ${data.count} image Pins`;
    preview.replaceChildren(link, caption);
    message.textContent = `source: Pinterest`;
  } catch (e) {
    message.className = 'status error';
    message.textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
