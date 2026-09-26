window.Skills = {
  defs: {
    beast: {
      rend: { name: 'Рваный удар', target: 'enemy', baseCharges: 26, cd: 620, desc: 'Сильный точечный удар.' },
      howl: { name: 'Пронизывающий вопль', target: 'massEnemy', baseCharges: 22, cd: 1250, desc: 'Снимает у всех врагов до 2 щитов, затем наносит мощный массовый урон.' },
      crushing: { name: 'Сокрушающий удар', target: 'enemy', baseCharges: 10, cd: 950, desc: 'Мгновенно добивает цель ниже порога HP. Выше порога наносит усиленный урон.' },
      fury: { name: 'Ярость', target: 'self', baseCharges: 18, cd: 1450, desc: 'На 5 секунд усиливает следующий нанесённый урон.' }
    },
    tank: {
      absolute: { name: 'Абсолютный щит', target: 'allyOrHq', baseCharges: 9, cd: 13000, desc: 'Полная неуязвимость выбранного союзника или штаба. Кулдаун 13 секунд.' },
      defense: { name: 'Защита', target: 'massAlly', baseCharges: 18, cd: 4400, desc: 'Даёт всем живым союзникам 5 обычных щитов, максимум 13.' },
      shieldHeal: { name: 'Щитовая регенерация', target: 'massAlly', baseCharges: 22, cd: 3200, desc: 'У каждого союзника тратит до 5 щитов и лечит его. Чем больше щитов — тем сильнее лечение.' },
      bash: { name: 'Удар щитом', target: 'enemy', baseCharges: 24, cd: 780, desc: 'Точечный усиленный удар.' }
    },
    healer: {
      single: { name: 'Точечное лечение', target: 'ally', baseCharges: 32, cd: 650, desc: 'Сильное лечение выбранного живого союзника.' },
      mass: { name: 'Массовое лечение', target: 'massAlly', baseCharges: 24, cd: 1150, desc: 'Лечит всех живых союзников.' },
      revive: { name: 'Нашатырь', target: 'deadAlly', baseCharges: 12, cd: 1450, desc: 'Воскрешает союзника, пока не истекло 5 секунд после смерти.' },
      ward: { name: 'Оберег', target: 'ally', baseCharges: 22, cd: 950, desc: 'Даёт выбранному союзнику обычные щиты, максимум 13.' }
    },
    ninja: {
      antiheal: { name: 'Запрет исцеления', target: 'enemy', baseCharges: 22, cd: 1050, desc: 'Сильно уменьшает входящее лечение цели.' },
      underArmor: { name: 'Удар из-под брони', target: 'enemy', baseCharges: 26, cd: 680, desc: 'Снимает 3 обычных щита, затем наносит усиленный удар.' },
      shadowFan: { name: 'Теневой веер', target: 'massEnemy', baseCharges: 20, cd: 1300, desc: 'Массовая атака по всем живым врагам.' },
      execute: { name: 'Добивание', target: 'enemy', baseCharges: 22, cd: 900, desc: 'Особенно сильно бьёт по цели с низким HP.' }
    }
  },
  createInitial(admin = false) {
    const out = {};
    for (const [role, defs] of Object.entries(this.defs)) {
      out[role] = {};
      for (const id of Object.keys(defs)) {
        out[role][id] = { level: admin ? 25 : 1 };
      }
    }
    return out;
  },
  charges(account, role, id) {
    const d = this.defs[role][id], lvl = account.skills[role][id].level;
    if (role === 'beast' && id === 'crushing') {
      return d.baseCharges + Math.floor((lvl - 1) / 3);
    }
    return d.baseCharges + Math.floor((lvl - 1) / 4);
  },
  duration(role, id, lvl) {
    if (role === 'tank' && id === 'absolute') {
      return 6000 + (lvl - 1) * (6000 / 24);
    }
    return 0;
  },
  valueText(a, role, id) {
    const lvl = a.skills[role][id].level, m = Stats.skillMult(a, lvl), base = Stats.baseHit(a), heal = Stats.healPower(a);
    if (role === 'beast' && id === 'rend') {
      return `≈ ${U.fmt(base * 3.0 * m)} урона`;
    }
    if (role === 'beast' && id === 'howl') {
      return `≈ ${U.fmt(base * 1.55 * m)} каждому · −2 щита`;
    }
    if (role === 'beast' && id === 'crushing') {
      const threshold = Math.min(25, 13 + (lvl - 1) * .5);
      return `добивание ≤ ${threshold.toFixed(1)}% HP · иначе ≈ ${U.fmt(base * 3.35 * m)} урона · ${this.charges(a, role, id)} карт`;
    }
    if (role === 'beast' && id === 'fury') {
      return `следующий урон ×1.80`;
    }
    if (role === 'tank' && id === 'absolute') {
      return `${(this.duration(role, id, lvl) / 1000).toFixed(1)} сек · откат ${(this.defs[role][id].cd / 1000).toFixed(0)} сек · ${this.charges(a, role, id)} карт`;
    }
    if (role === 'tank' && id === 'defense') {
      return `+5 щитов каждому · максимум ${GameConfig.landBattle.maxShields}`;
    }
    if (role === 'tank' && id === 'shieldHeal') {
      return `1 щит ≈ ${U.fmt(heal * .59 * m)} HP · 5 щитов ≈ ${U.fmt(heal * 1.55 * m)} HP каждому`;
    }
    if (role === 'tank' && id === 'bash') {
      return `≈ ${U.fmt(base * 1.65 * m)} урона`;
    }
    if (role === 'healer' && id === 'single') {
      return `≈ ${U.fmt(heal * 1.45 * m)} HP`;
    }
    if (role === 'healer' && id === 'mass') {
      return `≈ ${U.fmt(heal * .52 * m)} HP каждому`;
    }
    if (role === 'healer' && id === 'revive') {
      return `${Math.round((.28 + .52 * (lvl / 25)) * 100)}% максимального HP`;
    }
    if (role === 'healer' && id === 'ward') {
      return `+${Math.min(5, 2 + Math.floor(lvl / 8))} щита · максимум ${GameConfig.landBattle.maxShields}`;
    }
    if (role === 'ninja' && id === 'underArmor') {
      return `−3 щита · ≈ ${U.fmt(base * 2.75 * m)} урона`;
    }
    if (role === 'ninja' && id === 'shadowFan') {
      return `≈ ${U.fmt(base * 1.20 * m)} каждому`;
    }
    if (role === 'ninja' && id === 'execute') {
      return `≈ ${U.fmt(base * 2.15 * m)} / до ${U.fmt(base * 4.15 * m)}`;
    }
    if (role === 'ninja' && id === 'antiheal') {
      return `${((4000 + lvl * 120) / 1000).toFixed(1)} сек · лечение цели ×0.2`;
    }
    return this.defs[role]?.[id]?.desc || '';
  }
};
