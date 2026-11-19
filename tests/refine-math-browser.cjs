'use strict';
// Real Chromium/touch-emulation acceptance against the generated local build.
// Disposable contexts only; no published app or real learner data are accessed.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const root=path.resolve(__dirname,'..'),out='/workspace/scratch/refine-math-review';fs.mkdirSync(out,{recursive:true});let checks=0,browser;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'};
const server=http.createServer((req,res)=>{try{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)&&file!==root)throw Error('path');if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404);res.end();}});
const snap=page=>page.evaluate(()=>PracticeHub.snapshot());
async function conceptAnswer(page,task){
 if(task.kind==='choice')await page.locator('[data-ct-action="choice"][data-value="'+task.answer+'"]').click();
 else if(['number','word'].includes(task.kind))await page.locator('[data-ct-input="answer"]').fill(String(task.answer));
 else for(const [zone,item]of Object.entries(task.answer)){await page.locator('[data-ct-action="select"][data-item="'+item+'"]').click();await page.locator('[data-ct-action="place"][data-zone="'+zone+'"]').click();}
}
async function finishGate(page){
 if((await snap(page)).state.active.run.phase==='intro')await page.locator('[data-ct-action="begin"]').click();
 let count=0;while(await page.evaluate(()=>PracticeHub.isOpen()&&PracticeHub.snapshot().kind==='concepts')){
  ok(count++<5,'Only the assigned three cards run');const task=await page.evaluate(()=>JSON.parse(JSON.stringify(ConceptTrainer.current(PracticeHub.snapshot().state.active.run))));await conceptAnswer(page,task);await page.locator('[data-ct-action="check"]').click();ok((await snap(page)).state.active.run.solved);await page.locator('[data-ct-action="next"]').click();
 }eq(count,3);
}
async function finishTheory(page){let count=0;while(await page.evaluate(()=>state.mode==='learn'&&!PracticeHub.isOpen())){ok(count++<15);await page.locator('[data-action="learn-next"]').click();}eq((await snap(page)).kind,'concepts');}
async function solveCheck(page){
 const t=await page.evaluate(()=>JSON.parse(JSON.stringify(MathCheck.current(PracticeHub.snapshot().state))));
 if(t.kind==='number')await page.locator('[data-mc-input="answer"]').fill(String(t.answer));
 else if(t.kind==='fields')for(const [i,value]of t.answer.entries())await page.locator('[data-mc-field="'+i+'"]').fill(String(value));
 else if(t.kind==='digits')for(const [i,value]of t.answer.entries()){await page.locator('[data-mc-action="digit"][data-value="'+value+'"]').click();await page.locator('[data-mc-action="place"][data-zone="'+i+'"]').click();}
 else{const q=await page.evaluate(ref=>JSON.parse(JSON.stringify(ConceptTrainer.TASKS.find(x=>x.id===ref))),t.ref);await conceptAnswer(page,q);}
 await page.locator('[data-mc-action="check"]').click();ok((await snap(page)).state.solved,'Control evaluates the real answer');await page.locator('[data-mc-action="next"]').click();return t;
}
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const results=[];
 for(const folder of ['kubiki','bricks'])for(const touch of [false,true]){
  const context=await browser.newContext({viewport:{width:touch?390:1280,height:touch?844:1000},hasTouch:touch,isMobile:touch,reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  try{
   await page.goto(base+'/'+folder+'/');await page.locator('.app-shell').waitFor();ok(await page.evaluate(()=>!!window.MathJourney&&!!window.MathCheck&&!!window.LearningJourney),'New code included in generated build');ok(await page.locator('[data-practice-open="assessment"]').count());eq(await page.locator('[data-practice-open="concepts"]').count(),0,'No separate concept-menu launcher');
   await finishTheory(page);await finishGate(page);eq(await page.evaluate(()=>({mode:state.mode,index:state.index})),{mode:'play',index:0});
   await page.locator('[data-action="combine"]').click();await page.locator('#answer').fill('8');await page.locator('[data-action="check"]').click();eq(await page.evaluate(()=>state.solved),false);await page.waitForTimeout(2400);eq(await page.evaluate(()=>state.index),0,'Errors never auto-advance');
   await page.locator('#answer').fill('7');await page.locator('[data-action="check"]').click();eq(await page.evaluate(()=>state.index),0,'Feedback holds the correct task');await page.waitForFunction(()=>state.index===1);eq(await page.evaluate(()=>state.solved),false);
   // Control has no old-course marks; completion is separately recorded.
   const marks=await page.evaluate(()=>JSON.stringify(progress.modeSolved));await page.locator('[data-practice-open="assessment"]').click();await page.locator('[data-mc-action="start"]').click();const covered=[];for(let i=0;i<10;i++)covered.push(await solveCheck(page));eq((await snap(page)).state.phase,'summary');eq(new Set(covered.map(t=>t.id)).size,10);eq(new Set(covered.filter(t=>t.source==='course').map(t=>t.group)).size,6);eq(await page.evaluate(()=>JSON.stringify(progress.modeSolved)),marks,'Control never awards ordinary course tasks');await page.locator('[data-mc-action="exit"]').click();
   await page.evaluate(()=>openPlaceValue('practice','pv.digits.305'));eq((await snap(page)).state.active.config.id,'math.pv.build.concepts.v1');await finishGate(page);
   for(const [i,n]of [3,0,5].entries()){await page.locator('[data-pv-action="digit"][data-digit="'+n+'"]').click();await page.locator('[data-pv-action="place"][data-place="'+i+'"]').click();}await page.locator('[data-pv-action="check"]').click();ok(await page.evaluate(()=>state.solved));await page.waitForFunction(()=>PlaceValueActivities.current(state.pv).id==='pv.digits.247');
   // Exact incomplete PVA restoration through a real browser restart.
   await page.locator('[data-pv-action="digit"][data-digit="2"]').click();await page.locator('[data-pv-action="place"][data-place="0"]').click();await page.reload();await page.locator('.app-shell').waitFor();eq(await page.evaluate(()=>state.pv.digits),[2,null,null]);eq(await page.evaluate(()=>PlaceValueActivities.current(state.pv).id),'pv.digits.247');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');eq(errors,[],'No browser exceptions');await page.screenshot({path:path.join(out,folder+(touch?'-touch':'-desktop')+'.png'),fullPage:true});results.push({folder,touch,success:true});
  }catch(error){await page.screenshot({path:path.join(out,'failure-'+folder+(touch?'-touch':'-desktop')+'.png'),fullPage:true}).catch(()=>{});results.push({folder,touch,success:false,error:error.stack,pageErrors:errors});}
  await context.close();console.log(JSON.stringify(results.at(-1)));
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,results,physicalDevices:false},null,2));if(results.some(r=>!r.success))process.exitCode=1;console.log(JSON.stringify({checks,results:results.length,success:results.every(r=>r.success),physicalDevices:false}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
