window.Stats = {
  baseHit(a) { const s = a.stats.strength, m = a.stats.mastery; return Math.round(42 + 7 * Math.sqrt(s) + 0.9 * s + 0.18 * m); },
  maxHp(a, role = null) {
    const mass = a.stats.mass, end = a.stats.endurance; let mult = 1; if (role === 'tank') {
      mult = 1.28;
    } if (role === 'healer') {
      mult = 1.08;
    } if (role === 'beast') {
      mult = .95;
    } if (role === 'ninja') {
      mult = .92;
    } return Math.round((820 + 16 * mass + 12 * end + 2.3 * Math.pow(mass, 1.35)) * mult);
  },
  damageReduction(a) { return U.clamp(.04 + (a.stats.endurance - 50) * .0013, 0.04, .34); },
  attackCooldown(a) { return U.clamp(560 - (a.stats.agility - 50) * 3.2, 280, 560); },
  healPower(a) { return Stats.baseHit(a) * (0.92 + (a.stats.will - 50) * .008); },
  skillMult(a, level) { return 1 + level * .035 + (a.stats.mastery - 50) * .0025; },
  shieldBlockPerLayer(a, role) { return Math.round(Stats.maxHp(a, role) * (.055 + (a.stats.mass - 50) * .00025)); },
  power(a) { return Math.round(Object.values(a.stats).reduce((x, y) => x + y, 0) * 12 + Object.values(a.skills).flatMap(x => Object.values(x)).reduce((s, k) => s + k.level * 70, 0)); }
};
