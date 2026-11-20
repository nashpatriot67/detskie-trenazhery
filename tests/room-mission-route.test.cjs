const {test} = require('node:test');
const assert = require('node:assert/strict');
const Route = require('../room-mission-route.js');

const paths = [
  [20, 15, 10, 5, 0, 1, 2, 3, 4],
  [24, 23, 18, 17, 12, 11, 10, 5, 0],
  [20, 15, 10, 5, 6, 11, 12, 17, 18, 19, 14, 9, 4]
];

function choose(game, steps) {
  for (const cell of steps) assert.equal(game.choose(cell).changed, true, 'Could not select cell ' + cell);
}

function finish(game, stage) {
  choose(game, paths[stage].slice(1));
  assert.equal(game.driveError(), '');
  assert.equal(game.arrive(), true);
}

test('route accepts only neighboring open cells and lets a child undo or rethink a partial route', () => {
  const game = Route.create();
  assert.match(game.choose(16).message, /соседнюю/);
  assert.match(game.choose(19).message, /соседнюю/);
  choose(game, [15, 10]);
  assert.match(game.choose(11).message, /книга/);
  assert.deepEqual(game.snapshot().path, [20, 15, 10]);
  assert.match(game.driveError(), /гаража/);
  assert.equal(game.arrive(), false);
  assert.equal(game.next(), false);

  const restored = Route.create(game.snapshot());
  choose(restored, [5, 15]);
  assert.deepEqual(restored.snapshot().path, [20, 15]);
  assert.equal(restored.undo(), true);
  assert.equal(restored.undo(), false);
  choose(restored, [15, 10]);
  assert.equal(restored.clear(), true);
  assert.deepEqual(restored.snapshot().path, [20]);
});

test('the car can use multiple legal routes to the first garage', () => {
  const alternate = Route.create();
  choose(alternate, [21, 22, 23, 24, 19, 14, 9, 4]);
  assert.equal(alternate.arrive(), true);
  assert.equal(alternate.undo(), false);
  assert.equal(alternate.clear(), false);
  assert.equal(Route.valid(alternate.snapshot()), true);
});

test('later routes require the key and both flags in order', () => {
  const game = Route.create();
  finish(game, 0);
  assert.equal(game.next(), true);
  choose(game, [19, 14, 9, 4, 3, 2, 1]);
  assert.match(game.choose(0).message, /Ключ/);
  assert.match(game.driveError(), /Ключ/);
  assert.equal(game.clear(), true);
  finish(game, 1);
  assert.equal(game.next(), true);
  choose(game, [15, 10, 11, 12, 17]);
  assert.match(game.choose(18).message, /Флажок 1/);
  assert.equal(game.clear(), true);

  finish(game, 2);
  const completed = game.snapshot();
  assert.equal(Route.done(completed), true);
  assert.equal(game.next(), false);
  assert.deepEqual(Route.create(completed).snapshot(), completed);
  assert.deepEqual(completed.finished, paths.slice(0, 2));
});

test('a corrupted route cannot restore a completed puzzle', () => {
  const game = Route.create();
  for (const stage of [0, 1, 2]) {
    finish(game, stage);
    game.next();
  }
  const snapshot = game.snapshot();
  snapshot.finished[1] = [24, 19, 14, 9, 4, 3, 2, 1, 0];
  assert.equal(Route.valid(snapshot), false);
  assert.equal(Route.done(snapshot), false);
  assert.deepEqual(Route.create(snapshot).snapshot().path, [20]);
  assert.equal(Route.valid({...game.snapshot(), path: [20, 15, 20]}), false);
  assert.equal(Route.valid({...game.snapshot(), path: [20, 15]}), false);
  assert.equal(Route.valid({...game.snapshot(), version: 2}), false);
});
