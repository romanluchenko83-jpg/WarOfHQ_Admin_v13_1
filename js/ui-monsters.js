window.UIMonsters = {
  timer: null, ending: false,
  render() {
    const a = Accounts.current(), b = a.monsters.battle;
    this.ending = false;
    if (!b) {
      const m = Monsters.make(a);
      UIShell.render('monsters', `<div class="monster-lobby">
        <section class="card monster-showcase"><span class="eyebrow">УРОВЕНЬ УГРОЗЫ ${m.tier}</span><div class="monster-portrait">${['🐺', '💀', '🐉', '👹'][(m.tier - 1) % 4]}</div><h1>${m.name}</h1><div class="monster-spec"><span>HP <b>${U.fmt(m.hp)}</b></span><span>Урон <b>${U.fmt(m.attack)}</b></span></div><div class="reward-chip">Награда: ${U.money(m.gold, 'gold')} · ${U.money(m.black, 'black')}</div><button id="monsterStart" class="primary-big">Вступить в бой</button></section>
        <section class="card"><div class="section-title"><div><span>Твой боевой профиль</span><small>Ролей в боях с монстрами нет</small></div></div><div class="combat-kpis compact"><div><span>HP</span><strong>${U.fmt(Stats.maxHp(a))}</strong></div><div><span>Базовый удар</span><strong>${U.fmt(Stats.baseHit(a))}</strong></div><div><span>Побед</span><strong>${a.monsters.kills}</strong></div></div><p class="muted">Каждый следующий уровень монстра резко сильнее предыдущего, но и награда растёт быстрее.</p></section>
      </div>`);
      document.getElementById('monsterStart').onclick = () => { Monsters.start(a); this.render(); };
      return;
    }
    UIShell.render('monsters', `<div class="monster-arena" id="monsterArena">
      <section class="arena-side player-side card"><span class="eyebrow">ТЫ</span><div class="arena-avatar">⚔️</div><h2>${U.esc(a.username)}</h2><div class="arena-hp"><div class="progress"><i id="playerHpBar"></i></div><b id="playerHpText"></b><span class="float-number" id="playerFlash"></span></div><div class="combo" id="comboText"></div></section>
      <section class="arena-center card"><div class="versus">VS</div><div class="monster-actions" id="monsterActions">
        <button data-ma="hit"><b>Базовый удар</b><span id="hitCd">готов</span></button>
        <button data-ma="power"><b>Сильный удар</b><span id="powerCd">мощный пробой</span></button>
        <button data-ma="guard"><b>Защита</b><span id="guardCd">−65% следующего удара</span></button>
        <button data-ma="flurry"><b>Серия ударов</b><span id="flurryCd">3 быстрых удара</span></button>
      </div><div class="monster-log" id="monsterLog"></div><div id="monsterFinish"></div></section>
      <section class="arena-side enemy-side card"><span class="eyebrow">УГРОЗА ${b.monster.tier}</span><div class="arena-avatar monster-avatar">${['🐺', '💀', '🐉', '👹'][(b.monster.tier - 1) % 4]}</div><h2>${b.monster.name}</h2><div class="arena-hp"><div class="progress enemy"><i id="monsterHpBar"></i></div><b id="monsterHpText"></b><span class="float-number" id="monsterFlash"></span></div><div class="reward-chip">${U.money(b.monster.gold, 'gold')} · ${U.money(b.monster.black, 'black')}</div></section>
    </div>`);
    const arena = document.getElementById('monsterArena');
    arena.onpointerdown = e => {
      if (e.button !== undefined && e.button !== 0) {
        return;
      }
      const btn = e.target.closest('button');
      if (btn) {
        e.preventDefault();
      }
      const act = e.target.closest('[data-ma]');
      if (act) {
        Monsters.action(a, act.dataset.ma);
        this.update(a);
        if (a.monsters.battle?.ended) {
          this.showFinish(a);
        }
        return;
      }
      if (e.target.closest('#monsterNext')) {
        Monsters.reset(a);
        return this.render();
      }
    };
    clearInterval(this.timer);
    this.update(a);
    if (b.ended) {
      this.showFinish(a);
    }
    else {
      this.timer = setInterval(() => {
        Monsters.tick(a); this.update(a); if (a.monsters.battle?.ended) {
          this.showFinish(a);
        }
      }, 45);
    }
  },
  showFinish(a) {
    if (this.ending) {
      return;
    }
    this.ending = true;
    clearInterval(this.timer);
    const b = a.monsters.battle, box = document.getElementById('monsterFinish');
    if (!box) {
      return;
    }
    box.innerHTML = `<div class="monster-finish ${b.win ? 'win' : 'lose'}"><b>${b.win ? 'Победа!' : 'Поражение'}</b><span>${b.win ? `Получено ${U.money(b.monster.gold, 'gold')} и ${U.money(b.monster.black, 'black')}` : 'Попробуй усилить характеристики.'}</span><button id="monsterNext" class="primary-big">${b.win ? 'Следующий противник' : 'Повторить'}</button></div>`;
    document.querySelectorAll('[data-ma]').forEach(btn => btn.disabled = true);
  },
  update(a) {
    const b = a.monsters.battle;
    if (!b) {
      return;
    }
    const max = Stats.maxHp(a), now = U.now(), set = (id, v) => {
      const e = document.getElementById(id); if (e) {
        e.textContent = v;
      }
    };
    const pb = document.getElementById('playerHpBar'), mb = document.getElementById('monsterHpBar');
    if (pb) {
      pb.style.width = U.pct(b.playerHp, max) + '%';
    }
    if (mb) {
      mb.style.width = U.pct(b.monsterHp, b.monster.hp) + '%';
    }
    set('playerHpText', `${U.fmt(b.playerHp)} / ${U.fmt(max)}`);
    set('monsterHpText', `${U.fmt(b.monsterHp)} / ${U.fmt(b.monster.hp)}`);
    set('comboText', b.combo ? `Серия ×${b.combo} · базовый удар усиливается` : 'Набирай серию без долгих пауз');
    set('playerFlash', b.flash.player || '');
    set('monsterFlash', b.flash.monster || '');
    b.flash.player = '';
    b.flash.monster = '';
    const cd = (key, label, ready) => { const left = Math.max(0, b.cooldowns[key] - now); set(label, left ? `${(left / 1000).toFixed(1)}с` : ready); };
    cd('power', 'powerCd', 'мощный пробой');
    cd('guard', 'guardCd', '−65% следующего удара');
    cd('flurry', 'flurryCd', '3 быстрых удара');
    const hitLeft = Math.max(0, b.lastPlayer + 260 - now);
    set('hitCd', hitLeft ? `${(hitLeft / 1000).toFixed(1)}с` : 'готов');
    const log = document.getElementById('monsterLog');
    if (log) {
      log.innerHTML = b.log.slice(-20).map(x => `<div>${U.esc(x)}</div>`).join('');
      log.scrollTop = log.scrollHeight;
    }
    document.querySelectorAll('[data-ma]').forEach(btn => { btn.disabled = !!b.ended; btn.classList.toggle('queued', b.queuedAction === btn.dataset.ma); });
  }
};
