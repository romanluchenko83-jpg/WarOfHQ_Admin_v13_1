window.UIBattle = {
  battle: null, me: null, selected: null, mode: null, timer: null, lastEnded: false, pendingTimer: null,
  shieldIcons(n) {
    if (!n) {
      return '';
    }
    return `<span class="shield-stack"><span class="shield-count">${n}</span><span class="sicon">🛡</span></span>`;
  },
  render(battle) {
    const account = Accounts.current(), me = BattleEngine.myFighter(battle, account);
    if (!me) {
      return App.show('lands');
    }
    App.page = 'battle';
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    this.battle = battle;
    this.me = me;
    this.mode = null;
    this.lastEnded = false;
    this.selected = { type: 'hq', faction: me.faction === 'red' ? 'blue' : 'red' };
    UIShell.render('battle', `
      <div class="battle-page" id="battleRoot">
        <section class="battle-action-dock card">
          <div class="battle-action-title"><div><span class="eyebrow">БОЙ ЗА ${U.esc(battle.landName).toUpperCase()}</span><b id="targetHint">Выбери действие</b></div><div id="battleStats"></div></div>
          <div class="actions" id="battleActions"></div>
        </section>
        <div class="battle-hq"><div id="hq-red"></div><div id="hq-blue"></div></div>
        <div class="battle-columns"><section class="team card" id="team-red"></section><section class="team card" id="team-blue"></section></div>
        <section class="battle-chat-dock card chatbox">
          <div id="chatlog" class="chatlog"></div>
          <div class="chatinput"><input id="chatInput" placeholder="Напиши сообщение — боты могут ответить"><button id="chatSend">Отправить</button></div>
        </section>
        <div id="battleResult"></div>
      </div>`);
    this.buildStaticBattle();
    this.bind();
    this.updateAll();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.updateAll(), 90);
  },
  buildStaticBattle() {
    for (const faction of ['red', 'blue']) {
      const h = document.getElementById(`hq-${faction}`);
      h.innerHTML = `<button class="hq-card" data-hq="${faction}"><div class="hq-line"><b>${GameConfig.factions[faction].name} — ШТАБ</b><span id="hqShield-${faction}"></span></div><div class="progress hq-progress" id="hqProgress-${faction}"><i id="hqBar-${faction}"></i></div><div class="hq-numbers" id="hqHp-${faction}"></div></button>`;
      const team = document.getElementById(`team-${faction}`);
      team.innerHTML = `<div class="team-title"><span>${GameConfig.factions[faction].name}</span><span id="alive-${faction}">0/10</span></div>` +
        Array.from({ length: 10 }, (_, i) => `<button class="fighter-row empty-slot" id="slot-${faction}-${i}" data-fighter=""><div class="mini-avatar" data-part="avatar">·</div><div class="fighter-main"><div class="fighter-name" data-part="name">Свободное место</div><div class="fighter-meta" data-part="meta"></div><div class="hpbar" data-part="hpwrap"><i data-part="bar"></i></div></div><div class="fighter-hp" data-part="hp"></div><div class="fighter-icons" data-part="icons"></div></button>`).join('');
    }
    this.buildActions();
  },
  buildActions() {
    const skills = Object.entries(Skills.defs[this.me.role]).map(([id, d], i) => `<button id="skill-${id}" data-skill-btn="${id}"><b>${i + 1} · ${d.name}</b><span data-skill-meta="${id}"></span></button>`).join('');
    document.getElementById('battleActions').innerHTML = `<button id="basicBtn" class="basic-action"><b>Space · Базовый удар</b><span>выбери цель</span></button>${skills}<button id="leaveBattle" class="danger-action"><b>Выйти из боя</b><span>перезаход платный</span></button>`;
  },
  bind() {
    const root = document.getElementById('battleRoot');
    root.onpointerdown = e => {
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      const interactive = e.target.closest('button');
      if (interactive) {
        e.preventDefault();
      }
      const fighter = e.target.closest('[data-fighter]');
      if (fighter && fighter.dataset.fighter) {
        return this.chooseFighter(fighter.dataset.fighter);
      }
      const hq = e.target.closest('[data-hq]');
      if (hq) {
        return this.chooseHq(hq.dataset.hq);
      }
      const sk = e.target.closest('[data-skill-btn]');
      if (sk) {
        return this.prepareSkill(sk.dataset.skillBtn);
      }
      if (e.target.closest('#basicBtn')) {
        return this.prepareBasic();
      }
      if (e.target.closest('#leaveBattle')) {
        return this.leave();
      }
      if (e.target.closest('[data-result-close]')) {
        UILands.tab = 'map';
        return App.show('lands');
      }
    };
    const send = () => {
      const i = document.getElementById('chatInput'); if (!i?.value.trim()) {
        return;
      } BattleChat.playerMessage(this.battle, this.me, i.value.trim()); i.value = ''; this.updateChat();
    };
    document.getElementById('chatSend').onclick = send;
    document.getElementById('chatInput').onkeydown = e => {
      if (e.key === 'Enter') {
        send();
      }
    };
    document.onkeydown = e => this.key(e);
  },
  leave() {
    if (this.battle.ended) {
      return App.show('lands');
    }
    BattleEngine.leave(this.battle, Accounts.current());
    clearInterval(this.timer);
    clearTimeout(this.pendingTimer);
    document.onkeydown = null;
    UILands.tab = 'map';
    App.show('lands');
  },
  prepareBasic() {
    if (!this.me?.alive) {
      return;
    }
    this.mode = this.mode === 'basic' ? null : 'basic';
    document.getElementById('targetHint').textContent = this.mode ? 'Базовый удар: выбери врага или вражеский штаб' : 'Выбери действие';
    this.updateTargets();
    this.updateActions();
  },
  prepareSkill(id) {
    const def = Skills.defs[this.me.role]?.[id], state = this.me.skillState[id];
    if (!def || !state || state.charges <= 0 || !this.me.alive) {
      return;
    }
    if (def.target === 'massEnemy' || def.target === 'massAlly' || def.target === 'self') {
      const target = def.target === 'self' ? this.me : null;
      this.perform(id, target);
      return;
    }
    this.mode = this.mode === id ? null : id;
    document.getElementById('targetHint').textContent = this.mode ? `${def.name}: жёлтым отмечены допустимые цели` : 'Выбери действие';
    this.updateTargets();
    this.updateActions();
  },
  canTargetFighter(f) {
    if (!this.mode) {
      return false;
    }
    if (this.mode === 'basic') {
      return f.alive && f.faction !== this.me.faction;
    }
    const d = Skills.defs[this.me.role]?.[this.mode];
    if (!d) {
      return false;
    }
    if (d.target === 'enemy') {
      return f.alive && f.faction !== this.me.faction;
    }
    if (d.target === 'ally') {
      return f.alive && f.faction === this.me.faction;
    }
    if (d.target === 'deadAlly') {
      return !f.alive && f.faction === this.me.faction && f.reviveUntil > U.now();
    }
    if (d.target === 'allyOrHq') {
      return f.alive && f.faction === this.me.faction;
    }
    return false;
  },
  canTargetHq(faction) {
    if (this.mode === 'basic') {
      return faction !== this.me.faction;
    }
    if (!this.mode) {
      return false;
    }
    const d = Skills.defs[this.me.role]?.[this.mode];
    return d?.target === 'allyOrHq' && faction === this.me.faction;
  },
  chooseFighter(id) {
    const f = this.battle.fighters.find(x => x.id === id);
    if (!f) {
      return;
    }
    this.selected = { type: 'fighter', id };
    if (this.mode) {
      if (!this.canTargetFighter(f)) {
        return;
      }
      this.executeMode(f);
    }
    else {
      this.updateTargets();
    }
  },
  chooseHq(faction) {
    this.selected = { type: 'hq', faction };
    if (this.mode) {
      if (!this.canTargetHq(faction)) {
        return;
      }
      this.executeMode({ __hq: true, faction });
    }
    else {
      this.updateTargets();
    }
  },
  executeMode(target) {
    const action = this.mode; if (!action) {
      return;
    } this.perform(action, target);
  },
  perform(action, target) {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = null;
    const run = () => {
      if (!this.me?.alive || this.battle.ended) {
        return;
      }
      let ok = false;
      if (action === 'basic') {
        ok = BattleEngine.basicAttack(this.battle, this.me, target);
      }
      else {
        ok = BattleEngine.useSkill(this.battle, this.me, action, target);
      }
      if (ok) {
        this.mode = null;
        const h = document.getElementById('targetHint');
        if (h) {
          h.textContent = 'Действие выполнено';
        }
        this.updateAll();
        return;
      }
      const readyAt = action === 'basic' ? this.me.nextAttackAt : (this.me.skillState[action]?.nextAt || 0), wait = Math.max(0, readyAt - U.now());
      if (wait > 0 && wait < 6500) {
        const h = document.getElementById('targetHint');
        if (h) {
          h.textContent = `Действие принято · ${(wait / 1000).toFixed(1)}с`;
        }
        this.pendingTimer = setTimeout(run, wait + 12);
      }
      else {
        const h = document.getElementById('targetHint');
        if (h) {
          h.textContent = 'Цель больше недоступна';
        }
        this.mode = null;
        this.updateTargets();
      }
    };
    run();
  },
  updateAll() {
    if (!this.battle) {
      return;
    }
    const current = BattleEngine.myFighter(this.battle, Accounts.current());
    if (!current && !this.battle.ended) {
      clearInterval(this.timer);
      clearTimeout(this.pendingTimer);
      UILands.tab = 'map';
      return App.show('lands');
    }
    if (current) {
      this.me = current;
    }
    this.updateHq();
    this.updateTeams();
    this.updateActions();
    this.updateTargets();
    this.updateStats();
    this.updateChat();
    if (this.battle.ended && !this.lastEnded) {
      this.lastEnded = true;
      this.showResult();
    }
  },
  updateHq() {
    for (const f of ['red', 'blue']) {
      const h = this.battle.hq[f], bar = document.getElementById(`hqBar-${f}`), txt = document.getElementById(`hqHp-${f}`), sh = document.getElementById(`hqShield-${f}`), wrap = document.getElementById(`hqProgress-${f}`);
      if (bar) {
        bar.style.width = U.pct(h.hp, h.maxHp) + '%';
      }
      if (txt) {
        txt.textContent = `${U.fmt(h.hp)} / ${U.fmt(h.maxHp)}`;
      }
      const shielded = h.absoluteUntil > U.now();
      if (sh) {
        sh.textContent = shielded ? `АБС. ЩИТ ${((h.absoluteUntil - U.now()) / 1000).toFixed(1)}с` : '';
      }
      if (wrap) {
        wrap.classList.toggle('shielded', shielded);
      }
    }
  },
  updateTeams() {
    for (const f of ['red', 'blue']) {
      this.updateTeam(f);
    }
  },
  updateTeam(faction) {
    const list = this.battle.fighters.filter(x => x.faction === faction).slice(0, 10), alive = list.filter(x => x.alive).length, al = document.getElementById(`alive-${faction}`);
    if (al) {
      al.textContent = `${alive}/10`;
    }
    for (let i = 0; i < 10; i++) {
      const el = document.getElementById(`slot-${faction}-${i}`), f = list[i];
      if (!el) {
        continue;
      }
      const wrap = el.querySelector('[data-part="hpwrap"]');
      if (!f) {
        el.dataset.fighter = '';
        el.className = 'fighter-row empty-slot';
        el.querySelector('[data-part="avatar"]').textContent = '·';
        el.querySelector('[data-part="name"]').textContent = 'Свободное место';
        el.querySelector('[data-part="meta"]').textContent = '';
        el.querySelector('[data-part="hp"]').textContent = '';
        el.querySelector('[data-part="bar"]').style.width = '0%';
        el.querySelector('[data-part="icons"]').textContent = '';
        wrap?.classList.remove('shielded');
        continue;
      }
      el.dataset.fighter = f.id;
      el.className = 'fighter-row' + (!f.alive ? ' dead' : '');
      el.querySelector('[data-part="avatar"]').textContent = { tank: '🛡', healer: '✦', beast: '🐺', ninja: '🥷' }[f.role];
      el.querySelector('[data-part="name"]').textContent = f.name + (f.accountId === Accounts.current().id ? ' · ты' : '');
      const revive = !f.alive && f.reviveUntil > U.now() ? ` · рес ${((f.reviveUntil - U.now()) / 1000).toFixed(1)}с` : '';
      el.querySelector('[data-part="meta"]').textContent = `${GameConfig.roleNames[f.role]} · щиты ${f.shields}/${GameConfig.landBattle.maxShields}${revive}`;
      el.querySelector('[data-part="hp"]').textContent = `${U.fmt(f.hp)}/${U.fmt(f.maxHp)}`;
      el.querySelector('[data-part="bar"]').style.width = U.pct(f.hp, f.maxHp) + '%';
      const absolute = f.absoluteUntil > U.now();
      const shielded = f.shields > 0 || absolute;
      wrap?.classList.toggle('shielded', shielded);
      const icons = [];
      if (absolute) {
        icons.push('<span class="abs-shield">🛡∞</span>');
      }
      if (f.shields > 0) {
        icons.push(this.shieldIcons(f.shields));
      }
      if (f.antiHealUntil > U.now()) {
        icons.push('<span class="antiheal">⛔</span>');
      }
      el.querySelector('[data-part="icons"]').innerHTML = icons.join(' ');
    }
  },
  updateTargets() {
    document.querySelectorAll('.fighter-row').forEach(el => { const f = this.battle.fighters.find(x => x.id === el.dataset.fighter); el.classList.toggle('targetable', !!f && this.canTargetFighter(f)); el.classList.toggle('selected', this.selected?.type === 'fighter' && this.selected.id === el.dataset.fighter); });
    document.querySelectorAll('.hq-card').forEach(el => { const f = el.dataset.hq; el.classList.toggle('targetable', this.canTargetHq(f)); el.classList.toggle('selected', this.selected?.type === 'hq' && this.selected.faction === f); });
  },
  updateActions() {
    const basic = document.getElementById('basicBtn');
    if (basic) {
      const r = Math.max(0, this.me.nextAttackAt - U.now());
      basic.disabled = !this.me.alive;
      basic.classList.toggle('selected', this.mode === 'basic');
      basic.querySelector('span').textContent = r > 0 ? `готов через ${(r / 1000).toFixed(1)}с · можно выбрать цель` : 'выбери цель';
    }
    for (const id of Object.keys(Skills.defs[this.me.role])) {
      const st = this.me.skillState[id], btn = document.getElementById(`skill-${id}`), meta = document.querySelector(`[data-skill-meta="${id}"]`);
      if (!btn || !meta) {
        continue;
      }
      const r = Math.max(0, st.nextAt - U.now());
      btn.disabled = !this.me.alive || st.charges <= 0;
      btn.classList.toggle('selected', this.mode === id);
      meta.textContent = `${st.charges} карт${r > 0 ? ` · ${(r / 1000).toFixed(1)}с` : ''}`;
    }
  },
  updateStats() {
    const e = document.getElementById('battleStats'); if (e) {
      e.textContent = `Урон ${U.fmt(this.me.stats.damage)} · лечение ${U.fmt(this.me.stats.healing)} · блок ${U.fmt(this.me.stats.blocked)} · вклад ${U.fmt(this.me.contribution)}`;
    }
  },
  updateChat() {
    const log = document.getElementById('chatlog'); if (!log) {
      return;
    } const bottom = log.scrollHeight - log.scrollTop - log.clientHeight < 50; log.innerHTML = this.battle.chat.slice(-60).map(r => `<div class="chatrow ${r.kind || ''}"><span class="who">${U.esc(r.who)}</span><span>${U.esc(r.text)}</span></div>`).join(''); if (bottom) {
      log.scrollTop = log.scrollHeight;
    }
  },
  showResult() {
    clearInterval(this.timer);
    clearTimeout(this.pendingTimer);
    const top = this.battle.top || [], me = Accounts.current();
    document.getElementById('battleResult').innerHTML = `<div class="result-overlay"><div class="card result-card"><span class="eyebrow">БИТВА ЗАВЕРШЕНА</span><h2>Победа: ${GameConfig.factions[this.battle.winner].name}</h2><p>Следующая битва за эту землю начнётся через час. Победители и топ-3 по вкладу получили дополнительные награды.</p><div class="result-ranking">${top.slice(0, 3).map((x, i) => `<div><b>${i + 1}. ${U.esc(x.name)}</b><span>${U.fmt(x.contribution)} вклада</span></div>`).join('') || '<div>Живых игроков в рейтинге нет</div>'}</div><div class="wallet-result">Сейчас у тебя: <b>${U.money(me.gold, 'gold')}</b> · <b>${U.money(me.blackGold, 'black')}</b></div><button data-result-close>Вернуться к землям</button></div></div>`;
  },
  key(e) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      return this.prepareBasic();
    }
    if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const id = Object.keys(Skills.defs[this.me.role])[+e.key - 1];
      if (id) {
        return this.prepareSkill(id);
      }
    }
    if (e.key.toLowerCase() === 'q') {
      this.selected = { type: 'hq', faction: this.me.faction };
      return this.updateTargets();
    }
    if (e.key.toLowerCase() === 'e') {
      this.selected = { type: 'hq', faction: this.me.faction === 'red' ? 'blue' : 'red' };
      return this.updateTargets();
    }
  }
};
