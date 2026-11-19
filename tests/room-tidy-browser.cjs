'use strict';
// Disposable localhost profiles and synthetic records only. The browser must
// operate the controls through native mouse, touch, or keyboard events.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.env.RAY_TIDY_REVIEW_DIR||'/workspace/scratch/ray-tidy-review',prefix='/detskie-trenazhery/',key='kubiki-progress-v1',moduleId='life-room-tidy';
const report={success:false,checks:0,mouseDrags:0,touchDrags:0,keyboardMoves:0,viewports:[],syntheticProfilesOnly:true,productionWrites:false,physicalDevices:false,limitations:['Chromium emulation does not replace physical iPhone, Safari, Huawei or Android testing.']};
const ok=(value,label)=>{assert.ok(value,label);report.checks++;},eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);report.checks++;};
const source=id=>`[data-ri-item="${id}"]`,target=id=>`[data-ri-target="${id}"]`,pause=(page,ms)=>page.waitForTimeout(ms),touchSessions=new WeakMap();
let seed,data;
function fixtures(){
 const context=vm.createContext({});
 for(const name of ['learning-progress.js','life-quest-data.js','life-school-schedule.js','school-packing-flow.js','life-quests.js','room-tidy-data.js','room-tidy-logic.js','room-adventure.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),context,{filename:name});
 let learning=context.LearningProgress.empty('tidy-browser-test');
 learning=context.LearningProgress.setModule(learning,'life-quests',context.LifeQuests.snapshot(context.LifeQuests.create({generation:'tidy-browser-test'})),{ownerId:'synthetic-fixture',generation:'tidy-browser-test'});
 const pool=context.LifeQuestData.quests.find(q=>q.id==='life.sport.pool');
 const classic=context.RoomAdventure.create({pool});classic.act('dropFloor',{id:'toy-car',zone:'toybox'});
 learning=context.LearningProgress.setModule(learning,'life-room-adventure',{version:1,adventure:classic.snapshot(),sound:false},{ownerId:'synthetic-classic',generation:'tidy-browser-test'});
 seed=JSON.parse(JSON.stringify({stars:27,currentLesson:11,resetEpoch:'tidy-browser-test',solved:{8:[0,1]},read:[8],worksheet:{8:{0:'13'}},customParentField:{keep:'synthetic unchanged'},learning}));
 data=JSON.parse(JSON.stringify(context.RoomTidyData));
}
const otherRecords={'detalki-progress-v1':'{"synthetic":"bricks keep"}','slovograd-v1':'{"synthetic":"russian keep"}','unrelated-test-key':'keep exactly'};
async function seedPage(page,base){await page.goto(base+'qa-seed.html');await page.evaluate(({key,seed,otherRecords})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(seed));for(const [k,v]of Object.entries(otherRecords))localStorage.setItem(k,v);},{key,seed,otherRecords});}
const raw=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),snapshot=page=>page.evaluate(()=>RayTidy.snapshot());
async function ready(page){await page.waitForFunction(()=>window.RayTidy?.snapshot()?.loaded===true,{},{timeout:30000});}
async function settle(page,stage){await page.waitForFunction(stage=>{const s=window.RayTidy?.snapshot();return s?.state.stage===stage&&!s.transitioning&&(!s.displayStage||s.displayStage===stage);},stage,{timeout:20000});await pause(page,40);}
async function center(page,selector){const el=page.locator(selector);await el.waitFor({state:'visible'});await el.scrollIntoViewIfNeeded();const r=await el.boundingBox();ok(r&&r.width>=44&&r.height>=44,'Native target at least 44px: '+selector);return{x:r.x+r.width/2,y:r.y+r.height/2};}
async function session(page){if(!touchSessions.has(page))touchSessions.set(page,await page.context().newCDPSession(page));return touchSessions.get(page);}
async function tap(page,selector,mode='mouse'){
 if(mode==='keyboard'){await page.locator(selector).focus();await page.keyboard.press('Enter');}
 else if(mode==='touch'){const at=await center(page,selector),s=await session(page);await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...at,id:1,radiusX:8,radiusY:8,force:1}]});await pause(page,25);await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else await page.locator(selector).click();
 await pause(page,50);
}
async function drag(page,from,to,mode='mouse',capture){
 if(mode==='keyboard'){await tap(page,from,mode);await tap(page,to,mode);report.keyboardMoves++;return;}
 const a=await center(page,from),b=await center(page,to);
 if(capture)await page.locator('#ray-tidy-game').screenshot({path:path.join(out,capture+'-before.png')});
 if(mode==='touch'){
  const s=await session(page);await s.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1,radiusX:8,radiusY:8,force:1}]});
  for(let i=1;i<=12;i++){await s.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/12,y:a.y+(b.y-a.y)*i/12,id:1,radiusX:8,radiusY:8,force:1}]});await pause(page,10);}
  if(capture)await page.locator('#ray-tidy-game').screenshot({path:path.join(out,capture+'-during.png')});
  await s.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});report.touchDrags++;
 }else{
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await pause(page,35);
  if(capture)await page.locator('#ray-tidy-game').screenshot({path:path.join(out,capture+'-during.png')});
  await page.mouse.up();report.mouseDrags++;
 }
 if(capture){await pause(page,100);await page.locator('#ray-tidy-game').screenshot({path:path.join(out,capture+'-after.png')});}
 await pause(page,50);
}
async function preserved(page){
 const value=await raw(page);
 for(const field of ['stars','currentLesson','resetEpoch','solved','read','worksheet','customParentField'])eq(value[field],seed[field],'Preserves old field '+field);
 for(const id of ['life-quests','life-room-adventure'])eq(value.learning.modules[id],seed.learning.modules[id],'Preserves original module '+id);
 const originalLearning={...seed.learning},actualLearning={...value.learning};delete originalLearning.modules;delete actualLearning.modules;eq(actualLearning,originalLearning,'Practice preserves every academic and real-life learning field');
 eq(Object.keys(value.learning.modules).filter(id=>id!==moduleId).sort(),Object.keys(seed.learning.modules).sort(),'Only the canonical tidy module may be added');
 eq(await page.evaluate(records=>Object.fromEntries(Object.keys(records).map(k=>[k,localStorage.getItem(k)])),otherRecords),otherRecords,'Other progress owners remain unchanged');
}
async function geometry(page,width,stage){
 const result=await page.locator('#ray-tidy-game').evaluate(root=>{
  const buttons=[...root.querySelectorAll('button')].filter(el=>!el.disabled&&el.getAttribute('aria-hidden')!=='true').map(el=>{const r=el.getBoundingClientRect(),css=getComputedStyle(el);return{id:el.dataset.riItem||el.dataset.riTarget||el.dataset.tidyRule||el.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height,visible:!!r.width&&!!r.height&&css.visibility!=='hidden'&&css.display!=='none'};}).filter(b=>b.visible),overlaps=[];
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([a.id,b.id]);}
  return{buttons,overlaps,overflow:document.documentElement.scrollWidth>innerWidth+1};
 });
 ok(!result.overflow,width+' '+stage+' no horizontal overflow');ok(result.buttons.every(b=>b.width>=44&&b.height>=44),width+' '+stage+' all controls at least 44px');eq(result.overlaps,[],width+' '+stage+' controls do not overlap');
 const regions=await page.evaluate(()=>RayTidy.regions());ok(Array.isArray(regions),'Real hit regions exposed');ok(regions.every(region=>region.width>=44&&region.height>=44),width+' '+stage+' real hit regions are at least 44px');
 const mismatch=await page.evaluate(()=>RayTidy.regions().some(region=>{const button=[...document.querySelectorAll('#ray-tidy-game [data-ri-item],#ray-tidy-game [data-ri-target]')].find(el=>region.item?el.dataset.riItem===region.item:el.dataset.riTarget===region.target);if(!button)return true;const box=button.getBoundingClientRect();return ['x','y','width','height'].some(key=>Math.abs(box[key]-region[key])>.01);}));ok(!mismatch,'Region inspection matches actual native DOM control rectangles');
 report.geometry=report.geometry||[];report.geometry.push({width,stage,controls:result.buttons.length,regions:regions.length});
}
async function picture(page,width,stage){await page.locator('#ray-tidy-game').screenshot({path:path.join(out,stage+'-'+width+'.png')});}
async function start(page,mode){await tap(page,'[data-tidy-start]',mode);await settle(page,(await snapshot(page)).state.stage);}
async function keyboardTab(page,selector){await page.keyboard.press('Tab');for(let i=0;i<80;i++){if(await page.locator(selector).evaluate(el=>document.activeElement===el))return ok(true,'Control reachable by native Tab navigation');await page.keyboard.press('Tab');}ok(false,'Control unreachable by native Tab: '+selector);}
function comparable(state){const value=JSON.parse(JSON.stringify(state));delete value.message;delete value.messages;return value;}
async function rejected(page,from,to,mode,label){const before=comparable((await snapshot(page)).state);await drag(page,source(from),target(to),mode);eq(comparable((await snapshot(page)).state),before,label);}
async function motion(page){
 const before=await snapshot(page);await pause(page,130);const after=await snapshot(page);ok(after.frames>before.frames,'Visible started game paints animation frames');
 if(after.reducedMotion){ok(after.actor&&before.actor,'Reduced-motion actor is observable');eq({x:after.actor.x,y:after.actor.y,moving:after.actor.moving},{x:before.actor.x,y:before.actor.y,moving:false},'Reduced motion keeps the idle actor stationary');}
 // Moving the game out of the viewport is a reversible test fixture only.
 await page.locator('#ray-tidy-game').evaluate(el=>{el.dataset.qaMargin=el.style.marginTop;el.style.marginTop=(innerHeight+100)+'px';});await page.evaluate(()=>scrollTo(0,0));
 await page.waitForFunction(()=>RayTidy.snapshot().visible===false);const hidden=await snapshot(page);await pause(page,140);eq((await snapshot(page)).frames,hidden.frames,'Offscreen game suspends painting');
 await page.locator('#ray-tidy-game').evaluate(el=>{el.style.marginTop=el.dataset.qaMargin;delete el.dataset.qaMargin;});await page.locator('#ray-tidy-game').scrollIntoViewIfNeeded();await page.waitForFunction(()=>RayTidy.snapshot().visible===true);report.motion={offscreenPause:true,reducedMotionObserved:!!after.reducedMotion};
}
function accepts(car,slot,rule){return rule==='color'?data.colors[slot.col]===car.color:(rule==='type'?data.types:data.sizes)[slot.row]===car[rule];}
async function keyBlocked(page,label){const el=page.locator(source(data.targetId));ok(!await el.count()||!await el.isVisible()||!await el.isEnabled(),label);}
async function selectThenPlace(page,id,zone,mode){await tap(page,source(id),mode);await tap(page,target(zone),mode);}
async function playEpisode(page,base,width,mode){
 await seedPage(page,base);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.__qaInput=[];for(const type of ['pointerdown','pointermove','pointerup','keydown'])document.addEventListener(type,event=>{if(event.target.closest?.('#ray-tidy-game'))__qaInput.push({type,pointerType:event.pointerType,key:event.key,trusted:event.isTrusted});},true);});
 await page.goto(base+'life/?room=tidy');await ready(page);eq(await page.locator('meta[name="trainer-build"]').getAttribute('content'),report.build,'Exact frozen build loaded');
 eq((await snapshot(page)).state.stage,'search','New episode begins with search');eq((await snapshot(page)).started,false,'Explicit Start required');const initialFrames=(await snapshot(page)).frames;await pause(page,120);eq((await snapshot(page)).frames,initialFrames,'No animation loop before Start');await preserved(page);await geometry(page,width,'intro');await picture(page,width,'intro');
 if(mode==='keyboard')await keyboardTab(page,'[data-tidy-start]');
 const rule=width===390?'color':width===320?'type':'size';
 if(rule!=='color'){await tap(page,'[data-tidy-rule="'+rule+'"]',mode);eq((await snapshot(page)).state.rule,rule,'Native rule choice '+rule);}
 await start(page,mode);await geometry(page,width,'search');await picture(page,width,'search');await keyBlocked(page,'Covered key is not interactive before shirt removal');
 await rejected(page,'dirty-shirt','toybox',mode,'Wrong search destination does not advance');
 await drag(page,source('dirty-shirt'),target('laundry'),mode,width===390?'animated-search-drag':null);eq((await snapshot(page)).state.search['dirty-shirt'],'laundry','Native input clears top cover');await keyBlocked(page,'Key remains blocked by brick after shirt removal');
 const beforeHint=comparable((await snapshot(page)).state);await tap(page,'[data-tidy-hint]',mode);ok(await page.locator('[data-tidy-help]').isVisible(),'Hint opens immediately after a native gesture');eq(comparable((await snapshot(page)).state),beforeHint,'Hint does not advance the activity');await tap(page,'[data-tidy-hint]',mode);ok(!await page.locator('[data-tidy-help]').isVisible(),'Hint closes through the same native control');
 ok((await raw(page)).learning.modules[moduleId],'Meaningful input saves into canonical tidy module');await preserved(page);
 const partial=comparable((await snapshot(page)).state);await page.reload();await ready(page);eq(comparable((await snapshot(page)).state),partial,'Reload resumes exact partial state and undo history');eq((await snapshot(page)).started,false,'Reload waits for explicit Start');await start(page,mode);
 // A fresh genuine pointerdown must clear suppression left by the earlier drag.
 await selectThenPlace(page,'loose-brick','lego-tray',mode);eq((await snapshot(page)).state.search['loose-brick'],'lego-tray','Rapid selection and destination work after native dragging');
 const keyButton=page.locator(source(data.targetId));ok(await keyButton.isVisible()&&await keyButton.isEnabled(),'Favorite car becomes interactive only after both covers clear');
 const historyBeforeFind=(await snapshot(page)).state.history.length;
 if(width===390)await drag(page,source(data.targetId),target('parking-tray'),mode);else await tap(page,source(data.targetId),mode);
 eq((await snapshot(page)).state.found,true,'Native input discovers the exposed favorite car');eq((await snapshot(page)).state.history.length,historyBeforeFind+1,'Finding the favorite car records exactly one action');ok((await page.locator('[data-tidy-feedback]').innerText()).includes('Вот любимая'),'Finishing the discovery gesture retains positive found feedback');
 for(const id of ['teddy','toy-car','storybook']){const item=data.searchItems.find(item=>item.id===id);await drag(page,source(id),target(item.zones[0]),mode);eq((await snapshot(page)).state.search[id],item.zones[0],'Search placement '+id);}
 await settle(page,'garage');await geometry(page,width,'garage');await picture(page,width,'garage');
 await tap(page,'[data-tidy-undo]',mode);await settle(page,'search');eq((await snapshot(page)).state.search.storybook,undefined,'Undo crosses garage boundary into search');await drag(page,source('storybook'),target('bookshelf'),mode);await settle(page,'garage');
 await motion(page);
 let firstSlot;
 for(const car of data.cars){
  const before=(await snapshot(page)).state,free=data.slots.filter(slot=>!Object.values(before.garage).includes(slot.id)),valid=free.filter(slot=>accepts(car,slot,rule)).reverse();ok(valid.length>0,'Matching empty garage cell remains for '+car.id);
  if(!Object.keys(before.garage).length){const wrong=free.find(slot=>!accepts(car,slot,rule));await rejected(page,car.id,wrong.id,mode,'Nonmatching garage cell does not advance');firstSlot=valid[0].id;}
  else if(Object.keys(before.garage).length===1)await rejected(page,car.id,firstSlot,mode,'Occupied garage cell does not advance');
  await drag(page,source(car.id),target(valid[0].id),mode);eq((await snapshot(page)).state.garage[car.id],valid[0].id,'Any matching empty cell accepted: '+car.id);
 }
 await settle(page,'lego');await geometry(page,width,'lego');await picture(page,width,'lego');
 const small=data.legoItems.find(item=>!item.model&&item.studs<=4);await rejected(page,small.id,'large-parts',mode,'Small part rejects large-parts bin');
 for(const item of data.legoItems){
  if(item.model){await rejected(page,item.id,'small-parts',mode,'Finished model cannot be dismantled into loose-parts bin');}
  await drag(page,source(item.id),target(item.zones[0]),mode);eq((await snapshot(page)).state.lego[item.id],item.zones[0],'Lego placement '+item.id);
 }
 await settle(page,'clothes');await geometry(page,width,'clothes');await picture(page,width,'clothes');
 const dirty=data.clothesItems.find(item=>item.dirty);await rejected(page,dirty.id,'wardrobe',mode,'Dirty clothes reject clean storage');
 for(const item of data.clothesItems){const destination=item.zones[width===320&&item.zones.length>1?1:0];await drag(page,source(item.id),target(destination),mode);eq((await snapshot(page)).state.clothes[item.id],destination,'Clothes allowed destination '+item.id+' → '+destination);}
 await settle(page,'done');eq((await snapshot(page)).state.selfReported,false,'Game completion never marks a real-world action done');eq((await snapshot(page)).state.realGoal,null,'No real-world goal is automatically selected');await geometry(page,width,'done');await picture(page,width,'done');
 await tap(page,'[data-tidy-undo]',mode);await settle(page,'clothes');const last=data.clothesItems.at(-1);eq((await snapshot(page)).state.clothes[last.id],undefined,'Undo crosses final boundary into clothes');await picture(page,width,'undo-from-done');await drag(page,source(last.id),target(last.zones[width===320&&last.zones.length>1?1:0]),mode);await settle(page,'done');
 const episodeEvents=await page.evaluate(()=>__qaInput);await preserved(page);await page.reload();await ready(page);eq((await snapshot(page)).state.stage,'done','Completed virtual episode resumes');eq((await snapshot(page)).state.selfReported,false,'Reload still never invents real-world completion');await start(page,mode);await settle(page,'done');await preserved(page);
 const events=episodeEvents.concat(await page.evaluate(()=>__qaInput));if(mode==='keyboard')ok(events.some(event=>event.type==='keydown'&&event.key==='Enter'&&event.trusted),'Trusted native keyboard activation verified');else ok(events.some(event=>event.type==='pointermove'&&event.pointerType===mode&&event.trusted),'Trusted native '+mode+' drag verified');eq(errors,[],'No browser runtime errors');
 let nextMission=null;
 if(width===390){await tap(page,'[data-tidy-replay]',mode);await settle(page,'search');eq((await snapshot(page)).state.rule,rule,'Replay keeps explicitly chosen rule');}
 else{nextMission=data.rules[(data.rules.indexOf(rule)+1)%data.rules.length];await tap(page,'[data-tidy-replay-rule="'+nextMission+'"]',mode);await settle(page,'search');eq((await snapshot(page)).state.rule,nextMission,'New mission changes the rule through native input');}
 const reset=(await snapshot(page)).state;eq(reset.history,[],'New mission clears own undo history');eq({search:reset.search,found:reset.found,garage:reset.garage,lego:reset.lego,clothes:reset.clothes,realGoal:reset.realGoal,selfReported:reset.selfReported},{search:{},found:false,garage:{},lego:{},clothes:{},realGoal:null,selfReported:false},'New mission clears only its activity state and invents no real-world completion');await preserved(page);
 report.viewports.push({width,mode,rule,nextMission,fullEpisode:true,reloadResume:true,oldDataPreserved:true,nativeInput:true,undoAcrossStages:true});console.log(JSON.stringify({phase:'viewport-complete',width,mode,rule,checks:report.checks}));
}
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');if(!u.pathname.startsWith(prefix))return res.writeHead(404).end();let name=u.pathname.slice(prefix.length);if(name==='qa-seed.html')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">');if(!name||name.endsWith('/'))name+='index.html';const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch(_){if(!res.headersSent)res.writeHead(404);res.end();}});
async function standalone(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),requests=[],errors=[];page.on('request',req=>{if(!req.isNavigationRequest())requests.push(req.url());});page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>route.request().isNavigationRequest()&&route.request().url().startsWith('file://'+path.join(root,'life/offline.html'))?route.continue():route.abort());
 try{
  let directFile=true;
  try{await page.goto('file://'+path.join(root,'life/offline.html')+'?room=tidy');}catch(error){
   if(!error.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw error;
   directFile=false;const url=base+'life/offline.html?room=tidy';
   report.limitations.push('Managed Chromium blocks file:// navigation. Exact offline.html bytes were executed through one fulfilled localhost navigation with every dependent request blocked.');
   await context.unroute('**/*');await context.route('**/*',route=>route.request().isNavigationRequest()&&route.request().url()===url?route.fulfill({status:200,contentType:'text/html;charset=utf-8',body:fs.readFileSync(path.join(root,'life/offline.html'),'utf8')}):route.abort());await page.goto(url);
  }
  await ready(page);await start(page,'mouse');await drag(page,source('dirty-shirt'),target('laundry'),'mouse');eq((await snapshot(page)).state.search['dirty-shirt'],'laundry','Standalone offline bytes accept native input');await geometry(page,390,'offline-search');await picture(page,'offline','search');eq(requests,[],'Standalone offline bytes make zero external resource requests');eq(errors,[],'Standalone offline bytes have no runtime errors');report.standalone={directFileNavigation:directFile,exactOfflineHtmlBytes:true,externalResourceRequests:0,nativeInput:true};
 }finally{await context.close();}
}
async function freshPwa(browser,base){
 const context=await browser.newContext({viewport:{width:390,height:1100},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await context.setOffline(true);await page.goto(base+'life/?room=tidy');await ready(page);await start(page,'mouse');eq((await snapshot(page)).state.stage,'search','Fresh installed PWA opens an unvisited tidy query route offline');await drag(page,source('dirty-shirt'),target('laundry'),'mouse');eq((await snapshot(page)).state.search['dirty-shirt'],'laundry','Fresh PWA accepts native input while offline');await page.reload();await ready(page);eq((await snapshot(page)).state.search['dirty-shirt'],'laundry','Fresh PWA restores exact checkpoint while offline');eq(errors,[],'Fresh PWA offline has no runtime errors');await picture(page,'pwa-offline','search');report.freshPwaOffline=true;}finally{await context.close();}
}
(async()=>{
 if(!process.argv.includes('--ready')){console.log('Ray tidy browser checks prepared. Run with --ready after integration and reproducible build.');return;}
 fs.mkdirSync(out,{recursive:true});fixtures();report.build=JSON.parse(fs.readFileSync(path.join(root,'trainer-build.json'),'utf8')).build;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+prefix;let browser;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const [width,mode]of [[390,'mouse'],[320,'touch'],[768,'keyboard']]){
   const context=await browser.newContext({viewport:{width,height:1100},hasTouch:mode==='touch',isMobile:width===320,reducedMotion:width===390?'no-preference':'reduce',serviceWorkers:'block'}),page=await context.newPage();
   try{await playEpisode(page,base,width,mode);}catch(error){await page.screenshot({path:path.join(out,'failure-'+width+'.png'),fullPage:true}).catch(()=>{});throw error;}finally{await context.close();}
  }
  await standalone(browser,base);await freshPwa(browser,base);report.success=true;
  report.sourceHashes=Object.fromEntries(['room-tidy-data.js','room-tidy-logic.js','room-tidy-game.js','room-tidy-game.css','room-tidy-scene.js','room-toy-art.js','room-input.js','room-progress.js'].filter(name=>fs.existsSync(path.join(root,name))).map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,name))).digest('hex')]));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve));fs.writeFileSync(path.join(out,'room-tidy-browser-report.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(error=>{report.error=error.stack;fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'room-tidy-browser-report.json'),JSON.stringify(report,null,2));console.error(error);process.exitCode=1;});
