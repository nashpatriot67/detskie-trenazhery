(function (root) {
  'use strict';
  var doc = root.document;
  var nav = root.navigator || {};
  var script = doc && doc.currentScript;
  var scriptUrl = script && script.src;
  var protocol = root.location && root.location.protocol;
  if (!doc || (protocol !== 'https:' && protocol !== 'http:')) return;

  var deferredPrompt = null;
  var prompting = false;
  var installed = false;
  var launcher = null;
  var spacer = null;
  var panel = null;
  var previousFocus = null;
  var previousOverflow = '';
  var displayMode = null;
  try { displayMode = root.matchMedia('(display-mode: standalone)'); } catch (_) {}

  function standalone() {
    return installed || !!nav.standalone || !!(displayMode && displayMode.matches);
  }

  function syncLauncher() {
    if (!launcher) return;
    launcher.hidden = standalone();
    if (spacer) spacer.hidden = launcher.hidden;
    launcher.disabled = prompting;
  }

  function instruction(browser) {
    if (browser === 'yandex') return '<ol><li>Открой меню Яндекс Браузера.</li><li>Выбери «Добавить на домашний экран». На телефоне пункт может называться «Добавить ярлык на рабочий стол».</li><li>Нажми «Добавить».</li></ol>';
    if (browser === 'huawei') return '<ol><li>В меню Huawei Browser нажми «В закладки».</li><li>Выбери «Рабочий экран».</li><li>Подтверди галочкой в правом верхнем углу.</li></ol>';
    if (browser === 'ios') return '<ol><li>Открой эту страницу в Safari.</li><li>Нажми «Поделиться» — квадрат со стрелкой вверх.</li><li>Выбери «На экран Домой» и нажми «Добавить».</li></ol>';
    return '<ol><li>Открой меню браузера.</li><li>Найди «Установить приложение», «Добавить на главный экран» или «Создать ярлык».</li><li>Подтверди добавление.</li></ol>';
  }

  function browserName() {
    var ua = nav.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
    if (/YaBrowser|YaApp_Android|YaSearchBrowser/i.test(ua)) return 'yandex';
    if (/HuaweiBrowser/i.test(ua)) return 'huawei';
    return 'other';
  }

  function focusable() {
    return panel ? Array.prototype.slice.call(panel.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]')).filter(function (element) {
      return !element.disabled && element.getAttribute('tabindex') !== '-1' && !element.hidden;
    }) : [];
  }

  function closeHelp() {
    if (!panel) return;
    var old = panel;
    panel = null;
    old.remove();
    doc.body.style.overflow = previousOverflow;
    if (previousFocus && previousFocus.isConnected !== false && typeof previousFocus.focus === 'function') previousFocus.focus();
    previousFocus = null;
  }

  function openHelp(failed) {
    if (standalone()) return;
    if (panel) { var existing = focusable(); if (existing[0]) existing[0].focus(); return; }
    var browser = browserName();
    var title = browser === 'yandex' ? 'В Яндекс Браузере' : browser === 'huawei' ? 'В Huawei Browser' : browser === 'ios' ? 'На iPhone или iPad' : 'Через меню браузера';
    previousFocus = doc.activeElement || launcher;
    previousOverflow = doc.body.style.overflow;
    panel = doc.createElement('div');
    panel.className = 'pwa-backdrop';
    panel.innerHTML = '<section class="pwa-dialog" role="dialog" aria-modal="true" aria-labelledby="pwa-title" aria-describedby="pwa-description">' +
      '<button class="pwa-close" type="button" data-pwa-close aria-label="Закрыть подсказку">×</button>' +
      '<span class="pwa-kicker">ВСЕГДА ПОД РУКОЙ</span><h2 id="pwa-title">На главном экране</h2>' +
      '<p id="pwa-description">Открывай тренажёр по значку, без поиска ссылки.</p>' +
      (failed ? '<p class="pwa-notice" role="status">Браузер не открыл окно установки. Попробуй добавить значок через его меню.</p>' : '') +
      '<h3>' + title + '</h3>' + instruction(browser) +
      (browser === 'other' ? '<details class="pwa-other"><summary>У меня Huawei или Яндекс</summary><h3>Huawei Browser</h3>' + instruction('huawei') + '<h3>Яндекс Браузер</h3>' + instruction('yandex') + '</details>' : '') +
      '<p class="pwa-note">Название пункта зависит от версии браузера. Если он не виден, открой ссылку в обычном браузере, а не внутри чата.</p>' +
      '<p class="pwa-note">Ярлык из меню может открывать сайт в обычной вкладке. Отдельное окно приложения зависит от поддержки установки в браузере.</p>' +
      '<p class="pwa-note">Для первого открытия и озвучки нужен интернет.</p>' +
      '<button class="pwa-done" type="button" data-pwa-close>Понятно</button></section>';
    panel.addEventListener('click', function (event) {
      event.stopPropagation();
      if (event.target === panel || (event.target.closest && event.target.closest('[data-pwa-close]'))) closeHelp();
    });
    doc.body.appendChild(panel);
    doc.body.style.overflow = 'hidden';
    var controls = focusable();
    if (controls[0]) controls[0].focus();
  }

  function requestInstall() {
    if (prompting || standalone()) return;
    if (!deferredPrompt) { openHelp(false); return; }
    var event = deferredPrompt;
    deferredPrompt = null;
    prompting = true;
    syncLauncher();
    var result;
    try {
      // The browser's prompt must be called during this exact button gesture.
      result = event.prompt();
    } catch (_) {
      prompting = false;
      syncLauncher();
      openHelp(true);
      return;
    }
    Promise.resolve(result).then(function () { return event.userChoice; }).then(function () {
      prompting = false;
      syncLauncher();
    }, function () {
      prompting = false;
      syncLauncher();
      openHelp(true);
    });
  }

  root.addEventListener('beforeinstallprompt', function (event) {
    if (standalone() || !event || typeof event.prompt !== 'function') return;
    event.preventDefault();
    deferredPrompt = event;
    syncLauncher();
  });
  root.addEventListener('appinstalled', function () {
    installed = true;
    deferredPrompt = null;
    closeHelp();
    syncLauncher();
  });
  function modeChanged() { if (standalone()) closeHelp(); syncLauncher(); }
  if (displayMode) {
    if (typeof displayMode.addEventListener === 'function') displayMode.addEventListener('change', modeChanged);
    else if (typeof displayMode.addListener === 'function') displayMode.addListener(modeChanged);
  }

  // Capture prevents the trainers' own Escape/Tab handlers from closing their UI.
  doc.addEventListener('keydown', function (event) {
    if (!panel) return;
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); closeHelp(); return; }
    if (event.key !== 'Tab') return;
    var controls = focusable();
    if (!controls.length) { event.preventDefault(); return; }
    var first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && (doc.activeElement === first || !panel.contains(doc.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || !panel.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
  }, true);
  doc.addEventListener('focusin', function (event) {
    if (!panel || panel.contains(event.target)) return;
    var controls = focusable();
    if (controls[0]) controls[0].focus();
  }, true);

  function registerWorker() {
    if (!scriptUrl || !nav.serviceWorker || root.isSecureContext === false) return;
    if (protocol !== 'https:' && !/^(?:localhost|127\.0\.0\.1)$/.test(root.location.hostname || '')) return;
    try {
      var worker = new root.URL('sw.js', scriptUrl);
      var scope = new root.URL('./', scriptUrl);
      var registration = nav.serviceWorker.register(worker.href, { scope: scope.pathname });
      if (registration && registration.catch) registration.catch(function () {});
    } catch (_) { /* Installation help stays available if this browser has no worker support. */ }
  }

  function mount() {
    if (!doc.body || launcher) return;
    spacer = doc.createElement('div');
    spacer.className = 'pwa-install-space';
    spacer.setAttribute('aria-hidden', 'true');
    launcher = doc.createElement('button');
    launcher.className = 'pwa-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-haspopup', 'dialog');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3v11m-4-4 4 4 4-4M5 15v5h14v-5"/></svg><span>На главный экран</span>';
    launcher.addEventListener('click', function (event) { event.stopPropagation(); requestInstall(); });
    doc.body.appendChild(spacer);
    doc.body.appendChild(launcher);
    syncLauncher();
    if (doc.readyState === 'complete') registerWorker();
    else root.addEventListener('load', registerWorker, { once: true });
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  root.TrainerPWA = { openInstallHelp: openHelp, closeInstallHelp: closeHelp };
})(window);
