'use strict';

// Reviewed room episode domain actions; no browser or learner data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'life-quest-data.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'room-adventure.js'), 'utf8'), context);
const reviewed = context.LifeQuestData;
const pool = reviewed.quests.find(quest => quest.id === 'life.sport.pool');
const api = context.RoomAdventure;
assert.equal(typeof api?.create, 'function', 'prototype exposes RoomAdventure.create');

const plain = value => JSON.parse(JSON.stringify(value));
const core = state => plain({
  stage: state.stage, placements: state.placements, blanket: state.blanket,
  pillow: state.pillow, packed: state.packed, zip: state.zip
});
const config = {
  items: reviewed.items,
  zones: reviewed.zones,
  pool,
  floor: {
    items: ['toy-car', 'teddy', 'dirty-shirt'],
    accepted: { 'toy-car': ['toybox'], teddy: ['toybox'], 'dirty-shirt': ['laundry'] },
    why: {
      'toy-car': 'Машинке удобнее в ящике для игрушек.',
      teddy: 'Мишка ждёт следующей игры в ящике для игрушек.',
      'dirty-shirt': 'Футболка после спорта по условию нуждается в стирке.'
    }
  }
};
const make = data => {
  const events = [];
  return { game: api.create(data || config, event => events.push(event)), events };
};
function action(game, name, payload, accepted = true) {
  const result = game.act(name, payload);
  assert.equal(result.accepted, accepted, `${name} ${JSON.stringify(payload)} accepted=${accepted}`);
  assert.equal(typeof result.stageChanged, 'boolean', `${name} reports stageChanged`);
  assert.equal(typeof result.message, 'string', `${name} gives child feedback`);
  return result;
}
function clearFloor(game, order = ['dirty-shirt', 'teddy', 'toy-car']) {
  order.forEach(id => action(game, 'dropFloor', { id, zone: id === 'dirty-shirt' ? 'laundry' : 'toybox' }));
  assert.equal(game.state.stage, 'bed');
}
function makeBed(game, order = [1, 0], pillowFirst = false) {
  if (pillowFirst) action(game, 'pillow');
  order.forEach(index => action(game, 'corner', { index }));
  if (!pillowFirst) action(game, 'pillow');
  assert.equal(game.state.stage, 'bag');
}
function readyForBag(game) {
  clearFloor(game);
  makeBed(game);
}

let checks = 0;
function test(label, fn) {
  fn();
  checks += 1;
  process.stdout.write(`✓ ${label}\n`);
}

test('floor drops reject the dirty shirt in the toybox and preserve position', () => {
  const { game, events } = make();
  const before = plain(game.state);
  const rejection = action(game, 'dropFloor', { id: 'dirty-shirt', zone: 'toybox' }, false);
  assert.ok(rejection.message.includes('стир'), 'feedback explains the shirt needs laundry');
  assert.deepEqual(plain(game.state.placements), before.placements);
  assert.equal(game.state.stage, 'floor');
  assert.equal(events.length, 0, 'rejected drops do not emit completion events');
  const result = action(game, 'dropFloor', { id: 'dirty-shirt', zone: 'laundry' });
  assert.equal(result.stageChanged, false);
  assert.ok(events.length > 0, 'accepted manipulation emits an event');
  clearFloorAfterShirt(game);
});

function clearFloorAfterShirt(game) {
  action(game, 'dropFloor', { id: 'toy-car', zone: 'toybox' });
  const transition = action(game, 'dropFloor', { id: 'teddy', zone: 'toybox' });
  assert.equal(transition.stageChanged, true, 'last floor item reports the scene transition');
  assert.equal(game.state.stage, 'bed');
}

test('floor items can be cleared in any order', () => {
  for (const order of [
    ['toy-car', 'teddy', 'dirty-shirt'],
    ['teddy', 'dirty-shirt', 'toy-car'],
    ['dirty-shirt', 'toy-car', 'teddy']
  ]) {
    const { game } = make();
    clearFloor(game, order);
    assert.equal(Object.keys(game.state.placements).length, 3);
  }
});

test('controller honors all reviewed alternatives supplied in a floor fixture', () => {
  const clothes = reviewed.quests.find(quest => quest.id === 'life.places.clothes');
  for (const zone of clothes.accepted['clean-shirt']) {
    const { game } = make({
      ...config,
      floor: { items: ['clean-shirt'], accepted: { 'clean-shirt': clothes.accepted['clean-shirt'] }, why: clothes.why }
    });
    action(game, 'dropFloor', { id: 'clean-shirt', zone });
    assert.equal(game.state.placements['clean-shirt'], zone);
    assert.equal(game.state.stage, 'bed');
  }
});

test('both blanket corners and the pillow are required, in either order', () => {
  for (const order of [[0, 1], [1, 0]]) {
    for (const pillowFirst of [true, false]) {
      const { game } = make();
      clearFloor(game);
      if (pillowFirst) action(game, 'pillow');
      action(game, 'corner', { index: order[0] });
      assert.equal(game.state.stage, 'bed', 'one corner never completes the bed');
      action(game, 'corner', { index: order[1] });
      if (!pillowFirst) {
        assert.equal(game.state.stage, 'bed', 'both corners still need the pillow');
        action(game, 'pillow');
      }
      assert.equal(game.state.stage, 'bag');
      assert.deepEqual(plain(game.state.blanket), [true, true]);
      assert.equal(game.state.pillow, true);
    }
  }
});

test('actions for later scenes and invalid corner indices cannot skip work', () => {
  const { game } = make();
  action(game, 'pack', { id: 'towel' }, false);
  action(game, 'corner', { index: 0 }, false);
  action(game, 'pillow', undefined, false);
  action(game, 'zip', undefined, false);
  assert.equal(game.state.stage, 'floor');
  clearFloor(game);
  action(game, 'corner', { index: -1 }, false);
  action(game, 'corner', { index: 2 }, false);
  assert.deepEqual(plain(game.state.blanket), [false, false]);
});

test('a school book is rejected with the existing pool explanation', () => {
  const { game, events } = make();
  readyForBag(game);
  const count = events.length;
  const result = action(game, 'pack', { id: 'math-book' }, false);
  assert.equal(result.message, pool.why['math-book']);
  assert.deepEqual(plain(game.state.packed), []);
  assert.equal(events.length, count);
});

test('zip is blocked until every required pool item is packed', () => {
  const { game } = make();
  readyForBag(game);
  for (const id of pool.required.slice(0, -1)) action(game, 'pack', { id });
  action(game, 'zip', undefined, false);
  assert.equal(game.state.stage, 'bag');
  assert.equal(game.state.zip, false);
  action(game, 'pack', { id: pool.required.at(-1) });
  assert.equal(game.state.stage, 'bag', 'packing is followed by an actual zip gesture');
  const result = action(game, 'zip');
  assert.equal(result.stageChanged, true);
  assert.equal(game.state.stage, 'done');
  assert.equal(game.state.zip, true);
});

test('goggles and water are accepted but never required', () => {
  for (const optional of [[], ['goggles'], ['water'], ['goggles', 'water']]) {
    const { game } = make();
    readyForBag(game);
    [...optional, ...pool.required.slice().reverse()].forEach(id => action(game, 'pack', { id }));
    action(game, 'zip');
    assert.equal(game.state.stage, 'done');
    assert.equal(game.state.packed.length, pool.required.length + optional.length);
  }
});

test('unpacking a required item makes the zip wait until it is returned', () => {
  const { game } = make();
  readyForBag(game);
  pool.required.forEach(id => action(game, 'pack', { id }));
  action(game, 'unpack', { id: 'towel' });
  assert.equal(game.state.packed.includes('towel'), false);
  action(game, 'zip', undefined, false);
  action(game, 'pack', { id: 'towel' });
  action(game, 'zip');
  assert.equal(game.state.stage, 'done');
});

test('render state cannot be mutated to skip the adventure', () => {
  const { game } = make();
  const view = game.state;
  try { view.stage = 'done'; view.packed.push('towel'); view.blanket[0] = true; } catch {}
  assert.equal(game.state.stage, 'floor');
  assert.deepEqual(plain(game.state.packed), []);
  assert.deepEqual(plain(game.state.blanket), [false, false]);
  assert.deepEqual(plain(game.getState()), plain(game.state));
});

test('prototype snapshots restore a valid partial scene without external storage', () => {
  const { game } = make();
  readyForBag(game);
  action(game, 'pack', { id: 'towel' });
  action(game, 'pack', { id: 'goggles' });
  const saved = plain(game.snapshot());
  assert.equal(saved.kind, 'RoomAdventurePrototype');
  assert.equal(saved.version, 1);
  const restored = make().game;
  assert.equal(restored.restore(saved).accepted, true);
  assert.deepEqual(core(restored.state), core(game.state));
  action(restored, 'pack', { id: 'swimwear' });
  assert.equal(game.state.packed.includes('swimwear'), false, 'restored instances are independent');
  const before = plain(restored.state);
  for (const malformed of [
    null, false, {}, { version: -1 }, 'bad-json',
    { ...saved, state: { ...saved.state, stage: 'done', zip: false } },
    { ...saved, state: { ...saved.state, packed: ['math-book'] } }
  ]) {
    assert.equal(restored.restore(malformed).accepted, false);
    assert.deepEqual(plain(restored.state), before, 'invalid snapshots preserve the current valid scene');
  }
});

test('reset starts a fresh prototype without real learner progress', () => {
  const { game } = make();
  readyForBag(game);
  action(game, 'pack', { id: 'water' });
  game.reset();
  assert.equal(game.state.stage, 'floor');
  assert.deepEqual(plain(game.state.placements), {});
  assert.deepEqual(plain(game.state.blanket), [false, false]);
  assert.equal(game.state.pillow, false);
  assert.deepEqual(plain(game.state.packed), []);
  assert.equal(game.state.zip, false);
});

process.stdout.write(`${checks} adventure controller checks passed.\n`);
