window.Lands = {
  ensure() {
    const now = U.now();
    if (!GameState.world) {
      GameState.world = {
        lands: [
          { id: 'north', name: 'Северный бастион', owner: 'red', nextBattle: now + 120000, type: 'tower', icon: '🏰', terrain: 'снежная крепость', x: 18, y: 14, art: 'assets/lands/north-fortress.svg' },
          { id: 'forest', name: 'Сумрачный лес', owner: 'red', nextBattle: now + 360000, type: 'forest', icon: '🌲', terrain: 'древний лес', x: 33, y: 44, art: 'assets/lands/forest.svg' },
          { id: 'mine', name: 'Чёрная шахта', owner: 'blue', nextBattle: now + 540000, type: 'mine', icon: '⛏️', terrain: 'рудная шахта', x: 72, y: 28, art: 'assets/lands/mine.svg' },
          { id: 'citadel', name: 'Старая цитадель', owner: 'neutral', nextBattle: now + 180000, type: 'citadel', icon: '🗼', terrain: 'каменная башня', x: 50, y: 48, art: 'assets/lands/citadel.svg' },
          { id: 'valley', name: 'Долина клыков', owner: 'blue', nextBattle: now + 720000, type: 'valley', icon: '🦴', terrain: 'скалистая долина', x: 67, y: 72, art: 'assets/lands/valley.svg' },
          { id: 'marsh', name: 'Гнилые болота', owner: 'neutral', nextBattle: now + 420000, type: 'swamp', icon: '🪵', terrain: 'туманные болота', x: 21, y: 73, art: 'assets/lands/swamp.svg' }
        ], queues: {}, battles: {}, treasury: { red: 0, blue: 0 }, lastIncome: now
      };
    }
    GameState.world.queues ??= {};
    GameState.world.battles ??= {};
    GameState.world.treasury ??= { red: 0, blue: 0 };
    GameState.world.lastIncome ??= now;
    for (const l of GameState.world.lands || []) {
      l.nextBattle ??= now + 3600000;
      l.owner ??= 'neutral';
      const arts = { north: 'assets/lands/north-fortress.svg', forest: 'assets/lands/forest.svg', mine: 'assets/lands/mine.svg', citadel: 'assets/lands/citadel.svg', valley: 'assets/lands/valley.svg', marsh: 'assets/lands/swamp.svg' };
      l.icon ??= '✦';
      l.terrain ??= 'земля';
      l.type ??= 'plain';
      l.x ??= 50;
      l.y ??= 50;
      l.art ??= arts[l.id] || 'assets/lands/citadel.svg';
      GameState.world.battles[l.id] ??= { active: false, battleId: null };
    }
    Store.save(GameState);
  },
  tickIncome() {
    this.ensure();
    const w = GameState.world, elapsed = (U.now() - w.lastIncome) / 3600000;
    if (elapsed < 1) {
      return;
    }
    const hours = Math.floor(elapsed);
    for (const f of ['red', 'blue']) {
      w.treasury[f] += w.lands.filter(l => l.owner === f).length * 5 * hours;
    }
    w.lastIncome += hours * 3600000;
    Store.save(GameState);
  },
  claimIncome(account) {
    this.ensure();
    account.landIncomeAt ??= U.now();
    const hours = Math.floor((U.now() - account.landIncomeAt) / 3600000);
    if (hours < 1) {
      return { hours: 0, gold: 0, black: 0, lands: this.ownedCount(account.faction) };
    }
    const owned = this.ownedCount(account.faction);
    const gold = hours * owned * GameConfig.landBattle.landGoldPerHour;
    const black = hours * owned * GameConfig.landBattle.landBlackPerHour;
    account.landIncomeAt += hours * 3600000;
    account.gold += gold;
    account.blackGold += black;
    Accounts.save();
    return { hours, gold, black, lands: owned };
  },
  ownedCount(faction) { this.ensure(); return GameState.world.lands.filter(l => l.owner === faction).length; },
  get(id) { this.ensure(); return GameState.world.lands.find(l => l.id === id); },
  queuedLandFor(accountId) {
    this.ensure(); for (const [landId, q] of Object.entries(GameState.world.queues || {})) {
      for (const f of ['red', 'blue']) {
        if ((q[f] || []).some(x => x.accountId === accountId)) {
          return landId;
        }
      }
    } return null;
  },
  queue(id) {
    this.ensure();
    if (!GameState.world.queues[id]) {
      GameState.world.queues[id] = { red: [], blue: [] };
    }
    GameState.world.queues[id].red ??= [];
    GameState.world.queues[id].blue ??= [];
    return GameState.world.queues[id];
  },
  register(account, landId, role) {
    if (!GameConfig.roleNames[role]) {
      throw Error('Сначала выбери роль во вкладке «Навыки»');
    }
    const state = GameState.world.battles[landId], live = (window.BattleEngine && BattleEngine.getBattle) ? BattleEngine.getBattle(landId) : null;
    if (state?.active && live) {
      throw Error('Битва уже идёт');
    }
    if (state?.active && !live) {
      this.markBattle(landId, false, null);
    }
    for (const [otherId, q] of Object.entries(GameState.world.queues || {})) {
      for (const faction of ['red', 'blue']) {
        if ((q[faction] || []).some(x => x.accountId === account.id)) {
          throw Error('Нельзя записаться сразу в несколько битв');
        }
      }
    }
    const q = this.queue(landId), team = q[account.faction];
    if (team.some(x => x.accountId === account.id)) {
      throw Error('Ты уже записан');
    }
    if (team.filter(x => !x.isBot).length >= 3) {
      throw Error('Три места для живых игроков уже заняты');
    }
    team.push({ accountId: account.id, name: account.username, role, isBot: false });
    account.lastRole = role;
    account.pendingBattleLandId = landId;
    Accounts.save();
    Store.save(GameState);
  },
  unregister(account, landId) {
    const q = this.queue(landId), team = q[account.faction];
    const i = team.findIndex(x => x.accountId === account.id);
    if (i >= 0) {
      team.splice(i, 1);
    }
    if (account.pendingBattleLandId === landId) {
      account.pendingBattleLandId = null;
    }
    Accounts.save();
    Store.save(GameState);
  },
  ready(id) { return U.now() >= this.get(id).nextBattle; },
  markBattle(id, active, battleId = null) { this.ensure(); GameState.world.battles[id] = { active: !!active, battleId: battleId || null }; Store.save(GameState); },
  scheduleNext(id) {
    const l = this.get(id);
    l.nextBattle = U.now() + 3600000;
    GameState.world.queues[id] = { red: [], blue: [] };
    this.markBattle(id, false, null);
    Store.save(GameState);
  },
  distributeBattleRewards(battle, winnerFaction) {
    const ranked = Object.values(battle.ledger || {}).sort((a, b) => b.contribution - a.contribution);
    for (const p of ranked) {
      if (!p.accountId) {
        continue;
      }
      const a = Object.values(GameState.accounts).find(x => x.id === p.accountId);
      if (!a) {
        continue;
      }
      Accounts.normalize(a);
      a.gold += GameConfig.landBattle.participationGold;
      a.blackGold += GameConfig.landBattle.participationBlack;
      if (a.faction === winnerFaction) {
        a.gold += GameConfig.landBattle.winnerGold;
        a.blackGold += GameConfig.landBattle.winnerBlack;
        a.records.landsWon++;
      }
      a.records.bestContribution = Math.max(a.records.bestContribution || 0, p.contribution || 0);
    }
    ranked.slice(0, 3).forEach((p, i) => {
      if (!p.accountId) {
        return;
      }
      const a = Object.values(GameState.accounts).find(x => x.id === p.accountId);
      if (!a) {
        return;
      }
      const r = GameConfig.landBattle.topRewards[i];
      a.gold += r.gold;
      a.blackGold += r.black;
    });
    GameState.world.treasury[winnerFaction] = (GameState.world.treasury[winnerFaction] || 0) + 5;
    Accounts.save();
    return ranked.slice(0, 5);
  }
};
Lands.ensure();
