window.Bots = {
  names: ['Rex', 'Mila', 'Shade', 'Fang', 'Krot', 'Vega', 'Luna', 'IronWall', 'Claw', 'Bulwark', 'Rook', 'Ash', 'Moro', 'Nyx', 'Grom', 'Fox'],
  create(faction, role, levelBias = 0) {
    const name = U.pick(this.names) + Math.floor(U.rand(1, 99));
    const stats = {};
    for (const k of Object.keys(GameConfig.baseStats)) {
      stats[k] = Math.round(50 + U.rand(-4, 12) + levelBias);
    }
    const fake = { id: U.id('bot'), username: name, faction, isBot: true, gold: 0, blackGold: 0, stats, skills: Skills.createInitial(false) };
    for (const r of Object.keys(fake.skills)) {
      for (const s of Object.keys(fake.skills[r])) {
        fake.skills[r][s].level = Math.round(U.clamp(7 + U.rand(-3, 4) + levelBias * .15, 1, 25));
      }
    }
    fake.role = role;
    return fake;
  },
  chooseRole(team) {
    const counts = { beast: 0, tank: 0, healer: 0, ninja: 0 }; team.forEach(x => counts[x.role] = (counts[x.role] || 0) + 1); if (counts.healer < 2) {
      return 'healer';
    } if (counts.tank < 2) {
      return 'tank';
    } return U.pick(['beast', 'beast', 'ninja', 'tank', 'healer']);
  },
  fillTeam(faction, existing) {
    const list = [...existing]; const botCount = list.filter(x => x.isBot).length; let can = Math.max(0, GameConfig.landBattle.maxBots - botCount); while (list.length < 10 && can > 0) {
      const role = this.chooseRole(list);
      const b = this.create(faction, role);
      list.push({ account: b, accountId: null, name: b.username, role, isBot: true });
      can--;
    } return list;
  },
  targetEnemy(battle, actor) {
    const enemies = battle.teams[actor.faction].enemy.filter(x => x.alive); if (!enemies.length) {
      return null;
    } const healers = enemies.filter(x => x.role === 'healer'); if (actor.role === 'ninja' && healers.length) {
      return U.pick(healers);
    } const low = [...enemies].sort((a, b) => a.hp - b.hp); return Math.random() < .55 ? low[0] : U.pick(enemies);
  },
  targetAlly(battle, actor, dead = false) {
    const allies = battle.teams[actor.faction].allies.filter(x => dead ? !x.alive && x.reviveUntil > U.now() : x.alive); if (!allies.length) {
      return null;
    } return [...allies].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
  },
  act(battle, actor) {
    if (!actor.alive) {
      return;
    }
    const now = U.now();
    if (actor.nextAiAt && actor.nextAiAt > now) {
      return;
    }
    actor.nextAiAt = now + U.rand(320, 650);
    if (actor.role === 'healer') {
      const dead = this.targetAlly(battle, actor, true);
      if (dead && actor.skillState.revive?.charges > 0 && Math.random() < .8) {
        return BattleEngine.useSkill(battle, actor, 'revive', dead);
      }
      const ally = this.targetAlly(battle, actor, false);
      if (ally && ally.hp / ally.maxHp < .42 && actor.skillState.single?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'single', ally);
      }
      if (battle.teams[actor.faction].allies.filter(x => x.alive && x.hp / x.maxHp < .7).length >= 3 && actor.skillState.mass?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'mass', null);
      }
    }
    if (actor.role === 'tank') {
      if (actor.shields >= 3 && actor.hp / actor.maxHp < .55 && actor.skillState.shieldHeal?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'shieldHeal', actor);
      }
      if (battle.teams[actor.faction].allies.filter(x => x.alive && x.shields < 2).length >= 4 && actor.skillState.defense?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'defense', null);
      }
      if (actor.hp / actor.maxHp < .32 && actor.skillState.absolute?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'absolute', actor);
      }
    }
    if (actor.role === 'beast') {
      const lowEnemy = battle.teams[actor.faction].enemy.filter(x => x.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (lowEnemy && actor.skillState.crushing?.charges > 0 && lowEnemy.hp / lowEnemy.maxHp <= .20 && Math.random() < .72) {
        return BattleEngine.useSkill(battle, actor, 'crushing', lowEnemy);
      }
      if (actor.skillState.howl?.charges > 0 && Math.random() < .30) {
        return BattleEngine.useSkill(battle, actor, 'howl', null);
      }
    }
    if (actor.role === 'ninja' && actor.skillState.shadowFan?.charges > 0 && battle.teams[actor.faction].enemy.filter(x => x.alive).length >= 4 && Math.random() < .22) {
      return BattleEngine.useSkill(battle, actor, 'shadowFan', null);
    }
    const liveEnemies = battle.teams[actor.faction].enemy.filter(x => x.alive);
    const enemyHq = { __hq: true, faction: actor.faction === 'red' ? 'blue' : 'red' };
    if (liveEnemies.length <= 3 || Math.random() < .18) {
      return BattleEngine.basicAttack(battle, actor, enemyHq);
    }
    const enemy = this.targetEnemy(battle, actor);
    if (!enemy) {
      return BattleEngine.basicAttack(battle, actor, enemyHq);
    }
    if (actor.role === 'ninja' && enemy.role === 'healer') {
      if (actor.skillState.antiheal?.charges > 0 && (!enemy.antiHealUntil || enemy.antiHealUntil < now)) {
        return BattleEngine.useSkill(battle, actor, 'antiheal', enemy);
      }
      if (actor.skillState.underArmor?.charges > 0) {
        return BattleEngine.useSkill(battle, actor, 'underArmor', enemy);
      }
    }
    const ids = Object.keys(actor.skillState).filter(id => actor.skillState[id].charges > 0 && Skills.defs[actor.role][id].target === 'enemy');
    if (ids.length && Math.random() < .45) {
      return BattleEngine.useSkill(battle, actor, U.pick(ids), enemy);
    }
    BattleEngine.basicAttack(battle, actor, enemy);
  }
};
