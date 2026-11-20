(function (root) {
  'use strict';

  const VERSION = 1;
  const phases = ['study', 'find', 'restore', 'solved'];
  const zone = (id, label, x, y, tx, ty, spread = 100) => ({id, label, x, y, tx, ty, spread});
  const item = (id, label, art, home, moved = home, tint = '') => ({id, label, art, home, moved, tint});
  const room = {
    title: 'Полки в комнате',
    scene: 'search',
    intro: 'Машинка, мишка, книга и деталь лежат на своих местах. Загляни на каждую полку.',
    zones: [
      zone('cars', 'Гараж', 151, 239, 151, 318),
      zone('toys', 'Сундук', 378, 218, 378, 318),
      zone('books', 'Полка книг', 549, 452, 549, 530),
      zone('bricks', 'Ящик LEGO', 184, 436, 184, 530),
      zone('floor', 'На полу', 470, 620, 470, 697)
    ],
    paintedZones: [
      zone('cars', 'Машинки', 264, 111, 471, 111),
      zone('toys', 'Игрушки', 488, 187, 264, 187),
      zone('books', 'Книги', 264, 267, 471, 267),
      zone('bricks', 'LEGO', 488, 348, 264, 348),
      zone('floor', 'На полу', 470, 578, 470, 661)
    ],
    items: [
      item('red-car', 'Красная машинка', 'race-red', 'cars', 'floor'),
      item('teddy', 'Мишка', 'teddy', 'toys'),
      item('storybook', 'Книга сказок', 'storybook', 'books'),
      item('brick', 'Деталь конструктора', 'brick6', 'bricks')
    ]
  };
  const puzzles = Object.freeze([room, {
    title: 'Чистое и грязное',
    scene: 'clothes',
    intro: 'Чистая одежда сложена в ящике и шкафу. Футболка после тренировки ждёт стирки в корзине.',
    zones: [
      zone('drawer', 'Ящик', 157, 380, 157, 497, 112),
      zone('closet', 'Шкаф', 422, 388, 422, 497),
      zone('basket', 'Корзина для белья', 624, 327, 602, 481),
      zone('floor', 'На полу', 471, 628, 471, 682)
    ],
    items: [
      item('clean-socks', 'Чистые носки', 'clean-socks', 'drawer'),
      item('clean-shirt', 'Чистая футболка', 'clean-shirt', 'drawer', 'basket'),
      item('clean-trousers', 'Чистые брюки', 'clean-trousers', 'closet'),
      item('dirty-shirt', 'Футболка после тренировки', 'dirty-shirt', 'basket', 'floor')
    ]
  }, {
    title: 'Порядок в мастерской',
    scene: 'workshop',
    intro: 'Детали лежат в коробках своего цвета. Постройки стоят на полке. Запомни, где они.',
    zones: [
      zone('teal', 'Зелёная коробка', 145, 357, 145, 466),
      zone('amber', 'Жёлтая коробка', 365, 357, 365, 466),
      zone('shelf', 'Полка моделей', 588, 355, 588, 466, 112),
      zone('mat', 'На полу', 452, 602, 452, 685)
    ],
    items: [
      item('green-piece', 'Зелёная деталь LEGO', 'brick6', 'teal', 'amber'),
      item('yellow-piece', 'Жёлтая деталь LEGO', 'brick6', 'amber', 'teal', 'hue-rotate(225deg) saturate(1.70) brightness(1.35)'),
      item('rocket', 'Готовая ракета', 'model-rocket', 'shelf', 'mat'),
      item('house', 'Готовый домик', 'model-house', 'shelf')
    ]
  }]);
  for (const puzzle of puzzles) {
    puzzle.changed = Object.freeze(puzzle.items.filter(obj => obj.moved !== obj.home).map(obj => obj.id));
    for (const list of [puzzle.items, puzzle.zones, puzzle.paintedZones].filter(Boolean)) {
      list.forEach(Object.freeze);
      Object.freeze(list);
    }
    Object.freeze(puzzle);
  }

  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const blank = (stage = 0) => ({version:VERSION, stage, phase:'study', marked:[], placed:{}});
  const isMatch = (puzzle, ids) => ids.length === puzzle.changed.length && puzzle.changed.every(id => ids.includes(id));
  const restored = (puzzle, placed) => puzzle.items.every(obj => obj.home === obj.moved || placed[obj.id] === obj.home);
  const homeTarget = (puzzle, id) => puzzle.items.some(obj => obj.home === id);

  function valid(saved) {
    if (!isObject(saved) || Object.keys(saved).length !== 5 || saved.version !== VERSION ||
        !Number.isInteger(saved.stage) || !puzzles[saved.stage] || !phases.includes(saved.phase) ||
        !Array.isArray(saved.marked) || !isObject(saved.placed)) return false;
    const puzzle = puzzles[saved.stage];
    if (saved.marked.length > puzzle.items.length || new Set(saved.marked).size !== saved.marked.length ||
        !Array.from(saved.marked).every(id => puzzle.items.some(obj => obj.id === id))) return false;
    const assignments = Object.entries(saved.placed);
    if (saved.phase === 'study') return !saved.marked.length && !assignments.length;
    if (saved.phase === 'find') return !assignments.length;
    return isMatch(puzzle, saved.marked) &&
      assignments.every(([id, target]) => puzzle.changed.includes(id) && homeTarget(puzzle, target)) &&
      (saved.phase !== 'solved' || restored(puzzle, saved.placed));
  }

  function done(saved) {
    return valid(saved) && saved.stage === puzzles.length - 1 && saved.phase === 'solved';
  }

  function create(saved) {
    let state = valid(saved) ? copy(saved) : blank();
    function act(action, value, target) {
      const puzzle = puzzles[state.stage];
      if (action === 'review' && ['find', 'restore'].includes(state.phase)) {
        state = blank(state.stage);
        return true;
      }
      if (action === 'next' && state.phase === 'solved' && state.stage < puzzles.length - 1) {
        state = blank(state.stage + 1);
        return true;
      }
      if (action === 'hide' && state.phase === 'study') {
        state.phase = 'find';
        return true;
      }
      if (action === 'mark' && state.phase === 'find' && puzzle.items.some(obj => obj.id === value)) {
        state.marked = state.marked.includes(value) ? state.marked.filter(id => id !== value) : state.marked.concat(value);
        return true;
      }
      if (action === 'place' && state.phase === 'restore' &&
          puzzle.changed.includes(value) && homeTarget(puzzle, target)) {
        delete state.placed[value];
        state.placed[value] = target;
        return true;
      }
      if (action === 'undo' && state.phase === 'restore') {
        const latest = Object.keys(state.placed).at(-1);
        if (!latest) return false;
        delete state.placed[latest];
        return true;
      }
      if (action === 'check' && state.phase === 'find' && isMatch(puzzle, state.marked)) {
        state.phase = 'restore';
        return true;
      }
      if (action === 'check' && state.phase === 'restore' && restored(puzzle, state.placed)) {
        state.phase = 'solved';
        return true;
      }
      return false;
    }
    return Object.freeze({act, snapshot:() => copy(state)});
  }

  function positions(puzzle, state, zones) {
    const results = {};
    for (const entry of zones) {
      const neighbors = puzzle.items.filter(obj => (state.phase === 'study' ? obj.home : state.placed[obj.id] || obj.moved) === entry.id);
      const spread = neighbors.length > 2 ? Math.min(entry.spread, 90) : entry.spread;
      neighbors.forEach((obj, index) => {
        results[obj.id] = {x:entry.x + spread * (index - (neighbors.length - 1) / 2), y:entry.y};
      });
    }
    return results;
  }

  const style = `
    .ray-memory__field{position:relative;isolation:isolate;aspect-ratio:1;overflow:hidden;background:#16433c center/cover no-repeat}
    .ray-memory__field[data-memory-phase=restore]{cursor:default}
    .ray-memory__piece,.ray-memory__place,.ray-memory__ray{position:absolute;transform:translate(-50%,-50%)}
    .ray-memory__piece{display:grid;place-items:center;width:15.4%;height:15.4%;min-width:44px;min-height:44px;box-sizing:border-box;padding:0;border:2px solid transparent;border-radius:10px;background:none;color:#173c36;touch-action:manipulation}
    .ray-memory__piece img{width:100%;height:100%;object-fit:contain;pointer-events:none;filter:drop-shadow(2px 5px 3px #28170970)}
    .ray-memory__piece:disabled{opacity:1}
    .ray-memory__piece[aria-pressed=true]{background:#ffdb845c;border-color:#ffe3a9;box-shadow:0 0 0 2px #71471680}
    .ray-memory__piece[data-moving=true]{z-index:3}
    .ray-memory__place{display:grid;place-items:center;width:max-content;max-width:28%;min-width:44px;min-height:44px;padding:0 .16rem;border:0;background:transparent;color:#173a34;text-align:center}
    .ray-memory__place>span{font:700 clamp(11px,2.7vw,14px)/1.12 system-ui,sans-serif;background:#fff1cfee;border:1px solid #b99a5a;padding:.2rem .3rem;border-radius:6px;box-shadow:0 2px 5px #392a1c5c}
    .ray-memory__place:not(:disabled){z-index:2;cursor:pointer}
    .ray-memory__place:not(:disabled)>span{background:#f8df9d;border-color:#61401a}
    .ray-memory__place:disabled{opacity:1;pointer-events:none}
    .ray-memory__piece:focus-visible,.ray-memory__place:focus-visible{outline:3px solid #fff8da;outline-offset:-2px}
    .ray-memory__ray{width:16.5%;height:auto;pointer-events:none;left:14%;top:82%}
    .ray-memory__shutter{position:absolute;inset:0;z-index:4;display:grid;place-items:center;pointer-events:none;background:repeating-linear-gradient(90deg,#16463f,#245d51 15%,#16463f 27%);color:#fff3d2;font-weight:700}
  `;

  function mount(host, {store, onComplete, onExit} = {}) {
    const saved = store?.read() || {};
    const engine = create(saved.snapshot);
    const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const warning = () => store?.warning?.() || saved.error || '';
    let active = null;
    let locked = false;
    let shutter = null;
    let timer;
    let destroyed = false;
    let flying;
    host.innerHTML = `<section class="ray-mission" data-ray-mission="memory">
      <style>${style}</style>
      <nav class="ray-mission__nav"><button type="button" data-memory-action="exit">← К карте</button></nav>
      <h1 class="ray-mission__heading">Детектив Рэя</h1>
      <p class="ray-mission__stage" data-memory-stage></p>
      <p class="ray-mission__instruction" data-memory-instruction></p>
      <div class="ray-mission__scene ray-memory__field" data-memory-field role="group" aria-label="Комната Рэя">
        <div data-memory-parts></div>
        <canvas class="ray-memory__ray" width="140" height="192" aria-hidden="true"></canvas>
      </div>
      <div class="ray-mission__tools">
        <button type="button" data-memory-action="review" hidden>Взглянуть снова</button>
        <button type="button" data-memory-action="undo" hidden>Отменить</button>
        <button type="button" data-memory-action="hide" class="ray-mission__primary">Запомнил!</button>
      </div>
      <p class="ray-mission__feedback" data-memory-feedback role="status" aria-live="polite"></p>
      <p class="ray-mission__warning" data-memory-warning role="status" hidden></p>
    </section>`;
    const view = host.firstElementChild;
    const field = view.querySelector('[data-memory-field]');
    const parts = view.querySelector('[data-memory-parts]');
    const instruction = view.querySelector('[data-memory-instruction]');
    const stageHeading = view.querySelector('[data-memory-stage]');
    const reviewButton = view.querySelector('[data-memory-action=review]');
    const undoButton = view.querySelector('[data-memory-action=undo]');
    const primary = view.querySelector('[data-memory-action=hide]');
    const feedback = view.querySelector('[data-memory-feedback]');
    const saveWarning = view.querySelector('[data-memory-warning]');
    const canvas = view.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const actor = root.AdventureActor?.create({x:70, y:182, scale:1.95});
    const at = (el, x, y) => {
      el.style.left = (x / 7.2) + '%';
      el.style.top = (y / 7.2) + '%';
    };

    function updateWarning() {
      saveWarning.textContent = warning();
      saveWarning.hidden = !saveWarning.textContent;
    }

    function announce(text, kind = '') {
      feedback.textContent = text;
      feedback.dataset.kind = kind;
    }

    function render() {
      const state = engine.snapshot();
      const previous = view.ownerDocument.activeElement?.dataset;
      const puzzle = puzzles[state.stage];
      const special = puzzle === room && root.RoomMissionArt?.memory;
      const zones = special ? puzzle.paintedZones : puzzle.zones;
      const image = special || root.RoomCampaignScene?.[puzzle.scene] || root.RoomTidyScene?.scenes[puzzle.scene] || '';
      const coords = positions(puzzle, state, zones);
      field.style.backgroundImage = image ? 'url("' + image + '")' : '';
      field.dataset.memoryPhase = state.phase;
      stageHeading.textContent = (state.stage + 1) + '/' + puzzles.length + ' · ' + puzzle.title;
      const count = puzzle.changed.length;
      const number = count === 1 ? 'один предмет' : count === 2 ? 'два предмета' : 'три предмета';
      instruction.textContent = state.phase === 'study' ? puzzle.intro :
        state.phase === 'find' ? 'Что переместилось? Отметь ' + number + '. Выбрано ' + state.marked.length + ' из ' + count + '.' :
        state.phase === 'restore' ? 'Выбери отмеченную вещь, затем нажми на её прежнее место.' :
        'Порядок восстановлен!';
      parts.replaceChildren();
      for (const entry of zones) {
        if (!homeTarget(puzzle, entry.id)) continue;
        const button = view.ownerDocument.createElement('button');
        button.type = 'button';
        button.className = 'ray-memory__place';
        button.dataset.memoryZone = entry.id;
        button.disabled = locked || state.phase !== 'restore';
        const badge = view.ownerDocument.createElement('span');
        badge.textContent = entry.label;
        button.appendChild(badge);
        at(button, entry.tx, entry.ty);
        parts.appendChild(button);
      }
      for (const obj of puzzle.items) {
        const button = view.ownerDocument.createElement('button');
        button.type = 'button';
        button.className = 'ray-memory__piece';
        button.dataset.memoryItem = obj.id;
        button.disabled = locked || (state.phase !== 'find' && (state.phase !== 'restore' || !puzzle.changed.includes(obj.id)));
        const checked = state.phase === 'restore' ? active === obj.id : state.phase === 'find' && state.marked.includes(obj.id);
        button.setAttribute('aria-pressed', String(checked));
        const spot = zones.find(entry => entry.id === (state.phase === 'study' ? obj.home : state.placed[obj.id] || obj.moved));
        button.setAttribute('aria-label', obj.label + '. ' + spot.label);
        const sprite = root.RoomTidyScene?.sprites[obj.art];
        const picture = view.ownerDocument.createElement(sprite ? 'img' : 'span');
        if (sprite) {
          picture.src = sprite;
          picture.alt = '';
          if (obj.tint) picture.style.filter = obj.tint + ' drop-shadow(2px 5px 3px #28170970)';
        } else {
          picture.textContent = obj.label;
        }
        button.appendChild(picture);
        at(button, coords[obj.id].x, coords[obj.id].y);
        parts.appendChild(button);
      }
      if (ctx && actor) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        actor.update(0, {mood:state.phase === 'solved' ? 'celebrate' : 'think', reducedMotion:true});
        actor.draw(ctx);
      }
      reviewButton.hidden = !['find', 'restore'].includes(state.phase);
      reviewButton.disabled = locked;
      undoButton.hidden = state.phase !== 'restore';
      undoButton.disabled = locked || !Object.keys(state.placed).length;
      primary.disabled = locked;
      primary.dataset.memoryAction = state.phase === 'study' ? 'hide' : state.phase !== 'solved' ? 'check' : done(state) ? 'exit' : 'next';
      primary.textContent = state.phase === 'study' ? 'Запомнил!' : state.phase !== 'solved' ? 'Проверить' : done(state) ? 'К карте' : 'Дальше';
      if (previous?.memoryItem) parts.querySelector('[data-memory-item="' + previous.memoryItem + '"]:enabled')?.focus({preventScroll:true});
      if (previous?.memoryZone) parts.querySelector('[data-memory-zone="' + previous.memoryZone + '"]:enabled')?.focus({preventScroll:true});
      updateWarning();
    }

    function persist(state) {
      store?.save(state, {sound:saved.sound === true});
      updateWarning();
    }

    function settlePiece(id, previous) {
      const current = parts.querySelector('[data-memory-item="' + id + '"]');
      const end = current?.getBoundingClientRect();
      if (!current || !previous || !end || reduced || !current.animate) return;
      const dx = previous.left - end.left;
      const dy = previous.top - end.top;
      if (!dx && !dy) return;
      flying?.cancel();
      current.dataset.moving = 'true';
      flying = current.animate([
        {transform:'translate(-50%, -50%) translate(' + dx + 'px,' + dy + 'px) scale(1.06)'},
        {transform:'translate(-50%, -50%) translate(' + dx * 0.45 + 'px,' + (dy * 0.45 - 19) + 'px) scale(1.13)', offset:0.52},
        {transform:'translate(-50%, -50%) scale(1)'}
      ], {duration:440, easing:'cubic-bezier(.22,.7,.30,1)'});
      flying.onfinish = () => { delete current.dataset.moving; };
    }

    function changeScene() {
      if (reduced || !field.animate) { render(); return; }
      locked = true;
      shutter = view.ownerDocument.createElement('div');
      shutter.className = 'ray-memory__shutter';
      shutter.setAttribute('aria-hidden', 'true');
      shutter.textContent = 'Минуточку…';
      field.appendChild(shutter);
      render();
      shutter.animate([{clipPath:'inset(0)'}, {clipPath:'inset(0)', offset:.35},
        {clipPath:'inset(0 0 100% 0)'}], {duration:720, easing:'ease-in-out'});
      timer = root.setTimeout(() => {
        if (destroyed) return;
        shutter.remove();
        shutter = null;
        locked = false;
        render();
        primary.focus({preventScroll:true});
      }, 720);
    }

    function click(event) {
      const button = event.target.closest('button');
      if (!button || !view.contains(button)) return;
      const action = button.dataset.memoryAction;
      if (action === 'exit') { onExit?.(); return; }
      if (locked) return;
      const state = engine.snapshot();
      const puzzle = puzzles[state.stage];
      const id = button.dataset.memoryItem;
      const target = button.dataset.memoryZone;
      let changed = false;
      let before;
      const moving = target && active;
      if (id && state.phase === 'restore') {
        active = active === id ? null : id;
        render();
        announce(active ? 'Выбрано «' + puzzle.items.find(obj => obj.id === active).label + '». Укажи место.' : 'Выбери вещь.');
        return;
      }
      if (id) changed = engine.act('mark', id);
      else if (moving) {
        before = parts.querySelector('[data-memory-item="' + active + '"]')?.getBoundingClientRect();
        changed = engine.act('place', active, target);
      } else if (target) {
        announce('Сначала выбери вещь, которую хочешь вернуть.');
        return;
      } else if (action) changed = engine.act(action);
      if (!changed) {
        if (action === 'check' && state.phase === 'find') {
          const marked = state.marked.length;
          announce(marked !== puzzle.changed.length ? 'Сверь количество отмеченных вещей с заданием.' :
            'Вспомни порядок на полках. Можно взглянуть снова.', 'error');
        }
        if (action === 'check' && state.phase === 'restore') {
          const unplaced = puzzle.changed.some(obj => !own(state.placed, obj));
          announce(unplaced ? 'Ещё есть вещи, которые нужно вернуть.' :
            'Одна из вещей пока в другом месте. Выбери её и переставь.', 'error');
        }
        return;
      }
      const after = engine.snapshot();
      active = null;
      persist(after);
      if (action === 'hide') changeScene();
      else render();
      if (moving) settlePiece(moving, before);
      announce(after.phase === 'solved' ? 'Ты нашёл изменения и вернул вещи на прежние места!' :
        action === 'check' && after.phase === 'restore' ? 'Все изменения найдены. Теперь верни вещи.' : '',
        after.phase === 'solved' || action === 'check' ? 'success' : '');
      if (done(after)) onComplete?.();
    }

    view.addEventListener('click', click);
    const unsubscribe = store?.subscribe?.(updateWarning);
    render();
    return Object.freeze({destroy() {
      destroyed = true;
      root.clearTimeout(timer);
      flying?.cancel();
      shutter?.remove();
      unsubscribe?.();
      view.removeEventListener('click', click);
    }});
  }

  const api = Object.freeze({mount, valid, done, puzzles, create});
  root.RoomMissionMemory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
