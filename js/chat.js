window.BattleChat = {
  push(battle, who, text, kind = 'bot') {
    battle.chat.push({ t: U.now(), who, text, kind }); if (battle.chat.length > 80) {
      battle.chat.shift();
    }
  },
  event(battle, type, data = {}) {
    if (Math.random() > .55) {
      return;
    }
    const pool = {
      shield: ['опять щит', 'не бейте в щит', 'сколько у него этих щитов вообще', 'ждём пока спадёт'],
      hqShield: ['штаб снова под щитом', 'не тратьте урон в штаб сейчас', 'щит на штабе, переключитесь на игроков'],
      revive: ['он опять кого-то поднял', 'не дали трупу даже пять секунд полежать', 'сначала хила надо было снимать'],
      healerTanky: ['почему этот лекарь до сих пор жив', 'три человека на хиле и он стоит', 'что у него с хп вообще'],
      howl: ['вопль снял щиты, сейчас можно давить', 'всем щиты поснимало', 'вот теперь фокус'],
      death: ['минус один', 'место освободилось', 'не успели реснуть'],
      lowHq: ['штаб красный, дожимаем', 'в штаб всё что есть', 'не отвлекайтесь, штаб почти лёг']
    }[type];
    if (!pool) {
      return;
    }
    const candidates = [...battle.fighters].filter(x => x.alive && x.isBot);
    if (!candidates.length) {
      return;
    }
    this.push(battle, U.pick(candidates).name, U.pick(pool));
  },
  playerMessage(battle, player, text) {
    this.push(battle, player.name, text, 'human');
    const bots = battle.fighters.filter(x => x.alive && x.isBot);
    if (!bots.length) {
      return;
    }
    const lower = text.toLowerCase();
    let replies;
    if (/хил|лекар/.test(lower)) {
      replies = ['вижу хила', 'пробуем фокус лекаря', 'если он опять реснет, будет плохо'];
    }
    else if (/штаб/.test(lower)) {
      replies = ['понял, смотрю штаб', 'можно давить штаб, если щит спадёт', 'держим штаб в фокусе'];
    }
    else if (/щит/.test(lower)) {
      replies = ['да, щит вижу', 'не трать прокаст пока висит', 'считаю слои'];
    }
    else if (/рес|воскр/.test(lower)) {
      replies = ['пять секунд окно, следим', 'лекарь рядом, может поднять', 'если успеем — не дадим реснуть'];
    }
    else {
      replies = ['понял', 'ок', 'вижу', 'принято', 'да, играем от этого'];
    }
    setTimeout(() => {
      if (!battle.ended) {
        this.push(battle, U.pick(bots).name, U.pick(replies));
      }
    }, 350 + Math.random() * 700);
  }
};
