window.UIRaid = {
  timer: null, render() {
    const a = Accounts.current(); const completed = Raid.sync(a); const rem = Raid.remaining(a); let body = ''; if (a.raid.active) {
      body = `<section class="card raid-card"><h2>Дозор идёт</h2><div class="big-timer" id="raidTimer">${U.msToClock(a.raid.endsAt - U.now())}</div><p>Награда придёт только после полного завершения похода.</p><p>Ожидаемая награда: <b class="gold">${U.money(Math.round(a.raid.durationMinutes * GameConfig.raid.goldPerHour / 60), 'gold')}</b></p></section>`;
    }
    else {
      body = `<section class="card raid-card"><h2>Дозор</h2><p>50 золота за час. Награда начисляется только после окончания выбранного похода.</p><p>Осталось сегодня: <b>${rem} мин</b></p><div class="raid-options">${[30, 60, 90].map(m => `<button data-raid="${m}" ${m > rem ? 'disabled' : ''}>${m} минут<br><span class="small">+${U.money(Math.round(m * GameConfig.raid.goldPerHour / 60), 'gold')}</span></button>`).join('')}</div>${completed ? '<p class="ok">Поход завершён, награда начислена.</p>' : ''}</section>`;
    } UIShell.render('raid', `<div class="mode-grid">${body}<section class="card"><h3>Правила дозора</h3><p class="muted">Роли здесь не используются. Пока поход не закончился, золото не начисляется. После завершения можно начать следующий, если остался дневной лимит.</p></section></div>`); document.querySelectorAll('[data-raid]').forEach(b => b.onclick = () => {
      try {
        Raid.start(a, Number(b.dataset.raid));
        this.render();
      }
      catch (e) {
        alert(e.message);
      }
    }); clearInterval(this.timer); if (a.raid.active) {
      this.timer = setInterval(() => {
        if (!Accounts.current() || !Accounts.current().raid.active) {
          clearInterval(this.timer);
          return;
        } if (Raid.sync(a)) {
          this.render();
          return;
        } const el = document.getElementById('raidTimer'); if (el) {
          el.textContent = U.msToClock(a.raid.endsAt - U.now());
        }
      }, 250);
    }
  }
};
