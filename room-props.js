/* Tactile room props. The controller owns all positions and interaction. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdventureProps = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var TAU = Math.PI * 2;
  function n(v, fallback) { return Number.isFinite(v) ? v : fallback; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pt(p) { return Array.isArray(p) ? { x: p[0], y: p[1] } : p; }
  function round(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function ellipse(ctx, x, y, rx, ry) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  }
  function stroke(ctx, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function path(ctx, vertices) {
    ctx.beginPath(); ctx.moveTo(vertices[0].x, vertices[0].y);
    for (var i = 1; i < vertices.length; i++) ctx.lineTo(vertices[i].x, vertices[i].y);
    ctx.closePath();
  }

  function blanket(ctx, options) {
    options = options || {};
    var points = (options.points || [[180, 220], [460, 220], [460, 445], [180, 445]]).map(pt);
    if (points.length !== 4 || points.some(function (p) { return !p || !Number.isFinite(p.x) || !Number.isFinite(p.y); })) return;
    var settled = !!options.settled, time = n(options.time, 0);
    var amplitude = settled ? 0.95 : 4.8;
    var columns = 12, rows = 8;
    function surface(u, v) {
      var a = (1 - u) * (1 - v), b = u * (1 - v), c = u * v, d = (1 - u) * v;
      var wrinkle = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * amplitude *
        (Math.sin(u * 17.3 + v * 8.4 + (settled ? 0 : time * 0.7)) + Math.sin(v * 23.2 - u * 6.1) * 0.37);
      return {
        x: points[0].x * a + points[1].x * b + points[2].x * c + points[3].x * d + wrinkle * 0.32,
        y: points[0].y * a + points[1].y * b + points[2].y * c + points[3].y * d + wrinkle,
        z: wrinkle
      };
    }
    var xs = points.map(function (p) { return p.x; }), ys = points.map(function (p) { return p.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    ctx.save();
    // The clean cover rolls over the mattress edges; its drape stops above the
    // footboard. These panels also cover the old folds in the painted room.
    if (settled) {
      ctx.save();
      ctx.beginPath(); ctx.rect(minX - 40, minY - 15, maxX - minX + 80, Math.max(1, 549 - minY + 15)); ctx.clip();
      [0, 1].forEach(function (side) {
        var inner = [], outer = [];
        for (var edge = 0; edge <= rows * 3; edge++) {
          var v = edge / (rows * 3), p = surface(side, v);
          inner.push(p);
          outer.push({ x: p.x + (side ? 1 : -1) * (5 + Math.sin(v * Math.PI * 0.8) * 16) * v,
            y: Math.min(547, p.y + 7 * v) });
        }
        path(ctx, inner.concat(outer.reverse()));
        var drape = ctx.createLinearGradient(side ? maxX - 27 : minX - 19, 0, side ? maxX + 19 : minX + 27, 0);
        drape.addColorStop(0, side ? '#3e8182' : '#245f68');
        drape.addColorStop(0.55, side ? '#2d6e75' : '#367d80');
        drape.addColorStop(1, side ? '#1e5660' : '#609d98');
        ctx.fillStyle = drape; ctx.fill();
      });
      var left = points[3], right = points[2];
      path(ctx, [left, right, { x: right.x - 2, y: Math.min(547, right.y + 7) }, { x: left.x + 2, y: Math.min(547, left.y + 7) }]);
      ctx.fillStyle = '#2d6a70'; ctx.fill();
      ctx.restore();
    }
    ctx.shadowColor = 'rgba(16, 48, 47, .20)'; ctx.shadowBlur = settled ? 5 : 11;
    ctx.shadowOffsetX = 2; ctx.shadowOffsetY = settled ? 3 : 7;
    path(ctx, points); ctx.fillStyle = '#386d6d'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    path(ctx, points); ctx.clip();
    var base = ctx.createLinearGradient(minX, minY, maxX, maxY);
    base.addColorStop(0, '#70a9a3'); base.addColorStop(0.3, '#57938f');
    base.addColorStop(0.72, '#3f7f80'); base.addColorStop(1, '#2e6d75');
    ctx.fillStyle = base; ctx.fillRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
    var daylight = ctx.createRadialGradient(minX + (maxX - minX) * 0.23, minY, 3,
      minX + (maxX - minX) * 0.23, minY, Math.max(60, (maxX - minX) * 0.8));
    daylight.addColorStop(0, 'rgba(224, 236, 188, .20)'); daylight.addColorStop(1, 'rgba(224, 236, 188, 0)');
    ctx.fillStyle = daylight; ctx.fillRect(minX, minY, maxX - minX, maxY - minY);

    // Long, connected folds use the same bilinear cloth coordinates as its
    // corners. Mesh subdivision is only sampling detail, never a visible grid.
    function foldPath(position, bend, offset) {
      ctx.beginPath();
      for (var sample = 0; sample <= rows * 6; sample++) {
        var v = sample / (rows * 6);
        var u = position + Math.sin(v * 3.9 + position * 6) * Math.sin(v * Math.PI) * bend + offset;
        var p = surface(clamp(u, 0.003, 0.997), v);
        if (!sample) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
    }
    [0.12, 0.32, 0.57, 0.81, 0.93].forEach(function (position, index) {
      var bend = (settled ? 0.012 : 0.045) * (index % 2 ? -1 : 1);
      foldPath(position, bend, 0); stroke(ctx, 'rgba(17, 64, 69, .025)', settled ? 22 : 28);
      foldPath(position, bend, 0); stroke(ctx, 'rgba(17, 64, 69, .035)', settled ? 12 : 16);
      foldPath(position, bend, 0); stroke(ctx, settled ? 'rgba(17, 64, 69, .045)' : 'rgba(17, 64, 69, .09)', settled ? 4 : 6);
      foldPath(position, bend, -0.008); stroke(ctx, settled ? 'rgba(216, 233, 207, .075)' : 'rgba(216, 233, 207, .14)', settled ? 5 : 8);
      foldPath(position, bend, -0.012); stroke(ctx, 'rgba(228, 239, 216, .065)', 1.4);
    });
    // A soft lower turn is irregular and follows the cover's perspective.
    [0.86, 0.96].forEach(function (depth, index) {
      ctx.beginPath();
      for (var sample = 0; sample <= columns * 4; sample++) {
        var u = sample / (columns * 4), v = depth + Math.sin(u * 5.2 + index) * (settled ? 0.006 : 0.025);
        var p = surface(u, clamp(v, 0, 1));
        if (!sample) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      stroke(ctx, 'rgba(19, 67, 71, .06)', 5);
      stroke(ctx, 'rgba(217, 235, 207, .09)', 1.1);
    });
    // Scattered microscopic fibres avoid the look of ruled or squared paper.
    for (var fibre = 1; fibre <= 150; fibre++) {
      var fu = (fibre * 0.61803398875) % 1, fv = (fibre * 0.41421356237) % 1;
      var a = surface(fu, fv), b = surface(Math.min(1, fu + 0.004), fv + 0.001);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
      stroke(ctx, fibre % 3 ? 'rgba(225, 238, 215, .075)' : 'rgba(17, 70, 74, .06)', 0.65);
    }
    ctx.restore();
    ctx.save();
    path(ctx, points); stroke(ctx, 'rgba(29, 93, 100, .62)', 1.6);
    // A single fine hem holds its position on the dragged edges.
    [0.012, 0.988].forEach(function (edge) {
      [true, false].forEach(function (horizontal) {
        ctx.beginPath();
        for (var k = 0; k <= 30; k++) {
          var q = horizontal ? surface(k / 30, edge) : surface(edge, k / 30);
          if (!k) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        stroke(ctx, 'rgba(207, 228, 203, .30)', 0.9);
      });
    });
    ctx.restore();
  }

  function pillowShape(ctx, w, h) {
    ctx.beginPath(); ctx.moveTo(-w * 0.43, -h * 0.43);
    ctx.bezierCurveTo(-w * 0.18, -h * 0.54, w * 0.18, -h * 0.54, w * 0.43, -h * 0.43);
    ctx.bezierCurveTo(w * 0.54, -h * 0.27, w * 0.54, h * 0.27, w * 0.43, h * 0.43);
    ctx.bezierCurveTo(w * 0.18, h * 0.55, -w * 0.18, h * 0.55, -w * 0.43, h * 0.43);
    ctx.bezierCurveTo(-w * 0.54, h * 0.27, -w * 0.54, -h * 0.27, -w * 0.43, -h * 0.43);
    ctx.closePath();
  }
  function pillow(ctx, options) {
    options = options || {};
    var w = Math.max(12, n(options.width, 140)), h = Math.max(12, n(options.height, 80));
    ctx.save(); ctx.translate(n(options.x, 0), n(options.y, 0)); ctx.rotate(n(options.angle, 0));
    ctx.shadowColor = 'rgba(39, 48, 41, .22)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 9;
    pillowShape(ctx, w, h); ctx.fillStyle = '#dbcbaa'; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    var linen = ctx.createLinearGradient(-w * 0.25, -h * 0.5, w * 0.25, h * 0.6);
    linen.addColorStop(0, '#fffdf0'); linen.addColorStop(0.43, '#f4efdc'); linen.addColorStop(0.8, '#e1d8bd'); linen.addColorStop(1, '#c7b994');
    pillowShape(ctx, w, h); ctx.fillStyle = linen; ctx.fill(); stroke(ctx, '#ccbea1', 1.2);
    ctx.save(); pillowShape(ctx, w, h); ctx.clip();
    var light = ctx.createRadialGradient(-w * 0.13, -h * 0.15, 2, -w * 0.13, -h * 0.15, w * 0.59);
    light.addColorStop(0, 'rgba(255,255,250,.62)'); light.addColorStop(1, 'rgba(255,255,250,0)');
    ctx.fillStyle = light; ctx.fillRect(-w, -h, w * 2, h * 2);
    for (var thread = -Math.ceil(h / 2); thread < h / 2; thread += 3.5) {
      ctx.beginPath(); ctx.moveTo(-w * 0.52, thread); ctx.lineTo(w * 0.52, thread - 0.3);
      stroke(ctx, 'rgba(144, 128, 100, .045)', 0.65);
    }
    for (thread = -Math.ceil(w / 2); thread < w / 2; thread += 4) {
      ctx.beginPath(); ctx.moveTo(thread, -h * 0.55); ctx.lineTo(thread, h * 0.55);
      stroke(ctx, 'rgba(255, 255, 250, .13)', 0.7);
    }
    ctx.restore();
    pillowShape(ctx, w * 0.94, h * 0.85); stroke(ctx, 'rgba(172, 154, 122, .6)', 0.9);
    ctx.save(); ctx.translate(0, -0.9);
    pillowShape(ctx, w * 0.935, h * 0.84); stroke(ctx, 'rgba(255,255,246,.92)', 1.1); ctx.restore();
    // Short corner creases describe stuffed linen without a button or cartoon face.
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sy) {
        ctx.beginPath(); ctx.moveTo(sx * w * 0.43, sy * h * 0.39);
        ctx.quadraticCurveTo(sx * w * 0.37, sy * h * 0.25, sx * w * 0.30, sy * h * 0.23);
        stroke(ctx, 'rgba(171, 154, 121, .26)', 1.1);
      });
    });
    ctx.restore();
  }

  function bag(ctx, options) {
    options = options || {};
    var zip = clamp(n(options.zipProgress, 0), 0, 1);
    var packed = options.packedImages || [];
    var sliderX = -110 + 230 * zip, sliderY = -50;
    if (options.slider) {
      sliderX = n(options.slider.x, n(options.x, 360) + sliderX) - n(options.x, 360);
      sliderY = n(options.slider.y, n(options.y, 385) + sliderY) - n(options.y, 385);
    }
    ctx.save(); ctx.translate(n(options.x, 360), n(options.y, 385));
    ellipse(ctx, 4, 95, 150, 23); ctx.fillStyle = 'rgba(20, 49, 50, .17)'; ctx.fill();
    var handle = function (shift, color) {
      ctx.beginPath(); ctx.moveTo(-75, -29 + shift);
      ctx.bezierCurveTo(-77, -163 + shift, 76, -163 + shift, 77, -29 + shift);
      stroke(ctx, '#164f56', 18);
      ctx.beginPath(); ctx.moveTo(-75, -29 + shift);
      ctx.bezierCurveTo(-77, -163 + shift, 76, -163 + shift, 77, -29 + shift);
      stroke(ctx, color, 12);
      ctx.beginPath(); ctx.moveTo(-72, -29 + shift);
      ctx.bezierCurveTo(-74, -153 + shift, 73, -153 + shift, 74, -29 + shift);
      stroke(ctx, 'rgba(187, 226, 214, .44)', 1.2);
    };
    handle(-7, '#357b7f');
    // Main body has a rounded, reinforced base and shaped end panels.
    ctx.beginPath(); ctx.moveTo(-128, -52);
    ctx.bezierCurveTo(-147, -27, -146, 49, -127, 78);
    ctx.bezierCurveTo(-88, 104, 84, 104, 127, 78);
    ctx.bezierCurveTo(147, 49, 147, -27, 128, -52);
    ctx.bezierCurveTo(72, -70, -73, -70, -128, -52); ctx.closePath();
    var fabric = ctx.createLinearGradient(-142, -45, 141, 93);
    fabric.addColorStop(0, '#549d9b'); fabric.addColorStop(0.32, '#347f81');
    fabric.addColorStop(0.72, '#286b71'); fabric.addColorStop(1, '#184f59');
    ctx.fillStyle = fabric; ctx.fill(); stroke(ctx, '#1b555b', 2.5);
    ctx.save(); ctx.clip();
    // Fine canvas threads are subtle enough to remain material, not a pattern.
    for (var thread = -60; thread < 100; thread += 4) {
      ctx.beginPath(); ctx.moveTo(-143, thread); ctx.lineTo(143, thread + 3);
      stroke(ctx, 'rgba(210, 238, 218, .045)', 0.7);
    }
    var glint = ctx.createRadialGradient(-70, -23, 5, -70, -23, 170);
    glint.addColorStop(0, 'rgba(178,224,205,.15)'); glint.addColorStop(1, 'rgba(178,224,205,0)');
    ctx.fillStyle = glint; ctx.fillRect(-150, -80, 300, 190);
    ctx.beginPath(); ctx.moveTo(-146, 61); ctx.bezierCurveTo(-87, 95, 83, 95, 146, 61);
    ctx.lineTo(146, 112); ctx.lineTo(-146, 112); ctx.closePath(); ctx.fillStyle = '#205963'; ctx.fill();
    ctx.restore();
    // Rounded end piping and a side access panel.
    ctx.beginPath(); ctx.moveTo(106, -47);
    ctx.bezierCurveTo(134, -29, 140, 48, 115, 80);
    stroke(ctx, 'rgba(14,65,72,.52)', 3.8);
    ctx.beginPath(); ctx.moveTo(103, -47);
    ctx.bezierCurveTo(131, -29, 137, 48, 112, 80);
    stroke(ctx, 'rgba(145,199,185,.56)', 1.5);
    ctx.beginPath(); ctx.moveTo(-112, -44);
    ctx.bezierCurveTo(-132, -15, -131, 48, -112, 77);
    stroke(ctx, 'rgba(175,215,198,.45)', 1.5);
    ctx.beginPath(); ctx.moveTo(-117, 70); ctx.bezierCurveTo(-64, 93, 68, 94, 116, 70);
    stroke(ctx, 'rgba(136,191,178,.45)', 1.2);

    // Pocket, stitched straps, and a small woven compass label.
    round(ctx, -65, -10, 130, 77, 13);
    var pocket = ctx.createLinearGradient(0, -10, 0, 68);
    pocket.addColorStop(0, '#3e8b8c'); pocket.addColorStop(1, '#286e75');
    ctx.fillStyle = pocket; ctx.fill(); stroke(ctx, '#235e65', 1.5);
    round(ctx, -61, -6, 122, 69, 10); stroke(ctx, 'rgba(181,218,201,.37)', 0.9);
    [-76, 76].forEach(function (x) {
      round(ctx, x - 7, -42, 14, 94, 4); ctx.fillStyle = '#225e65'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 4, -37); ctx.lineTo(x - 4, 46); stroke(ctx, '#72a79d', 0.9);
      ctx.beginPath(); ctx.moveTo(x + 4, -37); ctx.lineTo(x + 4, 46); stroke(ctx, 'rgba(13,61,68,.65)', 0.9);
      ellipse(ctx, x, -25, 2.7, 2.7); ctx.fillStyle = '#d5c699'; ctx.fill();
      ellipse(ctx, x, 40, 2.7, 2.7); ctx.fillStyle = '#c3b47e'; ctx.fill();
    });
    round(ctx, -20, 14, 40, 30, 6); ctx.fillStyle = '#e7ddbb'; ctx.fill(); stroke(ctx, '#1e6269', 1.3);
    ellipse(ctx, 0, 29, 9, 9); stroke(ctx, '#337c80', 1.4);
    ctx.beginPath(); ctx.moveTo(2, 20); ctx.lineTo(5, 33); ctx.lineTo(-2, 28); ctx.lineTo(-5, 25); ctx.closePath();
    ctx.fillStyle = '#c08446'; ctx.fill();

    // The opening actually disappears behind the part of the zipper already closed.
    ellipse(ctx, 0, -50, 130, 24);
    ctx.fillStyle = '#123e45'; ctx.fill(); stroke(ctx, options.hover ? '#c5e5c9' : '#76aaa0', options.hover ? 3 : 2);
    ctx.save(); ellipse(ctx, 0, -50, 127, 21.5); ctx.clip();
    var lining = ctx.createLinearGradient(0, -73, 0, -28);
    lining.addColorStop(0, '#123b42'); lining.addColorStop(1, '#2b6269');
    ctx.fillStyle = lining; ctx.fillRect(-132, -75, 264, 50);
    packed.forEach(function (entry, index) {
      var image = entry && entry.image ? entry.image : entry;
      if (!image || image.complete === false) return;
      var iw = n(image.naturalWidth, n(image.width, 0)), ih = n(image.naturalHeight, n(image.height, 0));
      if (!iw || !ih) return;
      var size = Math.min(72, 210 / Math.max(1, packed.length) + 12);
      var factor = size / Math.max(iw, ih), imageX = (index - (packed.length - 1) / 2) * Math.min(55, 185 / Math.max(1, packed.length));
      ctx.save(); ctx.translate(imageX, -47 + (index % 2) * 4); ctx.rotate((index % 2 ? 1 : -1) * 0.12);
      ctx.drawImage(image, -iw * factor / 2, -ih * factor / 2, iw * factor, ih * factor); ctx.restore();
    });
    if (zip > 0) {
      var closed = ctx.createLinearGradient(0, -75, 0, -25);
      closed.addColorStop(0, '#589c98'); closed.addColorStop(0.5, '#428887'); closed.addColorStop(1, '#2c7176');
      ctx.fillStyle = closed; ctx.fillRect(-133, -77, sliderX + 133, 54);
    }
    ctx.restore();
    // Front rim catches the same upper-left daylight as the bag shell.
    ctx.beginPath(); ctx.ellipse(0, -50, 130, 24, 0, 0, Math.PI);
    stroke(ctx, '#5c9c96', 5.5);
    ctx.beginPath(); ctx.ellipse(0, -50.5, 129, 23, 0, 0, Math.PI);
    stroke(ctx, 'rgba(179,217,198,.65)', 1.1);
    if (zip > 0) {
      ctx.beginPath(); ctx.moveTo(-110, -50); ctx.lineTo(-110 + 230 * zip, -50); stroke(ctx, '#174e58', 4.8);
      for (var tooth = -109; tooth < -110 + 230 * zip; tooth += 4) {
        ctx.beginPath(); ctx.moveTo(tooth, -52.1); ctx.lineTo(tooth + 1.2, -48.1); stroke(ctx, '#d9cba4', 1.25);
      }
    }
    // Second strap remains behind the mouth but its upper arc reads separately.
    ctx.save();
    ctx.beginPath(); ctx.rect(-100, -150, 200, 74); ctx.clip();
    handle(3, '#448c8a'); ctx.restore();
    // Slider uses the exact controller position when supplied, otherwise zipProgress.
    ctx.save(); ctx.translate(sliderX, sliderY);
    ctx.shadowColor = 'rgba(7,37,42,.32)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    round(ctx, -7, -5, 14, 10, 3); ctx.fillStyle = '#d8bf83'; ctx.fill(); stroke(ctx, '#785e35', 1.2);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.moveTo(1, 1); ctx.lineTo(4, 13); stroke(ctx, '#f0dfae', 4.5);
    round(ctx, -1, 7, 10, 18, 4); ctx.fillStyle = options.ready ? '#e9ac5d' : '#efbd77'; ctx.fill(); stroke(ctx, '#9b713f', 1.2);
    round(ctx, 2, 10, 4, 7, 1.8); ctx.fillStyle = '#376e70'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, -3); ctx.lineTo(3, -3); stroke(ctx, '#fff0c5', 1.2);
    ctx.restore();
    ctx.restore();
  }
  return { blanket: blanket, pillow: pillow, bag: bag };
}));
