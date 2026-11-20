(function (root) {
  'use strict';

  const palette = {
    gold: ['Жёлтая', '#f4b536', '#9a5514'],
    coral: ['Красная', '#f37057', '#8f3228'],
    blue: ['Синяя', '#4d9ff1', '#21518d'],
    green: ['Зелёная', '#56c692', '#236451']
  };
  const block = (width, height, color) => Object.freeze({width,height,color});
  const puzzle = (id,title,story,hint,rows,pieces) => Object.freeze({
    id,title,story,hint,width:rows[0].length,height:rows.length,
    mask:Object.freeze(rows.join('').split('').map(cell => cell === '#')),
    area:rows.join('').replace(/\./g,'').length,
    pieces:Object.freeze(pieces)
  });
  const puzzles = Object.freeze([
    puzzle('bridge','Мостик для игрушек','Рэю нужен мостик. Собери верхнюю перекладину и две опоры.','Длинная деталь может лежать поперёк. Опорам удобнее стоять вдоль чертежа.',[
      '.###.','.#.#.','.#.#.','.....'
    ],[block(1,3,'gold'),block(1,2,'blue'),block(1,2,'coral')]),
    puzzle('rover','Вездеход','Собери вездеход для Рэя. Понадобятся кабина, нос, две стороны и хвост.','Сначала найди место для квадратной кабины. Потом посмотри, какие места остались по бокам.',[
      '..##..','.####.','.####.','..##..'
    ],[block(2,2,'blue'),block(2,1,'gold'),block(1,2,'green'),block(2,1,'coral'),block(1,2,'gold')]),
    puzzle('landing','Площадка для ракеты','У площадки две широкие стороны и узкий переход. Закрой всю отмеченную форму.','Узкая деталь подходит для перехода. Сравни размеры больших деталей и двух широких сторон.',[
      '##..##','##..##','######','##..##','##..##'
    ],[block(3,2,'green'),block(2,2,'gold'),block(3,2,'blue'),block(2,2,'coral'),block(1,2,'gold')])
  ]);
  const limit = 12;
  const copy = value => JSON.parse(JSON.stringify(value));

  function dimensions(piece,turn) {
    return turn ? [piece.height,piece.width] : [piece.width,piece.height];
  }

  function footprint(task,index,anchor,turn) {
    const [width,height] = dimensions(task.pieces[index],turn);
    const x = anchor % task.width, y = Math.floor(anchor / task.width);
    if (x + width > task.width || y + height > task.height) return [];
    return Array.from({length:width * height},(_,offset) =>
      anchor + Math.floor(offset / width) * task.width + offset % width);
  }

  function occupied(task,layout,except = -1) {
    const cells = new Map();
    layout.anchors.forEach((anchor,index) => {
      if (anchor !== null && index !== except) {
        for (const cell of footprint(task,index,anchor,layout.turns[index])) cells.set(cell,index);
      }
    });
    return cells;
  }

  function fits(task,layout,index,anchor,turn) {
    const cells = footprint(task,index,anchor,turn);
    if (!cells.length || cells.some(cell => !task.mask[cell])) {
      return 'Деталь выходит за чертёж. Попробуй повернуть её или выбери другую клетку.';
    }
    const other = occupied(task,layout,index);
    return cells.some(cell => other.has(cell)) ? 'Здесь уже есть другая деталь. Найди свободное место.' : '';
  }

  function layoutValid(task,layout) {
    if (!layout || !Array.isArray(layout.anchors) || !Array.isArray(layout.turns)) return false;
    const count = task.pieces.length;
    if (layout.anchors.length !== count || layout.turns.length !== count) return false;
    for (let index = 0; index < count; index++) {
      const anchor = layout.anchors[index], turn = layout.turns[index];
      if (turn !== 0 && turn !== 1) return false;
      if (anchor !== null && (!Number.isInteger(anchor) || anchor < 0 || anchor >= task.mask.length)) return false;
    }
    return layout.anchors.every((anchor,index) => anchor === null || !fits(task,layout,index,anchor,layout.turns[index]));
  }

  const filled = (task,layout) => occupied(task,layout).size === task.area && layout.anchors.every(anchor => anchor !== null);

  function valid(save) {
    if (!save || save.version !== 1 || !Array.isArray(save.proofs) || save.proofs.length >= puzzles.length ||
      !Array.isArray(save.history) || save.history.length > limit || typeof save.accepted !== 'boolean') return false;
    const task = puzzles[save.proofs.length];
    return layoutValid(task,save.layout) && (!save.accepted || filled(task,save.layout)) &&
      Array.from(save.proofs).every((layout,index) => layoutValid(puzzles[index],layout) && filled(puzzles[index],layout)) &&
      Array.from(save.history).every(layout => layoutValid(task,layout));
  }

  function done(save) {
    return valid(save) && save.accepted && save.proofs.length === puzzles.length - 1;
  }

  function fresh(proofs = []) {
    const count = puzzles[proofs.length].pieces.length;
    return {version:1,proofs,layout:{anchors:Array(count).fill(null),turns:Array(count).fill(0)},accepted:false,history:[]};
  }

  function create(snapshot) {
    let record = valid(snapshot) ? copy(snapshot) : fresh();
    const task = () => puzzles[record.proofs.length];

    function change(update) {
      const next = copy(record.layout);
      update(next);
      record.history.push(record.layout);
      if (record.history.length > limit) record.history.shift();
      record.layout = next;
      return {ok:true};
    }

    function act(action,index,anchor) {
      if (action === 'replay' && done(record)) {
        record = fresh();
        return {ok:true};
      }
      if (action === 'next' && record.accepted && !done(record)) {
        record = fresh([...record.proofs,record.layout]);
        return {ok:true};
      }
      if (record.accepted) return {ok:false};
      if (action === 'undo' && record.history.length) {
        record.layout = record.history.pop();
        return {ok:true};
      }
      if (action === 'check') {
        if (!filled(task(),record.layout)) {
          return {ok:false,text:'На чертеже остались пустые кружки. Закрой их деталями.'};
        }
        record.accepted = true;
        return {ok:true};
      }
      const {turns,anchors} = record.layout;
      const piece = task().pieces[index];
      if (!Number.isInteger(index) || !piece) return {ok:false,text:'Сначала выбери деталь на столе.'};
      if (action === 'remove' && anchors[index] !== null) {
        return change(next => { next.anchors[index] = null; });
      }
      if (action === 'rotate') {
        const turn = 1 - turns[index];
        if (anchors[index] !== null) {
          if (fits(task(),record.layout,index,anchors[index],turn)) {
            return {ok:false,text:'Здесь тесно для поворота. Сними деталь, поверни и примерь снова.'};
          }
        }
        return change(next => { next.turns[index] = turn; });
      }
      if (action === 'place' && Number.isInteger(anchor) && anchor >= 0 && anchor < task().mask.length) {
        if (anchor === anchors[index]) return {ok:false,text:'Деталь уже стоит здесь. Выбери другую клетку.'};
        const text = fits(task(),record.layout,index,anchor,turns[index]);
        if (text) return {ok:false,text};
        return change(next => { next.anchors[index] = anchor; });
      }
      return {ok:false};
    }
    return Object.freeze({task,act,snapshot:() => copy(record)});
  }

  function studs(width,height) {
    return Array.from({length:width * height},() => '<i aria-hidden="true"></i>').join('');
  }

  function pieceLabel(piece,turn) {
    const [width,height] = dimensions(piece,turn);
    return palette[piece.color][0] + ' деталь ' + width + ' на ' + height;
  }

  const styles = `
    .ray-build-scene{position:relative;background:linear-gradient(145deg,#dca66c,#a35c37);background-size:cover;background-position:center;overflow:hidden}
    .ray-build-meter{position:absolute;top:8px;left:9px;z-index:1;margin:0;padding:4px 9px;border-radius:6px;background:#fdf2d8;color:#483422;font-size:.82rem}
    .ray-build-actor{position:absolute;right:3px;top:1px;width:55px;height:54px;pointer-events:none}
    .ray-build-board{width:min(100%,30rem);margin:41px auto 8px;position:relative;display:grid;grid-template-columns:repeat(var(--build-cols),minmax(0,1fr));isolation:isolate;overflow:hidden;background:linear-gradient(155deg,#1c5473,#153746);border:2px solid #b5cdd1;border-radius:12px;box-shadow:0 8px 6px #3b211b8c}
    .ray-build-board button{position:relative;aspect-ratio:1;min-width:0;min-height:0;width:100%;padding:0;border:1px solid #4d8496;border-radius:0;background:transparent;box-shadow:none;touch-action:manipulation}
    .ray-build-board button[data-blueprint]{background:#407b92}
    .ray-build-board button[data-blueprint]::after{content:"";position:absolute;inset:25%;border:2px dashed #e4f6e6;border-radius:50%}
    .ray-build-board button:focus-visible{z-index:3;outline:3px solid #fff4b3;outline-offset:-5px}
    .ray-build-block{box-sizing:border-box;display:grid;place-items:center;grid-template-columns:repeat(var(--piece-width),minmax(0,1fr));border:1px solid var(--piece-edge);border-radius:6px;background:linear-gradient(148deg,#fff4b761,transparent 45%),var(--piece-color);box-shadow:inset 0 2px 0 #fff8,inset 0 -4px 0 #391d1b55,0 3px 3px #02192380}
    .ray-build-block i{display:block;width:59%;aspect-ratio:1;border-radius:50%;border:1px solid #36211445;background:radial-gradient(circle at 30% 24%,#fffc9dae,#fff5 26%,transparent 58%),var(--piece-color);box-shadow:0 2px 0 var(--piece-edge),0 3px 3px #2d211c66}
    .ray-build-board .ray-build-block{position:absolute;inset:auto;pointer-events:none;z-index:2}
    .ray-build-board .ray-build-block[data-held]{outline:2px solid #ffeead;outline-offset:-2px}
    .ray-build-board .ray-build-block[data-snap]{animation:rayBuildSnap .34s cubic-bezier(.15,.9,.3,1) both}
    .ray-build-board[data-accepted]{animation:rayBuildFinish .9s ease-in-out both}
    .ray-build-tray{width:min(100%,30rem);margin:12px auto 0;display:grid;grid-template-columns:repeat(var(--build-count), minmax(0,1fr));gap:5px}
    .ray-build-tray button{display:grid;place-items:center;gap:2px;min-height:67px;min-width:0;padding:4px 2px;border:1px solid #b5764f;border-radius:8px;background:#fff6db;color:#59391d;font-weight:700;font-size:.78rem;line-height:1}
    .ray-build-tray button[aria-pressed=true]{outline:3px solid #f4c64f;outline-offset:-3px;background:#ffedb3}
    .ray-build-tray button[data-placed=true] .ray-build-block{opacity:.48}
    .ray-build-tray .ray-build-block{height:var(--piece-height);width:var(--tray-width);max-width:100%}
    .ray-build-tray .ray-build-block[data-snap]{animation:rayBuildSnap .34s cubic-bezier(.15,.9,.3,1) both}
    .ray-build-secondary{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}
    .ray-build-secondary [data-build-command=rotate]:not(:disabled){background:#ffe9ab;border-color:#b9812c;color:#553614}
    .ray-build-warning{padding:3px;color:#803719}
    @keyframes rayBuildSnap{0%{transform:translateY(-10px) scale(1.08);filter:brightness(1.22)}68%{transform:scale(.96)}100%{transform:none;filter:none}}
    @keyframes rayBuildFinish{0%,100%{filter:none}45%{filter:brightness(1.3);box-shadow:0 0 28px #ffdf7d}}
    @media(prefers-reduced-motion:reduce){.ray-build-board[data-accepted],.ray-build .ray-build-block[data-snap]{animation:none}}
  `;

  function mount(host,{store,onComplete,onExit} = {}) {
    const saved = store?.read() || {};
    const model = create(saved.snapshot);
    const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    let selected = null, snapped = null, cursor = 0, latest = '', frame = 0;
    host.innerHTML = `<section class="ray-mission ray-build">
      <style>${styles}</style>
      <header><div class="ray-mission__nav"><button type="button" data-build-command="exit">← К карте</button></div>
        <h1 class="ray-mission__heading">Модель по чертежу</h1>
        <p class="ray-mission__stage" data-build-caption></p>
        <p class="ray-mission__instruction" data-build-lead></p>
        <p class="ray-mission__instruction">Выбери деталь. Если нужно, поверни её. Нажми на клетку, где будет её левый верхний угол.</p>
      </header>
      <div class="ray-mission__scene ray-build-scene" data-build-scene>
        <p class="ray-build-meter" data-build-meter></p>
        <canvas class="ray-build-actor" width="110" height="108" aria-hidden="true"></canvas>
        <div class="ray-build-board" data-build-board role="group" aria-label="Чертёж"></div>
        <div class="ray-build-tray" data-build-tray role="group" aria-label="Детали на столе"></div>
      </div>
      <div class="ray-mission__tools ray-build-secondary">
        <button type="button" data-build-command="rotate">↻ Повернуть</button>
        <button type="button" data-build-command="remove" hidden>Снять деталь</button>
      </div>
      <div class="ray-mission__tools">
        <button type="button" data-build-command="undo">Отменить</button>
        <button type="button" data-build-command="hint">Подсказка</button>
        <button type="button" data-build-command="check" data-primary>Проверить</button>
        <button type="button" data-build-command="replay" hidden>Играть заново</button>
      </div>
      <p class="ray-mission__feedback" data-build-feedback role="status" aria-live="polite"></p>
      <p class="ray-build-warning" data-build-warning role="status" hidden></p>
    </section>`;
    const view = host.firstElementChild;
    const el = name => view.querySelector('[data-build-' + name + ']');
    const command = name => view.querySelector('[data-build-command="' + name + '"]');
    const primary = command('check');
    const scene = el('scene'), board = el('board'), tray = el('tray');
    const painting = root.RoomMissionArt?.build || root.RoomCampaignScene?.workshop;
    if (painting) scene.style.backgroundImage = 'linear-gradient(#412d2788,#29190e66),url("' + painting + '")';
    const canvas = view.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const actor = root.AdventureActor?.create({x:55,y:104,scale:1.3});
    if (!ctx || !actor) canvas.hidden = true;

    function animate(mood = 'idle') {
      if (!ctx || !actor) return;
      root.cancelAnimationFrame(frame);
      let last, start;
      function draw(now) {
        if (start === undefined) start = last = now;
        ctx.clearRect(0,0,110,108);
        actor.update((now - last) / 1000,{mood,reducedMotion:reduced});
        actor.draw(ctx);
        last = now;
        if (!reduced && mood !== 'idle' && now - start < 1450) frame = root.requestAnimationFrame(draw);
      }
      frame = root.requestAnimationFrame(draw);
    }

    function refreshWarning() {
      const warning = store?.warning?.() || saved.error || '';
      el('warning').textContent = warning;
      el('warning').hidden = !warning;
    }

    function render(animateBoard = false) {
      const task = model.task(), save = model.snapshot();
      const {layout,accepted} = save;
      const cells = occupied(task,layout);
      const currentFocus = view.ownerDocument.activeElement;
      const focusPiece = currentFocus?.dataset?.buildPiece;
      const focusCell = currentFocus?.dataset?.buildCell;
      const finish = done(save);
      view.dataset.buildStage = task.id;
      view.dataset.buildComplete = String(finish);
      el('caption').textContent = (save.proofs.length + 1) + ' из ' + puzzles.length + ' · ' + task.title;
      el('lead').textContent = task.story;
      el('meter').textContent = 'Закрыто ' + cells.size + ' из ' + task.area;
      board.style.setProperty('--build-cols',task.width);
      board.toggleAttribute('data-accepted',animateBoard);
      board.innerHTML = task.mask.map((on,index) => {
        const row = Math.floor(index / task.width) + 1, col = index % task.width + 1;
        const item = cells.get(index);
        const label = 'Ряд ' + row + ', клетка ' + col + '. ' +
          (item !== undefined ? pieceLabel(task.pieces[item],layout.turns[item]) : on ? 'Место на чертеже' : 'За пределами чертежа');
        return `<button type="button" data-build-cell="${index}" ${on?'data-blueprint':''} tabindex="${index===cursor?0:-1}" aria-label="${label}" ${accepted?'disabled':''}></button>`;
      }).join('') + layout.anchors.map((anchor,index) => {
        if (anchor === null) return '';
        const piece = task.pieces[index];
        const [width,height] = dimensions(piece,layout.turns[index]);
        const [,color,edge] = palette[piece.color];
        const size = `left:${100 * (anchor % task.width) / task.width}%;top:${100 * Math.floor(anchor / task.width) / task.height}%;width:${100 * width / task.width}%;height:${100 * height / task.height}%`;
        return `<span class="ray-build-block" aria-hidden="true" ${selected===index?'data-held':''} ${snapped===index?'data-snap':''} style="${size};--piece-width:${width};--piece-color:${color};--piece-edge:${edge}">${studs(width,height)}</span>`;
      }).join('');
      tray.style.setProperty('--build-count',task.pieces.length);
      tray.innerHTML = task.pieces.map((piece,index) => {
        const [width,height] = dimensions(piece,layout.turns[index]);
        const [,color,edge] = palette[piece.color];
        const label = pieceLabel(piece,layout.turns[index]) + (layout.anchors[index] === null ? ' на столе' : ' на чертеже');
        return `<button type="button" data-build-piece="${index}" aria-label="${label}" aria-pressed="${selected===index}" data-placed="${layout.anchors[index]!==null}" ${accepted?'disabled':''}>
          <span class="ray-build-block" aria-hidden="true" ${selected===index&&snapped===index?'data-snap':''} style="--piece-width:${width};--piece-color:${color};--piece-edge:${edge};--tray-width:${15 * width}px;--piece-height:${14 * height}px">${studs(width,height)}</span>
          <span aria-hidden="true">${layout.anchors[index]===null?'':'✓ '}${width}×${height}</span>
        </button>`;
      }).join('');
      command('rotate').disabled = accepted || selected === null;
      command('remove').hidden = accepted || selected === null || layout.anchors[selected] === null;
      command('undo').disabled = accepted || save.history.length === 0;
      command('hint').disabled = accepted;
      command('replay').hidden = !finish;
      primary.dataset.buildCommand = finish ? 'exit' : accepted ? 'next' : 'check';
      primary.textContent = finish ? 'К карте' : accepted ? 'Дальше' : 'Проверить';
      el('feedback').textContent = latest || (accepted ? (finish ? 'Все модели готовы. Рэй машет тебе!' : 'Чертёж точно закрыт. Модель готова!') : '');
      refreshWarning();
      if (!accepted && focusPiece !== undefined) tray.querySelector('[data-build-piece="' + focusPiece + '"]')?.focus({preventScroll:true});
      if (!accepted && focusCell !== undefined) board.querySelector('[data-build-cell="' + focusCell + '"]')?.focus({preventScroll:true});
    }

    function perform(action,index,anchor) {
      const wasDone = done(model.snapshot());
      const result = model.act(action,index,anchor);
      latest = result.text || '';
      snapped = result.ok && (action === 'place' || action === 'rotate') ? index : null;
      if (result.ok) {
        if (['place','remove','next','check','replay','undo'].includes(action)) selected = null;
        if (action === 'next' || action === 'replay') cursor = model.task().mask.indexOf(true);
        const snapshot = model.snapshot();
        if (action === 'rotate') latest = 'Деталь повёрнута. ' + pieceLabel(model.task().pieces[index],snapshot.layout.turns[index]) + '.';
        store?.save(snapshot,{sound:saved.sound === true});
      }
      const finished = result.ok && action === 'check';
      render(finished);
      animate(finished ? 'celebrate' : result.ok ? 'happy' : 'think');
      if (finished && !wasDone && done(model.snapshot())) onComplete?.();
    }

    function onClick(event) {
      const button = event.target.closest('button');
      if (!button || button.disabled) return;
      const {buildCommand,buildPiece,buildCell} = button.dataset;
      if (buildCommand === 'exit') { onExit?.(); return; }
      if (buildCommand === 'hint') {
        el('feedback').textContent = latest = model.task().hint;
        animate('think');
        return;
      }
      if (buildCommand) { perform(buildCommand,selected); return; }
      if (buildPiece !== undefined) {
        selected = Number(buildPiece);
        latest = pieceLabel(model.task().pieces[selected],model.snapshot().layout.turns[selected]) + '. Выбери клетку на чертеже.';
        snapped = null; render(); return;
      }
      if (buildCell === undefined) return;
      cursor = Number(buildCell);
      const state = model.snapshot(), placed = occupied(model.task(),state.layout).get(cursor);
      if (selected === null && placed !== undefined) {
        selected = placed; latest = 'Деталь выбрана. Можно снять, повернуть или перенести.';
        snapped = null; render(); return;
      }
      if (selected === null) {
        latest = 'Выбери деталь на столе.';
        snapped = null; render(); return;
      }
      perform('place',selected,cursor);
    }

    function onKey(event) {
      const cell = event.target.dataset.buildCell;
      const task = model.task();
      const delta = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-task.width,ArrowDown:task.width}[event.key];
      if (cell === undefined || delta === undefined) return;
      const from = Number(cell), to = from + delta;
      if (to < 0 || to >= task.mask.length || (Math.abs(delta) === 1 &&
        Math.floor(to / task.width) !== Math.floor(from / task.width))) return;
      event.preventDefault();
      cursor = to;
      event.target.tabIndex = -1;
      const next = board.querySelector('[data-build-cell="' + to + '"]');
      next.tabIndex = 0; next.focus({preventScroll:true});
    }

    cursor = model.task().mask.indexOf(true);
    const unsubscribe = store?.subscribe?.(refreshWarning);
    view.addEventListener('click',onClick);
    view.addEventListener('keydown',onKey);
    render();
    animate();
    return Object.freeze({destroy() {
      unsubscribe?.(); root.cancelAnimationFrame(frame);
      view.removeEventListener('click',onClick);
      view.removeEventListener('keydown',onKey);
    }});
  }

  const api = Object.freeze({mount,valid,done,create,puzzles});
  root.RoomMissionBuild = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
