(function (global) {
  'use strict';

  const W = 720;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const point = (x, y, w, h, size) => ({x, y, w, h, size});
  const grid = (index, columns, y, step, offset = 0) => point((index % columns + .5) * W / columns + offset, y + Math.floor(index / columns) * step, W / columns - 9, step - 8, 71);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const SCENES = {garage:'garage', workshop:'lego', school:'search'};
  const SHORT_TARGETS = {
    'narrow-small':'Узкие · до 4', 'wide-small':'Широкие · до 4', 'wide-six':'Широкие · 6',
    'wide-eight':'Широкие · 8', 'wide-ten':'Широкие · 10', 'sport-bag':'Физкультура',
    'pool-bag':'Бассейн', 'stand-car':'Дорожка', 'stand-rocket':'Высокий отсек', 'stand-house':'Низкий отсек'
  };
  const shortTarget = target => SHORT_TARGETS[target.id] || target.label;
  const SCHOOL_LABELS = {'math-book':'Учебник матем.', 'spare-underwear':'Сменное бельё', 'gym-socks':'Носки для зала',
    'sport-uniform':'Форма для зала', 'sport-shoes':'Обувь для зала', 'pool-wet-bag':'Пакет для мокрых вещей'};
  const schoolLabel = item => SCHOOL_LABELS[item.id] || item.label.replace('иностранного языка', 'ин. языка').replace('по иностранному языку', 'по ин. языку').replace('по окружающему миру', 'по окр. миру').replace('окружающего мира', 'окр. мира');
  let sharedArtwork;

  function makeLayout(levelId, stage, state, garageBank) {
    const targets = new Map();
    const sources = new Map();
    const placed = new Map();
    const selection = stage.type === 'selection';
    const garage = levelId === 'garage';
    const school = levelId === 'school';
    const sequence = stage.type === 'sequence';
    const models = stage.id === 'models';
    const schoolCount = stage.items.length;
    const bank = garage ? garageBank : stage.items.map(item => item.id);
    const garageCells = garage ? global.RoomTidyLayout.cells(stage.targets) : [];

    if (selection) targets.set('backpack', {id:'backpack', visual:point(334, 291, 173, 84, 54)});
    (stage.targets || []).forEach((target, index) => {
      let visual;
      if (garage) visual = point(garageCells[index].x, [206, 319, 432][target.row], 132, 102, 122);
      else if (school) visual = index === 0 ? point(334, 288, 184, 104, 55) : point(584, 305, 174, 98, 54);
      else if (models) visual = point([143, 587, 362][index], 372, 182, 107, 116);
      else if (sequence) visual = grid(index, 3, 287, 118);
      else visual = grid(index, 5, 384, 112);
      targets.set(target.id, {...target, visual});
    });

    bank.forEach((id, index) => {
      if (!id) return;
      let visual;
      if (garage) visual = point([151, 360, 569][index], 622, 162, 123, 151);
      else if (school) visual = grid(index, schoolCount > 12 ? 5 : 4, selection ? 430 : 420, 112);
      else if (models) visual = point([138, 357, 577][index], 624, 169, 126, 151);
      else visual = grid(index, sequence ? 3 : 5, 532, 113);
      if (school) visual.size = 60;
      if (sequence) visual.size = 96;
      if (!selection && own(state.placements, id)) return;
      sources.set(id, visual);
    });

    for (const target of targets.values()) {
      const ids = selection ? state.selected : Object.keys(state.placements).filter(id => state.placements[id] === target.id);
      const v = target.visual;
      ids.forEach((id, index) => {
        let x = v.x, y = v.y, size = v.size;
        if (garage) y = [234, 343, 452][target.row];
        else if (models) y += 8;
        else if (!sequence) {
          const columns = Math.min(4, ids.length);
          const across = school ? 37 : 27;
          x += (index % columns - (columns - 1) / 2) * across;
          y += (Math.floor(index / columns) - Math.floor((ids.length - 1) / columns) / 2) * 31;
          size = school ? 52 : 55;
        }
        placed.set(id, point(x, y, 0, 0, size));
      });
    }
    return {targets, sources, placed};
  }

  function mount(host, {levelId, variant, store, onComplete, onExit} = {}) {
    const engine = global.RoomLevelsLogic.create(levelId, variant);
    const saved = store?.read() || {};
    let restoreError = '';
    if (saved.snapshot && !engine.restore(saved.snapshot)) restoreError = 'Продолжим с начала этого задания.';
    const school = levelId === 'school';
    const garage = levelId === 'garage';
    const reduced = Boolean(global.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const motion = global.RoomTidyMotion.create({reducedMotion:reduced});
    const actor = global.AdventureActor.create({x:school ? 121 : 57, y:garage ? 699 : school ? 354 : 323, scale:garage ? 1.35 : 1.42});
    host.innerHTML = `<section class="ray-levels" data-level-id="${esc(levelId)}">
      <header class="ray-levels__head">
        <div class="ray-levels__nav"><button type="button" data-level-command="exit">← К карте</button><button type="button" data-level-command="sound" aria-pressed="false"></button></div>
        <h1>${esc(engine.level.title)}</h1>
        <p class="ray-levels__step" data-level-step></p>
        <p class="ray-levels__instructions" data-level-instructions></p>
      </header>
      <details class="ray-levels__brief" data-level-brief hidden><summary>Памятка и расписание</summary><div data-level-schedule></div></details>
      <div class="ray-levels__scene" data-level-scene role="group" aria-label="Игровое поле">
        <canvas aria-hidden="true"></canvas><div class="ray-levels__hits" data-level-hits></div>
      </div>
      <div class="ray-levels__tools" role="group" aria-label="Действия">
        <button type="button" data-level-command="undo">Отменить</button>
        <button type="button" data-level-command="hint">Подсказка</button>
        <button type="button" class="ray-levels__primary" data-level-command="check">Проверить</button>
        <button type="button" data-level-command="remove" hidden>Вернуть на стол</button>
      </div>
      <p class="ray-levels__status" data-level-feedback role="status" aria-live="polite"></p>
      <details class="ray-levels__contents" data-level-contents hidden><summary>Что где лежит</summary><div data-level-placed></div></details>
      <p class="ray-levels__save" data-level-warning role="status" hidden></p>
    </section>`;

    const root = host.firstElementChild;
    const get = name => root.querySelector(`[data-level-${name}]`);
    const command = name => root.querySelector(`[data-level-command="${name}"]`);
    const scene = get('scene'), canvas = scene.querySelector('canvas'), hits = get('hits');
    const ctx = canvas.getContext('2d');
    if (!ctx) scene.classList.add('ray-levels__scene--text');
    const primary = command('check');
    const images = new Map();
    const itemImages = new Map();
    let sound = saved.sound === true, audio, layout, scale = 1, artwork, stage, garageBank = [];
    let active = null, dragging = null, hover = null, message = '', mood = 'idle', look, reaction = 0;
    let frame = 0, lastFrame = 0, flights = [], destroyed = false, completed = engine.state.complete;

    function loadImage(src) {
      if (!src || images.has(src)) return images.get(src);
      const image = new global.Image();
      images.set(src, image);
      image.onload = draw;
      image.src = src;
      return image;
    }

    function landscape() {
      const name = stage?.scene || engine.level.scene || levelId;
      const fresh = global.RoomCampaignScene?.[levelId] || global.RoomCampaignScene?.[name];
      const fallback = artwork?.backgrounds[name] || artwork?.backgrounds[SCENES[levelId]];
      const candidate = loadImage(fresh);
      return candidate?.complete && candidate.naturalWidth ? candidate : fallback;
    }

    function localItem(id) { return stage.items.find(item => item.id === id); }

    function prepareSchoolItems() {
      if (!school) return;
      for (const item of stage.items) {
        const markup = global.ObjectArt?.markup(item.id, {decorative:true});
        const uri = global.RoomPoolArt?.[item.id] || (markup && `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
        itemImages.set(item.id, loadImage(uri));
      }
    }

    function pill(value, x, y, w, {bg = '#fff8e8', color = '#173c36', font = 27, h = 35} = {}) {
      ctx.beginPath();
      ctx.roundRect(x - w/2, y - h/2, w, h, 8);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = color;
      ctx.font = `700 ${font}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(value, x, y + 1, w - 10);
    }

    function plate(x, y, w, h, fill, line) {
      ctx.beginPath();
      ctx.roundRect(x - w/2, y - h/2, w, h, 9);
      ctx.fillStyle = fill;
      ctx.fill();
      if (line) {
        ctx.strokeStyle = line;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    function drawSchoolBag() {
      if (!school || stage.type !== 'placement' || !global.AdventureProps) return;
      ctx.save();
      ctx.translate(584, 346);
      ctx.scale(.76, .70);
      global.AdventureProps.bag(ctx, {x:0, y:0});
      ctx.restore();
    }

    function drawBackground() {
      const image = landscape();
      ctx.fillStyle = '#214039';
      ctx.fillRect(0, 0, W, W);
      if (image && school) {
        ctx.drawImage(image, 0, -52, W, W);
        ctx.drawImage(image, 0, image.height*.92, image.width, image.height*.08, 0, W-52, W, 52);
      } else if (image) ctx.drawImage(image, 0, 0, W, W);
      else {
        const floor = ctx.createLinearGradient(0, 480, 0, W);
        floor.addColorStop(0, '#a67543');
        floor.addColorStop(1, '#d6a772');
        ctx.fillStyle = floor;
        ctx.fillRect(0, 480, W, 240);
        if (garage) global.RoomToyArt.drawGarage(ctx, {cells:[...layout.targets.values()].map(t => ({...t.visual, id:t.id})), hover});
      }
      drawSchoolBag();
    }

    function drawTargets() {
      if (garage) {
        const cols = [...layout.targets.values()].slice(0, 4);
        const rows = stage.rows || [];
        cols.forEach((target, i) => {
          const col = stage.columns[i];
          pill(col.label, target.visual.x, 111, 138, {bg:col.color || target.color, color:'#191c15', font:25});
        });
        rows.forEach((row, i) => pill(row.label, 371, [159, 268, 377][i], 270, {font:24, h:31}));
      }
      for (const [id, target] of layout.targets) {
        const v = target.visual;
        const isHovered = hover === id;
        if (garage) {
          if (isHovered) plate(v.x, v.y + 12, v.w, v.h - 22, '#ffe19a36', '#f5cf77');
          continue;
        }
        if (school) {
          if (isHovered) plate(v.x, v.y, v.w, v.h, '#ffe19a36', '#f5cf77');
          if (id === 'backpack') pill('Рюкзак', 334, 378, 147, {font:25});
          else pill(shortTarget(target), v.x, 360, 204, {font:23});
          continue;
        }
        if (stage.type === 'sequence') {
          plate(v.x, v.y, v.w - 14, 86, '#173b36df', isHovered ? '#f5cf77' : '#7dad98');
          if (![...layout.placed.values()].some(pos => pos.x === v.x && pos.y === v.y)) {
            pill(id.split('-').at(-1), v.x, v.y, 48, {font:27});
          }
        } else if (stage.id === 'models') {
          if (isHovered) plate(v.x, v.y, v.w, v.h, '#ffe19a36', '#f5cf77');
          if (id === 'stand-car') {
            plate(v.x, 392, 115, 18, '#273b36');
            ctx.save(); ctx.setLineDash([13, 6]); ctx.strokeStyle = '#eae1bd'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(v.x-51, 392); ctx.lineTo(v.x+51, 392); ctx.stroke(); ctx.restore();
          }
          pill(shortTarget(target), v.x, 447, 194, {font:24});
        } else {
          const rim = ctx.createLinearGradient(0, v.y-32, 0, v.y+41);
          rim.addColorStop(0, '#f3c785'); rim.addColorStop(.23, '#bc8549'); rim.addColorStop(1, '#7e542d');
          plate(v.x, v.y, v.w, 93, rim, isHovered ? '#ffe7a2' : '#e4b77a');
          plate(v.x, v.y - 9, v.w - 13, 55, '#294c41', '#24604f');
          pill(shortTarget(target), v.x, v.y + 48, v.w + 1, {font:25, h:33});
        }
      }
    }

    function drawObject(id, v, size = v.size, angle = 0) {
      const item = localItem(id);
      if (!item) return;
      if (stage.type === 'sequence') {
        plate(v.x, v.y, 211, 94, '#fff5dce8', '#e6ba75');
        ctx.font = '700 25px "Trebuchet MS", sans-serif';
        ctx.fillStyle = '#173c36';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const lines = [''];
        for (const word of item.label.split(' ')) {
          const line = `${lines.at(-1)} ${word}`.trim();
          if (ctx.measureText(line).width <= 197) lines[lines.length - 1] = line;
          else lines.push(word);
        }
        lines.forEach((line, i) => ctx.fillText(line, v.x, v.y + (i - (lines.length - 1)/2)*26));
        return;
      }
      if (!school) {
        (artwork?.drawItem || global.RoomToyArt.drawItem)(ctx, item, {x:v.x, y:v.y, size, angle});
        return;
      }
      const image = itemImages.get(id);
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(angle);
      if (image?.complete && image.naturalWidth) {
        const ratio = size / Math.max(image.width, image.height);
        const w = image.width * ratio, h = image.height * ratio;
        ctx.shadowColor = '#1713127a';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 4;
        ctx.drawImage(image, -w/2, -h/2, w, h);
      } else {
        ctx.font = `${Math.round(size*.68)}px Arial, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(item.icon || item.label.at(0), 0, 0);
      }
      ctx.restore();
    }

    function draw() {
      if (!ctx || destroyed || !layout) return;
      drawBackground();
      motion.drawUnder(ctx);
      drawTargets();
      actor.draw(ctx);
      const hidesItem = id => flights.some(flight => flight.id === id) || dragging?.id === id;
      for (const [id, v] of layout.placed) {
        if (hidesItem(id)) continue;
        drawObject(id, v);
        if (id === active) plate(v.x, v.y, v.size + 18, v.size*.64, '#ffe19a2d', '#f5cf77');
      }
      for (const [id, v] of layout.sources) {
        if (hidesItem(id) || layout.placed.has(id)) continue;
        if (id === active) plate(v.x, v.y, Math.min(v.w, v.size + 23), v.size*.72, '#ffe19a38', '#f5cf77');
        const visual = school ? {...v, y:v.y-16} : v;
        if (school) plate(visual.x, visual.y, 86, 65, '#15372d65');
        drawObject(id, visual);
      }
      for (const {id, cue, size} of flights) {
        const pose = motion.sampleFlight(cue, cue.age / cue.duration);
        drawObject(id, pose, size*pose.scale, pose.angle);
      }
      if (dragging) drawObject(dragging.id, dragging, dragging.size, dragging.angle);
      motion.drawOver(ctx);
    }

    function step(timestamp) {
      frame = 0;
      if (destroyed || document.hidden) return;
      const dt = lastFrame ? Math.min(.06, (timestamp - lastFrame) / 1000) : 0;
      lastFrame = timestamp;
      motion.update(dt);
      flights = flights.filter(flight => flight.cue.age < flight.cue.duration);
      reaction = Math.max(0, reaction - dt);
      actor.update(dt, {mood:reaction > 0 ? mood : 'idle', lookX:look?.x, lookY:look?.y, reducedMotion:reduced});
      draw();
      if (motion.active() || reaction) frame = global.requestAnimationFrame(step);
    }

    function wake() {
      if (destroyed) return;
      if (reduced) actor.update(0, {mood, lookX:look?.x, lookY:look?.y, reducedMotion:true});
      draw();
      if (!frame && !document.hidden && !reduced && (motion.active() || reaction)) {
        lastFrame = 0;
        frame = global.requestAnimationFrame(step);
      }
    }

    function labelsFor(target, state) {
      const names = Object.keys(state.placements).filter(id => state.placements[id] === target.id).map(id => localItem(id).label);
      return `${target.label}${names.length ? `. Здесь ${names.join(', ')}` : ''}`;
    }

    function syncHits() {
      const focused = hits.contains(document.activeElement) ? document.activeElement.dataset.levelKey : null;
      const state = engine.state;
      const selection = stage.type === 'selection';
      const button = (key, attr, label, v, info, css = '', pressed, identity = '') => {
        const width = Math.max(44, v.w * scale), height = Math.max(44, v.h * scale);
        return `<button type="button" data-level-key="${esc(key)}" ${attr} ${identity} aria-label="${esc(label)}" ${pressed === undefined ? '' : `aria-pressed="${pressed}"`} class="ray-levels__hit ${css}" style="left:${v.x/W*100}%;top:${v.y/W*100}%;width:${width}px;height:${height}px"><span class="ray-levels__hit-label">${esc(info)}</span></button>`;
      };
      if (state.complete) { hits.innerHTML = ''; return; }
      const html = [];
      if (!state.submitted) {
        for (const [id, v] of layout.sources) {
          const item = localItem(id);
          const chosen = selection && state.selected.includes(id);
          html.push(button(`item:${id}`, selection ? `data-ri-target="choose:${esc(id)}"` : `data-ri-item="${esc(id)}"`, item.label, v,
            school ? schoolLabel(item) : item.label, `ray-levels__item${school ? ' ray-levels__item--labeled' : ''}${chosen ? ' ray-levels__item--packed' : ''}`,
            selection ? chosen : id === active, `data-level-item="${esc(id)}"`));
        }
        if (!selection) for (const [id, target] of layout.targets) {
          const parked = Object.keys(state.placements).find(item => state.placements[item] === id);
          html.push(button(`target:${id}`, `data-ri-target="${esc(id)}"`, labelsFor(target, state), target.visual,
            parked ? `${shortTarget(target)}: ${localItem(parked).label}` : shortTarget(target), 'ray-levels__target', undefined, `data-level-target="${esc(id)}"`));
        }
      }
      hits.innerHTML = html.join('');
      if (focused) [...hits.children].find(node => node.dataset.levelKey === focused)?.focus({preventScroll:true});
    }

    function refreshWarning() {
      const warning = store?.warning?.() || saved.error || restoreError;
      const row = get('warning');
      row.textContent = warning;
      row.hidden = !warning;
    }

    function syncStage() {
      const state = engine.state;
      stage = engine.stages[state.stageIndex];
      root.dataset.levelStage = stage.id;
      if (stage.id === 'plan') actor.y = actor.targetY = 220;
      garageBank = [];
      prepareSchoolItems();
      const brief = get('brief');
      brief.hidden = !stage.schedule?.length;
      brief.open = false;
      get('schedule').innerHTML = `${stage.memo ? `<p>${esc(stage.memo)}</p>` : ''}<div class="ray-levels__days">${(stage.schedule || []).map(day =>
        `<section><h2>${esc(day.label)}</h2><ol>${day.lessons.map(lesson => `<li>${esc(lesson.title)}</li>`).join('')}</ol></section>`).join('')}</div>`;
    }

    function updateLayout(returned) {
      const state = engine.state;
      if (garage) {
        const available = stage.items.filter(item => !own(state.placements, item.id)).map(item => item.id);
        if (returned && available.includes(returned) && !garageBank.includes(returned)) {
          const free = [0, 1, 2].find(i => !available.includes(garageBank[i]));
          garageBank[free ?? 2] = returned;
        }
        for (let i = 0; i < 3; i++) {
          if (!available.includes(garageBank[i])) garageBank[i] = available.find(id => !garageBank.includes(id));
        }
      }
      layout = makeLayout(levelId, stage, state, garageBank);
      syncHits();
      const placeList = get('placed');
      const contents = get('contents');
      const grouped = (stage.targets || []).some(target => target.capacity !== 1);
      contents.hidden = state.submitted || !grouped || !Object.keys(state.placements).length;
      placeList.innerHTML = contents.hidden ? '' : [...layout.targets.values()].map(target => {
        const ids = Object.keys(state.placements).filter(id => state.placements[id] === target.id);
        if (!ids.length) return '';
        return `<section><strong>${esc(target.label)}</strong><div>${ids.map(id => `<button type="button" data-ri-target="inspect:${esc(id)}">${esc(localItem(id).label)}</button>`).join('')}</div></section>`;
      }).join('');
    }

    function status() {
      const state = engine.state;
      const count = stage.type === 'selection' ? state.selected.length : Object.keys(state.placements).length;
      const detail = stage.type === 'selection' ? `В рюкзаке ${count}` : school ? `В двух сумках ${count}` : `Размещено ${count} из ${stage.items.length}`;
      get('step').textContent = `${engine.stages.length > 1 ? `${state.stageIndex + 1}/${engine.stages.length} · ` : ''}${stage.title} · ${detail}`;
      get('instructions').textContent = school ? stage.instruction : `${stage.instruction} ${stage.memo || ''}`;
      get('feedback').textContent = message || state.feedback?.text || (state.complete ? 'Уровень пройден!' : '');
      get('feedback').dataset.kind = message ? '' : state.feedback?.kind || '';
      command('undo').disabled = !state.canUndo || state.submitted || state.complete;
      command('hint').disabled = state.complete || state.submitted;
      command('remove').hidden = !active || !own(state.placements, active) || state.submitted || state.complete;
      command('remove').textContent = garage ? 'Вернуть на пол' : 'Вернуть на стол';
      command('sound').textContent = sound ? 'Звук вкл.' : 'Звук выкл.';
      command('sound').setAttribute('aria-pressed', String(sound));
      primary.dataset.levelCommand = state.complete ? 'finish' : state.submitted ? 'next' : 'check';
      primary.textContent = state.complete ? 'К карте' : state.submitted ? 'Дальше' : 'Проверить';
      root.dataset.levelComplete = String(state.complete);
      refreshWarning();
    }

    function select(id, showMessage = true) {
      if (!localItem(id) || engine.state.complete || engine.state.submitted) return;
      active = id;
      look = layout.placed.get(id) || layout.sources.get(id);
      message = showMessage ? `${localItem(id).label}. Выбери место.` : '';
      hits.querySelectorAll('[data-ri-item]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.riItem === id)));
      status(); wake();
    }

    function soundCue(ok) {
      if (!sound) return;
      try {
        const Audio = global.AudioContext || global.webkitAudioContext;
        if (!audio) audio = new Audio();
        audio.resume().catch(() => {});
        const now = audio.currentTime, signal = audio.createOscillator(), gain = audio.createGain();
        signal.frequency.setValueAtTime(ok ? 523 : 370, now);
        signal.frequency.exponentialRampToValueAtTime(ok ? 698 : 329, now + .14);
        gain.gain.setValueAtTime(.04, now);
        gain.gain.exponentialRampToValueAtTime(.001, now + .17);
        signal.connect(gain).connect(audio.destination);
        signal.start(); signal.stop(now + .18);
      } catch (_) { /* The game can continue without an available audio device. */ }
    }

    function fly(id, from, to) {
      if (!from || !to) return;
      flights = flights.filter(f => f.id !== id);
      const cue = motion.trigger(garage ? 'garage' : school ? 'settle' : 'lego', {from:{...from, scale:1}, to:{...to, scale:to.size/from.size}, item:localItem(id)});
      if (cue.duration) flights.push({id, cue, size:from.size});
      look = to;
    }

    function perform(action, payload = {}, release) {
      const before = engine.state;
      const previous = layout;
      const beforeSave = JSON.stringify(engine.snapshot());
      if (!engine.act(action, payload)) return;
      const after = engine.state;
      const afterSave = engine.snapshot();
      const changed = beforeSave !== JSON.stringify(afterSave);
      message = '';
      active = null;
      hover = null;
      if (before.stageIndex !== after.stageIndex) {
        motion.clear(); flights = []; syncStage();
      }
      updateLayout(Object.keys(before.placements).find(id => !own(after.placements, id)));
      if (before.stageIndex === after.stageIndex) for (const item of stage.items) {
        const id = item.id;
        if ((before.placements[id] || before.selected.includes(id)) === (after.placements[id] || after.selected.includes(id))) continue;
        const from = (payload.itemId === id && release) || previous.placed.get(id) || previous.sources.get(id);
        const to = layout.placed.get(id) || layout.sources.get(id);
        fly(id, from, to);
      }
      if (changed) store?.save(afterSave, {sound});
      if (action !== 'hint') {
        const positive = action === 'check' ? after.submitted || after.complete : changed;
        mood = positive ? 'happy' : 'think'; reaction = .85;
        soundCue(positive);
      }
      const completeNow = after.complete && !completed;
      if (completeNow) {
        completed = true;
        reaction = 1.65; mood = 'celebrate'; motion.trigger('finale');
      }
      status(); wake();
      if (completeNow) onComplete?.();
    }

    function targetAt(p) {
      return [...layout.targets.values()].find(({visual:v}) => Math.abs(v.x-p.x) <= Math.max(v.w/2, 22/scale) && Math.abs(v.y-p.y) <= Math.max(v.h/2, 22/scale))?.id;
    }

    const input = global.RoomInput.attach({root:scene, scene,
      onSelect(id) { select(id); },
      onMove(id, p) {
        const source = layout.sources.get(id);
        if (!source) return;
        dragging = {...p, id, size:source.size, angle:Math.max(-.2, Math.min(.2, (p.x-source.x)*.001))};
        hover = targetAt(p); look = p; wake();
      },
      onDrop(id, p) {
        const destination = targetAt(p);
        const release = dragging;
        dragging = null; hover = null;
        if (destination) perform('drop', {itemId:id, targetId:destination}, release);
        else {
          if (release) fly(id, release, layout.sources.get(id));
          message = 'Выбери подходящее место на игровом поле.';
          status(); wake();
        }
      },
      onTarget(id) {
        if (id.startsWith('choose:')) perform('choose', {itemId:id.slice(7)});
        else if (active) perform('drop', {itemId:active, targetId:id});
        else {
          const parked = Object.keys(engine.state.placements).find(item => engine.state.placements[item] === id);
          if (parked) select(parked);
          else { message = 'Сначала выбери вещь.'; status(); }
        }
      },
      onCancel() { dragging = null; hover = null; wake(); }
    });

    root.addEventListener('click', event => {
      const inspect = event.target.closest('[data-ri-target^="inspect:"]')?.dataset.riTarget;
      if (inspect) select(inspect.slice(8));
      const action = event.target.closest('[data-level-command]')?.dataset.levelCommand;
      if (action === 'exit' || action === 'finish') onExit?.();
      else if (action === 'sound') {
        sound = !sound;
        if (sound) soundCue(true);
        store?.save(engine.snapshot(), {sound}); status();
      } else if (action === 'remove') perform('remove', {itemId:active});
      else if (action) perform(action);
    });
    root.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !active) return;
      input.cancel(); active = null; message = '';
      hits.querySelectorAll('[data-ri-item]').forEach(node => node.setAttribute('aria-pressed', 'false'));
      status(); wake();
    });

    function resize() {
      const width = scene.clientWidth;
      if (!width) return;
      scale = width/W;
      if (ctx) {
        const pixels = Math.round(Math.min(global.devicePixelRatio || 1, 2) * width);
        canvas.width = canvas.height = pixels;
        ctx.setTransform(pixels/W, 0, 0, pixels/W, 0, 0);
      }
      syncHits(); draw();
    }
    function visibility() {
      if (document.hidden) {
        global.cancelAnimationFrame(frame); frame = 0; input.cancel();
      } else wake();
    }
    syncStage(); updateLayout(); status(); resize();
    const observer = global.ResizeObserver && new global.ResizeObserver(resize);
    observer?.observe(scene);
    document.addEventListener('visibilitychange', visibility);
    const unsubscribe = store?.subscribe?.(refreshWarning);
    if (ctx && global.RoomTidyArtwork) {
      sharedArtwork ||= global.RoomTidyArtwork.load();
      sharedArtwork.then(result => { artwork = result; draw(); });
    }
    return Object.freeze({destroy() {
      destroyed = true;
      observer?.disconnect(); input.destroy(); unsubscribe?.();
      document.removeEventListener('visibilitychange', visibility);
      global.cancelAnimationFrame(frame); audio?.close().catch(() => {});
      root.remove();
    }});
  }

  global.RoomLevelsView = Object.freeze({mount});
})(typeof window === 'undefined' ? globalThis : window);
