/* Explorer buddy. Coordinates are the centre of the feet; update() takes seconds. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdventureActor = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var TAU = Math.PI * 2;
  var C = {
    ink: '#173d46', deep: '#165a64', teal: '#2d8e99', light: '#78c8c9',
    cream: '#fff1cf', creamShade: '#dfcfaa', white: '#fffdf1',
    orange: '#f4a651', darkOrange: '#c97530', sole: '#254951'
  };
  function number(value, fallback) { return Number.isFinite(value) ? value : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function round(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, fill, stroke, lineWidth) {
    round(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1.5; ctx.stroke(); }
  }
  function circle(ctx, x, y, radius, fill, stroke, lineWidth) {
    ctx.beginPath(); ctx.arc(x, y, radius, 0, TAU); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth || 1.5; ctx.stroke(); }
  }
  function line(ctx, points, color, width) {
    ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (var i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }

  function create(options) {
    options = options || {};
    var scale = clamp(number(options.scale, 1), 0.1, 8);
    var actor = {
      x: number(options.x, 0), y: number(options.y, 0), scale: scale,
      width: 54 * scale, height: 82 * scale,
      targetX: number(options.x, 0), targetY: number(options.y, 0),
      mood: 'idle', moving: false,
      _time: 0, _phase: 0, _gait: 0, _reaction: 20,
      _lookX: 0, _lookY: 0, _pointerX: null, _pointerY: null,
      _direction: 1, _reduced: false,

      update: function (dt, state) {
        state = state || {};
        dt = clamp(number(dt, 0), 0, 0.1);
        this.scale = clamp(number(this.scale, 1), 0.1, 8);
        this.width = 54 * this.scale; this.height = 82 * this.scale;
        this.targetX = number(state.targetX, this.targetX);
        this.targetY = number(state.targetY, this.targetY);
        this._reduced = !!state.reducedMotion;
        var nextMood = /^(idle|walk|happy|think|celebrate)$/.test(state.mood) ? state.mood : this.mood;
        if (nextMood !== this.mood) { this.mood = nextMood; this._reaction = 0; }
        this._time += dt; this._reaction += dt;
        if (Number.isFinite(state.lookX)) this._pointerX = state.lookX;
        if (Number.isFinite(state.lookY)) this._pointerY = state.lookY;
        var dx = this.targetX - this.x, dy = this.targetY - this.y;
        var distance = Math.hypot(dx, dy);
        var travel = Math.min(distance, number(options.speed, 118) * this.scale * dt);
        this.moving = distance > 0.5 * this.scale && !this._reduced;
        if (this._reduced || distance < 0.5 * this.scale) {
          this.x = this.targetX; this.y = this.targetY;
        } else if (distance > 0) {
          this.x += dx / distance * travel; this.y += dy / distance * travel;
          this._phase += travel / (24 * this.scale) * TAU;
          if (Math.abs(dx) > 0.4) this._direction = dx < 0 ? -1 : 1;
        }
        this._gait += ((this.moving ? 1 : 0) - this._gait) * (1 - Math.exp(-dt * 14));
        if (this._reduced) this._gait = 0;
        var lookX = this._pointerX === null ? this._direction * (this.moving ? 0.6 : 0.15) :
          clamp((this._pointerX - this.x) / (95 * this.scale), -1, 1);
        var lookY = this._pointerY === null ? 0 :
          clamp((this._pointerY - (this.y - 61 * this.scale)) / (100 * this.scale), -1, 1);
        var ease = this._reduced ? 1 : 1 - Math.exp(-dt * 11);
        this._lookX += (lookX - this._lookX) * ease;
        this._lookY += (lookY - this._lookY) * ease;
        return this;
      },

      draw: function (ctx) {
        if (!ctx) return;
        var t = this._time, gait = this._gait, phase = this._phase;
        var happy = this.mood === 'happy' || this.mood === 'celebrate';
        var celebrate = this.mood === 'celebrate';
        var thinking = this.mood === 'think';
        var reaction = this._reaction;
        var hop = !this._reduced && happy && reaction < 0.62 ?
          Math.sin(reaction / 0.62 * Math.PI) * (celebrate ? 11 : 6) : 0;
        var breath = this._reduced ? 0 : Math.sin(t * 2.25) * 0.65 * (1 - gait);
        var bob = this._reduced ? 0 : -Math.abs(Math.sin(phase)) * 1.7 * gait + breath;
        var tilt = this._reduced ? 0 : Math.sin(phase) * 0.026 * gait;
        var lookX = this._lookX, lookY = this._lookY;
        var swing = Math.sin(phase) * gait;
        var blinkCycle = t % 4.7;
        var blink = !this._reduced && blinkCycle > 4.49 ?
          Math.sin((blinkCycle - 4.49) / 0.21 * Math.PI) : 0;
        var waving = happy && (celebrate || reaction < 1.7);
        var wave = !this._reduced && waving ? Math.sin(t * 13) * 0.18 : 0;

        ctx.save(); ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
        // Contact shadow stays on the floor when the robot hops.
        ctx.beginPath(); ctx.ellipse(0, 1, 22 - hop * 0.4, 5 - hop * 0.06, 0, 0, TAU);
        ctx.fillStyle = 'rgba(22, 52, 56, ' + (0.19 - hop * 0.005) + ')'; ctx.fill();
        ctx.translate(0, bob - hop); ctx.rotate(tilt);

        function leg(side, stride) {
          var hipX = side * 8;
          var footX = hipX + stride * 6;
          var lift = Math.max(0, -stride) * 4.2;
          var kneeX = hipX + stride * 2.1;
          var kneeY = -10 - lift * 0.45;
          line(ctx, [hipX, -20, kneeX, kneeY, footX, -4 - lift], C.ink, 6.4);
          line(ctx, [hipX, -20, kneeX, kneeY, footX, -4 - lift], C.light, 3.6);
          circle(ctx, kneeX, kneeY, 3, C.cream, C.ink, 1.1);
          box(ctx, footX - 6.6, -5.5 - lift, 14, 6, 2.5, C.teal, C.ink, 1.4);
          line(ctx, [footX - 4.5, -0.6 - lift, footX + 5.2, -0.6 - lift], C.sole, 1.8);
          line(ctx, [footX - 3.5, -4.2 - lift, footX + 2, -4.2 - lift], C.light, 1.2);
        }
        leg(-1, swing); leg(1, -swing);

        // Small explorer pack is visible around the body, with an orange side strap.
        box(ctx, -20.5, -42, 41, 23, 6, C.deep, C.ink, 1.6);
        box(ctx, 15, -38, 6.2, 12, 2, C.orange, C.ink, 1.2);

        function arm(side, raised) {
          ctx.save(); ctx.translate(side * 17, -40);
          var angle = raised ? side * (-1.95 + wave) : -side * (0.15 + swing * 0.38);
          if (thinking && side === -1) angle = 1.32;
          ctx.rotate(angle);
          line(ctx, [0, 0, side * 5, 8.5, side * 7.7, 17], C.ink, 6.3);
          line(ctx, [0, 0, side * 5, 8.5, side * 7.7, 17], C.teal, 3.8);
          circle(ctx, side * 5, 8.5, 2.8, C.light, C.ink, 1.1);
          // Angular soft gloves, with a distinct thumb and seam.
          box(ctx, side * 7.7 - 4.8, 14, 9.6, 8.5, 3.2, C.cream, C.ink, 1.3);
          circle(ctx, side * 7.7 - side * 4.4, 16.5, 2.1, C.cream, C.ink, 1);
          line(ctx, [side * 7.7 - 2.3, 20, side * 7.7 + 2.3, 20], C.creamShade, 1.2);
          ctx.restore();
        }
        arm(-1, celebrate); arm(1, waving);

        // Shell, shoulder joints, and the compass badge.
        box(ctx, -17.5, -46, 35, 27, 8, C.teal, C.ink, 1.8);
        box(ctx, -14.5, -43.8, 5, 20, 2, C.light);
        box(ctx, -10, -42, 23, 16.5, 4.8, C.cream, C.deep, 1.2);
        line(ctx, [-13, -21.8, 12, -21.8], C.deep, 2.1);
        circle(ctx, -12.4, -38.5, 1.4, C.ink);
        circle(ctx, 13.4, -38.5, 1.4, C.ink);
        circle(ctx, 1, -33.8, 5.4, C.white, C.teal, 1.2);
        ctx.beginPath(); ctx.moveTo(1.5, -38); ctx.lineTo(4, -31.5);
        ctx.lineTo(0.5, -33); ctx.lineTo(-2, -36.1); ctx.closePath();
        ctx.fillStyle = C.orange; ctx.fill();
        line(ctx, [-4.5, -23.6, 6, -23.6], C.orange, 2.7);
        box(ctx, -5, -49.5, 10, 5, 2, C.creamShade, C.ink, 1.3);

        ctx.save();
        ctx.translate(lookX * 1.2, lookY * 0.65);
        ctx.rotate(thinking ? -0.075 : (this._reduced ? 0 : lookX * 0.025));
        // Antenna responds to the step and carries a warm signal light.
        var antennaLean = this._reduced ? 0 : Math.sin(t * 3.1) * 0.7 + swing * 0.6;
        line(ctx, [9, -73.4, 10 + antennaLean, -79], C.ink, 2.3);
        circle(ctx, 10 + antennaLean, -79.8, 2.35, C.orange, C.ink, 1.1);
        circle(ctx, 10.5 + antennaLean, -80.5, 0.7, C.cream);
        box(ctx, -23, -65.5, 6.5, 11.5, 3, C.teal, C.ink, 1.4);
        box(ctx, 16.5, -65.5, 6.5, 11.5, 3, C.teal, C.ink, 1.4);
        line(ctx, [-20.5, -62.6, -20.5, -58.4], C.light, 1.2);
        line(ctx, [20, -62.6, 20, -58.4], C.light, 1.2);
        box(ctx, -20, -74, 40, 27, 8, C.teal, C.ink, 1.8);
        box(ctx, -17.2, -71.5, 34.4, 21.5, 6.2, C.cream, C.deep, 1.1);
        // Soft highlights make the shell read as metal at small sizes.
        line(ctx, [-13.5, -72.7, 7, -72.7], C.light, 1.1);
        line(ctx, [-14.5, -69.5, -4, -69.5], C.white, 1.3);

        var eyesY = -61.7 + lookY * 1.3;
        var eyesX = lookX * 1.75;
        var eyeH = Math.max(0.7, 7.3 * (1 - blink));
        if (happy && !this.moving) {
          ctx.strokeStyle = C.ink; ctx.lineWidth = 2.7; ctx.lineCap = 'round';
          [-7, 7].forEach(function (x) {
            ctx.beginPath(); ctx.moveTo(x - 2.7 + eyesX, eyesY + 1);
            ctx.quadraticCurveTo(x + eyesX, eyesY - 3, x + 2.7 + eyesX, eyesY + 1); ctx.stroke();
          });
        } else {
          box(ctx, -10 + eyesX, eyesY - eyeH / 2, 5.8, eyeH, 2.6, C.ink);
          box(ctx, 4.2 + eyesX, eyesY - eyeH / 2, 5.8, eyeH, 2.6, C.ink);
          if (eyeH > 3) {
            circle(ctx, -7.7 + eyesX, eyesY - 1.6, 0.85, C.white);
            circle(ctx, 6.5 + eyesX, eyesY - 1.6, 0.85, C.white);
          }
        }
        if (thinking) line(ctx, [-10, -67.5, -5.4, -68.8], C.deep, 1.6);
        ctx.beginPath();
        if (happy) {
          ctx.moveTo(-3.4, -55.6); ctx.quadraticCurveTo(0, -51.9, 3.4, -55.6);
        } else if (thinking) {
          ctx.moveTo(-1.2, -54.9); ctx.lineTo(2.6, -55.5);
        } else {
          ctx.moveTo(-2.5, -55.1); ctx.quadraticCurveTo(0, -53.6, 2.5, -55.1);
        }
        ctx.strokeStyle = C.deep; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.stroke();
        circle(ctx, -14.3, -55.5, 1.1, C.orange);
        circle(ctx, 14.3, -55.5, 1.1, C.orange);
        ctx.restore();
        ctx.restore();
      }
    };
    return actor;
  }
  return { create: create };
}));
