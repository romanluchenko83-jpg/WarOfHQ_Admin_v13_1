window.Economy = {
  statCost(account, stat) { const v = account.stats[stat] || 50; return Math.floor(18 * Math.pow(1.075, v - 50) + 2 * (v - 50)); },
  buyStat(account, stat) {
    const cost = this.statCost(account, stat); if (account.gold < cost) {
      throw Error('Не хватает золота');
    } account.gold -= cost; account.stats[stat]++; Accounts.save(); return cost;
  },
  skillCost(level) { return Math.floor(3 + level * 1.8 + Math.pow(level, 1.35) * 0.35); },
  buySkill(account, role, skillId) {
    const s = account.skills[role][skillId]; if (!s) {
      throw Error('Нет такой карты');
    } if (s.level >= 25) {
      throw Error('Максимальный уровень');
    } const cost = this.skillCost(s.level); if (account.blackGold < cost) {
      throw Error('Не хватает чёрного золота');
    } account.blackGold -= cost; s.level++; Accounts.save(); return cost;
  },
  addGold(a, n) { a.gold = Math.max(0, a.gold + n); Accounts.save(); }, addBlackGold(a, n) { a.blackGold = Math.max(0, a.blackGold + n); Accounts.save(); }
};
