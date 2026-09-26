window.U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  now: () => Date.now(),
  id: (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4),
  fmt: n => Math.round(n).toLocaleString('ru-RU'),
  pct: (a, b) => b <= 0 ? 0 : Math.max(0, Math.min(100, (a / b) * 100)),
  pick: a => a[Math.floor(Math.random() * a.length)],
  rand: (a, b) => a + Math.random() * (b - a),
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])),
  dayKey: () => new Date().toISOString().slice(0, 10),
  msToClock(ms) { ms = Math.max(0, ms); const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60); return h ? `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${m}:${String(s % 60).padStart(2, '0')}`; },
  deep: x => JSON.parse(JSON.stringify(x)),
  money: (n, type = 'gold') => `<span class="money ${type}"><img class="currency-bars" src="assets/${type === 'gold' ? 'gold-bars.svg' : 'black-gold-bars.svg'}" alt="">${Math.round(n).toLocaleString('ru-RU')}</span>`
};
