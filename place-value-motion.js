(function (root) {
'use strict';

let active = null;
const exchangeActions = new Set(['pack2', 'pack5', 'pack', 'pack100', 'split2', 'split5', 'split', 'split100']);
const motionPreference = '(prefers-reduced-motion: reduce)';
const noMotion = win => win.matchMedia?.(motionPreference).matches;
const cancel = () => active?.finish(false);

function capturePiece(piece, landingPoint) {
  if (!piece) return null;
  const win = piece.ownerDocument.defaultView;
  const rect = piece.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;

  const style = win.getComputedStyle(piece);
  const studs = piece.querySelector('.brick-studs');
  const hundred = piece.classList.contains('hundred');
  const ten = piece.classList.contains('ten');
  let cols = hundred ? 10 : 1;
  let rows = hundred || ten ? 10 : 1;
  let grid = {left: 0, top: 0, right: 0, bottom: 0};
  let studSize = 0;
  if (studs) {
    cols = Number(style.getPropertyValue('--cols'));
    rows = Number(style.getPropertyValue('--rows'));
    const area = studs.getBoundingClientRect();
    grid = {
      left: Math.max(0, area.left - rect.left), top: Math.max(0, area.top - rect.top),
      right: Math.max(0, rect.right - area.right), bottom: Math.max(0, rect.bottom - area.bottom)
    };
    studSize = studs.firstElementChild.getBoundingClientRect().width / (area.width / cols);
  }

  return {
    x: landingPoint ? landingPoint.x - rect.width / 2 : rect.left,
    y: landingPoint ? landingPoint.y - rect.height / 2 : rect.top,
    width: rect.width, height: rect.height,
    cols, rows, grid, studSize,
    face: style.getPropertyValue('--piece-face').trim(),
    edge: style.getPropertyValue('--piece-edge').trim()
  };
}

function capture(container, K, quantities = K.values) {
  if (!container || noMotion(container.ownerDocument.defaultView)) return null;
  const result = {};
  for (const type of Object.keys(K.values)) {
    if (quantities[type]) {
      result[type] = Array.from(container.querySelectorAll('.piece.' + type), piece => capturePiece(piece));
    }
  }
  return result;
}

// The plate separates along the little divisions: 1 × 10 columns for cubes
// and 5 × 2 stud groups for construction bricks. External edges keep the lip.
function sections(piece, cols, rows) {
  const pitchX = (piece.width - piece.grid.left - piece.grid.right) / piece.cols;
  const pitchY = (piece.height - piece.grid.top - piece.grid.bottom) / piece.rows;
  const parts = [];
  for (let row = 0; row < piece.rows; row += rows) {
    for (let col = 0; col < piece.cols; col += cols) {
      const grid = {
        left: col === 0 ? piece.grid.left : 0,
        top: row === 0 ? piece.grid.top : 0,
        right: col + cols === piece.cols ? piece.grid.right : 0,
        bottom: row + rows === piece.rows ? piece.grid.bottom : 0
      };
      parts.push({
        ...piece, cols, rows, grid,
        x: piece.x + (col ? piece.grid.left + col * pitchX : 0),
        y: piece.y + (row ? piece.grid.top + row * pitchY : 0),
        width: cols * pitchX + grid.left + grid.right,
        height: rows * pitchY + grid.top + grid.bottom
      });
    }
  }
  return parts;
}

function studLayout(piece) {
  const {grid, width, height} = piece;
  return {
    top: (100 * grid.top / height) + '%', right: (100 * grid.right / width) + '%',
    bottom: (100 * grid.bottom / height) + '%', left: (100 * grid.left / width) + '%'
  };
}

function graphic(doc, piece) {
  const face = doc.createElement('div');
  face.className = 'pv-flight-piece' + (piece.studSize ? ' pv-flight-brick' : '');
  face.style.left = piece.x + 'px';
  face.style.top = piece.y + 'px';
  face.style.width = piece.width + 'px';
  face.style.height = piece.height + 'px';
  face.style.backgroundColor = piece.face;
  face.style.color = piece.edge;
  face.style.setProperty('--piece-columns', piece.cols);
  face.style.setProperty('--piece-rows', piece.rows);
  if (!piece.studSize) return face;

  const studs = doc.createElement('div');
  studs.className = 'pv-flight-studs';
  Object.assign(studs.style, studLayout(piece));
  studs.style.setProperty('--pv-stud-size', (100 * piece.studSize) + '%');
  for (let i = 0; i < piece.cols * piece.rows; i++) studs.append(doc.createElement('i'));
  face.append(studs);
  return face;
}

function preview(piece) {
  const source = capturePiece(piece);
  if (!source) return null;
  const ghost = graphic(piece.ownerDocument, source);
  ghost.classList.add('pv-drag-preview');
  ghost.setAttribute('aria-hidden', 'true');
  return ghost;
}

function frames(from, to, index, kind, clearance) {
  const x = to.x - from.x + (to.width - from.width) / 2;
  const y = to.y - from.y + (to.height - from.height) / 2;
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const distance = Math.hypot(x, y);
  const turn = kind === 'hundred' ? (index - 4.5) * 1.5 : (index % 2 ? 6 : -6);
  const lift = Math.max(0, Math.min(42, 12 + distance * .1, Math.min(from.y, to.y) - clearance));
  const transform = (t, up, pitch, roll, squash = 1) =>
    'translate(' + x * t + 'px,' + (y * t - up) + 'px) perspective(720px) rotateX(' + pitch +
    'deg) rotateZ(' + roll + 'deg) scale(' + ((1 + (scaleX - 1) * t) / squash) +
    ',' + ((1 + (scaleY - 1) * t) * squash) + ')';
  const destination = {backgroundColor: to.face, color: to.edge};
  return [
    {offset: 0, transform: transform(0, 0, 0, 0), backgroundColor: from.face, color: from.edge,
      filter: 'drop-shadow(1px 2px 2px #23384f16)', easing: 'cubic-bezier(.25,.7,.3,1)'},
    {offset: .24, transform: transform(.10, lift * .7, kind === 'hundred' ? 19 : 11, turn),
      filter: 'drop-shadow(2px 8px 5px #23384f32)', easing: 'cubic-bezier(.34,.08,.28,1)'},
    {offset: .63, transform: transform(.77, lift, 11, turn * .35),
      filter: 'drop-shadow(3px 12px 7px #23384f42)', easing: 'cubic-bezier(.27,.68,.28,1)'},
    {offset: .89, transform: transform(1, 0, 0, 0, .975), ...destination,
      filter: 'drop-shadow(1px 2px 2px #23384f16)', easing: 'ease-out'},
    {offset: 1, transform: transform(1, 0, 0, 0), ...destination,
      filter: 'drop-shadow(1px 2px 2px #23384f16)'}
  ];
}

function play(container, from, to, targets, kind, action) {
  cancel();
  if (!from.length || from.length !== to.length || from.length > 100 ||
      from.some((part, i) => !part || !to[i] || part.cols !== to[i].cols ||
        part.rows !== to[i].rows)) return Promise.resolve(false);

  const doc = container.ownerDocument;
  const win = doc.defaultView;
  if (!doc.body || noMotion(win) || typeof doc.body.animate !== 'function') return Promise.resolve(false);

  const overlay = doc.createElement('div');
  overlay.className = 'pv-exchange-overlay';
  overlay.dataset.motion = action;
  overlay.setAttribute('aria-hidden', 'true');
  const animations = [];
  const hidden = new Map(targets.map(piece => [piece, piece.style.visibility]));
  const duration = kind === 'hundred' ? 660 : kind === 'exchange' ? 525 : 355;
  const delayStep = kind === 'hundred' ? 18 : 11;
  const header = kind === 'move' ? null : container.querySelector('.zone-header');
  const clearance = header ? header.getBoundingClientRect().bottom + 6 : -Infinity;
  const preference = win.matchMedia?.(motionPreference);
  let timer;
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  function finish(completed) {
    if (active?.promise !== promise) return;
    active = null;
    win.clearTimeout(timer);
    preference?.removeEventListener?.('change', cancel);
    for (const animation of animations) animation.cancel();
    for (const [piece, visibility] of hidden) piece.style.visibility = visibility;
    container.classList.remove('pv-exchanging');
    overlay.remove();
    resolve(completed);
  }

  active = {promise, finish, exchange: kind !== 'move'};
  doc.body.append(overlay);
  try {
    for (const [piece] of hidden) piece.style.visibility = 'hidden';
    if (kind !== 'move') container.classList.add('pv-exchanging');
    for (const [index, source] of from.entries()) {
      const destination = to[index];
      const face = graphic(doc, source);
      if (kind === 'exchange') face.classList.add('pv-exchange-unit');
      overlay.append(face);
      const delay = Math.min(index, 9) * delayStep;
      const timing = {duration, delay, fill: 'both'};
      animations.push(face.animate(frames(source, destination, index, kind, clearance), timing));
      if (source.studSize) {
        animations.push(face.firstElementChild.animate([studLayout(source), studLayout(destination)], timing));
      }
    }
    timer = win.setTimeout(() => finish(true), duration + 9 * delayStep + 60);
    preference?.addEventListener?.('change', cancel);
    Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => finish(true));
  } catch (_) {
    finish(false);
  }
  return promise;
}

function entries(container, type, start, count) {
  return Array.from(container.querySelectorAll('.piece.' + type)).slice(start, start + count);
}

function animate(container, snapshot, before, after, K, options = {}) {
  if (!container || !snapshot || options.reducedMotion || !exchangeActions.has(options.action)) return Promise.resolve(false);
  const sources = [], destinations = [], targets = [];
  for (const type of Object.keys(K.values)) {
    const offset = before[type] || 0;
    const difference = (after[type] || 0) - offset;
    if (difference < 0) sources.push(...(snapshot[type] || []).slice(difference));
    if (difference > 0) {
      for (const piece of entries(container, type, offset, difference)) {
        targets.push(piece);
        destinations.push(capturePiece(piece));
      }
    }
  }
  if (sources.some(piece => !piece) || destinations.some(piece => !piece)) return Promise.resolve(false);
  const hundred = options.action.endsWith('100');
  const ten = hundred && [...sources, ...destinations].find(piece => piece.cols * piece.rows === 10);
  if (hundred && !ten) return Promise.resolve(false);
  const cols = ten ? ten.cols : 1;
  const rows = ten ? ten.rows : 1;
  return play(container, sources.flatMap(piece => sections(piece, cols, rows)),
    destinations.flatMap(piece => sections(piece, cols, rows)), targets, hundred ? 'hundred' : 'exchange', options.action);
}

function move(container, snapshot, before, after, action = 'move') {
  if (!container || !snapshot) return Promise.resolve(false);
  const sources = [], destinations = [], targets = [];
  for (const type of Object.keys(snapshot)) {
    const start = before[type] || 0;
    const count = (after[type] || 0) - start;
    if (count < 1) continue;
    const pieces = entries(container, type, start, count);
    sources.push(...snapshot[type].slice(0, pieces.length));
    destinations.push(...pieces.map(piece => capturePiece(piece)));
    if (container.dataset.zone !== 'bank') targets.push(...pieces);
  }
  return play(container, sources, destinations, targets, 'move', action);
}

// Consume the same recorded action as the worked example. Going back reverses
// that single action and keeps the visible objects in correspondence.
function transition(frame, reverse, getZone, K) {
  const action = frame.actions?.[0];
  if (!action) return () => {};
  const before = reverse ? frame.after : frame.before;
  const after = reverse ? frame.before : frame.after;
  if (action.kind === 'exchange') {
    const name = reverse
      ? action.action.replace(/^(pack|split)/, prefix => prefix === 'pack' ? 'split' : 'pack')
      : action.action;
    const snapshot = capture(getZone(action.zone), K, before[action.zone]);
    return () => animate(getZone(action.zone), snapshot, before[action.zone], after[action.zone], K, {action: name});
  }

  const from = reverse ? action.to : action.from;
  const to = reverse ? action.from : action.to;
  const counts = Object.fromEntries(frame.actions.map(item => [item.type, item.count]));
  const snapshot = capture(getZone(from), K, counts);
  if (snapshot) {
    for (const type of Object.keys(snapshot)) snapshot[type] = snapshot[type].slice(-counts[type]);
  }
  return () => move(getZone(to), snapshot, before[to], after[to], frame.operation);
}

root.PlaceValueMotion = {
  capture, capturePiece, animate, move, preview, transition, cancel,
  isBusy: () => Boolean(active?.exchange),
  idle: () => active?.promise || Promise.resolve()
};
})(typeof window === 'undefined' ? globalThis : window);
