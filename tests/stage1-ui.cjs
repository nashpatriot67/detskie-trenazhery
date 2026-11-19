'use strict';
// Stage 1 browser acceptance. Only disposable localhost contexts and synthetic
// fixtures. No production/child data, deployment, or source modifications.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {installLegacyConceptFixture,prepareLegacyMathMode}=require('./legacy-concept-fixture.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.STAGE1_ARTIFACTS||'/workspace/scratch/stage1-review');
const prefix='/detskie-trenazhery/',mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg'};
const examples=[[95,8,'+',103],[180,35,'+',215],[270,45,'+',315],[198,7,'+',205],[302,8,'-',294],[300,18,'-',282],[405,27,'-',378],[500,176,'-',324]].map(([a,b,op,result])=>({a,b,op,result}));
const files=['kubiki/app.js','bricks/app.js','kubiki/engine.js','bricks/engine.js','kubiki/course.js','bricks/course.js','slovograd/app.js','slovograd/core.js','place-value.js','place-value-motion.js','place-value-activities.js','place-value-activities.css','math-range.js','learning-progress.js','trainer-loader.js','offline-bundle.js','trainer-assets.json','kubiki/index.html','bricks/index.html','slovograd/index.html','sw.js'];
const hashes=()=>Object.fromEntries(files.filter(f=>fs.existsSync(path.join(root,f))).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const results=[],skipped=[];let checks=0,browser,base,origin;
const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;},ok=(a,message)=>{assert.ok(a,message);checks++;};
const plain=x=>JSON.parse(JSON.stringify(x));
async function test(name,folder,fn,options={}){
 if(process.argv[2]&&!new RegExp(process.argv[2]).test(name))return;
 const ctx=await browser.newContext({viewport:{width:options.width||1280,height:options.height||1000},hasTouch:!!options.touch,isMobile:!!options.touch,serviceWorkers:'block',reducedMotion:options.motion||'reduce'});ctx.setDefaultTimeout(8000);
 await installLegacyConceptFixture(ctx);
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 let page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const h={ctx,get page(){return page;},async open(){await page.goto(base+folder+'/');await page.locator('.app-shell').waitFor();},async reopen(){await page.close();page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await h.open();},async saveShot(name){await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});}};
 try{await fn(h);eq(errors,[],'No uncaught browser error');results.push({name,folder,success:true});}
 catch(e){try{await page.screenshot({path:path.join(out,'failure-'+name+'.png'),fullPage:true});}catch{}results.push({name,folder,success:false,error:e.stack||String(e),pageErrors:errors});}
 finally{await ctx.close();console.log(JSON.stringify(results.at(-1)));}
}
async function idle(page){await page.evaluate(async()=>{if(window.PlaceValueMotion)await PlaceValueMotion.idle();});}
async function quantity(page){return page.evaluate(()=>({parts:JSON.parse(JSON.stringify(state.zones.a)),total:K.total(state.zones.a),across:K.total(state.zones.a)+K.total(state.zones.b)+K.total(state.zones.removed)}));}
async function exchange(page,action){const before=await quantity(page);await page.locator('[data-exchange="'+action+'"]').click();await idle(page);const after=await quantity(page);eq(after.total,before.total,'Exchange preserves the current quantity');eq(after.across,before.across,'Exchange preserves quantity across all zones');return after;}
async function move(page,type,from,to,count=1){for(let i=0;i<count;i++){await page.locator('[data-piece="'+type+'"][data-from="'+from+'"]').first().click();await page.locator('[data-zone="'+to+'"] .zone-header').click();}}
async function assertHidden(page,target){
 const data=await page.evaluate(()=>({unknown:[...document.querySelectorAll('.equation .eq-answer')].map(e=>e.textContent.trim()),fields:[...document.querySelectorAll('.quantity-summary [data-total],.quantity-summary [data-actual],.quantity-summary [data-expanded],.quantity-summary [data-standard]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none').map(e=>e.textContent.trim()),live:document.querySelector('#live')?.textContent||''}));
 for(const value of data.unknown)eq(value,'?','Unknown arithmetic result is not revealed');
 eq(data.fields,[],'Independent numeric quantity fields are omitted');
 ok(!new RegExp('(^|[^0-9])'+target+'([^0-9]|$)').test(data.live),'Live region never gives the unknown result');
}
async function fixture(h,t,mode='play'){
 await h.open();await h.page.evaluate(t=>{const l=COURSE[12];l.title='Числа и действия';l.example={...t};l.exercises[0]={...t,answer:t.result,missing:'result',text:t.a+(t.op==='+'?'+':'−')+t.b+'='};},t);
 await h.page.locator('nav [data-view="course"]').click();await h.page.locator('.course-card[data-lesson="13"]').click();
 if(mode!=='learn'){await prepareLegacyMathMode(h.page,13);await h.page.locator('[data-mode="'+mode+'"]').click();await h.page.locator('.math-route-disclosure > summary').click();await h.page.locator('[data-practice="0"]').click();}
}
async function solve(page,t,{early=false,unitsFirst=false}={}){
 const initial=await quantity(page);
 if(t.op==='+'){
  if(early){await move(page,'unit','b','a',2);await exchange(page,'pack');await exchange(page,'pack100');await move(page,'unit','b','a',t.b-2);}
  else{await page.locator('[data-action="combine"]').click();eq((await quantity(page)).across,initial.across);eq(((q)=>[q.parts.hundred,q.parts.ten,q.parts.unit])(await quantity(page)),[Math.floor(t.a/100)+Math.floor(t.b/100),Math.floor(t.a/10)%10+Math.floor(t.b/10)%10,t.a%10+t.b%10],'Joined group retains actual unnormalised counts');if(t.a%10+t.b%10>=10)eq((await quantity(page)).parts.unit,t.a%10+t.b%10,'Raw unit count remains before manual carry');while(await page.evaluate(()=>state.zones.a.unit>=10))await exchange(page,'pack');while(await page.evaluate(()=>state.zones.a.ten>=10))await exchange(page,'pack100');}
 }else{
  const u=t.b%10,d=Math.floor(t.b/10)%10,c=Math.floor(t.b/100);
  if(unitsFirst){const n=t.a%10;await move(page,'unit','a','removed',n);if(n<u){if(await page.evaluate(()=>state.zones.a.ten===0))await exchange(page,'split100');await exchange(page,'split');}await move(page,'unit','a','removed',u-n);}
  else if(await page.evaluate(u=>state.zones.a.unit<u,u)){if(await page.evaluate(()=>state.zones.a.ten===0)){const q=await exchange(page,'split100');eq([q.parts.hundred,q.parts.ten,q.parts.unit],[Math.floor(t.a/100)-1,10,t.a%10],'Borrowing a hundred produces ten tens and retains units');if(t.a===302)await page.locator('.board').screenshot({path:path.join(out,'borrow-302-'+new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)+'-hundred.png')});}const q=await exchange(page,'split');eq(q.parts.unit,t.a%10+10,'Borrowed ten creates ten additional real units');if(t.a===302){eq([q.parts.hundred,q.parts.ten,q.parts.unit],[2,9,12]);await page.locator('.board').screenshot({path:path.join(out,'borrow-302-'+new URL(page.url()).pathname.split('/').filter(Boolean).at(-1)+'-ten.png')});}}
  if(await page.evaluate(d=>state.zones.a.ten<d,d))await exchange(page,'split100');
  await move(page,'hundred','a','removed',c);await move(page,'ten','a','removed',d);if(!unitsFirst)await move(page,'unit','a','removed',u);
 }
 eq((await quantity(page)).total,t.result,'Final physical quantity matches independent arithmetic');if(t.op==='-')eq(await page.evaluate(()=>K.total(state.zones.removed)),t.b,'Exactly the subtrahend was physically removed');await assertHidden(page,t.result);
 await page.locator('#answer').fill(String(t.result));await page.locator('[data-action="check"]').click();eq(await page.evaluate(()=>state.solved),true,'Existing check accepts valid material actions and answer');
}
async function openTask(h,id,track='practice'){
 await h.open();await h.page.locator('[data-pv-open="'+track+'"]').first().click();
 if(id)await h.page.locator('[data-pv-task-select]').selectOption(id);
 await h.page.locator('[data-pv-action="check"],[data-pv-action="skip"]').first().waitFor();
}
async function run(){
 fs.mkdirSync(out,{recursive:true});const sourceBefore=hashes();
 const server=http.createServer((req,res)=>{try{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!rel.startsWith(prefix)||rel.includes('..'))return res.writeHead(404).end();rel=rel.slice(prefix.length);if(!rel||rel.endsWith('/'))rel+='index.html';const file=path.join(root,rel);if(!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(500).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port+prefix;origin=new URL(base).origin;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const folder of ['kubiki','bricks']){
   for(const t of examples){
    const name=folder+'-'+t.a+t.op+t.b;
    await test('arithmetic-'+name,folder,async h=>{await fixture(h,t);await assertHidden(h.page,t.result);await solve(h.page,t);});
    await test('explanation-'+name,folder,async h=>{await fixture(h,t,'learn');const frames=[];for(let guard=0;guard<18;guard++){const f=await h.page.evaluate(()=>JSON.parse(JSON.stringify(learningFrame())));frames.push(f);const counts=await h.page.evaluate(()=>{const x={};for(const z of ['a','b','removed']){const el=document.querySelector('[data-learn-zone="'+z+'"]'),v=K.empty();if(el)for(const type of Object.keys(K.values))v[type]=el.querySelectorAll('.piece.'+type).length;x[z]=v;}return x;});eq(counts,f.zones,'Displayed objects match the engine frame');if(f.phase==='final')break;if(!f.showTotal)eq(await h.page.locator('.learn-visual [data-total]').count(),0,'No final total in a pending teaching transformation');await h.page.locator('[data-action="learn-next"]').click();await idle(h.page);}
      eq(frames.at(-1).phase,'final');eq(frames.at(-1).zones.a.unit,t.result%10);eq(frames.at(-1).zones.a.ten,Math.floor(t.result/10)%10);eq(frames.at(-1).zones.a.hundred,Math.floor(t.result/100));
      if(t.a===302){ok(frames.some(f=>f.zones.a.hundred===2&&f.zones.a.ten===10&&f.zones.a.unit===2),'First borrow is explicitly visible');ok(frames.some(f=>f.zones.a.hundred===2&&f.zones.a.ten===9&&f.zones.a.unit===12),'Second borrow is explicitly visible');await h.saveShot(folder+'-302-explanation-final');}
    });
   }
   await test('alternative-strategies-'+folder,folder,async h=>{await fixture(h,{a:198,b:7,op:'+',result:205});await solve(h.page,{a:198,b:7,op:'+',result:205},{early:true});await fixture(h,{a:302,b:8,op:'-',result:294});await solve(h.page,{a:302,b:8,op:'-',result:294},{unitsFirst:true});});
   await test('boundary-1000-'+folder,folder,async h=>{await fixture(h,{a:999,b:1,op:'+',result:1000});await solve(h.page,{a:999,b:1,op:'+',result:1000});eq(await h.page.locator('#answer').inputValue(),'1000','1000 is not clipped');const x=await quantity(h.page);eq(x.parts.hundred,10);eq(x.total,1000);ok(/тысяч|1000/.test(await h.page.locator('.quantity-summary').first().innerText()),'Boundary representation is explicitly explained');});
  }
  for(const folder of ['kubiki','bricks']){
   await test('table-zero-and-fix-'+folder,folder,async h=>{
    await openTask(h,'pv.digits.305');
    for(const [place,digit]of [[0,3],[1,0],[2,5]]){await h.page.locator('[data-pv-action="digit"][data-digit="'+digit+'"]').click();await h.page.locator('[data-pv-action="place"][data-place="'+place+'"]').click();}
    eq(await h.page.evaluate(()=>state.pv.digits),[3,0,5]);eq(await h.page.locator('.pv-place-table .pv-digit-slot').allTextContents(),['3','0','5']);
    await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);await h.saveShot(folder+'-table-305');
    await h.page.locator('[data-pv-task-select]').selectOption('pv.fix.305');eq(await h.page.evaluate(()=>state.pv.digits),[3,5,0]);
    await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),false,'Wrong zero placement is not accepted');
    for(const [place,digit]of [[1,0],[2,5]]){await h.page.locator('[data-pv-action="digit"][data-digit="'+digit+'"]').click();await h.page.locator('[data-pv-action="place"][data-place="'+place+'"]').click();}
    await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);ok(/после|исправ/i.test(await h.page.locator('.feedback').first().innerText()),'Correction after an error is explicitly identified');
   });
   await test('expanded-value-and-position-'+folder,folder,async h=>{
    await openTask(h,'pv.expand.470');for(const [i,value]of [400,70,0].entries())await h.page.locator('[data-pv-field="'+i+'"]').fill(String(value));await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    await h.page.locator('[data-pv-task-select]').selectOption('pv.value.247');await h.page.locator('#pv-answer').fill('40');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    await h.page.locator('[data-pv-task-select]').selectOption('pv.compare.4');for(const [i,value]of [40,400,4].entries())await h.page.locator('[data-pv-field="'+i+'"]').fill(String(value));await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
   });
   await test('read-model-no-leak-'+folder,folder,async h=>{
    await openTask(h,'pv.read.109');const surface=await h.page.locator('.pv-activity').innerText();ok(!/(^|\D)109(\D|$)/.test(surface),'Read-model target is not given in visible instructions or navigation');
    const labels=await h.page.locator('.pv-activity [aria-label]').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));ok(labels.every(label=>!/(^|\D)109(\D|$)/.test(label)),'ARIA never gives the unknown model number');
    await h.page.locator('#pv-answer').fill('109');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
   });
   await test('build-quantity-alternative-'+folder,folder,async h=>{
    await openTask(h,'pv.build.420');for(let i=0;i<3;i++)await h.page.locator('[data-piece="hundred"][data-from="bank"]').click();for(let i=0;i<12;i++)await h.page.locator('[data-piece="ten"][data-from="bank"]').click();
    const before=await quantity(h.page);eq([before.parts.hundred,before.parts.ten,before.parts.unit],[3,12,0]);eq(before.total,420);await h.page.locator('#pv-answer').fill('420');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true,'Quantity-building accepts3S12D without forcing canonical form');
   });
   await test('hundred-exchanges-'+folder,folder,async h=>{
    for(const fixture of [{id:'pv.exchange.13t',answer:130,start:[0,13,0],actions:['pack100'],final:[1,3,0]},{id:'pv.exchange.2h15t',answer:350,start:[2,15,0],actions:['pack100'],final:[3,5,0]},{id:'pv.exchange.9t15u',answer:105,start:[0,9,15],actions:['pack','pack100'],final:[1,0,5]}]){
     await openTask(h,fixture.id);const before=await quantity(h.page);eq([before.parts.hundred,before.parts.ten,before.parts.unit],fixture.start,'Initial grouping is preserved');
     for(const action of fixture.actions)await exchange(h.page,action);const q=await quantity(h.page);eq([q.parts.hundred,q.parts.ten,q.parts.unit],fixture.final);eq(q.total,fixture.answer);
     await h.page.locator('[data-action="undo"]').click();ok((await quantity(h.page)).parts.ten!==q.parts.ten,'Undo restores the last representation');await exchange(h.page,fixture.actions.at(-1));
     await h.page.locator('#pv-answer').fill(String(fixture.answer));await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    }
    await h.saveShot(folder+'-hundred-exchange');
   });
   await test('activity-arithmetic-302-restore-'+folder,folder,async h=>{
    await openTask(h,'pv.arithmetic.subtract.302.8');await exchange(h.page,'split100');await exchange(h.page,'split');await h.page.locator('#pv-answer').fill('294');const snapshot=await h.page.evaluate(()=>({task:PlaceValueActivities.current(state.pv).id,pv:JSON.parse(JSON.stringify(state.pv)),zones:JSON.parse(JSON.stringify(state.zones)),answer:state.answer,undo:JSON.parse(JSON.stringify(state.undo))}));
    await h.reopen();const restored=await h.page.evaluate(()=>({task:PlaceValueActivities.current(state.pv).id,pv:JSON.parse(JSON.stringify(state.pv)),zones:JSON.parse(JSON.stringify(state.zones)),answer:state.answer,undo:JSON.parse(JSON.stringify(state.undo))}));eq(restored.task,snapshot.task);eq(restored.zones,snapshot.zones,'Noncanonical2S9D12E survives full page close/reopen');eq(restored.answer,'294');eq(restored.undo,snapshot.undo,'Undo history survives');
    await move(h.page,'unit','a','removed',8);await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);await h.saveShot(folder+'-302-restored');
   });
   await test('activity1000-draft-restore-'+folder,folder,async h=>{
    await openTask(h,'pv.arithmetic.add.999.1');await h.page.locator('[data-action="combine"]').click();await exchange(h.page,'pack');await exchange(h.page,'pack100');await h.page.locator('#pv-answer').fill('1000');await h.reopen();eq(await h.page.locator('#pv-answer').inputValue(),'1000');eq((await quantity(h.page)).total,1000);eq((await quantity(h.page)).parts.hundred,10);await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);ok(/тысяч/.test(await h.page.locator('.pv-reviewed').innerText()));
   });
   await test('diagnostic-short-skip-'+folder,folder,async h=>{
    await openTask(h,null,'diagnostic');const queue=await h.page.evaluate(()=>state.pv.queue.slice());eq(queue.length,3,'A short diagnosis chooses three cards rather than forcing all');eq(new Set(queue).size,3);ok(queue.every(id=>id.startsWith('pv.diag.')));
    const before=await h.page.evaluate(()=>JSON.parse(JSON.stringify(progress.learning||{})));const current=await h.page.evaluate(()=>PlaceValueActivities.current(state.pv).id);await h.page.locator('[data-pv-action="skip"]').click();const event=await h.page.evaluate(id=>progress.learning.observations.filter(x=>x.taskId===id).at(-1),current);eq(event.finalOutcome,'skipped');eq(event.assistance.afterError,false,'Skipping is not recorded as an error');
    await h.page.locator('[data-pv-action="next"]').click();eq(await h.page.evaluate(()=>state.pv.index),1);await h.reopen();eq(await h.page.evaluate(()=>state.pv.index),1,'The diagnostic cursor resumes');eq(await h.page.evaluate(()=>state.pv.queue),queue);await h.saveShot(folder+'-diagnostic');
   });
   await test('diagnostic-prediction-and-conservation-'+folder,folder,async h=>{
    await h.open();await h.page.evaluate(()=>{PlaceValueActivities.start(state,'diagnostic',K,LearningProgress,progress.learning,'pv.diag.predict');renderFresh();});
    const before=(await quantity(h.page)).parts,button=h.page.locator('[data-exchange="pack100"]');if(await button.isEnabled()){await button.click();await idle(h.page);eq((await quantity(h.page)).parts,before,'A child cannot reveal the predicted model before answering');}else ok(true,'Pre-prediction exchange is disabled');
    for(const [i,value]of [3,5,0].entries())await h.page.locator('[data-pv-field="'+i+'"]').fill(String(value));await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),false,'A forecast alone does not complete its required physical confirmation');eq(await h.page.evaluate(()=>state.pv.predictionConfirmed),true);await exchange(h.page,'pack100');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    await h.page.evaluate(()=>{PlaceValueActivities.start(state,'diagnostic',K,LearningProgress,progress.learning,'pv.diag.conservation');renderFresh();});await exchange(h.page,'split100');await exchange(h.page,'split');await h.page.locator('[data-pv-action="choice"][data-choice="same"]').click();await h.page.locator('#pv-answer').fill('302');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
   });
   await test('help-after-error-and-independent-'+folder,folder,async h=>{
    await openTask(h,'pv.value.247');await h.page.locator('[data-pv-action="hint"]').click();await h.page.locator('#pv-answer').fill('40');await h.page.locator('[data-pv-action="check"]').click();let e=await h.page.evaluate(()=>progress.learning.observations.filter(x=>x.taskId==='pv.value.247').at(-1));eq(e.status,'assisted');eq(e.assistance.visual,true);
    await h.page.locator('[data-pv-task-select]').selectOption('pv.read.109');await h.page.locator('#pv-answer').fill('109');await h.page.locator('[data-pv-action="check"]').click();e=await h.page.evaluate(()=>progress.learning.observations.filter(x=>x.taskId==='pv.read.109').at(-1));eq(e.status,'independent');eq(e.assistance.afterError,false);
    await h.page.locator('[data-pv-task-select]').selectOption('pv.value.247');await h.page.locator('#pv-answer').fill('4');await h.page.locator('[data-pv-action="check"]').click();await h.page.locator('#pv-answer').fill('40');await h.page.locator('[data-pv-action="check"]').click();e=await h.page.evaluate(()=>progress.learning.observations.filter(x=>x.taskId==='pv.value.247').at(-1));eq(e.firstOutcome,'incorrect');eq(e.assistance.afterError,true);ok(/после|исправ/i.test(await h.page.locator('.feedback').first().innerText()));
   });
   await test('geometry-and-touch-table-'+folder,folder,async h=>{
    await openTask(h,'pv.digits.305');for(const [place,digit]of [[0,3],[1,0],[2,5]]){await h.page.locator('[data-pv-action="digit"][data-digit="'+digit+'"]').tap();await h.page.locator('[data-pv-action="place"][data-place="'+place+'"]').tap();}eq(await h.page.evaluate(()=>state.pv.digits),[3,0,5]);
    for(const el of await h.page.locator('.pv-digit-slot,.pv-digit-bank button').all()){const b=await el.boundingBox();ok(b.width>=43&&b.height>=43,'Digit controls retain large touch targets');}
    ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow at a mobile width');await h.saveShot(folder+'-table-mobile');
   },{width:390,height:844,touch:true});
   await test('digit-mouse-drag-'+folder,folder,async h=>{await openTask(h,'pv.digits.247');await h.page.locator('[data-pv-action="digit"][data-digit="2"]').dragTo(h.page.locator('[data-pv-action="place"][data-place="0"]'));eq(await h.page.evaluate(()=>state.pv.digits[0]),2,'Mouse drag places a real digit');});
  }
  for(const folder of ['kubiki','bricks']){
   await test('selective-meaning-does-not-reveal-'+folder,folder,async h=>{
    const t={a:15,b:12,op:'+',result:27};await openTask(h,'pv.arithmetic.add.15.12');
    await h.page.locator('[data-action="combine"]').click();await h.page.locator('#pv-answer').fill('27');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    await h.page.locator('[data-pv-action="meaning-open"]').click();
    const active=await h.page.locator('.pv-activity').innerText();ok(!/(^|\D)20(\D|$)/.test(active),'Previous worked representation never supplies the probed twenty');
    await h.page.locator('#pv-meaning-answer').fill('20');await h.page.locator('[data-pv-action="meaning-check"]').click();eq(await h.page.evaluate(()=>state.pv.meaningDone),true);
    const event=await h.page.evaluate(()=>progress.learning.observations.filter(e=>e.taskId==='pv.meaning.tens-15-12').at(-1));eq(event.finalOutcome,'correct');ok(event.skillIds.includes('math.placevalue.position'));
    await h.page.locator('[data-pv-task-select]').selectOption('pv.read.305');eq(await h.page.locator('[data-pv-action="meaning-open"]').count(),0,'A semantic question is selective rather than forced after every task');
   });
   await test('diagnostic-adapts-and-recommends-'+folder,folder,async h=>{
    await h.open();await h.page.evaluate(()=>{
     const lp=LearningProgress;let learning=lp.clean(progress.learning,progress.resetEpoch);
     for(const t of PlaceValueActivities.TASKS.filter(t=>t.diagnostic))learning=lp.record(learning,{...lp.attempt(t.id,t.skillIds,{generation:learning.generation}),outcome:'correct'});
     const t=PlaceValueActivities.TASKS.find(t=>t.id==='pv.diag.conservation');learning=lp.record(learning,{...lp.attempt(t.id,t.skillIds,{generation:learning.generation}),outcome:'incorrect'});progress.learning=learning;save();
    });
    await h.page.locator('[data-pv-open="diagnostic"]').first().click();const q=await h.page.evaluate(()=>state.pv.queue.slice());eq(q.length,3);ok(q.includes('pv.diag.conservation'),'Recent exchange difficulty influences the short selection');
    await h.page.evaluate(()=>{PlaceValueActivities.start(state,'diagnostic',K,LearningProgress,progress.learning,'pv.diag.position');renderFresh();});
    for(const i of [0,1,2])await h.page.locator('[data-pv-field="'+i+'"]').fill('4');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),false);
    ok(await h.page.locator('.pv-remediation [data-lesson]').count()>0,'A difficulty points to an existing suitable lesson');ok(/одна ошибка|ещё не|уточн/i.test(await h.page.locator('.pv-activity').innerText()),'One incorrect attempt is not labelled definitive non-understanding');
    await h.saveShot(folder+'-diagnostic-clarification');
   });
   await test('legacy-and-opaque-data-'+folder,folder,async h=>{
    await h.open();const key=folder==='kubiki'?'kubiki-progress-v1':'detalki-progress-v1';
    const old=await h.page.evaluate(()=>({lastLesson:13,lastView:'trainer',read:[13],solved:{'1:0':true},session:{version:2,lesson:13,mode:'play',index:0,demo:false,step:0,solved:false,zones:{a:{...K.empty(),ten:1,unit:12},b:K.empty(),removed:K.empty()},answer:'22',undo:[],worksheetTask:false,repeating:false},parentNote:{keep:'opaque-existing-field'}}));
    await h.page.evaluate(({key,old})=>localStorage.setItem(key,JSON.stringify(old)),{key,old});await h.reopen();eq(await h.page.evaluate(()=>state.zones.a.unit),12,'Old noncanonical state is restored without a hidden carry');eq(await h.page.locator('#answer').inputValue(),'22');eq(await h.page.evaluate(()=>progress.solved['1:0']),true);
    await h.page.locator('[data-pv-open="practice"]').first().click();await h.page.locator('[data-pv-task-select]').selectOption('pv.value.247');await h.page.locator('#pv-answer').fill('40');await h.page.locator('[data-pv-action="check"]').click();
    const stored=await h.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);eq(stored.solved['1:0'],true);eq(stored.parentNote,old.parentNote,'An additive observation never deletes foreign existing fields');ok(stored.learning.observations.length>0);
   });
   await test('corrupt-storage-is-not-overwritten-'+folder,folder,async h=>{
    await h.open();const key=folder==='kubiki'?'kubiki-progress-v1':'detalki-progress-v1',raw='{"interrupted":';await h.page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});await h.reopen();
    await h.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));eq(await h.page.evaluate(key=>localStorage.getItem(key),key),raw,'A corrupt load does not replace the original bytes with an empty session');
   });
   await test('reset-and-next-clear-old-answer-'+folder,folder,async h=>{
    await openTask(h,'pv.exchange.13t');await h.page.locator('#pv-answer').fill('130');
    await h.page.locator('[data-pv-action="reset"]').click();eq(await h.page.locator('#pv-answer').inputValue(),'','Reset never recaptures the old DOM answer');eq(await h.page.evaluate(()=>state.answer),'');
    await exchange(h.page,'pack100');await h.page.locator('#pv-answer').fill('130');await h.page.locator('[data-pv-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);
    await h.page.locator('[data-pv-action="next"]').click();eq(await h.page.locator('#pv-answer').inputValue(),'','The next model starts with an empty answer');eq(await h.page.evaluate(()=>PlaceValueActivities.current(state.pv).id),'pv.exchange.2h15t');
    await exchange(h.page,'pack100');await h.page.locator('#pv-answer').fill('350');await h.page.locator('[data-pv-action="check"]').click();await h.page.locator('[data-pv-action="next"]').click();eq(await h.page.locator('#pv-answer').inputValue(),'','A second next never inherits a previously checked result');
   });
   await test('multiple-tabs-passive-preserves-current-'+folder,folder,async h=>{
    await openTask(h,'pv.value.247');await h.page.locator('#pv-answer').fill('40');
    const second=await h.ctx.newPage();await second.goto(base+folder+'/');await second.locator('#pv-answer').waitFor();await second.locator('#pv-answer').fill('4');
    await h.page.waitForFunction(()=>state.pvConflict===true);ok(await h.page.locator('.pv-fieldset[disabled]').count()>0,'An outdated tab clearly blocks conflicting edits');
    const key=folder==='kubiki'?'kubiki-progress-v1':'detalki-progress-v1',raw=await second.evaluate(key=>localStorage.getItem(key),key);await h.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));eq(await second.evaluate(key=>localStorage.getItem(key),key),raw,'A background page cannot replace the current draft');
    await h.page.locator('[data-pv-action="reload"]').click();eq(await h.page.locator('#pv-answer').inputValue(),'4','Explicitly reopening current work accepts the newer draft');await second.close();
   });
   await test('touch-drag-and-320-layout-'+folder,folder,async h=>{
    await openTask(h,'pv.digits.247');
    const source=h.page.locator('[data-pv-action="digit"][data-digit="2"]'),dest=h.page.locator('[data-pv-action="place"][data-place="0"]');await source.scrollIntoViewIfNeeded();
    const a=await source.boundingBox(),b=await dest.boundingBox(),session=await h.ctx.newCDPSession(h.page);const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};
    ok(from.y>=0&&to.y>=0&&from.y<844&&to.y<844,'Touch source and destination are in the visible viewport');
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/6,y:from.y+(to.y-from.y)*i/6}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();eq(await h.page.evaluate(()=>state.pv.digits[0]),2,'A real touch drag places the chosen digit');
    await h.page.locator('[data-pv-task-select]').selectOption('pv.arithmetic.subtract.302.8');await exchange(h.page,'split100');await exchange(h.page,'split');eq((await quantity(h.page)).parts.unit,12);ok(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Three hundreds and the borrowed representation do not overflow320px');await h.saveShot(folder+'-320-borrowed');
   },{width:320,height:844,touch:true});
  }
  for(const mode of ['construct','write','dictation'])await test('russian-navigation-no-answer-'+mode,'slovograd',async h=>{
   await h.open();await h.page.evaluate(mode=>{state.sound=false;state.spellingFree=true;state.mode.spelling=mode;go('spelling');},mode);if(await h.page.locator('[data-action="lesson-continue"]').count())await h.page.locator('[data-action="lesson-continue"]').click();
   const word=await h.page.evaluate(()=>current().word),selected=await h.page.locator('[data-control="exercise"] option:checked').textContent(),aria=await h.page.locator('.task-map-item.current').getAttribute('aria-label');ok(!selected.includes(word),'Exercise picker never reveals the unknown spelling');ok(!aria.includes(word),'Task map ARIA never reveals it');eq(await h.page.evaluate(()=>state.solved),false);if(mode==='write')await h.saveShot('russian-independent-writing');
  });
  await test('russian-help-resume-and-meaning','slovograd',async h=>{
   await h.open();await h.page.evaluate(()=>{state.sound=false;state.spellingFree=true;state.mode.spelling='write';go('spelling');});if(await h.page.locator('[data-action="lesson-continue"]').count())await h.page.locator('[data-action="lesson-continue"]').click();
   await h.page.locator('[data-action="hint"]').first().click();await h.page.locator('#word-answer').fill('жыжы');await h.page.locator('[data-action="check"]').click();if(await h.page.locator('[data-action="lesson-continue"]').count())await h.page.locator('[data-action="lesson-continue"]').click();await h.reopen();eq(await h.page.locator('#word-answer').inputValue(),'жыжы');
   const assistance=await h.page.evaluate(()=>state.attempt.assistance);ok(assistance.afterError,'An error remains distinguished after reopening');ok(assistance.visual||assistance.explanation,'Mathematical/language help is retained');const word=await h.page.evaluate(()=>current().word);await h.page.locator('#word-answer').fill(word);await h.page.locator('[data-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);ok(await h.page.locator('.attempt-result').count()>0,'Attempt independence is visible');
   const observations=await h.page.evaluate(()=>progress.learning.observations);ok(observations.length>0);ok(observations.some(e=>e.assistance.afterError),'New observations preserve the corrected first error');
  });
  await test('russian-selective-meaning-and-reopen','slovograd',async h=>{
   await h.open();await h.page.evaluate(()=>{state.sound=false;state.spellingFree=true;state.mode.spelling='write';go('spelling');const i=list().findIndex(t=>t.checkWord);state.index[source()]=i;state.attempt=null;prepare();render();});
   if(await h.page.locator('[data-action="lesson-continue"]').count())await h.page.locator('[data-action="lesson-continue"]').click();const word=await h.page.evaluate(()=>current().word);await h.page.locator('#word-answer').fill(word);await h.page.locator('[data-action="check"]').click();eq(await h.page.evaluate(()=>state.solved),true);await h.page.locator('[data-action="meaning-open"]').click();
   eq(await h.page.locator('.big-word').count(),0,'The previous correct spelling is not shown on a semantic probe');eq(await h.page.locator('.guide-panel').count(),0,'The previous rule/checkword aside cannot give away the probe');
   const data=await h.page.evaluate(()=>({correct:state.meaning.options.indexOf(state.meaning.correct),probeId:state.meaning.probeId,id:state.meaning.attempt.taskId}));const wrong=(data.correct+1)%3;await h.page.locator('[data-meaning-choice="'+wrong+'"]').click();eq(await h.page.evaluate(()=>state.meaning.outcome),'incorrect');await h.reopen();eq(await h.page.evaluate(()=>state.meaning.open),true,'An unfinished semantic question resumes rather than silently skipping to the next word');eq(await h.page.evaluate(()=>state.meaning.probeId),data.probeId);ok(await h.page.evaluate(()=>state.meaning.attempt.assistance.afterError),'The first semantic error survives reopening');
   await h.page.locator('[data-meaning-choice="'+data.correct+'"]').click();eq(await h.page.evaluate(()=>state.meaning.finished),true);const event=await h.page.evaluate(id=>progress.learning.observations.filter(e=>e.taskId===id).at(-1),data.id);eq(event.finalOutcome,'correct');eq(event.firstOutcome,'incorrect');eq(event.assistance.afterError,true);await h.saveShot('russian-meaning');
  });
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
 const sourceAfter=hashes(),changed=Object.keys(sourceBefore).filter(name=>sourceBefore[name]!==sourceAfter[name]);
 const report={success:results.every(x=>x.success)&&changed.length===0,checks,cases:results.length,results,skipped,sourceFilesChanged:changed,sourceHashes:sourceBefore,localOnly:true,productionAccess:false,studentDataAccess:false,physicalDevices:false,engine:'Chromium /usr/bin/chromium',limitations:['Mobile viewports and touch emulation do not constitute physical Huawei/Safari testing.','PWA and offline package acceptance is reported separately.']};
 fs.writeFileSync(path.join(out,'stage1-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.success)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
