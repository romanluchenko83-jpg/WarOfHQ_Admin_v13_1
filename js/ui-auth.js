window.UIAuth = {
  render(mode = 'login', msg = '') {
    const reg = mode === 'register';
    document.getElementById('app').innerHTML = `<div class="auth-wrap"><div class="auth-box card"><h1>Война фракций</h1><p class="muted">Локальная браузерная RPG</p><div class="auth-tabs"><button id="tabLogin" class="${!reg ? 'active' : ''}">Вход</button><button id="tabReg" class="${reg ? 'active' : ''}">Регистрация</button></div><div id="authMsg" class="${msg ? 'error' : ''}">${U.esc(msg)}</div><div class="form-row"><label>Ник</label><input id="authName" autocomplete="username"></div><div class="form-row"><label>Пароль</label><input id="authPass" type="password" autocomplete="current-password"></div>${reg ? `<div class="form-row"><label>Фракция</label><select id="authFaction"><option value="red">Багровый союз</option><option value="blue">Лазурный орден</option></select></div><p class="small muted">Все персонажи начинают с 50 каждого стата. Ник <b>Admin</b> получает админские карты 25 уровня, но тоже стартует со статов 50.</p>` : ''}<button id="authSubmit">${reg ? 'Создать аккаунт' : 'Войти'}</button></div></div>`;
    document.getElementById('tabLogin').onclick = () => this.render('login');
    document.getElementById('tabReg').onclick = () => this.render('register');
    document.getElementById('authSubmit').onclick = () => {
      try {
        const n = document.getElementById('authName').value, p = document.getElementById('authPass').value;
        if (reg) {
          Accounts.create(n, p, document.getElementById('authFaction').value);
        }
        Accounts.login(n, p);
        App.show('profile');
      }
      catch (e) {
        this.render(mode, e.message);
      }
    };
  }
};
