window.App = {
  page: null, watcher: null,
  show(page) {
    this.page = page;
    document.onkeydown = null;
    const a = Accounts.current();
    if (!a) {
      return UIAuth.render();
    }
    if (page === 'profile') {
      return UIProfile.render();
    }
    if (page === 'raid') {
      return UIRaid.render();
    }
    if (page === 'monsters') {
      return UIMonsters.render();
    }
    if (page === 'lands') {
      return UILands.render();
    }
    return UIProfile.render();
  },
  watchBattles() {
    clearInterval(this.watcher);
    this.watcher = setInterval(() => {
      const a = Accounts.current();
      if (!a || this.page !== 'lands' || this.page === 'battle') {
        return;
      }
      const pending = a.pendingBattleLandId;
      if (!pending) {
        return;
      }
      const existing = BattleEngine.getBattle(pending);
      if (existing) {
        const me = BattleEngine.myFighter(existing, a);
        if (me) {
          a.pendingBattleLandId = null;
          Accounts.save();
          this.page = 'battle';
          UIBattle.render(BattleEngine.view(existing));
          return;
        }
      }
      const land = Lands.get(pending);
      if (land && Lands.ready(pending) && !existing) {
        const battle = BattleEngine.start(pending);
        a.pendingBattleLandId = null;
        Accounts.save();
        this.page = 'battle';
        UIBattle.render(BattleEngine.view(battle));
      }
    }, 200);
  },
  init() {
    Lands.ensure();
    BattleEngine.startLoop();
    this.watchBattles();
    Accounts.current() ? this.show('profile') : UIAuth.render('login');
  }
};
document.addEventListener('DOMContentLoaded', () => App.init());
