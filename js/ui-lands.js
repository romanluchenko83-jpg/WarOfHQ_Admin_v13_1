window.UILands = {
  tab: 'skills',
  timer: null,
  render(tab = this.tab) {
    this.tab = tab;
    const a = Accounts.current();
    Lands.tickIncome();
    const incomePreview = Lands.claimIncome(a);
    const subtabs = `<div class="subtabs modern-tabs">
      <button data-sub="skills" class="${tab === 'skills' ? 'active' : ''}">Навыки и роль</button>
      <button data-sub="map" class="${tab === 'map' ? 'active' : ''}">Карта битвы</button>
    </div>`;
    let body = '';
    if (tab === 'skills') {
      const roles = Object.entries(GameConfig.roleNames).map(([r, name]) => {
        const art = { beast: '🐺', tank: '🛡️', healer: '✦', ninja: '🥷' }[r];
        const subtitle = { beast: 'массовый урон и снятие щитов', tank: 'защита, щиты и выживание', healer: 'лечение и воскрешение', ninja: 'контроль лекарей и пробитие щитов' }[r];
        return `<button data-role="${r}" class="role-card role-${r} ${a.lastRole === r ? 'active' : ''}">
          <span class="role-art">${art}</span><span class="role-name">${name}</span><small>${subtitle}</small>
        </button>`;
      }).join('');
      const skills = Object.entries(a.skills[a.lastRole]).map(([id, s]) => {
        const d = Skills.defs[a.lastRole][id], cost = Economy.skillCost(s.level);
        return `<article class="skill-card">
          <div class="skill-head"><div><b>${d.name}</b><span>ур. ${s.level}/25</span></div><em>${Skills.valueText(a, a.lastRole, id)}</em></div>
          <p>${d.desc}</p>
          <button data-skill="${id}" ${s.level >= 25 ? 'disabled' : ''}>${s.level >= 25 ? 'Максимальный уровень' : `Прокачать · ${U.money(cost, 'black')}`}</button>
        </article>`;
      }).join('');
      body = `<section class="card land-skills-card">
        <div class="section-title"><div><span>Роль на битву за землю</span><small>Роли действуют только в этом режиме</small></div></div>
        <div class="role-picker">${roles}</div>
        <div class="skills-header"><h2>${GameConfig.roleNames[a.lastRole]}</h2><span>Базовый удар аккаунта: ${U.fmt(Stats.baseHit(a))}</span></div>
        <div class="skill-grid">${skills}</div>
      </section>`;
    }
    else {
      const owned = Lands.ownedCount(a.faction);
      const income = `<section class="card income-banner">
        <div><span class="eyebrow">ДОХОД ФРАКЦИИ</span><h3>${owned} земель удерживается</h3><p>Каждая земля приносит ${GameConfig.landBattle.landGoldPerHour} золота и ${GameConfig.landBattle.landBlackPerHour} чёрного золота в час.</p></div>
        <div class="income-rate"><b>+${U.money(owned * GameConfig.landBattle.landGoldPerHour, 'gold')}/ч</b><b>+${U.money(owned * GameConfig.landBattle.landBlackPerHour, 'black')}/ч</b></div>
      </section>`;
      const cards = GameState.world.lands.map(l => {
        const q = Lands.queue(l.id), mine = q[a.faction].some(x => x.accountId === a.id);
        const battle = BattleEngine.getBattle(l.id), active = !!battle;
        const left = active && battle.leftAccounts?.[a.id];
        const meInside = active && BattleEngine.myFighter(battle, a);
        let action = '';
        if (meInside) {
          action = `<button data-enter-active="${l.id}">Вернуться в текущий бой</button>`;
        }
        else if (left) {
          action = `<div class="reentry-box"><select data-reentry-role="${l.id}">${Object.entries(GameConfig.roleNames).map(([r, n]) => `<option value="${r}" ${a.lastRole === r ? 'selected' : ''}>${n}</option>`).join('')}</select><button data-reenter="${l.id}">Перезайти · ${U.money(GameConfig.landBattle.reentryBlackCost, 'black')}</button></div>`;
        }
        else if (active) {
          action = `<button data-join-live="${l.id}">Войти в идущий бой как ${GameConfig.roleNames[a.lastRole]}</button>`;
        }
        else if (mine) {
          action = `<button data-unreg="${l.id}" class="secondary">Отменить запись</button>`;
        }
        else {
          action = `<button data-open="${l.id}">Записаться как ${GameConfig.roleNames[a.lastRole]}</button>`;
        }
        return `<article class="land-card ${l.owner}" data-land-card="${l.id}">
          <div class="land-art-wrap"><img class="land-art" src="${l.art}" alt="${l.name}"><div class="land-art-shade"></div><span class="land-art-title">${l.name}</span></div>
          <div class="land-top"><div><span class="land-dot"></span><h3>${l.name}</h3></div><span class="owner-tag">${l.owner === 'neutral' ? 'Нейтральная' : GameConfig.factions[l.owner].name}</span></div>
          <div class="land-badge">${l.icon} ${l.terrain}</div>
          <div class="land-timer"><span>${active ? 'БИТВА ИДЁТ' : 'До следующей битвы'}</span><strong data-countdown="${l.id}">${active ? 'LIVE' : Lands.ready(l.id) ? '00:00' : U.msToClock(l.nextBattle - U.now())}</strong></div>
          <div class="queue-row"><span>Красные: ${q.red.length}/10</span><span>Синие: ${q.blue.length}/10</span></div>
          <div class="land-actions">${action}</div>
        </article>`;
      }).join('');
      body = `${income}<div class="land-grid">${cards}</div>`;
    }
    UIShell.render('lands', `${subtabs}${body}`);
    document.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => this.render(b.dataset.sub));
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { a.lastRole = b.dataset.role; Accounts.save(); this.render('skills'); });
    document.querySelectorAll('[data-skill]').forEach(b => b.onclick = () => {
      try {
        Economy.buySkill(a, a.lastRole, b.dataset.skill);
        this.render('skills');
      }
      catch (e) {
        alert(e.message);
      }
    });
    document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => {
      try {
        Lands.register(a, b.dataset.open, a.lastRole);
        this.render('map');
      }
      catch (e) {
        alert(e.message);
      }
    });
    document.querySelectorAll('[data-unreg]').forEach(b => b.onclick = () => { Lands.unregister(a, b.dataset.unreg); this.render('map'); });
    document.querySelectorAll('[data-enter-active]').forEach(b => b.onclick = () => {
      const battle = BattleEngine.getBattle(b.dataset.enterActive); if (battle) {
        UIBattle.render(BattleEngine.view(battle));
      }
    });
    document.querySelectorAll('[data-join-live]').forEach(b => b.onclick = () => {
      try {
        const battle = BattleEngine.getBattle(b.dataset.joinLive);
        BattleEngine.joinActive(battle, a, a.lastRole);
        UIBattle.render(BattleEngine.view(battle));
      }
      catch (e) {
        alert(e.message);
      }
    });
    document.querySelectorAll('[data-reenter]').forEach(b => b.onclick = () => {
      try {
        const sel = document.querySelector(`[data-reentry-role="${b.dataset.reenter}"]`);
        const role = sel?.value || a.lastRole;
        const battle = BattleEngine.getBattle(b.dataset.reenter);
        BattleEngine.reenter(battle, a, role);
        UIBattle.render(BattleEngine.view(battle));
      }
      catch (e) {
        alert(e.message);
      }
    });
    clearInterval(this.timer);
    if (tab === 'map') {
      this.timer = setInterval(() => this.tick(a), 250);
    }
  },
  tick(a) {
    for (const l of GameState.world.lands) {
      const el = document.querySelector(`[data-countdown="${l.id}"]`);
      const active = !!BattleEngine.getBattle(l.id);
      if (el) {
        el.textContent = active ? 'LIVE' : Lands.ready(l.id) ? '00:00' : U.msToClock(l.nextBattle - U.now());
      }
      const q = Lands.queue(l.id), mine = q[a.faction].some(x => x.accountId === a.id);
      if (mine && Lands.ready(l.id) && !active) {
        clearInterval(this.timer);
        const battle = BattleEngine.start(l.id);
        UIBattle.render(battle);
        return;
      }
    }
  }
};
