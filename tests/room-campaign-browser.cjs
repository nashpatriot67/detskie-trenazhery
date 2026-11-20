'use strict';
// Run with --ready after generating trainer assets. Uses only synthetic browser
// profiles, a disposable loopback origin, and native browser interactions.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

const root = path.resolve(__dirname,'..');
const out = process.env.ROOM_CAMPAIGN_REVIEW_DIR || '/workspace/scratch/ray-campaign-qa';
if (!process.argv.includes('--ready')) {
  console.log('Generate the trainer build, then run this browser test with --ready.');
  return;
}
fs.mkdirSync(out,{recursive:true});
const prefix = '/detskie-trenazhery/';
const progressKey = 'kubiki-progress-v1';
const tidyKey = 'life-room-tidy';
const map = '[data-ray-map]';
const advanced = '.ray-levels';
const stage = id => `${advanced}[data-level-stage="${id}"]`;
const level = id => `${map} .ray-chapter button[data-ray-level="${id}"]`;
const item = id => `[data-ri-item="${id}"]`;
const goal = id => `[data-ri-target="${id}"]`;
const classicItem = (kind,id) => `[data-rg-kind="${kind}"][data-rg-item="${id}"]`;
const classicGoal = id => `[data-rg-kind="zone"][data-rg-target="${id}"]`;
const command = name => `${advanced} [data-level-command="${name}"]`;
const tidy = require(path.join(root,'room-tidy-data.js'));
const {levels} = require(path.join(root,'room-levels-data.js'));
const pool = global.LifeQuestData.quests.find(quest => quest.id === 'life.sport.pool');
const report = {success:false, checks:0, viewports:[], geometry:[], runtimeErrors:[], syntheticProfilesOnly:true};
const fixtures = {};
const assertOk = (actual, message) => { assert.ok(actual, message); report.checks++; };
const assertEqual = (actual, expected, message) => { assert.deepEqual(actual, expected, message); report.checks++; };
const campaigns = page => page.evaluate(() => window.RayCampaign.snapshot());
const stored = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), progressKey);
const savedCampaign = raw => raw.learning.modules[tidyKey].state.campaign;
const json = value => JSON.parse(JSON.stringify(value));
const log = text => process.stdout.write(text + '\n');

const mime = {'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
  '.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server = http.createServer((req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) return res.writeHead(404).end();
    let name = url.pathname.slice(prefix.length);
    if (name === 'qa-seed.html') return res.writeHead(200, {'Content-Type':mime['.html']}).end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">');
    if (!name || name.endsWith('/')) name += 'index.html';
    const filename = path.resolve(root, name);
    if (!filename.startsWith(root + path.sep)) return res.writeHead(404).end();
    const body = fs.readFileSync(filename);
    return res.writeHead(200, {'Content-Type':mime[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'}).end(body);
  } catch (_) { return res.writeHead(404).end(); }
});

async function visible(page, selector) {
  await page.locator(selector).waitFor({state:'visible'});
}

async function tap(page, selector, mode = 'mouse') {
  const node = page.locator(selector);
  if (mode === 'keyboard') {
    await node.focus();
    await page.keyboard.press('Enter');
  } else if (mode === 'touch') {
    await node.tap();
  } else await node.click();
}

async function place(page, from, to, mode = 'mouse') {
  await tap(page, from, mode);
  await tap(page, to, mode);
}

async function mouseDrag(page, from, to) {
  const source = page.locator(from), destination = page.locator(to);
  await source.scrollIntoViewIfNeeded();
  await destination.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(), b = await destination.boundingBox();
  assertOk(a && b && a.y >= 0 && b.y >= 0, `Drag endpoints visible for ${from} → ${to}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps:10});
  await page.mouse.up();
}

async function saveScreenshot(page, width, id, selector) {
  await page.locator(selector).screenshot({path:path.join(out, `${id}-${width}.png`), animations:'disabled'});
}

async function geometry(page, width, label, selector) {
  const data = await page.locator(selector).evaluate(panel => {
    const relevant = [...panel.querySelectorAll('button:not(:disabled):not([aria-hidden="true"])')].map(button => {
      const {x,y,width,height} = button.getBoundingClientRect();
      return {id:button.dataset.riItem || button.dataset.riTarget || button.dataset.rayLevel || button.textContent.trim(),x,y,width,height};
    }).filter(button => button.width && button.height);
    const overlap = [];
    for (const [i, a] of relevant.entries()) for (const b of relevant.slice(i + 1)) {
      const dx = Math.min(a.x+a.width,b.x+b.width) - Math.max(a.x,b.x);
      const dy = Math.min(a.y+a.height,b.y+b.height) - Math.max(a.y,b.y);
      if (dx > 1 && dy > 1) overlap.push([a.id,b.id]);
    }
    return {relevant, overlap, pageWidth:document.documentElement.scrollWidth, innerWidth};
  });
  const small = data.relevant.filter(button => button.width < 43.99 || button.height < 43.99);
  const clipped = data.relevant.filter(button => button.x < -1 || button.x + button.width > data.innerWidth + 1);
  report.geometry.push({width,label,buttons:data.relevant.length,small,overlap:data.overlap,clipped});
  assertEqual(data.innerWidth,width,`Correct device viewport at ${width}`);
  assertOk(data.pageWidth <= width + 1,`No horizontal overflow at ${width} in ${label}, page width ${data.pageWidth}`);
  assertEqual(small,[],`44px targets at ${width} in ${label}`);
  assertEqual(clipped,[],`Native controls fit at ${width} in ${label}`);
  assertEqual(data.overlap,[],`Native controls do not overlap at ${width} in ${label}`);
}

async function mapCheck(page, expectedUnlocked, expectedComplete) {
  await visible(page,map);
  const state = await campaigns(page);
  assertEqual(state.active,null,'Return to map closes the active level');
  assertEqual(state.unlocked,expectedUnlocked,'Map unlock order');
  assertEqual(Object.keys(state.statuses).filter(id => state.statuses[id] === 'done'),expectedComplete,'Map completion status');
  const enabled = Object.keys(state.statuses).filter(id => expectedUnlocked.includes(id) && !expectedComplete.includes(id));
  assertEqual(await page.locator(`${map} .ray-chapter [data-ray-level]:enabled`).evaluateAll(controls => controls.map(el => el.dataset.rayLevel)),enabled,'Only the next unfinished chapter is playable');
  assertEqual(await page.locator(`${map} .ray-chapter :disabled`).count(),expectedComplete.length,'Completed chapter cards show disabled completion status');
  assertEqual(await page.locator(`${map} .ray-chapter-locked`).count(),Object.keys(state.statuses).length-expectedUnlocked.length,'Future chapters show a locked status');
}

async function waitTidy(page, expected) {
  await page.waitForFunction(expected => {
    const game = window.RayTidy?.snapshot();
    return game?.loaded && game.state.stage === expected && !game.transitioning && game.displayStage === expected;
  },expected);
}

async function waitClassic(page, expected) {
  await page.waitForFunction(expected => {
    const game = window.AdventureGame?.snapshot();
    return game?.loaded && game.state.stage === expected && !game.transitioning && game.displayStage === expected;
  },expected);
}

async function currentAdvanced(page,id) {
  return (await campaigns(page)).data.levels[id];
}

async function beginner(page, width) {
  await tap(page,level('tidy'));
  await waitTidy(page,'search');
  await tap(page,'[data-tidy-start]');
  await geometry(page,width,'search','#ray-tidy-game');
  await saveScreenshot(page,width,'search','#ray-tidy-game');
  assertEqual(await page.locator(item(tidy.targetId)).count(),0,'Covered favorite car has no active hit target');
  await place(page,item('dirty-shirt'),goal('toybox'));
  assertEqual((await campaigns(page)).room.state.search,{},'Wrong target leaves beginner search unchanged');
  await mouseDrag(page,item('dirty-shirt'),goal('laundry'));
  assertEqual((await campaigns(page)).room.state.search['dirty-shirt'],'laundry','Native drag clears the first cover');
  await place(page,item('loose-brick'),goal('lego-tray'));
  await tap(page,item(tidy.targetId));
  assertOk((await campaigns(page)).room.state.found,'Native selection reveals the favorite car after removing both covers');
  for (const entry of tidy.searchItems.slice(2)) await place(page,item(entry.id),goal(entry.zones[0]));
  await waitTidy(page,'garage');
  for (const car of tidy.cars) {
    const parked = (await campaigns(page)).room.state.garage;
    const slot = tidy.slots.find(entry => tidy.colors[entry.col] === car.color && !Object.values(parked).includes(entry.id));
    await place(page,item(car.id),goal(slot.id));
  }
  await waitTidy(page,'lego');
  for (const entry of tidy.legoItems) await place(page,item(entry.id),goal(entry.zones[0]));
  await waitTidy(page,'clothes');
  const lastClothing = tidy.clothesItems.at(-1);
  for (const entry of tidy.clothesItems.slice(0,-1)) await place(page,item(entry.id),goal(entry.zones[0]));
  fixtures.tidyFinish = await stored(page);
  await place(page,item(lastClothing.id),goal(lastClothing.zones[0]));
  await waitTidy(page,'done');
  assertEqual((await campaigns(page)).room.state.selfReported,false,'Virtual cleanup does not report a real action');
  assertOk(!await page.locator('[data-tidy-undo]').isVisible(),'Campaign locks cleanup when the completion is recorded');
  await tap(page,'[data-tidy-replay]');
  await mapCheck(page,['tidy','departure'],['tidy']);
  log('Beginner cleanup passed');

  await tap(page,level('departure'));
  await waitClassic(page,'bed');
  assertEqual(await page.locator('[data-rg-pip="floor"]').count(),0,'Campaign keeps the floor already cleared');
  await tap(page,'[data-rg-start]');
  await place(page,classicItem('pillow','pillow'),classicGoal('pillow-target'));
  for (const corner of ['corner-0','corner-1']) await place(page,classicItem('corner',corner),classicGoal(corner));
  await waitClassic(page,'bag');
  await saveScreenshot(page,width,'pool','#room-mission-play');
  await place(page,classicItem('zip','zip'),classicGoal('zip-end'));
  assertEqual((await campaigns(page)).statuses.departure,'part','Closing the empty bag does not finish the chapter');
  for (const id of pool.required) await place(page,classicItem('object',id),classicGoal('bag'));
  fixtures.departureFinish = await stored(page);
  await place(page,classicItem('zip','zip'),classicGoal('zip-end'));
  await waitClassic(page,'done');
  await tap(page,'[data-rg-replay]');
  await mapCheck(page,['tidy','departure','garage'],['tidy','departure']);
  fixtures.garage = await stored(page);
  fs.writeFileSync(path.join(out,'garage-unlocked.json'),JSON.stringify(fixtures.garage));
  log('Beginner departure passed');
}

function matchTarget(stageData, entry) {
  return stageData.targets.find(target => target.accepts ? target.accepts.includes(entry.id) :
    Object.entries(target.match).every(([key,value]) => entry[key] === value) &&
    (target.maxStuds === undefined || entry.studs <= target.maxStuds));
}

async function fillPlacement(page, stageData, excluded = []) {
  for (const entry of stageData.items.filter(entry => !excluded.includes(entry.id) && (!stageData.required || stageData.required.includes(entry.id)))) {
    await place(page,item(entry.id),goal(matchTarget(stageData,entry).id));
  }
}

async function garage(page,width) {
  await tap(page,level('garage'));
  const details = levels.garage.stages[0];
  await visible(page,stage(details.id));
  await geometry(page,width,details.id,stage(details.id));
  await saveScreenshot(page,width,details.id,stage(details.id));
  const [first,second] = details.items;
  const firstTarget = matchTarget(details,first);
  const sameColorWrongType = details.targets.find(target => target.col === firstTarget.col && target.row !== firstTarget.row);
  const wrongColor = details.targets.find(target => target.row === firstTarget.row && target.col !== firstTarget.col);
  for (const wrong of [sameColorWrongType,wrongColor]) {
    await place(page,item(first.id),goal(wrong.id));
    await tap(page,command('check'));
    assertEqual((await currentAdvanced(page,'garage')).submitted,false,'Garage checks both the row and column');
    assertEqual((await campaigns(page)).unlocked,['tidy','departure','garage'],'Wrong parking cannot unlock the workshop');
    await tap(page,command('undo'));
  }
  await place(page,item(first.id),goal(firstTarget.id));
  await place(page,item(second.id),goal(matchTarget(details,second).id));
  const checkpoint = await currentAdvanced(page,'garage');
  assertEqual(Object.keys(checkpoint.draft.placements).length,2,'Two accepted parking placements are in the checkpoint');
  assertEqual(savedCampaign(await stored(page)).levels.garage,checkpoint,'Advanced checkpoint and history saved exactly');
  await tap(page,command('exit'));
  await mapCheck(page,['tidy','departure','garage'],['tidy','departure']);
  assertEqual((await campaigns(page)).statuses.garage,'part','Map displays the saved garage as in progress');
  await page.reload();
  await visible(page,map);
  await tap(page,level('garage'));
  assertEqual(await currentAdvanced(page,'garage'),checkpoint,'Reload and reentry restore exact parking draft, state, and undo history');
  await tap(page,command('undo'));
  assertEqual((await currentAdvanced(page,'garage')).draft.placements,{[first.id]:firstTarget.id},'Restored undo applies to the last move');
  await fillPlacement(page,details,[first.id]);
  await tap(page,command('check'));
  assertEqual((await campaigns(page)).statuses.garage,'done','All twelve correctly sorted cars finish the garage');
  await tap(page,command('finish'));
  await mapCheck(page,['tidy','departure','garage','workshop'],['tidy','departure','garage']);
  fixtures.workshop = await stored(page);
  log('Garage progression and exact resume passed');
}

async function workshop(page,width) {
  await tap(page,level('workshop'));
  const [bricks,models,plan] = levels.workshop.stages;
  for (const details of [bricks,models]) {
    await visible(page,stage(details.id));
    await geometry(page,width,details.id,stage(details.id));
    await saveScreenshot(page,width,details.id,stage(details.id));
    await fillPlacement(page,details);
    await tap(page,command('check'));
    assertEqual((await campaigns(page)).statuses.workshop,'part','Completing one workshop stage leaves the level in progress');
    await tap(page,command('next'));
  }
  await visible(page,stage(plan.id));
  await geometry(page,width,plan.id,stage(plan.id));
  await saveScreenshot(page,width,plan.id,stage(plan.id));
  for (const [index,id] of ['boxes','clear','shelf','sort','inspect'].entries()) {
    await place(page,item(id),goal(`position-${index+1}`),'keyboard');
  }
  await tap(page,command('check'),'keyboard');
  assertEqual((await currentAdvanced(page,'workshop')).submitted,false,'Invalid plan order does not complete the workshop');
  await place(page,goal('position-1'),goal('position-2'),'keyboard');
  await tap(page,command('check'),'keyboard');
  assertEqual((await campaigns(page)).statuses.workshop,'done','Changing the first two positions validates the alternate plan');
  await tap(page,command('exit'));
  await mapCheck(page,['tidy','departure','garage','workshop','school'],['tidy','departure','garage','workshop']);
  fixtures.school = await stored(page);
  log('Workshop sorting, models, and keyboard planning passed');
}

async function choose(page,id) {
  const control = page.locator(`${advanced} ${goal(`choose:${id}`)}`);
  if (await control.count()) await control.click();
  else await tap(page,`${advanced} ${item(id)}`);
}

async function school(page,width) {
  await tap(page,level('school'));
  for (const details of levels.school.stages) {
    await visible(page,stage(details.id));
    if (details.id === 'sports') fixtures.sports = await stored(page);
    await geometry(page,width,details.id,stage(details.id));
    await saveScreenshot(page,width,details.id,stage(details.id));
    if (details.id === 'common') {
      await tap(page,`${stage(details.id)} [data-level-brief] > summary`);
      const body = await page.locator(stage(details.id)).innerText();
      assertOk(/вторник/i.test(body) && /четверг/i.test(body),'School presents both real comparison days');
      await tap(page,`${stage(details.id)} [data-level-brief] > summary`);
      const wrong = details.items.find(entry => !details.required.includes(entry.id));
      await choose(page,wrong.id);
      await tap(page,command('check'));
      assertEqual((await currentAdvanced(page,'school')).submitted,false,'Wrong common school item does not pass check');
      await choose(page,wrong.id);
    }
    if (details.type === 'selection') for (const id of details.required) await choose(page,id);
    else await fillPlacement(page,details);
    await tap(page,command('check'));
    assertEqual((await currentAdvanced(page,'school')).submitted,true,`${details.id} validates correct required items`);
    if (details !== levels.school.stages.at(-1)) await tap(page,command('next'));
  }
  await tap(page,command('exit'));
  const all = ['tidy','departure','garage','workshop','school'];
  await mapCheck(page,all,all);
  await page.reload();
  await mapCheck(page,all,all);
  await saveScreenshot(page,width,'completed-map',map);
  log('School schedule, packing, and full campaign passed');
}

async function seedRecord(page,base,raw,extras={}) {
  await page.goto(base+'qa-seed.html');
  await page.evaluate(({values}) => {
    for (const [key,value] of Object.entries(values)) localStorage.setItem(key,value);
  }, {values:{...extras,[progressKey]:JSON.stringify(raw)}});
}

async function touchBeginnerFinish(page,base) {
  await seedRecord(page,base,fixtures.tidyFinish);
  await page.goto(base+'life/?room=campaign');
  await tap(page,level('tidy'),'touch');
  await waitTidy(page,'clothes');
  await tap(page,'[data-tidy-start]','touch');
  const last = tidy.clothesItems.at(-1);
  await place(page,item(last.id),goal(last.zones[0]),'touch');
  await tap(page,'[data-tidy-replay]','touch');
  await mapCheck(page,['tidy','departure'],['tidy']);

  await seedRecord(page,base,fixtures.departureFinish);
  await page.goto(base+'life/?room=campaign');
  await tap(page,level('departure'),'touch');
  await waitClassic(page,'bag');
  await tap(page,'[data-rg-start]','touch');
  await place(page,classicItem('zip','zip'),classicGoal('zip-end'),'touch');
  await tap(page,'[data-rg-replay]','touch');
  await mapCheck(page,['tidy','departure','garage'],['tidy','departure']);
}

async function legacy(page,base) {
  require(path.join(root,'learning-progress.js'));
  require(path.join(root,'room-tidy-logic.js'));
  const Adventure = require(path.join(root,'room-adventure.js'));
  const LP = global.LearningProgress, generation = 'ray-campaign-browser';
  const tidyGame = Adventure.create({episode:'tidy'});
  tidyGame.act('drop',{id:'dirty-shirt',zone:'laundry'});
  const shortGame = Adventure.create({pool});
  for (const [id,zone] of [['toy-car','toybox'],['teddy','toybox'],['dirty-shirt','laundry']]) shortGame.act('dropFloor',{id,zone});
  shortGame.act('pillow');
  const basic = {stars:27, currentLesson:11, solved:{8:[0,1]}, read:[8], worksheet:{8:{0:'13'}}, resetEpoch:generation, customParent:{keep:'preserve'},learning:LP.empty(generation)};
  const wrappers = {
    'life-room-adventure':{version:1,adventure:shortGame.snapshot(),sound:false},
    [tidyKey]:{version:1,adventure:tidyGame.snapshot(),sound:true},
    'life-quests':{version:1,marker:'keep'}
  };
  for (const [id,state] of Object.entries(wrappers)) basic.learning = LP.setModule(basic.learning,id,state,{ownerId:'legacy-fixture',generation});
  const extras = {'detalki-progress-v1':'{"synthetic":"bricks keep"}','slovograd-v1':'{"synthetic":"russian keep"}','unrelated-test-key':'keep exactly'};
  await seedRecord(page,base,basic,extras);
  await page.goto(base+'life/?room=1');
  await waitClassic(page,'bed');
  assertEqual(await page.evaluate(() => AdventureGame.snapshot().state.pillow),shortGame.state.pillow,'Old direct short room resumes as before');
  await page.goto(base+'life/?room=tidy');
  await waitTidy(page,'search');
  assertEqual(await page.evaluate(() => RayTidy.snapshot().state.search),{ 'dirty-shirt':'laundry' },'Old direct tidy route loads the pre-campaign save');
  await page.goto(base+'life/?room=campaign');
  await mapCheck(page,['tidy'],[]);
  const imported = await campaigns(page);
  assertEqual(imported.room,tidyGame.snapshot(),'Campaign uses the pre-campaign tidy snapshot exactly');
  assertEqual(imported.data.departure,shortGame.snapshot(),'Campaign detects the pre-campaign departure checkpoint');
  await tap(page,level('tidy'));
  await waitTidy(page,'search');
  await tap(page,'[data-tidy-start]');
  await place(page,item('loose-brick'),goal('lego-tray'));
  const after = await stored(page);
  for (const key of Object.keys(basic).filter(key => key !== 'learning')) assertEqual(after[key],basic[key],`Top-level legacy field ${key} preserved`);
  assertEqual(Object.keys(after.learning.modules),Object.keys(basic.learning.modules),'Campaign does not add a storage module for legacy profiles');
  for (const key of Object.keys(wrappers).filter(key => key !== tidyKey)) assertEqual(after.learning.modules[key],basic.learning.modules[key],`Unrelated legacy module ${key} is exact`);
  assertEqual(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key,localStorage.getItem(key)])),Object.keys(extras)),extras,'Unrelated localStorage records are exact');
  assertOk(after.learning.modules[tidyKey].state.campaign,'Campaign is a field on the existing tidy wrapper');
  const campaignBefore = savedCampaign(after);
  await page.goto(base+'life/?room=tidy');
  await waitTidy(page,'search');
  await tap(page,'[data-tidy-start]');
  await tap(page,item(tidy.targetId));
  assertEqual(savedCampaign(await stored(page)),campaignBefore,'Writing through old direct tidy preserves campaign fields');
  log('Legacy routes and imported progress passed');
}

function browserContext(browser,width,mode) {
  return browser.newContext({viewport:{width,height:1100},hasTouch:mode === 'touch',isMobile:mode === 'touch',reducedMotion:'reduce',serviceWorkers:'block'});
}

async function runProfile(browser,width,mode,job) {
  const context = await browserContext(browser,width,mode);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  try { await job(page); }
  catch (error) {
    await page.screenshot({path:path.join(out,`failure-${width}.png`),fullPage:true,timeout:3000}).catch(() => {});
    const body = await page.locator('body').innerText().catch(() => '');
    log(body.slice(0,1200));
    throw error;
  } finally { await context.close(); report.runtimeErrors.push(...errors); }
  assertEqual(errors,[],`No browser page errors at ${width}`);
}

async function main() {
  await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    await runProfile(browser,390,'mouse',async page => {
      await page.goto(base+'life/');
      await visible(page,'.room-launch[href="?room=campaign"]');
      assertEqual(await page.locator('.room-launch').count(),1,'Life homepage has one Ray campaign launcher');
      assertEqual(await page.locator('.room-launch').getAttribute('href'),'?room=campaign','Life homepage points at the map');
      await tap(page,'.room-launch');
      await mapCheck(page,['tidy'],[]);
      report.build = await page.locator('meta[name="trainer-build"]').getAttribute('content');
      assertEqual(report.build,JSON.parse(fs.readFileSync(path.join(root,'trainer-build.json'),'utf8')).build,'Exact built assets loaded');
      await geometry(page,390,'map',map);
      await saveScreenshot(page,390,'map',map);
      await beginner(page,390);
      await garage(page,390);
      await workshop(page,390);
      await school(page,390);
    });
    report.viewports.push(390);
    await runProfile(browser,390,'mouse',page => legacy(page,base));
    for (const [width,mode] of [[320,'touch'],[768,'keyboard']]) {
      await runProfile(browser,width,mode,async page => {
        await page.goto(base+'life/?room=campaign');
        await mapCheck(page,['tidy'],[]);
        await geometry(page,width,'map',map);
        await saveScreenshot(page,width,'map',map);
        if (mode === 'touch') await touchBeginnerFinish(page,base);
        for (const id of ['garage','workshop','school']) {
          await seedRecord(page,base,fixtures[id]);
          await page.goto(base+'life/?room=campaign');
          await tap(page,level(id),mode);
          const details = levels[id].stages[0];
          await geometry(page,width,details.id,stage(details.id));
          await saveScreenshot(page,width,details.id,stage(details.id));
          if (details.type === 'placement') {
            await place(page,item(details.items[0].id),goal(matchTarget(details,details.items[0]).id),mode);
            assertEqual(Object.keys((await currentAdvanced(page,id)).draft.placements).length,1,`${mode} moves an advanced item`);
          } else {
            await tap(page,goal(`choose:${details.required[0]}`),mode);
            assertEqual((await currentAdvanced(page,id)).draft.selected,[details.required[0]],`${mode} selects a school item`);
          }
          await tap(page,command('exit'),mode);
          await visible(page,map);
        }
        await seedRecord(page,base,fixtures.sports);
        await page.goto(base+'life/?room=campaign');
        await tap(page,level('school'),mode);
        await geometry(page,width,'sports',stage('sports'));
        await saveScreenshot(page,width,'sports',stage('sports'));
      });
      report.viewports.push(width);
    }
    report.success = true;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { report.error = error.stack; console.error(error); process.exitCode=1; }).finally(() => {
  fs.writeFileSync(path.join(out,'ray-campaign-browser-report.json'),JSON.stringify(report,null,2));
  log(JSON.stringify({success:report.success,build:report.build,checks:report.checks,geometry:report.geometry.length,viewports:report.viewports}));
});
