window.UIProfile = {
  statDesc(k) {
    return {
      strength: 'Определяет базовый удар — от него масштабируются почти все боевые умения.',
      mass: 'Увеличивает максимальное здоровье и ценность защиты.',
      endurance: 'Увеличивает здоровье и снижает входящий урон.',
      agility: 'Сокращает задержку между базовыми ударами.',
      will: 'Усиливает лечение.',
      mastery: 'Повышает эффективность прокачанных карт.'
    }[k] || '';
  },
  render() {
    const a = Accounts.current();
    const stats = Object.entries(GameConfig.statNames).map(([k, n]) => {
      const cost = Economy.statCost(a, k);
      return `<div class="stat-upgrade">
        <div class="stat-copy"><b>${n}</b><span>${this.statDesc(k)}</span></div>
        <div class="stat-value">${a.stats[k]}</div>
        <button data-stat="${k}">+1 <small>${U.money(cost, 'gold')}</small></button>
      </div>`;
    }).join('');
    UIShell.render('profile', `
      <div class="profile-grid">
        <section class="card profile-hero">
          <div class="profile-avatar ${a.faction}">
            <div class="avatar-glow"></div>
            <div class="avatar-mark">${a.isAdmin ? 'A' : '⚔'}</div>
          </div>
          <div class="profile-main">
            <div class="eyebrow">${a.isAdmin ? 'АДМИНИСТРАТОР' : 'БОЕЦ ФРАКЦИИ'}</div>
            <h1>${U.esc(a.username)}</h1>
            <p>${GameConfig.factions[a.faction].name}</p>
            <div class="combat-kpis">
              <div><span>Мощь</span><strong>${U.fmt(Stats.power(a))}</strong></div>
              <div><span>Здоровье</span><strong>${U.fmt(Stats.maxHp(a))}</strong></div>
              <div><span>Базовый урон</span><strong>${U.fmt(Stats.baseHit(a))}</strong></div>
              <div><span>Скорость удара</span><strong>${(Stats.attackCooldown(a) / 1000).toFixed(2)}с</strong></div>
            </div>
          </div>
        </section>

        <section class="card profile-records">
          <div class="section-title"><span>Прогресс</span></div>
          <div class="record"><span>Побед за земли</span><b>${a.records.landsWon}</b></div>
          <div class="record"><span>Монстров побеждено</span><b>${a.records.monsterKills}</b></div>
          <div class="record"><span>Лучший вклад</span><b>${U.fmt(a.records.bestContribution)}</b></div>
          <div class="record"><span>Земель у фракции</span><b>${Lands.ownedCount(a.faction)}</b></div>
        </section>
      </div>

      <section class="card stats-card">
        <div class="section-title"><div><span>Характеристики персонажа</span><small>Прокачиваются только за обычное золото</small></div></div>
        <div class="stats-upgrades">${stats}</div>
      </section>
    `);
    document.querySelectorAll('[data-stat]').forEach(btn => btn.onclick = () => {
      try {
        Economy.buyStat(a, btn.dataset.stat);
        this.render();
      }
      catch (e) {
        alert(e.message);
      }
    });
  }
};
