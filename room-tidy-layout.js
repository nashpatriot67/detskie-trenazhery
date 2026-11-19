(function (root) {
  'use strict';

  // Coordinates use the same 720 × 720 world as the matching scene paintings.
  function place(id, x, y, w, h, dropX, dropY, labelY, lipY) {
    return {id, x, y, w, h, dropX, dropY, labelY, lipY};
  }

  const rooms = {
    search: [
      {...place('parking-tray', 65, 193, 172, 107, 151, 232, 318), itemSize: 48},
      place('toybox', 276, 195, 197, 82, 374, 229, 322, 237),
      place('laundry', 520, 170, 139, 88, 590, 202, 320, 208),
      place('lego-tray', 61, 400, 244, 86, 183, 438, 507, 456),
      place('bookshelf', 427, 409, 238, 91, 549, 464, 510)
    ],
    lego: [
      place('small-parts', 47, 230, 202, 108, 150, 284, 387, 318),
      place('large-parts', 267, 230, 182, 108, 357, 284, 387, 318),
      place('model-shelf', 476, 174, 215, 164, 584, 302, 388)
    ],
    clothes: [
      place('drawer', 34, 353, 236, 110, 152, 393, 498, 415),
      place('wardrobe', 302, 87, 225, 362, 415, 236, 498),
      place('laundry', 552, 280, 155, 127, 630, 327, 498, 349)
    ]
  };

  function cells(slots) {
    return slots.map(slot => ({
      ...slot,
      x: [145, 298, 450, 599][slot.col],
      y: [210, 318, 426][slot.row],
      baseY: [238, 344, 456][slot.row],
      w: 133,
      h: 91
    }));
  }

  function source(stage, id, index, favorite) {
    if (stage === 'search') {
      const pile = {x: 302, y: 620};
      if (id === 'dirty-shirt' || id === 'loose-brick' || id === favorite) return pile;
      return {
        teddy: {x: 626, y: 629},
        'toy-car': {x: 133, y: 611},
        storybook: {x: 454, y: 578}
      }[id];
    }
    return {x: 144 + index * 216, y: [625, 603, 632][index]};
  }

  root.RoomTidyLayout = Object.freeze({rooms, cells, source});
})(typeof window === 'undefined' ? globalThis : window);
