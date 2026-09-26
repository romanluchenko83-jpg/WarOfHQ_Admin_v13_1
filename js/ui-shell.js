window.UIShell = {
  render(page, body) {
    const a = Accounts.current(); if (!a) {
      return UIAuth.render();
    } Raid.sync(a); document.getElementById('app').innerHTML = `<div class="shell"><div class="topbar"><div><div class="brand">Война фракций</div><div class="small muted">${U.esc(a.username)} · ${GameConfig.factions[a.faction].name}${a.isAdmin ? ' · ADMIN' : ''}</div></div><div class="nav">${[['profile', 'Главная'], ['raid', 'Дозор'], ['monsters', 'Монстры'], ['lands', 'Битвы за земли']].map(([id, t]) => `<button data-nav="${id}" class="${page === id ? 'active' : ''}">${t}</button>`).join('')}</div><div class="currency">${U.money(a.gold, 'gold')}${U.money(a.blackGold, 'black')}<button id="logout">Выйти</button></div></div><main class="page">${body}</main></div>`; document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => App.show(b.dataset.nav)); document.getElementById('logout').onclick = () => { Accounts.logout(); UIAuth.render(); };
  }
};
