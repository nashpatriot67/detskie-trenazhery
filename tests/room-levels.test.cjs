const test = require('node:test');
const assert = require('node:assert/strict');
const Data = require('../room-levels-data.js');
const Logic = require('../room-levels-logic.js');

const drop = (game, itemId, targetId) => assert.equal(game.act('drop', {itemId, targetId}), true);
const choose = (game, itemId) => assert.equal(game.act('choose', {itemId}), true);
const remove = (game, itemId) => assert.equal(game.act('remove', {itemId}), true);

function check(game, expected) {
  assert.equal(game.act('check'), true);
  assert.equal(game.state.feedback.kind, expected ? 'success' : 'error');
  assert.equal(game.state.submitted, expected);
}

function next(game, expectedIndex) {
  check(game, true);
  assert.equal(game.state.complete, false);
  assert.equal(game.act('next'), true);
  assert.equal(game.state.stageIndex, expectedIndex);
  assert.deepEqual(game.state.placements, {});
  assert.deepEqual(game.state.selected, []);
}

function parkCars(game, rowAttribute) {
  const tidy = globalThis.RoomTidyData;
  const rows = rowAttribute === 'type' ? tidy.types : tidy.sizes;
  for (const item of tidy.cars) {
    const targetId = 'garage-' + rows.indexOf(item[rowAttribute]) + '-' + tidy.colors.indexOf(item.color);
    if (game.state.placements[item.id] !== targetId) drop(game, item.id, targetId);
  }
}

test('garage checks color and type even when every bay is occupied', () => {
  const game = Logic.create('garage');
  assert.deepEqual(Data.ids, ['garage', 'workshop', 'school']);
  assert.equal(game.availableItems().length, 12);
  assert.equal(game.act('next'), false);
  parkCars(game, 'type');

  drop(game, 'car-red-race', 'garage-0-1');
  assert.equal(game.state.placements['car-blue-race'], 'garage-0-0');
  check(game, false);
  assert.match(game.state.feedback.text, /цвет столбика/);
  assert.equal(game.act('undo'), true);
  assert.equal(game.state.placements['car-red-race'], 'garage-0-0');

  drop(game, 'car-red-race', 'garage-1-0');
  check(game, false);
  remove(game, 'car-red-race');
  assert.equal(game.availableItems().some(item => item.id === 'car-red-race'), true);
  parkCars(game, 'type');
  check(game, true);
  assert.equal(game.state.complete, true);
  assert.equal(game.act('next'), false);
});

test('garage size replay checks a different second attribute', () => {
  const game = Logic.create('garage', 'size');
  assert.equal(Logic.create('garage', 'missing'), null);
  assert.equal(Logic.create('constructor'), null);
  parkCars(game, 'type');
  check(game, false);
  parkCars(game, 'size');
  check(game, true);
  assert.equal(game.state.complete, true);
  assert.equal(Logic.create('garage').restore(game.snapshot()), false);
});

const bins = [
  'narrow-small', 'wide-small', 'wide-six', 'wide-eight', 'wide-ten',
  'narrow-small', 'wide-small', 'wide-six', 'wide-eight'
];

function fillWorkshop(game) {
  bins.forEach((target, index) => drop(game, 'brick-' + (index + 1), target));
  next(game, 1);
  drop(game, 'model-car', 'stand-car');
  drop(game, 'model-rocket', 'stand-rocket');
  drop(game, 'model-house', 'stand-house');
  next(game, 2);
}

function order(game, ids) {
  ids.forEach((id, index) => drop(game, id, 'position-' + (index + 1)));
}

test('workshop checks width and stud count, then tests the model stands', () => {
  const game = Logic.create('workshop');
  bins.forEach((target, index) => drop(game, 'brick-' + (index + 1), index === 0 ? 'wide-small' : target));
  check(game, false);
  assert.match(game.state.feedback.text, /ширину детали/);
  drop(game, 'brick-1', 'narrow-small');
  drop(game, 'brick-3', 'wide-eight');
  check(game, false);
  drop(game, 'brick-3', 'wide-six');
  next(game, 1);
  drop(game, 'model-house', 'stand-rocket');
  drop(game, 'model-car', 'stand-car');
  drop(game, 'model-rocket', 'stand-house');
  check(game, false);
  drop(game, 'model-house', 'stand-house');
  next(game, 2);
});

test('workshop accepts independent cleanup orders and rejects an early inspection', () => {
  const game = Logic.create('workshop');
  fillWorkshop(game);
  order(game, ['clear', 'boxes', 'sort', 'inspect', 'shelf']);
  check(game, false);
  assert.match(game.state.feedback.text, /Полку нужно проверить после/);
  drop(game, 'inspect', 'position-5');
  check(game, true);
  assert.equal(game.state.complete, true);

  game.reset();
  fillWorkshop(game);
  order(game, ['shelf', 'clear', 'boxes', 'sort', 'inspect']);
  check(game, true);
  assert.equal(game.state.complete, true);
});

const common = [
  'pencil-case', 'school-diary', 'change-shoes', 'shoe-bag', 'russian-book', 'russian-notebook', 'reading-book'
];
const tuesday = ['world-book', 'world-notebook', 'math-book', 'math-notebook'];
const sport = ['sport-uniform', 'sport-shoes', 'gym-socks'];
const pool = ['swimwear', 'swim-cap', 'towel', 'pool-slippers', 'shower-gel', 'pool-wet-bag', 'spare-underwear'];
const thursday = ['foreign-book', 'foreign-notebook', 'technology-folder', 'paper', 'glue', 'safe-scissors', 'music-folder'];

test('school packing distinguishes the shared set, Tuesday lessons, two bags and Thursday additions', () => {
  const game = Logic.create('school');
  const days = game.stages[0].schedule;
  assert.deepEqual(days.map(day => day.id), ['tue', 'thu']);
  for (const day of days) {
    assert.deepEqual(day.lessons.map(lesson => lesson.id),
      globalThis.LifeSchoolSchedule.day(day.id).lessons.map(lesson => lesson.id));
  }
  assert.equal(game.act('hint'), true);
  assert.match(game.state.feedback.text, /во вторник, и в четверг/);
  common.slice(1).forEach(id => choose(game, id));
  check(game, false);
  choose(game, 'pencil-case');
  choose(game, 'world-book');
  check(game, false);
  assert.match(game.state.feedback.text, /окружающего мира/);
  choose(game, 'world-book');
  next(game, 1);

  tuesday.forEach(id => choose(game, id));
  choose(game, 'russian-book');
  check(game, false);
  choose(game, 'russian-book');
  next(game, 2);

  sport.forEach(id => drop(game, id, 'sport-bag'));
  pool.forEach(id => drop(game, id, id === 'swim-cap' ? 'sport-bag' : 'pool-bag'));
  check(game, false);
  drop(game, 'swim-cap', 'pool-bag');
  drop(game, 'goggles', 'sport-bag');
  check(game, false);
  drop(game, 'goggles', 'pool-bag');
  drop(game, 'pencil-case', 'pool-bag');
  check(game, false);
  remove(game, 'pencil-case');
  next(game, 3);

  thursday.forEach(id => choose(game, id));
  choose(game, 'plasticine');
  check(game, false);
  choose(game, 'plasticine');
  check(game, true);
  assert.equal(game.state.complete, true);
  const reopened = Logic.create('school');
  assert.equal(reopened.restore(JSON.parse(JSON.stringify(game.snapshot()))), true);
  assert.equal(reopened.state.complete, true);
});

test('school pool goggles can stay at home', () => {
  const game = Logic.create('school');
  common.forEach(id => choose(game, id));
  next(game, 1);
  tuesday.forEach(id => choose(game, id));
  next(game, 2);
  sport.forEach(id => drop(game, id, 'sport-bag'));
  pool.forEach(id => drop(game, id, 'pool-bag'));
  next(game, 3);
});

test('saved drafts retain corrections and reject invalid stage or completion evidence', () => {
  const game = Logic.create('workshop');
  drop(game, 'brick-1', 'wide-six');
  drop(game, 'brick-2', 'wide-small');
  const saved = game.snapshot();
  game.state.placements['brick-2'] = 'wide-six';
  assert.equal(game.state.placements['brick-2'], 'wide-small');
  const reopened = Logic.create('workshop');
  assert.equal(reopened.restore(saved), true);
  assert.equal(reopened.state.placements['brick-1'], 'wide-six');
  assert.equal(reopened.state.canUndo, true);
  assert.equal(reopened.act('undo'), true);
  assert.deepEqual(reopened.state.placements, {'brick-1': 'wide-six'});
  saved.draft.placements['brick-1'] = 'wide-eight';
  assert.equal(reopened.state.placements['brick-1'], 'wide-six');
  assert.equal(reopened.restore({...saved, submitted: true}), false);
  assert.equal(reopened.restore({...saved, finished: [saved.draft]}), false);
  assert.equal(reopened.restore({...saved, finished: Array(1)}), false);
  assert.equal(reopened.restore({...saved, complete: true}), false);
  assert.equal(reopened.state.stageIndex, 0);

  const garage = Logic.create('garage');
  const snapshot = garage.snapshot();
  snapshot.draft.placements = {
    'car-red-race': 'garage-0-0',
    'car-red-offroad': 'garage-0-0'
  };
  assert.equal(garage.restore(snapshot), false);
});
