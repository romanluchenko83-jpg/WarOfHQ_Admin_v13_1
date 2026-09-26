window.Accounts = {
  normalize(account) {
    if (!account) {
      return account;
    }
    account.gold ??= 300;
    account.blackGold ??= 0;
    account.stats ??= U.deep(GameConfig.baseStats);
    for (const [k, v] of Object.entries(GameConfig.baseStats)) {
      account.stats[k] ??= v;
    }
    account.statSpent ??= {};
    account.raid ??= { day: U.dayKey(), usedMinutes: 0, active: false, startedAt: null, durationMinutes: 0, endsAt: null };
    account.monsters ??= { tier: 1, kills: 0, battle: null };
    account.skills ??= Skills.createInitial(!!account.isAdmin);
    for (const role of Object.keys(GameConfig.roleNames)) {
      account.skills[role] ??= {};
      for (const id of Object.keys(Skills.defs[role])) {
        account.skills[role][id] ??= { level: account.isAdmin ? 25 : 1 };
      }
    }
    account.records ??= { landsWon: 0, monsterKills: 0, bestContribution: 0 };
    account.records.landsWon ??= 0;
    account.records.monsterKills ??= 0;
    account.records.bestContribution ??= 0;
    account.lastRole = GameConfig.roleNames[account.lastRole] ? account.lastRole : 'tank';
    account.landIncomeAt ??= U.now();
    account.lastBattleResult ??= null;
    account.pendingBattleLandId ??= null;
    return account;
  },
  create(username, password, faction) {
    username = String(username || '').trim();
    password = String(password || '');
    if (username.length < 3) {
      throw Error('Ник минимум 3 символа');
    }
    if (password.length < 3) {
      throw Error('Пароль минимум 3 символа');
    }
    if (!GameConfig.factions[faction]) {
      throw Error('Выбери фракцию');
    }
    const key = username.toLowerCase();
    if (GameState.accounts[key]) {
      throw Error('Такой аккаунт уже существует');
    }
    const isAdmin = key === 'admin';
    const account = {
      id: U.id('acc'), username, password, faction, isAdmin, createdAt: U.now(), gold: 300, blackGold: 0,
      stats: U.deep(GameConfig.baseStats), statSpent: {},
      raid: { day: U.dayKey(), usedMinutes: 0, active: false, startedAt: null, durationMinutes: 0, endsAt: null },
      monsters: { tier: 1, kills: 0, battle: null },
      skills: Skills.createInitial(isAdmin), records: { landsWon: 0, monsterKills: 0, bestContribution: 0 },
      lastRole: 'tank', landIncomeAt: U.now(), lastBattleResult: null, pendingBattleLandId: null
    };
    GameState.accounts[key] = account;
    Store.save(GameState);
    return account;
  },
  login(username, password) {
    const a = GameState.accounts[String(username || '').trim().toLowerCase()];
    if (!a || a.password !== String(password || '')) {
      throw Error('Неверный ник или пароль');
    }
    this.normalize(a);
    GameState.session = a.id;
    Store.save(GameState);
    return a;
  },
  logout() { GameState.session = null; Store.save(GameState); },
  current() { const a = Object.values(GameState.accounts).find(a => a.id === GameState.session) || null; return this.normalize(a); },
  save() { Store.save(GameState); }
};
