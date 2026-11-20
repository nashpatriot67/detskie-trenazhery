(function (root) {
  'use strict';

  const width = 5;
  const cells = Array.from({length: width * width}, (_, index) => index);
  const objects = {
    teddy: 'мишка', storybook: 'книга', 'dirty-shirt': 'футболка', brick6: 'деталь конструктора'
  };
  const puzzles = [
    {
      title: 'По свободному проходу',
      instruction: 'Проложи путь для красной машинки. Касайся соседних клеток и объезжай игрушки.',
      start: 20, garage: 4, car: 'race-red', flags: [],
      obstacles: {8: 'teddy', 11: 'storybook', 12: 'brick6', 17: 'dirty-shirt'}
    },
    {
      title: 'За ключом от гаража',
      instruction: 'Заедь за ключом и только потом отправь синюю машинку к гаражу.',
      start: 24, garage: 0, car: 'offroad-blue',
      flags: [{cell: 17, label: 'Ключ', mark: 'key'}],
      obstacles: {6: 'teddy', 7: 'dirty-shirt', 8: 'brick6', 13: 'storybook', 21: 'brick6'}
    },
    {
      title: 'Два флажка по порядку',
      instruction: 'Проведи жёлтую машинку через флажок 1, потом через флажок 2. Закончи путь у гаража.',
      start: 20, garage: 4, car: 'utility-yellow',
      flags: [{cell: 6, label: 'Флажок 1', mark: '1'}, {cell: 18, label: 'Флажок 2', mark: '2'}],
      obstacles: {1: 'brick6', 8: 'teddy', 13: 'dirty-shirt', 16: 'storybook', 22: 'brick6'}
    }
  ];
  for (const scene of puzzles) {
    for (const flag of scene.flags) Object.freeze(flag);
    Object.freeze(scene.flags);
    Object.freeze(scene.obstacles);
    Object.freeze(scene);
  }
  Object.freeze(puzzles);

  const validCell = index => Number.isInteger(index) && index >= 0 && index < cells.length;
  const x = index => index % width;
  const y = index => Math.floor(index / width);
  const adjacent = (a, b) => Math.abs(x(a) - x(b)) + Math.abs(y(a) - y(b)) === 1;
  const missingFlag = (scene, path) => scene.flags.find(flag => !path.includes(flag.cell));

  function reason(scene, path, index) {
    if (!validCell(index)) return 'Выбери клетку на коврике.';
    if (scene.obstacles[index]) return 'Здесь ' + objects[scene.obstacles[index]] + '. Объедь вещь по свободной клетке.';
    if (!adjacent(path[path.length - 1], index)) return 'Выбери соседнюю клетку. Машинка едет прямо до следующей клетки.';
    if (path[path.length - 1] === scene.garage) return 'Путь уже у гаража. Нажми «Поехали».';
    const flag = missingFlag(scene, path);
    if (flag && (index === scene.garage || (scene.flags.some(item => item.cell === index) && flag.cell !== index))) {
      return 'Сначала добавь к маршруту клетку «' + flag.label + '».';
    }
    return '';
  }

  function validPath(scene, path) {
    if (!Array.isArray(path) || path.length === 0 || path.length > cells.length || path[0] !== scene.start) return false;
    for (let index = 1; index < path.length; index++) {
      const prefix = path.slice(0, index);
      if (prefix.includes(path[index]) || reason(scene, prefix, path[index])) return false;
    }
    return true;
  }

  function valid(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
        Object.keys(snapshot).length !== 5 || snapshot.version !== 1 || !Number.isInteger(snapshot.stage) ||
        snapshot.stage < 0 || snapshot.stage >= puzzles.length || typeof snapshot.arrived !== 'boolean' ||
        !Array.isArray(snapshot.finished) || snapshot.finished.length !== snapshot.stage) return false;
    const scene = puzzles[snapshot.stage];
    if (!validPath(scene, snapshot.path) || (snapshot.arrived && snapshot.path[snapshot.path.length - 1] !== scene.garage)) return false;
    for (let index = 0; index < snapshot.stage; index++) {
      const path = snapshot.finished[index];
      if (!validPath(puzzles[index], path) || path[path.length - 1] !== puzzles[index].garage) return false;
    }
    return true;
  }

  const done = snapshot => valid(snapshot) && snapshot.stage === puzzles.length - 1 && snapshot.arrived;

  function clone(snapshot) {
    return {...snapshot, path: snapshot.path.slice(), finished: snapshot.finished.map(path => path.slice())};
  }

  function create(saved) {
    let state = valid(saved) ? clone(saved) : {version: 1, stage: 0, path: [puzzles[0].start], arrived: false, finished: []};
    const scene = () => puzzles[state.stage];
    function driveError() {
      const flag = missingFlag(scene(), state.path);
      if (flag) return 'Добавь к маршруту клетку «' + flag.label + '».';
      return state.path[state.path.length - 1] === scene().garage ? '' : 'Продли дорожку до гаража, затем нажми «Поехали».';
    }
    return {
      snapshot: () => clone(state),
      choose(index) {
        if (state.arrived) return {changed: false};
        const previous = state.path.indexOf(index);
        if (previous >= 0) {
          if (previous === state.path.length - 1) return {changed: false};
          state.path = state.path.slice(0, previous + 1);
        } else {
          const message = reason(scene(), state.path, index);
          if (message) return {changed: false, message};
          state.path.push(index);
        }
        return {changed: true};
      },
      undo() {
        if (state.arrived || state.path.length <= 1) return false;
        state.path.pop();
        return true;
      },
      clear() {
        if (state.arrived || state.path.length <= 1) return false;
        state.path = [scene().start];
        return true;
      },
      driveError,
      arrive() {
        if (state.arrived || driveError()) return false;
        state.arrived = true;
        return true;
      },
      next() {
        if (!state.arrived || state.stage === puzzles.length - 1) return false;
        state = {...state, stage: state.stage + 1, path: [puzzles[state.stage + 1].start], arrived: false, finished: state.finished.concat([state.path])};
        return true;
      }
    };
  }

  const styles = `
    .route-scene{max-width:490px;margin:0 auto;padding:clamp(6px,2.7vw,16px);background-color:#705038}
    .route-board{position:relative;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));aspect-ratio:1;background:#ddd0a54d;border:2px solid #f9e5b4;border-radius:12px;box-shadow:0 7px 22px #3a1f1db5;overflow:hidden}
    .route-board .route-cell{position:relative;min-width:0;min-height:0;display:grid;place-items:center;isolation:isolate;border:1px solid #144c4e64;border-radius:0;padding:0;background:#83ae83bd;color:#153f3d;box-shadow:inset 0 1px 1px #d3e6ba88;touch-action:manipulation;cursor:pointer}
    .route-board .route-cell:nth-child(2n){background:#b1cb93c7}
    .route-board .route-cell[data-obstacle]{background:repeating-linear-gradient(135deg,#e0a56bcf 0 9px,#c28151e8 9px 17px)}
    .route-board .route-cell[data-start],.route-board .route-cell[data-goal]{background:#f3d59aeb}
    .route-board .route-cell:focus-visible{outline:3px solid #123c46;outline-offset:-4px;z-index:4}
    .route-obstacle{position:absolute;z-index:2;width:91%;height:83%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 3px 2px #47341b97)}
    .route-marker{position:relative;z-index:2;font-size:clamp(.65rem,3vw,.88rem);font-weight:750;line-height:1.05;background:#fff2c2;color:#213c30;padding:3px 5px;border-radius:5px;pointer-events:none;align-self:end;margin-bottom:4%;box-shadow:0 1px 3px #30352b60}
    .route-board [data-flag] .route-marker{align-self:center;background:#f7ce6c;padding:6px}
    .route-board [data-flag] .route-marker:not([data-key]){align-self:start;min-width:2ch;margin-top:18%;border-radius:3px 8px 8px 1px;border-left:3px solid #7e513e;color:#332a26}
    .route-board [data-flag][aria-pressed=true] .route-marker{background:#b4edb2}
    .route-garage{position:absolute;z-index:2;top:9%;width:69%;height:59%;background:repeating-linear-gradient(0deg,#291f26 0 3px,#342a32 3px 6px);border:5px solid #9f6038;border-radius:9px 9px 2px 2px;box-shadow:inset 0 4px 4px #160c15,0 2px 4px #4829349e}
    .route-segment{z-index:1;position:absolute;background:#167e79;box-shadow:inset 0 0 0 1px #f3fff12e;pointer-events:none}
    .route-segment[data-part=dot]{inset:26%;border-radius:50%}
    .route-segment[data-part=n]{top:-2%;left:32%;width:36%;height:53%}
    .route-segment[data-part=s]{bottom:-2%;left:32%;width:36%;height:53%}
    .route-segment[data-part=e]{right:-2%;top:32%;width:53%;height:36%}
    .route-segment[data-part=w]{left:-2%;top:32%;width:53%;height:36%}
    .route-car{position:absolute;z-index:3;width:18%;height:15%;object-fit:contain;top:0;left:0;transform:translate(-50%,-54%);pointer-events:none;filter:drop-shadow(0 4px 3px #192223a0)}
    .route-fallback{font-size:clamp(1.2rem,7vw,2.5rem)}
  `;

  const pos = index => ({left: (x(index) + 0.5) * 100 / width + '%', top: (y(index) + 0.5) * 100 / width + '%'});
  function renderCell(scene, sprites, index) {
    const obstacle = scene.obstacles[index];
    const flag = scene.flags.find(item => item.cell === index);
    const start = scene.start === index;
    const garage = scene.garage === index;
    const label = objects[obstacle] || flag?.label || (start ? 'Старт' : garage ? 'Гараж' : '');
    const kind = obstacle ? 'obstacle' : flag ? 'flag' : start ? 'start' : garage ? 'goal' : '';
    const photo = sprites?.[obstacle];
    const marker = photo ? `<img draggable="false" class="route-obstacle" src="${photo}" alt="">` :
      label ? `<span class="route-marker" aria-hidden="true"${flag?.mark === 'key' ? ' data-key' : ''}>${flag && flag.mark !== 'key' ? flag.mark : label}</span>` : '';
    const cover = garage ? '<span class="route-garage" aria-hidden="true"></span>' : '';
    return `<button type="button" class="route-cell" ${kind ? 'data-' + kind : ''} data-route-cell="${index}"
      aria-label="Строка ${y(index) + 1}, столбец ${x(index) + 1}${label ? ', ' + label : ''}"><span class="route-ink" aria-hidden="true"></span>${cover}${marker}</button>`;
  }

  function mount(host, {store, onComplete, onExit} = {}) {
    const saved = store?.read?.() || {};
    const model = create(saved.snapshot);
    const assets = root.RoomTidyScene || {};
    let motion = null;
    let travelling = false;
    let alive = true;
    let board;
    let car;
    let tileButtons;
    let feedback;
    let tools;
    let frame;
    const matched = root.matchMedia?.('(prefers-reduced-motion: reduce)');

    function persist() {
      store?.save?.(model.snapshot(), {sound: saved.sound === true});
      const warning = frame.querySelector('[data-route-warning]');
      warning.textContent = store?.warning?.() || saved.error || '';
      warning.hidden = !warning.textContent;
    }

    function paint(message = '') {
      const current = model.snapshot();
      const scene = puzzles[current.stage];
      for (const [index, button] of tileButtons.entries()) {
        const offset = current.path.indexOf(index);
        const adjacentBits = [current.path[offset - 1], current.path[offset + 1]];
        const parts = offset < 0 ? [] : ['dot', ...adjacentBits.filter(validCell).map(other => {
          if (y(other) < y(index)) return 'n';
          if (y(other) > y(index)) return 's';
          return x(other) < x(index) ? 'w' : 'e';
        })];
        button.querySelector('.route-ink').innerHTML = parts.map(part => '<i class="route-segment" data-part="' + part + '"></i>').join('');
        button.setAttribute('aria-pressed', String(offset >= 0));
        button.setAttribute('aria-disabled', String(travelling || current.arrived));
      }
      if (!travelling) Object.assign(car.style, pos(current.arrived ? scene.garage : scene.start));
      feedback.textContent = message || (current.arrived ? 'Машинка в гараже. Маршрут пройден!' : 'Шагов на дорожке: ' + (current.path.length - 1));
      tools.querySelector('[data-route-undo]').disabled = travelling || current.arrived || current.path.length <= 1;
      tools.querySelector('[data-route-clear]').disabled = travelling || current.arrived || current.path.length <= 1;
      tools.querySelector('[data-route-drive]').disabled = travelling;
      tools.querySelector('[data-route-drive]').hidden = current.arrived;
      tools.querySelector('[data-route-next]').hidden = !current.arrived;
      tools.querySelector('[data-route-next]').textContent = done(current) ? 'На карту' : 'Следующий маршрут';
    }

    function display() {
      const current = model.snapshot();
      const scene = puzzles[current.stage];
      host.innerHTML = `<style>${styles}</style>
        <section class="ray-mission route-mission">
          <nav class="ray-mission__nav"><button type="button" data-route-exit>‹ Карта Рэя</button></nav>
          <h1 class="ray-mission__heading">Дорога в гараж</h1>
          <p class="ray-mission__stage">Маршрут ${current.stage + 1} из ${puzzles.length} · ${scene.title}</p>
          <p class="ray-mission__instruction">${scene.instruction}</p>
          <div class="ray-mission__scene route-scene">
            <div class="route-board" role="group" aria-label="Поле маршрута, пять строк и пять столбцов">
              ${cells.map(index => renderCell(scene, assets.sprites, index)).join('')}
              ${assets.sprites?.[scene.car] ? '<img class="route-car" alt="" draggable="false" src="' + assets.sprites[scene.car] + '">' : '<span class="route-car route-fallback" aria-hidden="true">🏎️</span>'}
            </div>
          </div>
          <div class="ray-mission__tools">
            <button type="button" data-route-undo>Шаг назад</button>
            <button type="button" data-route-clear>Стереть путь</button>
            <button class="ray-mission__primary" type="button" data-route-drive>Поехали</button>
            <button class="ray-mission__primary" type="button" data-route-next hidden>Следующий маршрут</button>
          </div>
          <p class="ray-mission__feedback" aria-live="polite" role="status"></p>
          <p class="ray-mission__warning" data-route-warning role="status" hidden></p>
        </section>`;
      frame = host.querySelector('.route-mission');
      board = frame.querySelector('.route-board');
      const background = root.RoomMissionArt?.route || assets.scenes?.garage;
      if (background) {
        frame.querySelector('.route-scene').style.backgroundImage = 'url("' + background + '")';
      }
      car = board.querySelector('.route-car');
      tileButtons = [...board.querySelectorAll('[data-route-cell]')];
      feedback = frame.querySelector('.ray-mission__feedback');
      tools = frame.querySelector('.ray-mission__tools');
      if (saved.error) {
        const warning = frame.querySelector('[data-route-warning]');
        warning.textContent = saved.error;
        warning.hidden = false;
      }
      paint();
    }

    function arrived() {
      if (!alive) return;
      travelling = false;
      if (!model.arrive()) return;
      persist();
      paint();
      tools.querySelector('[data-route-next]').focus();
      if (done(model.snapshot())) onComplete?.();
    }

    function drive() {
      const message = model.driveError();
      if (message) {
        paint(message);
        return;
      }
      const path = model.snapshot().path;
      if (matched?.matches || typeof car.animate !== 'function') {
        arrived();
        return;
      }
      travelling = true;
      paint('Машинка едет по твоему маршруту.');
      motion = car.animate(path.map(pos), {duration: 200 * (path.length - 1), easing: 'linear'});
      motion.onfinish = () => {
        motion = null;
        arrived();
      };
    }

    function click(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-route-exit')) {
        onExit?.();
        return;
      }
      if (travelling) return;
      if (button.hasAttribute('data-route-drive')) {
        drive();
      } else if (button.hasAttribute('data-route-next')) {
        if (model.next()) {
          display();
          persist();
          tileButtons[model.snapshot().path[0]].focus();
        } else if (done(model.snapshot())) {
          onExit?.();
        }
      } else if (button.hasAttribute('data-route-cell')) {
        const result = model.choose(Number(button.dataset.routeCell));
        if (result.changed) persist();
        paint(result.message);
      } else if ((button.hasAttribute('data-route-undo') && model.undo()) || (button.hasAttribute('data-route-clear') && model.clear())) {
        persist();
        paint();
      }
    }

    function keydown(event) {
      const cell = event.target.closest('[data-route-cell]');
      const offset = {ArrowUp: -width, ArrowDown: width, ArrowLeft: -1, ArrowRight: 1}[event.key];
      if (!cell || !offset) return;
      event.preventDefault();
      const first = Number(cell.dataset.routeCell);
      const next = first + offset;
      if (validCell(next) && adjacent(first, next)) tileButtons[next].focus();
    }

    display();
    host.addEventListener('click', click);
    host.addEventListener('keydown', keydown);
    return {destroy() {
      alive = false;
      motion?.cancel();
      host.removeEventListener('click', click);
      host.removeEventListener('keydown', keydown);
      host.replaceChildren();
    }};
  }

  const api = Object.freeze({mount, valid, done, puzzles, create});
  root.RoomMissionRoute = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
