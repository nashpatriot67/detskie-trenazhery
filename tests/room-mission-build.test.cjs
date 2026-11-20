'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {create, valid, done, puzzles} = require('../room-mission-build.js');

const solutions = [
  {anchors:[1,6,8],turns:[1,0,0]},
  {anchors:[8,2,7,10,20],turns:[0,0,0,1,1]},
  {anchors:[0,18,16,4,14],turns:[1,0,1,0,1]}
];

function solve(model,index,layout = solutions[index]) {
  assert.equal(model.task(),puzzles[index]);
  for (let piece = 0; piece < layout.anchors.length; piece++) {
    if (layout.turns[piece]) assert.equal(model.act('rotate',piece).ok,true);
    assert.equal(model.act('place',piece,layout.anchors[piece]).ok,true);
    assert.equal(valid(model.snapshot()),true);
  }
  assert.equal(model.act('check').ok,true);
}

test('three blueprints advance only after the footprint is checked', () => {
  const model = create();
  assert.deepEqual(puzzles.map(puzzle => puzzle.area),[7,12,22]);
  for (let index = 0; index < solutions.length; index++) {
    assert.equal(model.act('next').ok,false);
    solve(model,index);
    assert.equal(done(model.snapshot()),index === solutions.length - 1);
    if (!done(model.snapshot())) assert.equal(model.act('next').ok,true);
  }
  const completed = model.snapshot();
  assert.equal(model.act('next').ok,false);
  assert.equal(model.act('replay').ok,true);
  assert.equal(done(model.snapshot()),false);
  assert.equal(model.task().id,'bridge');
  assert.equal(done(completed),true);
});

test('rotation and fit give specific feedback and leave invalid actions out of history', () => {
  const model = create();
  const initial = model.snapshot();
  assert.match(model.act('check').text,/пустые кружки/);
  assert.match(model.act('place',0,2).text,/выходит за чертёж/);
  assert.deepEqual(model.snapshot(),initial);
  model.act('rotate',0);
  model.act('place',0,1);
  assert.match(model.act('place',1,1).text,/другая деталь/);
  model.act('place',1,6);
  assert.match(model.act('rotate',0).text,/тесно для поворота/);
  assert.deepEqual(model.snapshot().layout,{anchors:[1,6,null],turns:[1,0,0]});
});

test('resuming after rotation keeps exact poses and undo history', () => {
  const model = create();
  model.act('rotate',0);
  model.act('place',0,1);
  model.act('place',1,6);
  const checkpoint = model.snapshot();
  const resumed = create(checkpoint);
  assert.deepEqual(resumed.snapshot(),checkpoint);
  assert.equal(resumed.act('remove',0).ok,true);
  assert.equal(resumed.snapshot().layout.anchors[0],null);
  assert.equal(resumed.act('undo').ok,true);
  assert.deepEqual(resumed.snapshot(),checkpoint);
  assert.equal(resumed.act('undo').ok,true);
  assert.deepEqual(resumed.snapshot().layout,{anchors:[1,null,null],turns:[1,0,0]});
});

test('symmetrical pieces may be arranged differently and still close the blueprint', () => {
  const model = create();
  solve(model,0,{anchors:[1,8,6],turns:[1,0,0]});
  assert.equal(model.act('next').ok,true);
  solve(model,1,{anchors:[8,20,10,7,2],turns:[0,0,0,1,1]});
  assert.equal(model.act('next').ok,true);
  solve(model,2,{anchors:[16,4,0,18,14],turns:[1,0,1,0,1]});
  assert.equal(done(model.snapshot()),true);
});

test('forged completion, overlaps and bad coordinates are rejected', () => {
  const model = create();
  const forged = model.snapshot();
  forged.accepted = true;
  assert.equal(valid(forged),false);
  solve(model,0);
  model.act('next');
  const invalidProof = model.snapshot();
  invalidProof.proofs[0].anchors[1] = invalidProof.proofs[0].anchors[2];
  assert.equal(valid(invalidProof),false);
  const invalidAnchor = model.snapshot();
  invalidAnchor.layout.anchors[0] = -1;
  assert.equal(valid(invalidAnchor),false);
  const altered = model.snapshot();
  altered.version = 99;
  assert.equal(valid(altered),false);
});
