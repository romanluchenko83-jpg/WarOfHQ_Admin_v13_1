window.Store = {
  key: 'war_hq_v4',
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || this.blank();
    }
    catch {
      return this.blank();
    }
  },
  blank() { return { accounts: {}, session: null, world: null, settings: {} }; },
  save(state) { localStorage.setItem(this.key, JSON.stringify(state)); },
  reset() { localStorage.removeItem(this.key); }
};
window.GameState = Store.load();
