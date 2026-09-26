window.Monsters = {
  names: ['Пепельный волк', 'Костяной громила', 'Чёрный василиск', 'Страж разлома'],
  make(a) {
    const t = a.monsters.tier;
    return { tier: t, name: this.names[(t - 1) % this.names.length], hp: Math.round(1150 * Math.pow(1.62, t - 1)), attack: Math.round(30 * Math.pow(1.47, t - 1)), gold: Math.round(22 + 13 * t + 4 * t * t), black: Math.max(1, Math.floor(1 + t * .7)) };
  },
  start(a) {
    const m = this.make(a), max = Stats.maxHp(a);
    a.monsters.battle = { monster: m, playerHp: max, monsterHp: m.hp, log: [`Ты выходишь против ${m.name}.`], lastPlayer: 0, lastMonster: U.now(), ended: false, win: false, guard: false, combo: 0, cooldowns: { power: 0, guard: 0, flurry: 0 }, queuedAction: null, flash: { player: '', monster: '' }, lastResult: null };
    Accounts.save();
    return a.monsters.battle;
  },
  action(a, type = 'hit') {
    const b = a.monsters.battle;
    if (!b || b.ended) {
      return false;
    }
    const now = U.now(), base = Stats.baseHit(a);
    const readyAt = type === 'hit' ? b.lastPlayer + 260 : (b.cooldowns[type] || 0);
    if (now < readyAt) {
      b.queuedAction = type;
      Accounts.save();
      return true;
    }
    b.queuedAction = null;
    if (type === 'hit') {
      b.lastPlayer = now;
      const dmg = Math.round(base * U.rand(.96, 1.14) * (1 + Math.min(.30, b.combo * .03)));
      b.monsterHp = Math.max(0, b.monsterHp - dmg);
      b.combo = Math.min(10, b.combo + 1);
      b.flash.monster = `−${U.fmt(dmg)}`;
      b.log.push(`Базовый удар: ${U.fmt(dmg)} урона.`);
    }
    else if (type === 'power') {
      b.cooldowns.power = now + 520;
      const dmg = Math.round(base * U.rand(2.45, 2.85) * (1 + Math.min(.2, b.combo * .02)));
      b.monsterHp = Math.max(0, b.monsterHp - dmg);
      b.combo = Math.min(10, b.combo + 2);
      b.flash.monster = `ПРОБОЙ −${U.fmt(dmg)}`;
      b.log.push(`Сильный удар наносит ${U.fmt(dmg)} урона.`);
    }
    else if (type === 'guard') {
      b.cooldowns.guard = now + 700;
      b.guard = true;
      b.log.push('Ты встаёшь в защиту: следующий удар монстра ослаблен на 65%.');
    }
    else if (type === 'flurry') {
      b.cooldowns.flurry = now + 760;
      let total = 0;
      for (let i = 0; i < 3; i++) {
        const d = Math.round(base * U.rand(.76, .98));
        total += d;
      }
      b.monsterHp = Math.max(0, b.monsterHp - total);
      b.combo = Math.min(10, b.combo + 3);
      b.flash.monster = `СЕРИЯ −${U.fmt(total)}`;
      b.log.push(`Серия из трёх ударов: ${U.fmt(total)} урона.`);
    }
    else {
      return false;
    }
    if (b.monsterHp <= 0) {
      this.finish(a, true);
    }
    if (b.log.length > 50) {
      b.log.shift();
    }
    Accounts.save();
    return true;
  },
  tick(a) {
    const b = a.monsters.battle;
    if (!b || b.ended) {
      return;
    }
    const now = U.now();
    if (b.queuedAction) {
      const q = b.queuedAction, ready = q === 'hit' ? now >= b.lastPlayer + 260 : now >= (b.cooldowns[q] || 0);
      if (ready) {
        this.action(a, q);
      }
    }
    if (now - b.lastMonster >= 1150) {
      b.lastMonster = now;
      let heavy = Math.random() < .18, dmg = Math.round(b.monster.attack * U.rand(heavy ? 1.35 : .82, heavy ? 1.72 : 1.14) * (1 - Stats.damageReduction(a)));
      if (b.guard) {
        dmg = Math.round(dmg * .35);
        b.guard = false;
        b.log.push('Защита принимает удар на себя.');
      }
      b.playerHp = Math.max(0, b.playerHp - dmg);
      b.combo = Math.max(0, b.combo - 1);
      b.flash.player = `${heavy ? 'ТЯЖЁЛЫЙ ' : ''}−${U.fmt(dmg)}`;
      b.log.push(`${b.monster.name}${heavy ? ' проводит тяжёлую атаку' : ''}: ${U.fmt(dmg)} урона.`);
      if (b.playerHp <= 0) {
        this.finish(a, false);
      }
      if (b.log.length > 50) {
        b.log.shift();
      }
      Accounts.save();
    }
  },
  finish(a, win) {
    const b = a.monsters.battle;
    if (!b || b.ended) {
      return;
    }
    b.ended = true;
    b.win = win;
    if (win) {
      a.gold += b.monster.gold;
      a.blackGold += b.monster.black;
      a.monsters.kills++;
      a.records.monsterKills++;
      a.monsters.tier++;
      b.log.push(`Победа: +${b.monster.gold} золота и +${b.monster.black} чёрного золота.`);
    }
    else {
      b.log.push('Поражение. Усиль характеристики и попробуй снова.');
    }
    Accounts.save();
  },
  reset(a) { a.monsters.battle = null; Accounts.save(); }
};
