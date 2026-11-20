'use strict';
// Run with --ready after building trainer assets. Uses synthetic records and
// disposable Chromium profiles bound to an ephemeral localhost port only.

const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');

if (!process.argv.includes('--ready')) {
  console.log('Build the trainer assets and run this test with --ready.');
  return;
}

const root = path.resolve(__dirname, '..');
const out = process.env.ROOM_MISSION_REVIEW_DIR || '/workspace/scratch/ray-mission-qa';
fs.mkdirSync(out, {recursive:true});

const prefix = '/detskie-trenazhery/';
const ids = ['route','build','memory'];
const map = '[data-ray-map]';
const activeHost = '[data-ray-level-host]';
const mission = id => `[data-ray-mission="${id}"]`;
const available = page => page.locator(`${map} [data-ray-mission]`);
const checkpoint = (page,id) => page.evaluate(id => RayCampaign.snapshot().data.missions?.[id]?.snapshot, id);
const gameStatus = (page,id) => page.evaluate(id => RayCampaign.snapshot().data.missions?.[id], id);
const modules = page => page.evaluate(() => JSON.parse(localStorage.getItem('kubiki-progress-v1'))?.learning?.modules || {});
const roomStatus = page => page.evaluate(() => {
  const {unlocked,statuses,room} = RayCampaign.snapshot();
  return {unlocked,statuses,room};
});
const report = {success:false,checks:0,viewports:[],geometry:[],syntheticOnly:true,runtimeErrors:[]};
const ok = (actual,msg) => { assert.ok(actual,msg);report.checks++; };
const eq = (actual,expected,msg) => { assert.deepEqual(actual,expected,msg);report.checks++; };
const release = JSON.parse(fs.readFileSync(path.join(root,'trainer-build.json'),'utf8'));
const worker = fs.readFileSync(path.join(root,'sw.js'),'utf8');
const cryptoHash = body => createHash('sha256').update(body).digest('hex');
const localFilename = value => {
  const pathname = new URL(value, 'http://localhost/').pathname.slice(1);
  return !pathname || pathname.endsWith('/') ? pathname + 'index.html' : pathname;
};
const workerResources = JSON.parse(worker.match(/const CORE = (\[[\s\S]+?\]);/)[1]);
const filenames = new Set(['sw.js',...workerResources.map(localFilename)]);
const assets = new Map([...filenames].map(name => [name,fs.readFileSync(path.join(root,name))]));
for (const [name,hash] of Object.entries(release.sourceHashes)) assert.equal(cryptoHash(assets.get(name)),hash,`Build coherence for ${name}`);
assert.ok(worker.includes(`const VERSION = '${release.build}'`),'Worker version agrees with generated build');
report.build = release.build;

const mime = {'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8',
  '.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.webp':'image/webp',
  '.svg':'image/svg+xml','.mp3':'audio/mpeg'};
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) return res.writeHead(404).end();
  const name = localFilename(pathname.slice(prefix.length));
  const body = assets.get(name);
  if (!body) return res.writeHead(404).end();
  res.writeHead(200,{'Content-Type':mime[path.extname(name)] || 'application/octet-stream','Cache-Control':'no-store'}).end(body);
});

async function tap(page, selector, mode = 'mouse') {
  const target = page.locator(selector);
  await target.waitFor({state:'visible'});
  if (mode === 'touch') await target.tap();
  else if (mode === 'keyboard') { await target.focus(); await page.keyboard.press('Enter'); }
  else await target.click();
}

async function returnToMap(page, exit, mode) {
  await tap(page,exit,mode);
  await page.locator(map).waitFor({state:'visible'});
  eq(await page.evaluate(() => RayCampaign.snapshot().mission),null,'Map closes the mission');
  eq(new URL(page.url()).searchParams.get('room'),'campaign','Map navigation stays in campaign');
}

async function start(page,id,mode) {
  await tap(page,mission(id),mode);
  await page.locator(`${activeHost} .ray-mission`).waitFor({state:'visible'});
  eq(await page.evaluate(() => RayCampaign.snapshot().mission),id,`Opens mission ${id}`);
}

async function geometry(page,width,label) {
  const result = await page.locator(`${activeHost} .ray-mission`).evaluate(panel => {
    const buttons = [...panel.querySelectorAll('button:not(:disabled)')].flatMap(button => {
      if (button.getAttribute('aria-hidden') === 'true' || getComputedStyle(button).visibility !== 'visible') return [];
      const box = button.getBoundingClientRect();
      if (!box.width || !box.height) return [];
      return [{width:box.width,height:box.height,x:box.x,y:box.y,name:button.getAttribute('aria-label')||button.textContent.trim()}];
    });
    const overlap = [];
    for (const [index,a] of buttons.entries()) for (const b of buttons.slice(index+1)) {
      if (Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1 &&
          Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1) overlap.push([a.name,b.name]);
    }
    return {innerWidth,horizontal:document.documentElement.scrollWidth,buttons,overlap};
  });
  const clipped = result.buttons.filter(b => b.x < -1 || b.x + b.width > width + 1);
  const small = result.buttons.filter(b => b.width < 43.99 || b.height < 43.99);
  report.geometry.push({width,label,buttons:result.buttons.length,small,overlap:result.overlap,clipped});
  ok(result.buttons.length >= 2,`${label} has visible controls`);
  eq(result.innerWidth,width,'Device viewport is exact');
  ok(result.horizontal <= width+1,`No horizontal scroll at ${width}px for ${label}`);
  eq(clipped,[],`No clipped controls at ${width}px for ${label}`);
  eq(result.overlap,[],`No overlapping controls at ${width}px for ${label}`);
  eq(small,[],`Controls are at least 44px at ${width}px for ${label}`);
}

async function picture(page,width,label) {
  await page.locator(`${activeHost} .ray-mission`).screenshot({path:path.join(out,`${label}-${width}.png`),animations:'disabled'});
}

async function resume(page,base,id,mode,exit) {
  const saved = await checkpoint(page,id);
  ok(saved,`${id} checks a real persisted draft`);
  await returnToMap(page,exit,mode);
  await start(page,id,mode);
  eq(await checkpoint(page,id),saved,`${id} preserves exact draft after map visit`);
  await page.reload();
  await page.locator(map).waitFor({state:'visible'});
  eq(page.url(),base+'life/?room=campaign','Reload stays in campaign');
  await start(page,id,mode);
  eq(await checkpoint(page,id),saved,`${id} restores exactly after reload`);
}

const buildPiece = index => `[data-build-piece="${index}"]`;
const buildCell = index => `[data-build-cell="${index}"]`;
const buildAction = action => `[data-build-command="${action}"]`;
const buildStage = id => `[data-build-stage="${id}"]`;
const buildSolutions = [
  {id:'bridge',placements:[[1,1],[6,0],[8,0]]},
  {id:'rover',placements:[[8,0],[2,0],[7,0],[10,1],[20,1]]},
  {id:'landing',placements:[[0,1],[18,0],[16,1],[4,0],[14,1]]}
];

async function placeBuild(page,index,anchor,turns,mode) {
  await tap(page,buildPiece(index),mode);
  for (let n=0;n<turns;n++) await tap(page,buildAction('rotate'),mode);
  await tap(page,buildCell(anchor),mode);
}

async function playBuild(page,base,width,mode,full) {
  await start(page,'build',mode);
  await page.locator(buildStage('bridge')).waitFor({state:'visible'});
  await geometry(page,width,'build');
  await picture(page,width,'build');
  await tap(page,buildAction('check'),mode);
  ok((await page.locator('[data-build-feedback]').textContent()).includes('пустые'), 'An empty build is rejected');
  const initial = await checkpoint(page,'build');
  await tap(page,buildPiece(0),mode);
  await tap(page,buildCell(2),mode);
  eq(await checkpoint(page,'build'),initial,'A horizontal piece cannot cover cells outside a vertical blueprint');
  await tap(page,buildAction('rotate'),mode);
  await tap(page,buildCell(1),mode);
  await resume(page,base,'build',mode,buildAction('exit'));
  if (!full) await returnToMap(page,buildAction('exit'),mode);
  else {
    for (const [stage,{id,placements}] of buildSolutions.entries()) {
      await page.locator(buildStage(id)).waitFor({state:'visible'});
      if (stage > 0) await geometry(page,width,`build-${id}`);
      for (const [piece,[cell,turns]] of placements.entries()) {
        if (stage || piece) await placeBuild(page,piece,cell,turns,mode);
      }
      await tap(page,buildAction('check'),mode);
      if (stage < buildSolutions.length - 1) await tap(page,buildAction('next'),mode);
    }
    ok((await gameStatus(page,'build')).completed,'The three checked models complete the mission');
    await returnToMap(page,`.ray-mission__tools ${buildAction('exit')}`,mode);
  }
}

const memoryItem = id => `[data-memory-item="${id}"]`;
const memoryZone = id => `[data-memory-zone="${id}"]`;
const memoryAction = id => `[data-memory-action="${id}"]`;

async function playMemory(page,base,width,mode,full) {
  await start(page,'memory',mode);
  const puzzles = await page.evaluate(() => RoomMissionMemory.puzzles);
  ok(puzzles.length >= 3,'Memory has increasing puzzle variety');
  await geometry(page,width,'memory-study');
  await picture(page,width,'memory');
  for (const [index,puzzle] of puzzles.entries()) {
    await tap(page,memoryAction('hide'),mode);
    const changed = puzzle.items.filter(item => item.home !== item.moved);
    const wrong = puzzle.items.find(item => item.home === item.moved);
    ok(changed.length > 0 && wrong,'Memory puzzle includes unchanged distractors');
    await page.locator(`${memoryItem(wrong.id)}:enabled`).waitFor({state:'visible'});
    await geometry(page,width,`memory-find-${index+1}`);
    if (!index) {
      await tap(page,memoryItem(wrong.id),mode);
      await tap(page,memoryAction('check'),mode);
      eq((await checkpoint(page,'memory')).phase,'find','Incorrect memory check cannot advance');
      await tap(page,memoryItem(wrong.id),mode);
    }
    for (const item of changed) await tap(page,memoryItem(item.id),mode);
    if (!index) await resume(page,base,'memory',mode,memoryAction('exit'));
    await tap(page,memoryAction('check'),mode);
    await geometry(page,width,`memory-restore-${index+1}`);
    for (const item of changed) {
      await tap(page,memoryItem(item.id),mode);
      await tap(page,memoryZone(item.home),mode);
    }
    await tap(page,memoryAction('check'),mode);
    if (!full || index === puzzles.length-1) break;
    await tap(page,memoryAction('next'),mode);
  }
  if (full) ok((await gameStatus(page,'memory')).completed,'Finding every change and restoring the shelves completes the mission');
  const exit = full ? `.ray-mission__tools ${memoryAction('exit')}` : memoryAction('exit');
  await returnToMap(page,exit,mode);
}

const routeCell = index => `[data-route-cell="${index}"]`;
const routes = [
  [20,15,10,5,0,1,2,3,4],
  [24,23,18,17,12,11,10,5,0],
  [20,15,10,5,6,11,12,17,18,19,14,9,4]
];

async function playRoute(page,base,width,mode,full) {
  await start(page,'route',mode);
  await geometry(page,width,'route');
  await picture(page,width,'route');
  await tap(page,routeCell(15),mode);
  const initial = await checkpoint(page,'route');
  eq(initial.path,[20,15],'A neighboring tile is added');
  await tap(page,routeCell(4),mode);
  eq(await checkpoint(page,'route'),initial,'A distant tile cannot jump across obstacles');
  await tap(page,'[data-route-drive]',mode);
  eq(await checkpoint(page,'route'),initial,'Incomplete road cannot start a drive');
  await tap(page,'[data-route-undo]',mode);
  eq((await checkpoint(page,'route')).path,[20],'Undo removes exactly one route tile');
  await tap(page,routeCell(15),mode);
  await resume(page,base,'route',mode,'[data-route-exit]');
  if (!full) {
    await returnToMap(page,'[data-route-exit]',mode);
    return;
  }
  for (const [index,route] of routes.entries()) {
    for (const cell of route.slice(index ? 1 : 2)) await tap(page,routeCell(cell),mode);
    eq((await checkpoint(page,'route')).path,route,`Route ${index+1} contains exactly the chosen trail`);
    await tap(page,'[data-route-drive]',mode);
    if (!index && mode === 'mouse') {
      await page.waitForFunction(() => document.querySelector('.route-car').getAnimations().length > 0);
      ok(!(await checkpoint(page,'route')).arrived,'The motion runs before arrival is persisted');
    }
    await page.locator('[data-route-next]').waitFor({state:'visible'});
    ok((await checkpoint(page,'route')).arrived,'Driving the car persists its arrival');
    if (index < routes.length - 1) await tap(page,'[data-route-next]',mode);
  }
  ok((await gameStatus(page,'route')).completed,'Three arrivals complete Route');
  await returnToMap(page,'[data-route-next]',mode);
}

async function replayRoute(page) {
  const button = page.locator(mission('route'));
  ok((await button.textContent()).includes('Сыграть ещё'),'Completed mission exposes replay action');
  await start(page,'route');
  const firstTile = await page.locator('.route-mission [data-start]').getAttribute('data-route-cell');
  eq(firstTile,'20','Replay starts on the first route');
  await tap(page,routeCell(15));
  const status = await gameStatus(page,'route');
  ok(status.completed,'A fresh replay retains previous completion');
  eq(status.snapshot.path,[20,15],'Replay draft saves independently of best completion');
  await returnToMap(page,'[data-route-exit]');
}

async function checkMap(page,base,mode) {
  await page.goto(base+'life/');
  await page.locator('.room-launch[href="?room=campaign"]').waitFor({state:'visible'});
  eq(await page.locator('.room-launch').count(),1,'One campaign launcher appears in the catalog');
  await tap(page,'.room-launch',mode);
  await page.locator(map).waitFor({state:'visible'});
  eq(await page.locator('meta[name="trainer-build"]').getAttribute('content'),release.build,'The exact built release loaded');
  const actual = await available(page).evaluateAll(buttons => buttons.map(button => button.dataset.rayMission).sort());
  eq(actual,[...ids].sort(),'All three side missions are available on the existing map');
  eq((await roomStatus(page)).unlocked,['tidy'],'Side missions respect the initial original curriculum');
  await page.evaluate(() => localStorage.setItem('qa-unrelated','keep'));
}

async function runProfile(browser,base,width,mode,full) {
  const context = await browser.newContext({viewport:{width,height:920},isMobile:mode==='touch',hasTouch:mode==='touch',
    reducedMotion:full && mode === 'mouse' ? 'no-preference' : 'reduce',serviceWorkers:'block'});
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  const outside = [];
  await context.route('**/*',route => {
    if (route.request().url().startsWith(base)) return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });

  try {
    await checkMap(page,base,mode);
    const before = await roomStatus(page);
    const previousModules = await modules(page);
    await playRoute(page,base,width,mode,full);
    await playBuild(page,base,width,mode,full);
    await playMemory(page,base,width,mode,full);
    if (full) await replayRoute(page);
    eq(await roomStatus(page),before,'Side mission play leaves the original level state unchanged');
    eq(await page.evaluate(() => localStorage.getItem('qa-unrelated')),'keep','Unrelated progress key is preserved');
    const owner = await modules(page);
    const {['life-room-tidy']:tidy,...remaining} = owner;
    delete previousModules['life-room-tidy'];
    eq(remaining,previousModules,'Side missions preserve every unrelated storage module');
    for (const id of ids) ok(tidy.state.campaign.missions[id],`Existing tidy owner persisted ${id}`);
    eq(outside,[],'Only disposable localhost resources were requested');
    eq(errors,[],`No runtime errors at ${width}px`);
    report.viewports.push({width,mode,full});
  } catch (error) {
    await page.screenshot({path:path.join(out,`failure-${width}.png`),fullPage:true,timeout:3000}).catch(()=>{});
    throw error;
  } finally {
    report.runtimeErrors.push(...errors);
    await context.close();
  }
}

async function offline(browser,base) {
  const context = await browser.newContext({viewport:{width:390,height:920},reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror',error => errors.push(error.message));
  try {
    await page.goto(base);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller,undefined,{timeout:20000});
    await context.setOffline(true);
    const response = await page.goto(base+'life/?room=campaign');
    ok(response?.fromServiceWorker(),'Offline first visit is served by the installed worker');
    await page.locator(map).waitFor({state:'visible'});
    eq(await page.locator('meta[name="trainer-build"]').getAttribute('content'),release.build,'Installed PWA loads expected campaign offline');
    await start(page,'route','mouse');
    await tap(page,routeCell(15));
    eq((await checkpoint(page,'route')).path,[20,15],'Route accepts input on the first offline visit');
    await returnToMap(page,'[data-route-exit]','mouse');
    await start(page,'build','mouse');
    await placeBuild(page,0,1,1,'mouse');
    ok(await checkpoint(page,'build'),'Building accepts input on the first offline visit');
    await returnToMap(page,buildAction('exit'),'mouse');
    await start(page,'memory','mouse');
    await tap(page,memoryAction('hide'));
    const memory = await checkpoint(page,'memory');
    eq(memory.phase,'find','Memory accepts input on the first offline visit');
    await page.reload();
    await page.locator(map).waitFor({state:'visible'});
    await start(page,'memory','mouse');
    eq(await checkpoint(page,'memory'),memory,'Offline reload restores the observed memory phase');
    eq(errors,[],'No runtime errors on first offline campaign visit');
    report.offline = true;
  } finally { await context.close(); }
}

async function main() {
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  const base = `http://127.0.0.1:${server.address().port}${prefix}`;
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    for (const [width,mode,full] of [[390,'mouse',true],[320,'touch',true],[768,'keyboard',false]]) {
      await runProfile(browser,base,width,mode,full);
    }
    await offline(browser,base);
    report.success = true;
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => {
  report.error = error.stack;
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  fs.writeFileSync(path.join(out,'room-mission-browser-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,build:report.build,checks:report.checks,viewports:report.viewports,offline:report.offline}));
});
