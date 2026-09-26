window.Raid = {
  normalize(a) {
    if (a.raid.day !== U.dayKey()) {
      a.raid = { day: U.dayKey(), usedMinutes: 0, active: false, startedAt: null, durationMinutes: 0, endsAt: null };
      Accounts.save();
    }
  },
  sync(a) {
    this.normalize(a); if (a.raid.active && a.raid.endsAt && U.now() >= a.raid.endsAt) {
      const mins = a.raid.durationMinutes || 0;
      a.gold += Math.round(mins * GameConfig.raid.goldPerHour / 60);
      a.raid.usedMinutes += mins;
      a.raid.active = false;
      a.raid.startedAt = null;
      a.raid.durationMinutes = 0;
      a.raid.endsAt = null;
      Accounts.save();
      return true;
    } return false;
  },
  start(a, minutes) {
    this.sync(a); minutes = Number(minutes); if (![30, 60, 90].includes(minutes)) {
      throw Error('Выбери 30, 60 или 90 минут');
    } if (a.raid.active) {
      throw Error('Дозор уже идёт');
    } if (a.raid.usedMinutes + minutes > GameConfig.raid.dailyMinutes) {
      throw Error('Не хватает дневного лимита');
    } a.raid.active = true; a.raid.startedAt = U.now(); a.raid.durationMinutes = minutes; a.raid.endsAt = U.now() + minutes * 60000; Accounts.save();
  },
  remaining(a) { this.normalize(a); return Math.max(0, GameConfig.raid.dailyMinutes - a.raid.usedMinutes); }
};
