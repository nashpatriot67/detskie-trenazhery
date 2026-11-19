(function (root) {
  'use strict';

  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) { resolve(null); return; }
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
  }

  async function load() {
    const data = root.RoomTidyScene;
    const backgrounds = {};
    const sprites = {};
    const assets = [
      ...Object.entries(data.scenes).map(([id, src]) => ({id, src, table: backgrounds})),
      ...Object.entries(data.sprites).map(([id, src]) => ({id, src, table: sprites}))
    ];
    await Promise.all(assets.map(async ({id, src, table}) => {
      const image = await loadImage(src);
      if (image) table[id] = image;
    }));

    function spriteFor(item, folded) {
      if (item.kind === 'car') {
        const key = `${item.carType}-${item.colorName}`;
        return sprites[key] || sprites[item.id];
      }
      // The same picture would give the wrong stud count on a different brick.
      if (item.kind === 'brick') return item.cols === 2 && item.rows === 3 ? sprites.brick6 : null;
      if (item.kind === 'clothing' && item.folded && !folded && sprites[`${item.id}-loose`]) {
        return sprites[`${item.id}-loose`];
      }
      return sprites[item.id];
    }

    function sizeFor(item, size) {
      if (item.kind !== 'car') return size;
      return size * ({small: 0.73, medium: 0.86, large: 1}[item.sizeClass] || 1);
    }

    function drawItem(ctx, item, pose) {
      const image = spriteFor(item, pose.folded);
      if (!image) {
        root.RoomToyArt.drawItem(ctx, item, pose);
        return;
      }
      const size = sizeFor(item, pose.size || 120);
      const ratio = size / Math.max(image.width, image.height);
      const width = image.width * ratio;
      const height = image.height * ratio;
      ctx.save();
      ctx.translate(pose.x, pose.y);
      ctx.rotate(pose.angle || 0);
      ctx.scale(pose.flip ? -1 : 1, pose.squash || 1);
      const shadowY = height * 0.43 + (pose.lift || 0) * 0.18;
      ctx.save();
      ctx.translate(3, shadowY);
      ctx.scale(1, 0.25);
      const reach = width * 0.61;
      const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
      shadow.addColorStop(0, 'rgba(31, 20, 14, 0.46)');
      shadow.addColorStop(0.58, 'rgba(31, 20, 14, 0.27)');
      shadow.addColorStop(1, 'rgba(31, 20, 14, 0)');
      ctx.fillStyle = shadow;
      ctx.fillRect(-reach, -reach, 2 * reach, 2 * reach);
      ctx.restore();
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    }

    return {backgrounds, drawItem};
  }

  root.RoomTidyArtwork = Object.freeze({load});
})(typeof window === 'undefined' ? globalThis : window);
