window.GameConfig = {
  version: '10.0.0',
  factions: { red: { name: 'Багровый союз', color: 'red' }, blue: { name: 'Лазурный орден', color: 'blue' } },
  statNames: { strength: 'Сила', mass: 'Масса', endurance: 'Выносливость', agility: 'Ловкость', will: 'Воля', mastery: 'Мастерство' },
  baseStats: { strength: 50, mass: 50, endurance: 50, agility: 50, will: 50, mastery: 50 },
  raid: { goldPerHour: 50, dailyMinutes: 90 },
  landBattle: {
    maxPlayers: 10,
    maxBots: 7,
    reviveWindowMs: 5000,
    baseHqHp: 420000,
    reentryBlackCost: 2,
    maxShields: 13,
    landGoldPerHour: 12,
    landBlackPerHour: 1,
    winnerGold: 35,
    winnerBlack: 3,
    participationGold: 12,
    participationBlack: 1,
    topRewards: [{ gold: 100, black: 8 }, { gold: 65, black: 5 }, { gold: 40, black: 3 }]
  },
  roleNames: { beast: 'Зверь', tank: 'Танк', healer: 'Лекарь', ninja: 'Ниндзя' }
};
