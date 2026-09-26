window.BattleEngine = {
  active: null,
  battles: {},
  loop: null,
  makeFighter(account, role, isBot = false) {
    const maxHp = Stats.maxHp(account, role), skillState = {};
    for (const id of Object.keys(Skills.defs[role])) {
      skillState[id] = { charges: Skills.charges(account, role, id), nextAt: 0 };
    }
    return {
      id: account.id || U.id('f'), accountId: isBot ? null : account.id, name: account.username, faction: account.faction,
      role, isBot, account, maxHp, hp: maxHp, alive: true, deathAt: 0, reviveUntil: 0, shields: 0, shieldSourceId: null,
      absoluteUntil: 0, absoluteSourceId: null, antiHealUntil: 0, nextAttackAt: 0, nextAiAt: 0, furyUntil: 0, skillState,
      stats: { damage: 0, healing: 0, blocked: 0, revives: 0 }, contribution: 0
    };
  },
  accountFromQueue(entry, faction) {
    if (entry.isBot) {
      return entry.account;
    }
    const a = Object.values(GameState.accounts).find(x => x.id === entry.accountId);
    return a || Bots.create(faction, entry.role);
  },
  getBattle(landId) { const b = this.battles[landId]; return b && !b.ended ? b : null; },
  fightingBattleFor(account) { return Object.values(this.battles).find(b => b && !b.ended && this.myFighter(b, account)) || null; },
  view(b) {
    if (b) {
      this.active = b;
    } return b;
  },
  start(landId) {
    const existing = this.getBattle(landId);
    if (existing) {
      this.active = existing;
      return existing;
    }
    const land = Lands.get(landId), q = Lands.queue(landId), rosters = {};
    for (const faction of ['red', 'blue']) {
      const humans = q[faction].filter(x => !x.isBot).slice(0, 3).map(e => ({ account: this.accountFromQueue(e, faction), accountId: e.accountId, name: e.name, role: e.role, isBot: false }));
      rosters[faction] = Bots.fillTeam(faction, humans);
    }
    const fighters = [];
    for (const faction of ['red', 'blue']) {
      for (const e of rosters[faction]) {
        fighters.push(this.makeFighter(e.account, e.role, e.isBot));
      }
    }
    const makeHq = () => ({ maxHp: GameConfig.landBattle.baseHqHp, hp: GameConfig.landBattle.baseHqHp, absoluteUntil: 0, absoluteSourceId: null });
    const battle = {
      id: U.id('battle'), landId, landName: land.name, startedAt: U.now(), ended: false, winner: null,
      hq: { red: makeHq(), blue: makeHq() }, fighters, chat: [], ledger: {}, leftAccounts: {}, lastTick: U.now(), top: []
    };
    this.reindex(battle);
    this.battles[landId] = battle;
    this.active = battle;
    Lands.markBattle(landId, true, battle.id);
    for (const f of fighters) {
      if (f.accountId) {
        this.syncLedger(battle, f);
      }
    }
    BattleChat.push(battle, 'Система', `Началась битва за ${land.name}`, 'system');
    return battle;
  },
  startLoop() {
    clearInterval(this.loop);
    this.loop = setInterval(() => {
      for (const b of Object.values(this.battles)) {
        if (b && !b.ended) {
          this.tick(b);
        }
      }
    }, 90);
  },
  reindex(b) {
    b.teams = {};
    for (const faction of ['red', 'blue']) {
      b.teams[faction] = { allies: b.fighters.filter(x => x.faction === faction), enemy: b.fighters.filter(x => x.faction !== faction) };
    }
  },
  syncLedger(b, f) {
    if (!f?.accountId) {
      return;
    }
    b.ledger[f.accountId] = { accountId: f.accountId, name: f.name, contribution: f.contribution, damage: f.stats.damage, healing: f.stats.healing, blocked: f.stats.blocked, revives: f.stats.revives };
  },
  fighterById(b, id) { return b?.fighters.find(x => x.id === id) || null; },
  creditBlock(b, target, blocked, kind = 'reduction', sourceId = null) {
    blocked = Math.max(0, Math.round(blocked));
    if (!blocked) {
      return;
    }
    let credited = sourceId ? this.fighterById(b, sourceId) : target;
    if (!credited) {
      credited = target;
    }
    credited.stats.blocked += blocked;
    let weight = kind === 'absolute' ? 1.8 : kind === 'shield' ? 1.35 : .55;
    if (credited.role === 'tank') {
      weight *= 1.35;
    }
    credited.contribution += blocked * weight;
    this.syncLedger(b, credited);
  },
  effectiveDamage(target, amount) {
    amount = Math.max(0, amount);
    if (target.absoluteUntil > U.now()) {
      return { dealt: 0, blocked: Math.round(amount), kind: 'absolute', sourceId: target.absoluteSourceId };
    }
    let blocked = 0, kind = 'reduction', sourceId = null;
    if (target.shields > 0) {
      blocked = amount * .5;
      amount *= .5;
      target.shields = Math.max(0, target.shields - 1);
      kind = 'shield';
      sourceId = target.shieldSourceId;
      if (target.shields === 0) {
        target.shieldSourceId = null;
      }
    }
    const beforeReduction = amount;
    amount *= 1 - Stats.damageReduction(target.account);
    blocked += beforeReduction - amount;
    return { dealt: Math.max(0, Math.round(amount)), blocked: Math.max(0, Math.round(blocked)), kind, sourceId };
  },
  hit(b, actor, target, amount) {
    if (!target || !target.alive) {
      return false;
    }
    if (actor.furyUntil > U.now()) {
      amount *= 1.8;
      actor.furyUntil = 0;
    }
    const r = this.effectiveDamage(target, amount);
    target.hp = Math.max(0, target.hp - r.dealt);
    actor.stats.damage += r.dealt;
    actor.contribution += r.dealt;
    this.creditBlock(b, target, r.blocked, r.kind, r.sourceId);
    this.syncLedger(b, actor);
    this.syncLedger(b, target);
    if (target.hp <= 0) {
      this.kill(b, target);
    }
    return true;
  },
  hitHq(b, actor, faction, amount) {
    const h = b.hq[faction];
    if (!h || faction === actor.faction) {
      return false;
    }
    if (h.absoluteUntil > U.now()) {
      const blocker = this.fighterById(b, h.absoluteSourceId);
      if (blocker) {
        this.creditBlock(b, blocker, amount, 'absolute', blocker.id);
      }
      return true;
    }
    const dealt = Math.max(1, Math.round(amount));
    h.hp = Math.max(0, h.hp - dealt);
    actor.stats.damage += dealt;
    actor.contribution += dealt;
    this.syncLedger(b, actor);
    if (h.hp <= h.maxHp * .15) {
      BattleChat.event(b, 'lowHq');
    }
    if (h.hp <= 0) {
      this.finish(b, actor.faction);
    }
    return true;
  },
  heal(b, actor, target, amount) {
    if (!target || !target.alive) {
      return 0;
    }
    const factor = target.antiHealUntil > U.now() ? .2 : 1;
    const actual = Math.max(0, Math.min(target.maxHp - target.hp, Math.round(amount * factor)));
    target.hp += actual;
    actor.stats.healing += actual;
    actor.contribution += actual;
    this.syncLedger(b, actor);
    this.syncLedger(b, target);
    return actual;
  },
  kill(b, target) {
    target.alive = false;
    target.hp = 0;
    target.deathAt = U.now();
    target.reviveUntil = U.now() + GameConfig.landBattle.reviveWindowMs;
    this.syncLedger(b, target);
    BattleChat.event(b, 'death');
  },
  revive(b, actor, target, lvl) {
    if (!target || target.alive || target.reviveUntil < U.now()) {
      return false;
    }
    target.alive = true;
    target.hp = Math.round(target.maxHp * (.28 + .52 * (lvl / 25)));
    target.reviveUntil = 0;
    actor.stats.revives++;
    actor.stats.healing += target.hp;
    actor.contribution += target.hp + 1500;
    this.syncLedger(b, actor);
    this.syncLedger(b, target);
    BattleChat.event(b, 'revive');
    return true;
  },
  basicAttack(b, actor, target) {
    const now = U.now();
    if (!actor || !actor.alive || now < actor.nextAttackAt || !target) {
      return false;
    }
    actor.nextAttackAt = now + Stats.attackCooldown(actor.account);
    const dmg = Stats.baseHit(actor.account) * U.rand(.82, 1.02);
    if (target.__hq) {
      return this.hitHq(b, actor, target.faction, dmg);
    }
    if (target.faction === actor.faction) {
      return false;
    }
    return this.hit(b, actor, target, dmg);
  },
  addShields(target, n, source = null) {
    target.shields = Math.min(GameConfig.landBattle.maxShields, Math.max(0, target.shields + n));
    if (source && target.shields > 0) {
      target.shieldSourceId = source.id;
    }
  },
  useSkill(b, actor, id, target) {
    const def = Skills.defs[actor.role]?.[id], st = actor.skillState[id], lvl = actor.account.skills[actor.role][id].level, now = U.now();
    if (!def || !st || st.charges <= 0 || now < st.nextAt || !actor.alive) {
      return false;
    }
    const mult = Stats.skillMult(actor.account, lvl);
    let ok = false;
    if (actor.role === 'beast' && id === 'rend') {
      ok = target?.faction !== actor.faction && this.hit(b, actor, target, Stats.baseHit(actor.account) * 3.0 * mult);
    }
    else if (actor.role === 'beast' && id === 'howl') {
      for (const e of b.teams[actor.faction].enemy.filter(x => x.alive)) {
        e.shields = Math.max(0, e.shields - 2);
        this.hit(b, actor, e, Stats.baseHit(actor.account) * 1.55 * mult);
      }
      BattleChat.event(b, 'howl');
      ok = true;
    }
    else if (actor.role === 'beast' && id === 'crushing' && target?.faction !== actor.faction && target?.alive) {
      const threshold = Math.min(.25, .13 + (lvl - 1) * .005);
      if (target.hp / target.maxHp <= threshold) {
        const remaining = target.hp;
        target.hp = 0;
        actor.stats.damage += remaining;
        actor.contribution += remaining + Math.round(target.maxHp * .18);
        this.syncLedger(b, actor);
        this.kill(b, target);
        ok = true;
      }
      else {
        ok = this.hit(b, actor, target, Stats.baseHit(actor.account) * 3.35 * mult);
      }
    }
    else if (actor.role === 'beast' && id === 'fury') {
      actor.furyUntil = now + 5000;
      ok = true;
    }
    else if (actor.role === 'tank' && id === 'absolute') {
      const dur = Skills.duration('tank', 'absolute', lvl);
      if (target?.__hq && target.faction === actor.faction) {
        const h = b.hq[target.faction];
        h.absoluteUntil = now + dur;
        h.absoluteSourceId = actor.id;
        BattleChat.event(b, 'hqShield');
        ok = true;
      }
      else if (target && target.faction === actor.faction && target.alive) {
        target.absoluteUntil = now + dur;
        target.absoluteSourceId = actor.id;
        BattleChat.event(b, 'shield');
        ok = true;
      }
    }
    else if (actor.role === 'tank' && id === 'defense') {
      for (const ally of b.teams[actor.faction].allies.filter(x => x.alive)) {
        this.addShields(ally, 5, actor);
      }
      ok = true;
    }
    else if (actor.role === 'tank' && id === 'shieldHeal') {
      let usedAny = false;
      for (const ally of b.teams[actor.faction].allies.filter(x => x.alive)) {
        const spent = Math.min(5, ally.shields);
        if (spent > 0) {
          ally.shields -= spent;
          if (ally.shields === 0) {
            ally.shieldSourceId = null;
          }
          usedAny = true;
          this.heal(b, actor, ally, Stats.healPower(actor.account) * (.35 + .24 * spent) * mult);
        }
      }
      ok = usedAny;
    }
    else if (actor.role === 'tank' && id === 'bash') {
      ok = target?.faction !== actor.faction && this.hit(b, actor, target, Stats.baseHit(actor.account) * 1.65 * mult);
    }
    else if (actor.role === 'healer' && id === 'single' && target?.faction === actor.faction) {
      this.heal(b, actor, target, Stats.healPower(actor.account) * 1.45 * mult);
      ok = true;
    }
    else if (actor.role === 'healer' && id === 'mass') {
      for (const ally of b.teams[actor.faction].allies.filter(x => x.alive)) {
        this.heal(b, actor, ally, Stats.healPower(actor.account) * .52 * mult);
      }
      ok = true;
    }
    else if (actor.role === 'healer' && id === 'revive' && target?.faction === actor.faction) {
      ok = this.revive(b, actor, target, lvl);
    }
    else if (actor.role === 'healer' && id === 'ward' && target?.faction === actor.faction && target.alive) {
      this.addShields(target, Math.min(5, 2 + Math.floor(lvl / 8)), actor);
      ok = true;
    }
    else if (actor.role === 'ninja' && id === 'antiheal' && target?.faction !== actor.faction && target?.alive) {
      target.antiHealUntil = now + 4000 + lvl * 120;
      ok = true;
    }
    else if (actor.role === 'ninja' && id === 'underArmor' && target?.faction !== actor.faction && target?.alive) {
      target.shields = Math.max(0, target.shields - 3);
      if (target.shields === 0) {
        target.shieldSourceId = null;
      }
      ok = this.hit(b, actor, target, Stats.baseHit(actor.account) * 2.75 * mult);
    }
    else if (actor.role === 'ninja' && id === 'shadowFan') {
      for (const e of b.teams[actor.faction].enemy.filter(x => x.alive)) {
        this.hit(b, actor, e, Stats.baseHit(actor.account) * 1.20 * mult);
      }
      ok = true;
    }
    else if (actor.role === 'ninja' && id === 'execute' && target?.faction !== actor.faction && target?.alive) {
      const bonus = target.hp / target.maxHp < .35 ? 4.15 : 2.15;
      ok = this.hit(b, actor, target, Stats.baseHit(actor.account) * bonus * mult);
    }
    if (ok) {
      st.charges--;
      st.nextAt = now + def.cd;
      this.syncLedger(b, actor);
      return true;
    }
    return false;
  },
  leave(b, account) {
    if (!b || b.ended) {
      return false;
    }
    const fighter = this.myFighter(b, account);
    if (!fighter) {
      return false;
    }
    this.syncLedger(b, fighter);
    b.leftAccounts[account.id] = { role: fighter.role, name: fighter.name, faction: fighter.faction, leftAt: U.now() };
    b.fighters = b.fighters.filter(f => f !== fighter);
    this.reindex(b);
    const q = Lands.queue(b.landId), team = q[account.faction], qi = team.findIndex(x => x.accountId === account.id);
    if (qi >= 0) {
      team.splice(qi, 1);
    }
    account.pendingBattleLandId = null;
    Accounts.save();
    Store.save(GameState);
    if (this.active === b) {
      this.active = null;
    }
    BattleChat.push(b, 'Система', `${fighter.name} вышел из боя. Для него этот бой завершён; возврат в него платный.`, 'system');
    return true;
  },
  joinActive(b, account, role = account.lastRole) {
    if (!b || b.ended) {
      throw Error('Этот бой уже завершён');
    }
    const other = this.fightingBattleFor(account);
    if (other && other !== b) {
      throw Error('Сначала выйди из текущего боя');
    }
    const queued = Lands.queuedLandFor(account.id);
    if (queued && queued !== b.landId) {
      throw Error('Ты уже записан в другую битву — сначала отмени ту запись');
    }
    if (this.myFighter(b, account)) {
      this.active = b;
      return this.myFighter(b, account);
    }
    if (b.leftAccounts?.[account.id]) {
      throw Error('Ты уже покидал этот бой — используй платный перезаход');
    }
    if (!GameConfig.roleNames[role]) {
      throw Error('Выбери роль');
    }
    const team = b.fighters.filter(f => f.faction === account.faction), humans = team.filter(f => !!f.accountId);
    if (team.length >= GameConfig.landBattle.maxPlayers) {
      throw Error('В команде нет свободного места');
    }
    if (humans.length >= 3) {
      throw Error('Три места для живых игроков уже заняты');
    }
    const f = this.makeFighter(account, role, false);
    b.fighters.push(f);
    this.reindex(b);
    this.syncLedger(b, f);
    const q = Lands.queue(b.landId), qteam = q[account.faction];
    if (!qteam.some(x => x.accountId === account.id)) {
      qteam.push({ accountId: account.id, name: account.username, role, isBot: false });
    }
    account.lastRole = role;
    account.pendingBattleLandId = null;
    Accounts.save();
    Store.save(GameState);
    this.active = b;
    BattleChat.push(b, 'Система', `${account.username} вошёл в уже идущий бой как ${GameConfig.roleNames[role]}.`, 'system');
    return f;
  },
  reenter(b, account, role = account.lastRole) {
    if (!b || b.ended) {
      throw Error('Бой уже завершён');
    }
    if (this.myFighter(b, account)) {
      this.active = b;
      return this.myFighter(b, account);
    }
    const other = this.fightingBattleFor(account);
    if (other && other !== b) {
      throw Error('Сначала выйди из текущего боя');
    }
    const queued = Lands.queuedLandFor(account.id);
    if (queued && queued !== b.landId) {
      throw Error('Ты уже записан в другую битву — сначала отмени ту запись');
    }
    const info = b.leftAccounts?.[account.id];
    if (!info) {
      throw Error('Ты не выходил из этого боя');
    }
    if (!GameConfig.roleNames[role]) {
      throw Error('Выбери роль');
    }
    const team = b.fighters.filter(f => f.faction === account.faction), humans = team.filter(f => !!f.accountId);
    if (team.length >= GameConfig.landBattle.maxPlayers || humans.length >= 3) {
      throw Error('В команде нет свободного места');
    }
    if (account.blackGold < GameConfig.landBattle.reentryBlackCost) {
      throw Error('Не хватает чёрного золота на перезаход');
    }
    account.blackGold -= GameConfig.landBattle.reentryBlackCost;
    account.lastRole = role;
    account.pendingBattleLandId = null;
    Accounts.save();
    const f = this.makeFighter(account, role, false);
    b.fighters.push(f);
    delete b.leftAccounts[account.id];
    this.reindex(b);
    this.syncLedger(b, f);
    const q = Lands.queue(b.landId), qteam = q[account.faction];
    if (!qteam.some(x => x.accountId === account.id)) {
      qteam.push({ accountId: account.id, name: account.username, role, isBot: false });
    }
    Store.save(GameState);
    this.active = b;
    BattleChat.push(b, 'Система', `${account.username} вернулся в бой как ${GameConfig.roleNames[role]} за ${GameConfig.landBattle.reentryBlackCost} чёрного золота.`, 'system');
    return f;
  },
  expireDead(b) {
    const now = U.now(), expired = [];
    for (const f of b.fighters) {
      if (!f.alive && f.reviveUntil && now >= f.reviveUntil) {
        f.reviveUntil = 0;
        f.expelled = true;
        expired.push(f);
        this.syncLedger(b, f);
        if (f.accountId) {
          b.leftAccounts[f.accountId] = { role: f.role, name: f.name, faction: f.faction, leftAt: now };
          const q = Lands.queue(b.landId), team = q[f.faction], i = team.findIndex(x => x.accountId === f.accountId);
          if (i >= 0) {
            team.splice(i, 1);
          }
        }
      }
    }
    if (expired.length) {
      for (const f of expired) {
        BattleChat.push(b, 'Система', `${f.name} выбыл из боя.`, 'system');
      }
      b.fighters = b.fighters.filter(x => !x.expelled);
      this.reindex(b);
    }
  },
  tick(b) {
    if (!b || b.ended) {
      return;
    }
    this.expireDead(b);
    for (const f of b.fighters) {
      if (f.isBot) {
        Bots.act(b, f);
      }
    }
    for (const f of b.fighters) {
      if (f.accountId) {
        this.syncLedger(b, f);
      }
    }
  },
  finish(b, winner) {
    if (b.ended) {
      return;
    }
    b.ended = true;
    b.winner = winner;
    for (const f of b.fighters) {
      if (f.accountId) {
        this.syncLedger(b, f);
      }
    }
    const land = Lands.get(b.landId);
    land.owner = winner;
    b.top = Lands.distributeBattleRewards(b, winner);
    Lands.scheduleNext(b.landId);
    BattleChat.push(b, 'Система', `${GameConfig.factions[winner].name} захватила ${land.name}. Следующая битва за землю — через час.`, 'system');
    if (this.active === b) {
      this.active = null;
    }
    Store.save(GameState);
  },
  myFighter(b, a) { return b?.fighters.find(x => x.accountId === a.id) || null; }
};
