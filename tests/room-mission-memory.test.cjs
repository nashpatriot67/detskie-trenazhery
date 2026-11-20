'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {puzzles, create, valid, done} = require('../room-mission-memory.js');

test('three scenes increase the number of changes and describe unique places', () => {
  assert.deepEqual(puzzles.map(puzzle => puzzle.changed.length), [1, 2, 3]);
  assert.equal(new Set(puzzles.map(puzzle => puzzle.scene)).size, puzzles.length);
  for (const puzzle of puzzles) {
    const zoneIds = puzzle.zones.map(entry => entry.id);
    assert.equal(new Set(zoneIds).size, zoneIds.length);
    if (puzzle.paintedZones) assert.deepEqual(puzzle.paintedZones.map(entry => entry.id), zoneIds);
    for (const obj of puzzle.items) {
      assert.ok(zoneIds.includes(obj.home));
      assert.ok(zoneIds.includes(obj.moved));
    }
  }
});

test('a wrong guess leaves the detective scene open for revision or a fresh look', () => {
  const game = create();
  assert.equal(game.act('mark', 'red-car'), false);
  assert.equal(game.act('hide'), true);
  assert.equal(game.act('mark', 'teddy'), true);
  assert.equal(game.act('check'), false);
  assert.deepEqual(game.snapshot().marked, ['teddy']);
  assert.equal(game.act('review'), true);
  assert.deepEqual(game.snapshot(), create().snapshot());
});

test('finding the changes alone cannot finish a scene', () => {
  const game = create();
  game.act('hide');
  game.act('mark', 'red-car');
  assert.equal(game.act('check'), true);
  assert.equal(game.snapshot().phase, 'restore');
  assert.equal(game.act('next'), false);
  assert.equal(game.act('place', 'teddy', 'toys'), false);
  assert.equal(game.act('place', 'red-car', 'bricks'), true);
  assert.equal(game.act('check'), false);
  assert.equal(game.act('undo'), true);
  assert.deepEqual(game.snapshot().placed, {});
  game.act('place', 'red-car', 'cars');
  assert.equal(game.act('check'), true);
  assert.equal(done(game.snapshot()), false);
  assert.equal(game.act('next'), true);
  assert.equal(game.snapshot().stage, 1);
});

test('all phases and placements restore from snapshots and complete in order', () => {
  let game = create();
  for (const [stage, puzzle] of puzzles.entries()) {
    assert.equal(game.snapshot().stage, stage);
    assert.equal(game.act('hide'), true);
    for (const id of puzzle.changed) game.act('mark', id);
    const findingDraft = game.snapshot();
    assert.ok(valid(findingDraft));
    game = create(findingDraft);
    assert.equal(game.act('check'), true);
    for (const obj of puzzle.items.filter(entry => puzzle.changed.includes(entry.id))) {
      assert.equal(game.act('place', obj.id, obj.home), true);
      const checkpoint = game.snapshot();
      assert.ok(valid(checkpoint));
      game = create(checkpoint);
      assert.deepEqual(game.snapshot(), checkpoint);
    }
    assert.equal(game.act('check'), true);
    assert.equal(done(game.snapshot()), stage === puzzles.length - 1);
    assert.equal(game.act('next'), stage < puzzles.length - 1);
  }
});

test('rejects malformed and unverifiable snapshots', () => {
  const initial = create().snapshot();
  assert.equal(valid({...initial, stage:3}), false);
  assert.equal(valid({...initial, phase:'find', marked:['red-car', 'red-car']}), false);
  assert.equal(valid({...initial, phase:'find', placed:{'red-car':'cars'}}), false);
  assert.equal(valid({...initial, phase:'restore', marked:['teddy']}), false);
  assert.equal(valid({...initial, phase:'restore', marked:['red-car'], placed:{'red-car':'attic'}}), false);
  assert.equal(valid({...initial, phase:'solved', marked:['red-car'], placed:{'red-car':'floor'}}), false);
  assert.deepEqual(create({...initial, version:999}).snapshot(), initial);
});
