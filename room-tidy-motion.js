(function (global) {
  'use strict';

  const TAU = 2 * Math.PI;
  const MAX_CUES = 12;
  const FRAME = 720;
  const DURATIONS = Object.freeze({garage: .72, lego: .54, laundry: .65, reveal: .55, settle: .48, transition: .76, finale: 1.65});
  const ALIASES = Object.freeze({park: 'garage', brick: 'lego', model: 'lego', hamper: 'laundry', find: 'reveal', drop: 'settle', done: 'finale'});
  const PALETTES = Object.freeze({garage: '255,220,153', lego: '255,221,149', laundry: '235,249,219', reveal: '255,224,138', settle: '238,215,167', finale: '255,226,164'});
  const limit = (value, low, high) => Math.max(low, Math.min(high, value));
  const mix = (from, to, fraction) => from + (to - from) * fraction;
  const unit = value => Number.isFinite(value) ? limit(value, 0, 1) : 0;
  const easeInOut = t => t * t * (3 - 2 * t);
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const windowed = (t, from, to) => unit((t - from) / (to - from));
  const number = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const kindOf = name => has(ALIASES, name) ? ALIASES[name] : has(DURATIONS, name) ? name : 'settle';
  const duration = name => DURATIONS[kindOf(name)];

  function bezier(a, b, c, d, t) {
    const rest = 1 - t;
    return rest ** 3 * a + 3 * rest ** 2 * t * b + 3 * rest * t ** 2 * c + t ** 3 * d;
  }

  function poseAt(effect, fraction) {
    const kind = kindOf(effect.kind);
    const from = effect.from || {x: 0, y: 0};
    const to = effect.to || from;
    const t = unit(fraction);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy);
    const side = dx < 0 ? -1 : 1;
    const startScale = number(from.scale, number(from.s, 1));
    const endScale = number(to.scale, kind === 'garage' ? .88 : kind === 'laundry' ? .5 : .61);
    const startAngle = number(from.angle, 0);
    const endAngle = number(to.angle, 0);
    const travel = easeInOut(t);
    const arc = Math.sin(t * Math.PI);
    const pose = {
      x: mix(from.x, to.x, travel),
      y: mix(from.y, to.y, travel),
      scale: mix(startScale, endScale, travel),
      angle: mix(startAngle, endAngle, easeOut(t)),
      alpha: 1,
      wheelAngle: 0
    };

    if (kind === 'garage') {
      const approach = limit(dist * .23, 29, 76);
      const offsetY = limit(dist * .18, 16, 60);
      const steer = easeInOut(windowed(t, 0, .81));
      const braking = windowed(t, .78, 1);
      pose.x = bezier(from.x, from.x + side * Math.min(dist * .3, 124), to.x - approach, to.x, steer);
      pose.y = bezier(from.y, from.y + offsetY * .54, to.y + offsetY, to.y + 8, steer);
      pose.x += 4 * Math.sin(braking * Math.PI);
      pose.y -= 8 * easeOut(braking);
      pose.y += 2.4 * Math.sin(steer * 5 * Math.PI) * arc;
      pose.angle += side * (.15 * Math.sin(steer * TAU) + .05 * Math.sin(braking * TAU));
      pose.wheelAngle = (dist + approach * .6) * steer / 11;
    } else if (kind === 'laundry') {
      const rise = windowed(t, 0, .66);
      const fall = windowed(t, .57, 1);
      const lift = limit(dist * .14, 35, 84);
      pose.x = mix(from.x, to.x, easeInOut(rise));
      pose.y = mix(from.y, to.y - lift, easeInOut(rise)) + lift * fall ** 2;
      pose.angle += side * (.24 * Math.sin(rise * Math.PI) - .13 * Math.sin(fall * Math.PI));
      pose.scale -= .06 * Math.sin(fall * Math.PI);
      pose.alpha = 1 - easeInOut(windowed(t, .84, 1));
    } else if (kind === 'lego') {
      const land = windowed(t, .69, 1);
      pose.y -= limit(dist * .13, 28, 71) * arc;
      pose.y -= 7 * Math.sin(land * TAU) * (1 - land);
      pose.angle += side * (.27 * arc - .09 * Math.sin(land * TAU) * (1 - land));
      pose.scale += .04 * Math.sin(land * TAU) * (1 - land);
    } else {
      const lift = kind === 'reveal' ? 55 : 38;
      pose.y -= limit(dist * .1, lift * .6, lift) * arc;
      pose.angle += side * .16 * arc;
    }

    if (t === 1) {
      pose.x = to.x;
      pose.y = to.y;
      pose.scale = endScale;
      pose.angle = endAngle;
    }
    return pose;
  }

  function camera(from, to, fraction) {
    const f = easeInOut(unit(fraction));
    const start = from || {};
    const finish = to || {};
    return {
      x: mix(number(start.x, 0), number(finish.x, 0), f),
      y: mix(number(start.y, 0), number(finish.y, 0), f),
      scale: mix(number(start.scale, 1), number(finish.scale, 1), f),
      alpha: mix(number(start.alpha, 1), number(finish.alpha, 1), f)
    };
  }

  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  }

  function glow(ctx, x, y, radius, color, opacity, squeeze = 1) {
    if (opacity <= .003) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, squeeze);
    const paint = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    paint.addColorStop(0, `rgba(${color},${opacity})`);
    paint.addColorStop(.38, `rgba(${color},${opacity * .64})`);
    paint.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = paint;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.restore();
  }

  function sparkle(ctx, x, y, size, color, opacity) {
    ctx.fillStyle = `rgba(${color},${opacity})`;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + .8, y - .8, x + size * .73, y);
    ctx.quadraticCurveTo(x + .8, y + .8, x, y + size);
    ctx.quadraticCurveTo(x - .8, y + .8, x - size * .73, y);
    ctx.quadraticCurveTo(x - .8, y - .8, x, y - size);
    ctx.fill();
  }

  function contactProgress(cue) {
    return windowed(cue.age, cue.impact, cue.life);
  }

  function contact(ctx, cue) {
    const p = contactProgress(cue);
    if (!p || p === 1) return;
    const {x, y} = cue.to;
    const light = PALETTES[cue.kind];
    const strength = Math.sin(p * Math.PI) * (1 - p * .43);
    const width = cue.kind === 'reveal' ? 89 : cue.kind === 'garage' ? 68 : 57;
    glow(ctx, x, y + 18, width, light, strength * .3, .4);
    ctx.lineWidth = 1.7 * (1 - p) + .3;
    ctx.strokeStyle = `rgba(${light},${strength * .45})`;
    ellipse(ctx, x, y + 22, mix(18, width * .9, p), mix(6, width * .31, p));
    ctx.stroke();
  }

  function dust(ctx, cue) {
    const p = contactProgress(cue);
    if (!p || p === 1) return;
    const count = cue.kind === 'reveal' ? 10 : cue.kind === 'garage' ? 6 : 5;
    const color = PALETTES[cue.kind];
    for (let i = 0; i < count; i++) {
      const angle = (i + .4) * TAU / count;
      const speed = 29 + ((i * 17 + cue.seed * 3) % 34);
      const distance = 10 + speed * easeOut(p);
      const x = cue.to.x + Math.cos(angle) * distance;
      const y = cue.to.y + 10 + Math.sin(angle) * distance * .46 - Math.sin(p * Math.PI) * (i % 2 ? 19 : 9);
      const alpha = Math.pow(1 - p, 2) * .68;
      if ((i + cue.seed) % 3 === 0 || cue.kind === 'reveal') {
        sparkle(ctx, x, y, 2.8 + (i % 4) * .98, color, alpha);
      } else {
        const size = (1.5 + (i % 4) * .43) * (1 + p * 1.6);
        ctx.fillStyle = `rgba(${color},${alpha * .57})`;
        ellipse(ctx, x, y, size, size * .62);
        ctx.fill();
      }
    }
  }

  function tyres(ctx, cue) {
    const p = windowed(cue.age, 0, cue.duration);
    if (!p || p >= .85) return;
    const near = poseAt(cue, p);
    const behind = poseAt(cue, Math.max(0, p - .115));
    const alpha = Math.sin(p * Math.PI) * .23;
    const width = 24 * near.scale;
    ctx.lineWidth = 2.3 * near.scale;
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(92,70,51,${alpha})`;
    for (const side of [-1, 1]) {
      const x = width * side;
      ctx.beginPath();
      ctx.moveTo(behind.x + x, behind.y + 21 * behind.scale);
      ctx.lineTo(near.x + x, near.y + 21 * near.scale);
      ctx.stroke();
    }
  }

  function tailLights(ctx, cue) {
    const p = windowed(cue.age, 0, cue.duration);
    const light = Math.sin(windowed(p, .63, 1) * Math.PI);
    if (light <= .01) return;
    const pose = poseAt(cue, p);
    const baseSize = number(cue.item?.size, 160) / 120 * pose.scale;
    const bodySize = ({small: .67, medium: .83, large: 1})[cue.item?.sizeClass] || .85;
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.angle);
    ctx.scale(baseSize * bodySize, baseSize * bodySize);
    glow(ctx, -46, 7, 14, '255,95,59', light * .76, .66);
    glow(ctx, -49, 8, 4, '255,203,149', light * .85, .73);
    ctx.restore();
  }

  function finale(ctx, cue, over) {
    const p = windowed(cue.age, 0, cue.life);
    const strength = Math.sin(p * Math.PI);
    if (strength <= .01) return;
    if (!over) {
      glow(ctx, 235, 168, 445, '255,230,178', strength * .16, .73);
      glow(ctx, 553, 486, 192, '255,205,131', strength * .10, .57);
      return;
    }
    for (let i = 0; i < 14; i++) {
      const x = 73 + (i * 173) % 592 + Math.sin(i * 1.7 + p * 4) * 10;
      const y = 120 + (i * 79) % 530 - p * (24 + i * 2.3);
      const light = strength * (.28 + .28 * Math.sin(p * 8 + i));
      sparkle(ctx, x, y, 3 + i % 4, PALETTES.finale, light);
    }
  }

  function create({reducedMotion = false} = {}) {
    let cues = [];
    let seed = 0;

    function trigger(name, options = {}) {
      const kind = kindOf(name);
      const fallback = {x: FRAME / 2, y: FRAME / 2};
      const to = options.to || options.from || fallback;
      const from = options.from || to;
      const seconds = reducedMotion ? 0 : limit(number(options.duration, duration(kind)), .001, 2.5);
      const impact = seconds * (kind === 'reveal' ? .16 : .82);
      const life = kind === 'finale' || kind === 'transition' ? seconds : seconds + .24;
      const cue = {...options, kind, from: {...from}, to: {...to}, duration: seconds, life, age: 0, impact, seed: seed++ % 127};
      if (!reducedMotion) {
        if (cues.length === MAX_CUES) cues.shift();
        cues.push(cue);
      }
      return cue;
    }

    function update(dt) {
      if (!Number.isFinite(dt) || dt <= 0 || !cues.length) return;
      for (const cue of cues) cue.age += dt;
      cues = cues.filter(cue => cue.age < cue.life);
    }

    function draw(ctx, over) {
      if (!cues.length) return;
      ctx.save();
      for (const cue of cues) {
        if (cue.kind === 'transition') continue;
        if (cue.kind === 'finale') {
          finale(ctx, cue, over);
        } else if (over) {
          dust(ctx, cue);
          if (cue.kind === 'garage') tailLights(ctx, cue);
        } else {
          if (cue.kind === 'garage') tyres(ctx, cue);
          contact(ctx, cue);
        }
      }
      ctx.restore();
    }

    return Object.freeze({
      update,
      trigger,
      duration: kind => reducedMotion ? 0 : duration(kind),
      sampleFlight: (effect, fraction) => poseAt(effect, reducedMotion ? 1 : fraction),
      camera: (from, to, fraction) => camera(from, to, reducedMotion ? 1 : fraction),
      drawUnder: ctx => draw(ctx, false),
      drawOver: ctx => draw(ctx, true),
      active: () => cues.length > 0,
      clear: () => { cues.length = 0; }
    });
  }

  const api = Object.freeze({create, duration, sampleFlight: poseAt, camera});
  global.RoomTidyMotion = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
