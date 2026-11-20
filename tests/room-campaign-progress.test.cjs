'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const owner = 'kubiki-progress-v1';
const tidyModule = 'life-room-tidy';
const classicModule = 'life-room-adventure';
const generation = 'campaign-test';
const copy = value => JSON.parse(JSON.stringify(value));
const scripts = [
  'learning-progress.js', 'life-quest-data.js', 'life-school-schedule.js',
  'room-tidy-data.js', 'room-tidy-logic.js', 'room-adventure.js', 'room-progress.js',
  'room-levels-data.js', 'room-levels-logic.js',
  'room-mission-route.js', 'room-mission-build.js', 'room-mission-memory.js', 'room-campaign.js'
].map(filename => new vm.Script(fs.readFileSync(path.join(__dirname, '..', filename), 'utf8'), {filename}));

function fixture(memory = {records: new Map(), writes: []}) {
  const window = {
    location: {pathname: '/life/'},
    localStorage: {
      getItem(key) { return memory.records.get(key) ?? null; },
      setItem(key, value) {
        assert.equal(key, owner, 'Campaign uses the existing progress owner');
        memory.records.set(key, value);
        memory.writes.push(value);
      }
    }
  };
  const context = vm.createContext({window});
  scripts.forEach(script => script.runInContext(context));
  let child = null;
  const childMount = (id, options) => {
    child = {id, options};
    return {destroy() { child = null; }};
  };
  window.RoomTidyGame = {mount: (_, options) => childMount('tidy', options)};
  window.RoomGame = {
    assets: () => ({atlas: 'test-atlas'}),
    mount: (_, options) => childMount('departure', options)
  };
  window.RoomLevelsView = {mount: (_, options) => childMount(options.levelId, options)};
  for (const name of ['Route', 'Build', 'Memory']) {
    const key = 'RoomMission' + name;
    window[key] = {...window[key], mount: (_, options) => childMount(name.toLowerCase(), options)};
  }

  const warning = {};
  const heroButton = {focus() {}, closest: () => ({scrollIntoView() {}})};
  let onClick;
  const map = {
    querySelector(selector) {
      return selector === '[data-ray-warning]' ? warning : heroButton;
    },
    scrollIntoView() {},
    addEventListener(_, fn) { onClick = fn; },
    removeEventListener() { onClick = null; }
  };
  const scene = {replaceChildren() {}, scrollIntoView() {}};
  const host = {firstElementChild: {querySelector: selector => selector === '[data-ray-map]' ? map : scene}};
  return {
    window, memory, warning,
    raw: () => JSON.parse(memory.records.get(owner)),
    seed: record => memory.records.set(owner, JSON.stringify(record)),
    open: () => window.RoomCampaign.mount(host),
    inspect: () => copy(window.RayCampaign.snapshot()),
    child: () => child,
    click: id => onClick({target: {closest: selector => selector === '[data-ray-level]' ? {dataset: {rayLevel: id}} : null}}),
    clickMission: id => onClick({target: {closest: selector => selector === '[data-ray-mission]' ? {dataset: {rayMission: id}} : null}})
  };
}

function accepted(game, name, payload) {
  assert.equal(game.act(name, payload).accepted, true, name);
}

function tidyGame(window) {
  return window.RoomAdventure.create({episode: 'tidy'});
}

function finishTidy(window, game) {
  const data = window.RoomTidyData;
  for (const item of data.searchItems) {
    if (!game.state.search[item.id]) accepted(game, 'drop', {id: item.id, zone: item.zones[0]});
  }
  if (!game.state.found) accepted(game, 'find', {id: data.targetId});
  for (const car of data.cars) {
    const slot = data.slots.find(slot => game.slotAccepts(car.id, slot.id) && !Object.values(game.state.garage).includes(slot.id));
    accepted(game, 'park', {id: car.id, slot: slot.id});
  }
  for (const item of data.legoItems.concat(data.clothesItems)) {
    accepted(game, 'drop', {id: item.id, zone: item.zones[0]});
  }
  assert.equal(game.state.stage, 'done');
}

function poolQuest(window) {
  return window.LifeQuestData.quests.find(quest => quest.id === 'life.sport.pool');
}

function classicPartial(window) {
  const game = window.RoomAdventure.create({pool: poolQuest(window)});
  accepted(game, 'dropFloor', {id: 'toy-car', zone: 'toybox'});
  accepted(game, 'dropFloor', {id: 'teddy', zone: 'toybox'});
  accepted(game, 'dropFloor', {id: 'dirty-shirt', zone: 'laundry'});
  accepted(game, 'corner', {index: 0});
  assert.equal(game.state.stage, 'bed');
  return game;
}

function finishDeparture(window, game) {
  accepted(game, 'corner', {index: 1});
  accepted(game, 'pillow');
  for (const id of poolQuest(window).required) accepted(game, 'pack', {id});
  accepted(game, 'zip');
  assert.equal(game.state.stage, 'done');
}

function seedRecord(window, modules = {}) {
  const progress = window.LearningProgress;
  let learning = progress.empty(generation);
  const attempt = progress.attempt('synthetic.old', ['math.synthetic'], {generation});
  attempt.finalOutcome = 'correct';
  learning = progress.record(learning, attempt);
  learning = progress.setModule(learning, 'life-quests', {version: 3, opaque: ['keep']}, {ownerId: 'existing'});
  for (const [id, state] of Object.entries(modules)) {
    learning = progress.setModule(learning, id, state, {ownerId: 'existing'});
  }
  return copy({resetEpoch: generation, stars: 27, currentLesson: 11, solved: {8: [0, 1]}, learning});
}

const wrap = (adventure, sound = true) => ({version: 1, adventure, sound});
const campaign = overrides => ({version: 1, active: null, tidyFinished: false, departure: null, levels: {}, ...overrides});
const campaignStore = window => window.RoomProgress.create({episode: 'tidy', withCampaign: true});

test('legacy room and classic departure checkpoints continue into the same campaign and survive reload', () => {
  const first = fixture();
  const {window} = first;
  const tidy = tidyGame(window);
  accepted(tidy, 'drop', {id: 'dirty-shirt', zone: 'laundry'});
  const oldTidy = copy(tidy.snapshot());
  const departure = classicPartial(window);
  const oldDeparture = copy(departure.snapshot());
  const initial = seedRecord(window, {[tidyModule]: wrap(oldTidy), [classicModule]: wrap(oldDeparture)});
  first.seed(initial);
  first.memory.records.set('another-owner', 'unchanged');

  const mounted = first.open();
  assert.equal(first.memory.writes.length, 0, 'Opening the map reads storage');
  assert.deepEqual(first.inspect().unlocked, ['tidy']);
  assert.equal(first.inspect().statuses.tidy, 'part');
  assert.equal(first.inspect().statuses.departure, 'part');
  first.click('garage');
  assert.equal(first.child(), null);
  first.click('tidy');
  const tidyView = first.child().options;
  assert.deepEqual(copy(tidyView.store.read().snapshot), oldTidy);
  finishTidy(window, tidy);
  assert.equal(tidyView.store.save(tidy.snapshot(), {sound: true}), true);
  tidyView.onExit();
  assert.equal(tidyView.store.save(oldTidy), false, 'Closed child cannot write to the map');
  assert.deepEqual(first.inspect().unlocked, ['tidy', 'departure']);

  first.click('departure');
  const departureView = first.child().options;
  assert.equal(departureView.skipFloor, true);
  assert.deepEqual(copy(departureView.store.read().snapshot), oldDeparture);
  finishDeparture(window, departure);
  assert.equal(departureView.store.save(departure.snapshot()), true);
  departureView.onExit();
  assert.deepEqual(first.inspect().unlocked, ['tidy', 'departure', 'garage']);

  first.click('garage');
  const garage = window.RoomLevelsLogic.create('garage');
  assert.equal(garage.act('drop', {itemId: 'car-red-race', targetId: 'garage-0-1'}), true);
  assert.equal(first.child().options.store.save(garage.snapshot()), true);
  mounted.destroy();

  const reopened = fixture(first.memory);
  const secondMount = reopened.open();
  assert.deepEqual(reopened.inspect().statuses, {
    tidy: 'done', departure: 'done', garage: 'part', workshop: 'new', school: 'new'
  });
  assert.deepEqual(reopened.inspect().unlocked, ['tidy', 'departure', 'garage']);
  reopened.click('workshop');
  assert.equal(reopened.child(), null);
  reopened.click('garage');
  const garageView = reopened.child().options;
  const nextSnapshot = garageView.store.read().snapshot;
  assert.deepEqual(copy(nextSnapshot), copy(garage.snapshot()));
  const resumed = reopened.window.RoomLevelsLogic.create('garage');
  assert.equal(resumed.restore(nextSnapshot), true);
  assert.equal(resumed.act('undo'), true);
  assert.deepEqual(copy(resumed.state.placements), {});
  const data = reopened.window.RoomTidyData;
  for (const car of data.cars) {
    const targetId = 'garage-' + data.types.indexOf(car.type) + '-' + data.colors.indexOf(car.color);
    assert.equal(resumed.act('drop', {itemId: car.id, targetId}), true);
  }
  assert.equal(resumed.act('check'), true);
  assert.equal(resumed.state.complete, true);
  assert.equal(garageView.store.save(resumed.snapshot()), true);
  garageView.onExit();
  assert.deepEqual(reopened.inspect().unlocked, ['tidy', 'departure', 'garage', 'workshop']);
  secondMount.destroy();

  const saved = reopened.raw();
  assert.deepEqual(Object.keys(saved.learning.modules).sort(), Object.keys(initial.learning.modules).sort());
  assert.deepEqual(saved.learning.modules[classicModule], initial.learning.modules[classicModule]);
  assert.deepEqual(saved.learning.modules['life-quests'], initial.learning.modules['life-quests']);
  assert.deepEqual({...saved, learning: undefined}, {...initial, learning: undefined});
  assert.deepEqual({...saved.learning, modules: undefined}, {...initial.learning, modules: undefined});
  assert.equal(reopened.memory.records.get('another-owner'), 'unchanged');
});

test('campaign data is optional and standalone tidy writes preserve it', () => {
  const env = fixture();
  const {window} = env;
  const tidy = tidyGame(window).snapshot();
  env.seed(seedRecord(window, {[tidyModule]: wrap(tidy)}));
  const old = window.RoomProgress.create({episode: 'tidy'});
  assert.equal(Object.hasOwn(old.read(), 'campaign'), false);

  const store = campaignStore(window);
  assert.equal(store.read().campaign, null);
  const state = campaign({active: 'tidy'});
  assert.equal(store.save(tidy, {campaign: state, sound: true}), true);
  old.read();
  assert.equal(old.save(tidy, {sound: false}), true);
  const reopened = campaignStore(window);
  const loaded = reopened.read();
  assert.equal(loaded.sound, false);
  assert.deepEqual(copy(loaded.campaign), state);
  loaded.campaign.active = 'workshop';
  assert.deepEqual(copy(reopened.read().campaign), state);
});

test('invalid and incomplete campaign evidence cannot replace valid saved progress', () => {
  const env = fixture();
  const {window} = env;
  const tidy = tidyGame(window).snapshot();
  const emptyGarage = copy(window.RoomLevelsLogic.create('garage').snapshot());
  const partial = campaign({active: 'garage', levels: {garage: emptyGarage}});
  const store = campaignStore(window);
  assert.equal(store.save(tidy, {campaign: partial}), true);
  const before = env.memory.records.get(owner);

  for (const invalid of [
    {version: 1, levels: {}},
    campaign({version: 2}),
    campaign({active: 'unknown'}),
    campaign({levels: {garage: {...emptyGarage, submitted: true}}}),
    campaign({levels: {garage: {...emptyGarage, levelId: 'school'}}}),
    campaign({levels: {unknown: emptyGarage}}),
    campaign({departure: {...copy(classicPartial(window).snapshot()), state: {stage: 'done'}}})
  ]) {
    assert.equal(window.RoomCampaign.valid(invalid), false);
    assert.equal(store.save(tidy, {campaign: invalid}), false);
    assert.equal(env.memory.records.get(owner), before);
  }

  const corrupt = env.raw();
  corrupt.learning.modules[tidyModule].state.campaign.levels.garage.submitted = true;
  env.seed(corrupt);
  const corruptText = env.memory.records.get(owner);
  const reopened = campaignStore(window);
  assert.ok(reopened.read().error);
  assert.equal(reopened.save(tidy, {campaign: partial}), false);
  assert.equal(env.memory.records.get(owner), corruptText);
  const standalone = window.RoomProgress.create({episode: 'tidy'});
  assert.deepEqual(copy(standalone.read().snapshot), copy(tidy));
});

test('the eight-module limit protects other modules and an existing tidy slot can store the campaign', () => {
  const env = fixture();
  const {window} = env;
  const tidy = tidyGame(window).snapshot();
  const existing = Object.fromEntries(Array.from({length: 7}, (_, index) => [
    'synthetic-' + index, {version: 1, payload: index}
  ]));
  const full = seedRecord(window, existing);
  env.seed(full);
  const first = campaignStore(window);
  const before = env.memory.records.get(owner);
  assert.equal(first.save(tidy, {campaign: campaign()}), false);
  assert.equal(env.memory.records.get(owner), before);

  delete existing['synthetic-6'];
  const withTidy = seedRecord(window, {...existing, [tidyModule]: wrap(tidy)});
  env.seed(withTidy);
  const second = campaignStore(window);
  assert.equal(second.save(tidy, {campaign: campaign()}), true);
  const modules = env.raw().learning.modules;
  assert.equal(Object.keys(modules).length, 8);
  for (const [id, entry] of Object.entries(withTidy.learning.modules)) {
    if (id !== tidyModule) assert.deepEqual(modules[id], entry);
  }
});

test('optional games resume and replay using the existing progress slot', () => {
  const env = fixture();
  const {window} = env;
  const tidy = tidyGame(window).snapshot();
  const route = window.RoomMissionRoute.create();
  const existing = seedRecord(window, {[tidyModule]: wrap(tidy)});
  env.seed(existing);
  const active = env.open();
  env.clickMission('route');
  assert.equal(env.inspect().mission,'route');
  assert.equal(env.child().options.store.read().snapshot,null);

  const paths = [
    [15,10,5,0,1,2,3,4],
    [23,18,17,16,15,10,5,0],
    [15,10,5,6,7,12,17,18,19,14,9,4]
  ];
  assert.equal(route.choose(paths[0][0]).changed,true);
  assert.equal(env.child().options.store.save(route.snapshot()),true);
  active.destroy();

  const next = fixture(env.memory);
  const resumed = next.open();
  next.clickMission('route');
  const child = next.child().options;
  assert.deepEqual(copy(child.store.read().snapshot),copy(route.snapshot()));
  for (const [index, path] of paths.entries()) {
    for (const step of (index ? path : path.slice(1))) assert.equal(route.choose(step).changed,true);
    assert.equal(route.arrive(),true);
    if (index < 2) assert.equal(route.next(),true);
  }
  assert.equal(child.store.save(route.snapshot()),true);
  child.onExit();
  const beforeReplay = next.raw();
  assert.equal(beforeReplay.learning.modules[tidyModule].state.campaign.missions.route.completed,true);
  for (const [id, record] of Object.entries(existing.learning.modules)) {
    if (id !== tidyModule) assert.deepEqual(beforeReplay.learning.modules[id],record);
  }
  assert.deepEqual(beforeReplay.learning.modules[tidyModule].state.adventure,copy(tidy));
  assert.deepEqual(next.inspect().unlocked,['tidy']);
  next.clickMission('route');
  assert.equal(next.child().options.store.read().snapshot,null);
  assert.equal(next.inspect().data.missions.route.completed,true);
  assert.equal(next.child().options.store.save({version:1}),false);
  resumed.destroy();
});
