'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const context = vm.createContext({});
for (const file of ['room-tidy-data.js', 'room-tidy-logic.js', 'room-adventure.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
}
const data = context.RoomTidyData;
const api = context.RoomTidyLogic;
const plain = value => JSON.parse(JSON.stringify(value));
let checks = 0;
function test(name, fn) { fn(); checks++; process.stdout.write(`✓ ${name}\n`); }
function make(rule = 'color') { return api.create({ episode: 'tidy', rule }); }
function act(game, type, payload, accepted = true) {
  const result = game.act(type, payload);
  assert.equal(result.accepted, accepted, `${type} ${JSON.stringify(payload)} accepted=${accepted}`);
  assert.equal(typeof result.stageChanged, 'boolean');
  assert.equal(typeof result.message, 'string');
  assert.ok(result.message.length);
  assert.equal(typeof result.effect, 'string');
  return result;
}
function search(game) {
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  const brick = data.searchItems.find(item => item.zones.includes('lego-tray'));
  act(game, 'drop', { id: shirt.id, zone: shirt.zones[0] });
  act(game, 'drop', { id: brick.id, zone: brick.zones[0] });
  act(game, 'find', { id: data.targetId });
  for (const item of data.searchItems.filter(item => ![shirt.id, brick.id].includes(item.id))) {
    act(game, 'drop', { id: item.id, zone: item.zones[0] });
  }
  assert.equal(game.state.stage, 'garage');
}
function garage(game) {
  for (const car of data.cars) {
    const slot = data.slots.find(slot => !Object.values(game.state.garage).includes(slot.id) && api.slotAccepts(car, slot, game.state.rule));
    assert.ok(slot, `empty matching slot for ${car.id}, rule=${game.state.rule}`);
    act(game, 'park', { id: car.id, slot: slot.id });
  }
  assert.equal(game.state.stage, 'lego');
}
function lego(game) {
  for (const item of data.legoItems) act(game, 'drop', { id: item.id, zone: item.zones[0] });
  assert.equal(game.state.stage, 'clothes');
}
function clothes(game) {
  for (const item of data.clothesItems) act(game, 'drop', { id: item.id, zone: item.zones[0] });
  assert.equal(game.state.stage, 'done');
}
function complete(game) { search(game); garage(game); lego(game); clothes(game); }
function progress(game) {
  const state = game.state;
  return plain({ stage: state.stage, search: state.search, found: state.found, garage: state.garage,
    lego: state.lego, clothes: state.clothes, rule: state.rule, realGoal: state.realGoal,
    selfReported: state.selfReported });
}

test('reviewed data has balanced cars, loose LEGO pieces, preserved models, and clothing alternatives', () => {
  assert.equal(data.searchItems.length, 5);
  assert.equal(data.cars.length, 12);
  assert.equal(data.slots.length, 12);
  for (const attr of ['color', 'type', 'size']) {
    const counts = new Map();
    for (const car of data.cars) counts.set(car[attr], (counts.get(car[attr]) || 0) + 1);
    assert.equal(counts.size, attr === 'color' ? 4 : 3);
    for (const count of counts.values()) assert.equal(count, attr === 'color' ? 3 : 4);
  }
  assert.equal(data.legoItems.length, 12);
  assert.equal(data.legoItems.filter(item => item.zones.includes('model-shelf')).length, 3);
  assert.equal(data.clothesItems.length, 8);
  assert.equal(data.clothesItems.filter(item => item.zones.includes('laundry')).length, 3);
  assert.equal(data.clothesItems.filter(item => item.zones.includes('drawer') && item.zones.includes('wardrobe')).length, 4);
});

for (const rule of ['color', 'type', 'size']) test(`${rule} rule completes all five stages with bounded snapshots`, () => {
  const game = make(rule);
  search(game);
  const wrongSlot = data.slots.find(slot => !api.slotAccepts(data.cars[0], slot, rule));
  act(game, 'park', { id: data.cars[0].id, slot: wrongSlot.id }, false);
  garage(game); lego(game); clothes(game);
  assert.equal(game.state.rule, rule);
  assert.equal(game.state.selfReported, false, 'virtual completion never reports a real room task');
  const snapshot = game.snapshot();
  assert.equal(snapshot.kind, 'RoomTidyAdventure');
  assert.equal(snapshot.version, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 48 * 1024);
  assert.ok(game.state.history.length <= 20);
  const resumed = make();
  assert.equal(resumed.restore(snapshot).accepted, true);
  assert.deepEqual(progress(resumed), progress(game));
});

test('covered brick and hidden target wait for the objects above them', () => {
  const game = make();
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  const brick = data.searchItems.find(item => item.zones.includes('lego-tray'));
  act(game, 'find', { id: data.targetId }, false);
  act(game, 'drop', { id: brick.id, zone: brick.zones[0] }, false);
  act(game, 'drop', { id: shirt.id, zone: shirt.zones[0] });
  act(game, 'find', { id: data.targetId }, false);
  act(game, 'drop', { id: brick.id, zone: brick.zones[0] });
  act(game, 'find', { id: data.targetId });
  assert.equal(game.state.found, true);
  assert.equal(game.state.stage, 'search', 'finding key alone does not sort the other floor objects');
});

test('wrong placement explains the rule without changing progress', () => {
  const game = make();
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  let before = progress(game);
  act(game, 'drop', { id: shirt.id, zone: 'toybox' }, false);
  assert.deepEqual(progress(game), before);
  search(game);
  const car = data.cars[0];
  const bad = data.slots.find(slot => !api.slotAccepts(car, slot, game.state.rule));
  before = progress(game);
  act(game, 'park', { id: car.id, slot: bad.id }, false);
  assert.deepEqual(progress(game), before);
  const matching = data.slots.filter(slot => api.slotAccepts(car, slot, game.state.rule));
  assert.ok(matching.length > 1, 'sorting accepts several matching spaces');
  act(game, 'park', { id: car.id, slot: matching[matching.length - 1].id });
  const sameColor = data.cars.find(item => item.id !== car.id && item.color === car.color);
  act(game, 'park', { id: sameColor.id, slot: matching[matching.length - 1].id }, false);
});

test('LEGO cannot be sent to the wrong box and assembled models stay assembled', () => {
  const game = make();
  search(game); garage(game);
  const model = data.legoItems.find(item => item.zones.includes('model-shelf'));
  const before = progress(game);
  act(game, 'drop', { id: model.id, zone: 'small-parts' }, false);
  assert.deepEqual(progress(game), before);
  act(game, 'drop', { id: model.id, zone: 'model-shelf' });
});

test('clean clothing accepts both reviewed storage alternatives', () => {
  for (const zone of ['drawer', 'wardrobe']) {
    const game = make();
    search(game); garage(game); lego(game);
    const alternative = data.clothesItems.find(item => item.zones.includes('drawer') && item.zones.includes('wardrobe'));
    act(game, 'drop', { id: alternative.id, zone });
    assert.equal(game.state.clothes[alternative.id], zone);
    const dirty = data.clothesItems.find(item => item.zones.includes('laundry'));
    act(game, 'drop', { id: dirty.id, zone: 'wardrobe' }, false);
  }
});

test('undo crosses stage boundaries, including the final completion', () => {
  const game = make();
  search(game);
  act(game, 'undo');
  assert.equal(game.state.stage, 'search');
  const missing = data.searchItems.find(item => !game.state.search[item.id]);
  act(game, 'drop', { id: missing.id, zone: missing.zones[0] });
  garage(game); lego(game); clothes(game);
  act(game, 'undo');
  assert.equal(game.state.stage, 'clothes');
  assert.equal(Object.keys(game.state.clothes).length, data.clothesItems.length - 1);
});

test('garage rule changes only before the first interaction and reset can choose a new rule', () => {
  const game = make();
  act(game, 'rule', { rule: 'type' });
  assert.equal(game.state.rule, 'type');
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  act(game, 'drop', { id: shirt.id, zone: shirt.zones[0] });
  act(game, 'rule', { rule: 'size' }, false);
  act(game, 'undo');
  act(game, 'rule', { rule: 'size' }, false);
  const resumed = make();
  assert.equal(resumed.restore(game.snapshot()).accepted, true);
  act(resumed, 'rule', { rule: 'size' }, false);
  game.reset({ rule: 'size' });
  assert.equal(game.state.stage, 'search');
  assert.equal(game.state.rule, 'size');
  assert.equal(Object.keys(game.state.search).length, 0);
});

test('real room self report requires an explicit action after virtual completion', () => {
  const game = make();
  const goal = data.realGoals[0];
  const id = typeof goal === 'string' ? goal : goal.id;
  act(game, 'real-goal', { id });
  act(game, 'real-done', {}, false);
  assert.equal(game.state.selfReported, false);
  complete(game);
  assert.equal(game.state.selfReported, false);
  act(game, 'real-done');
  assert.equal(game.state.selfReported, true);
  const resumed = make();
  assert.equal(resumed.restore(game.snapshot()).accepted, true);
  assert.equal(resumed.state.selfReported, true, 'explicit self report survives an honest snapshot');
  act(game, 'undo');
  assert.equal(game.state.selfReported, false);
});

test('snapshot and state accessors are detached and restore rejects impossible progress', () => {
  const game = make();
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  act(game, 'drop', { id: shirt.id, zone: shirt.zones[0] });
  const state = game.state;
  state.search.fake = 'toybox';
  assert.equal(game.state.search.fake, undefined);
  const saved = game.snapshot();
  const before = progress(game);
  const bads = [
    value => { value.version = 2; },
    value => { value.state.search.unknown = 'toybox'; },
    value => { value.state.found = true; },
    value => { value.state.stage = 'done'; },
    value => { value.state.selfReported = true; },
    value => { value.state.garage[data.cars[0].id] = data.slots[0].id; },
    value => { value.state.rule = 'weight'; },
    value => { value.state.unreviewed = true; }
  ];
  for (const mutate of bads) {
    const invalid = plain(saved);
    mutate(invalid);
    assert.equal(game.restore(invalid).accepted, false, 'invalid snapshot rejected');
    assert.deepEqual(progress(game), before, 'failed restore leaves existing progress intact');
  }
  assert.equal(game.restore(saved).accepted, true);
  saved.state.search.fake = 'toybox';
  assert.equal(game.state.search.fake, undefined);
});

test('restore rejects duplicate occupied slots and forged undo history', () => {
  const game = make();
  search(game); garage(game);
  const saved = game.snapshot();
  const duplicate = plain(saved);
  duplicate.state.garage[data.cars[1].id] = duplicate.state.garage[data.cars[0].id];
  assert.equal(game.restore(duplicate).accepted, false);
  const forged = plain(saved);
  const history = forged.state.history || forged.history;
  assert.ok(history.length);
  history[0].stage = 'done';
  assert.equal(game.restore(forged).accepted, false, 'invalid old states cannot fabricate progress through undo');
  const unrelated = plain(saved);
  const chain = unrelated.state.history || unrelated.history;
  chain[1] = plain(chain[0]);
  assert.equal(game.restore(unrelated).accepted, false, 'individually reachable history states must form actual adjacent actions');
});

test('search exposes only uncovered objects and the found target is removed', () => {
  const game = make();
  const shirt = data.searchItems.find(item => item.zones.includes('laundry'));
  const brick = data.searchItems.find(item => item.zones.includes('lego-tray'));
  assert.ok(!api.availableItems(game.state).includes(brick.id));
  assert.ok(!api.availableItems(game.state).includes(data.targetId));
  act(game, 'drop', { id: shirt.id, zone: shirt.zones[0] });
  assert.ok(api.availableItems(game.state).includes(brick.id));
  act(game, 'drop', { id: brick.id, zone: brick.zones[0] });
  assert.ok(api.availableItems(game.state).includes(data.targetId));
  act(game, 'find', { id: data.targetId });
  assert.ok(!api.availableItems(game.state).includes(data.targetId));
});

test('available car tray exposes at most three unplaced cars', () => {
  const game = make();
  search(game);
  const available = api.availableItems(game.state);
  assert.equal(available.length, 3);
  const ids = available.map(item => typeof item === 'string' ? item : item.id);
  assert.equal(new Set(ids).size, ids.length);
  const car = data.cars.find(item => item.id === ids[0]);
  const slot = data.slots.find(item => api.slotAccepts(car, item, game.state.rule));
  act(game, 'park', { id: car.id, slot: slot.id });
  assert.equal(api.availableItems(game.state).length, 3);
  assert.ok(!api.availableItems(game.state).some(item => (typeof item === 'string' ? item : item.id) === car.id));
});

test('legacy RoomAdventure factory delegates only the tidy episode', () => {
  const game = context.RoomAdventure.create({ episode: 'tidy', rule: 'size' });
  assert.equal(game.snapshot().kind, 'RoomTidyAdventure');
  const legacy = context.RoomAdventure.create({ pool: { required: ['towel'], optional: [] } });
  assert.equal(legacy.snapshot().kind, 'RoomAdventurePrototype');
  assert.equal(legacy.state.stage, 'floor');
});

process.stdout.write(`${checks} room tidy checks passed.\n`);
