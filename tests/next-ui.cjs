'use strict';
// Repeatable acceptance in disposable localhost browser contexts. No real
// learner records, published host, source edits, or deployment are involved.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.NEXT_REVIEW_DIR||'/workspace/scratch/next-review');
const prefix='/detskie-trenazhery/',keys={kubiki:'kubiki-progress-v1',bricks:'detalki-progress-v1',slovograd:'slovograd-v1'};
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json','.mp3':'audio/mpeg'};
let checks=0,browser,base,origin;const results=[],skipped=[];
const plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const eq=(actual,expected,message)=>{assert.deepEqual(actual,expected,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
function hashes(){
 const registry=JSON.parse(fs.readFileSync(path.join(root,'trainer-assets.json'),'utf8'));
 const names=[...new Set(Object.values(registry.trainers).flatMap(t=>t.scripts.concat(t.styles)).concat(['trainer-assets.json','trainer-loader.js','trainer-build.json','sw.js','index.html'],['kubiki','bricks','slovograd'].flatMap(f=>[f+'/index.html',f+'/offline.html'])))];
 return Object.fromEntries(names.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
}
const snap=page=>page.evaluate(()=>PracticeHub.snapshot());
const appSnapshot=page=>page.evaluate(()=>({view:state.view,mode:state.mode,index:state.index,lesson:state.lesson,zones:JSON.parse(JSON.stringify(state.zones||{})),answer:state.answer,solved:state.solved}));
async function openHub(h,kind){await h.open();await h.page.locator('[data-practice-open="'+kind+'"]').first().click();await h.page.locator('#practice-root').waitFor({state:'visible'});eq((await snap(h.page)).kind,kind);}
async function closeHub(page){await page.locator('[data-ph-action="close"]').click();await page.locator('#practice-root').waitFor({state:'hidden'});}
async function noOverflow(page){ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Document has no horizontal overflow');ok(await page.locator('#practice-root').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Overlay has no horizontal overflow');}
const conceptTask=page=>page.evaluate(()=>JSON.parse(JSON.stringify(ConceptTrainer.current(PracticeHub.snapshot().state))));
async function conceptTopic(page,topic){if((await snap(page)).state.phase!=='menu')await page.locator('[data-ct-action="menu"]').click();await page.locator('[data-ct-action="topic"][data-topic="'+topic+'"]').click();if((await snap(page)).state.phase==='intro')await page.locator('[data-ct-action="begin"]').click();}
async function conceptAnswer(page,task){
 task=task||await conceptTask(page);
 if(task.kind==='choice')await page.locator('[data-ct-action="choice"][data-value="'+task.answer+'"]').click();
 else if(task.kind==='number'||task.kind==='word')await page.locator('[data-ct-input="answer"]').fill(String(task.answer));
 else if(task.kind==='match')for(const [zone,item]of Object.entries(task.answer)){await page.locator('[data-ct-action="select"][data-item="'+item+'"]').click();await page.locator('[data-ct-action="place"][data-zone="'+zone+'"]').click();}
 else if(task.kind==='classify')for(const [item,zone]of Object.entries(task.answer)){await page.locator('[data-ct-action="select"][data-item="'+item+'"]').click();await page.locator('[data-ct-action="place"][data-zone="'+zone+'"]').click();}
 else throw Error('Unsupported acceptance task '+task.kind);
}
async function skipToConcept(page,id){for(let guard=0;guard<40;guard++){const t=await conceptTask(page);if(t&&t.id===id)return t;const s=(await snap(page)).state;if(!s.solved)await page.locator('[data-ct-action="skip"]').click();await page.locator('[data-ct-action="next"]').click();}throw Error('Target concept not reached: '+id);}
async function lifeOpen(page,id){if((await snap(page)).state.view!=='menu')await page.locator('[data-lq-action="menu"]').first().click();await page.locator('[data-lq-action="open"][data-quest="'+id+'"]').click();if((await snap(page)).state.phase==='intro')await page.locator('[data-lq-action="begin"]').click();}
const lifeQuest=page=>page.evaluate(()=>JSON.parse(JSON.stringify(LifeQuests.current(PracticeHub.snapshot().state))));
async function lifePlace(page,item,zone){await page.locator('[data-lq-action="select"][data-item="'+item+'"]').click();await page.locator('[data-lq-action="place"][data-zone="'+zone+'"]').click();}
function topological(q,reverse=false){const order=[],pending=q.steps.map(s=>s.id);while(pending.length){const possible=pending.filter(id=>!(q.before||[]).some(([a,b])=>b===id&&!order.includes(a)));if(!possible.length)throw Error('Cyclic quest plan');const id=reverse?possible.at(-1):possible[0];order.push(id);pending.splice(pending.indexOf(id),1);}return order;}
async function test(name,folder,fn,options={}){
 if(process.argv[2]&&!new RegExp(process.argv[2]).test(name))return;
 const context=await browser.newContext({viewport:{width:options.width||1280,height:options.height||1000},hasTouch:!!options.touch,isMobile:!!options.touch,reducedMotion:'reduce',serviceWorkers:'block'});context.setDefaultTimeout(10000);
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 let page=await context.newPage();const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 const h={context,get page(){return page;},async open(){await page.goto(base+folder+'/');await page.locator('.app-shell').waitFor();await page.locator('[data-practice-open="concepts"]').first().waitFor();},async reopen(){await page.close();page=await context.newPage();page.on('pageerror',e=>pageErrors.push(e.message));await h.open();},async shot(name){const overlay=await page.locator('#practice-root').isVisible();await page.screenshot({path:path.join(out,name+'.png'),fullPage:!overlay});}};
 try{await fn(h);eq(pageErrors,[],'No uncaught browser errors');results.push({name,folder,success:true});}
 catch(error){try{await h.shot('failure-'+name);}catch{}results.push({name,folder,success:false,error:error.stack||String(error),pageErrors});}
 finally{await context.close();console.log(JSON.stringify(results.at(-1)));}
}
async function run(){
 fs.mkdirSync(out,{recursive:true});const sourceBefore=hashes();
 const server=http.createServer((req,res)=>{try{let rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(!rel.startsWith(prefix)||rel.includes('..'))return res.writeHead(404).end();rel=rel.slice(prefix.length);if(!rel||rel.endsWith('/'))rel+='index.html';const f=path.join(root,rel);if(!fs.existsSync(f)||!fs.statSync(f).isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':mime[path.extname(f)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(f).pipe(res);}catch{res.writeHead(500).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port+prefix;origin=new URL(base).origin;
 try{
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  for(const folder of ['kubiki','bricks','slovograd']){
   await test('launchers-and-intact-host-'+folder,folder,async h=>{
    await h.open();for(const kind of ['concepts','quests','breaks'])eq(await h.page.locator('[data-practice-open="'+kind+'"]').count(),1,'One clear launcher per activity');
    const before=await appSnapshot(h.page);await h.page.locator('[data-practice-open="concepts"]').click();await h.page.locator('#practice-root').waitFor({state:'visible'});
    eq((await snap(h.page)).ownerKey,keys[folder],'Concepts use the existing subject owner');eq(await h.page.locator('#practice-root').getAttribute('role'),'dialog');eq(await h.page.locator('#app').evaluate(el=>el.inert),true,'Underlying exercise is inert');
    const focusable=await h.page.locator('#practice-root button:not([disabled]),#practice-root input:not([disabled]),#practice-root select:not([disabled])').count();
    for(let i=0;i<focusable+3;i++){await h.page.keyboard.press('Tab');ok(await h.page.evaluate(()=>!!document.activeElement.closest('#practice-root')),'Keyboard focus remains inside active activity');}
    await h.page.keyboard.press('Escape');await h.page.locator('#practice-root').waitFor({state:'hidden'});eq(await h.page.locator('#app').evaluate(el=>el.inert),false);eq(await appSnapshot(h.page),before,'Opening/closing practice does not change the original exercise');
    if(folder!=='slovograd'){await h.page.locator('nav [data-view="course"]').click();eq(await h.page.locator('.course-card').count(),36,'Original lessons remain');}
   });
  }
  for(const folder of ['kubiki','bricks'])await test('math-concepts-help-error-and-new-independent-'+folder,folder,async h=>{
   await openHub(h,'concepts');await conceptTopic(h.page,'math.addition');const t=await conceptTask(h.page);eq(t.id,'concept.math.add.match.0');eq(t.answer,{n0:'t0',n1:'t1',n2:'t2'});
   for(const [zone,item]of Object.entries({n0:'t1',n1:'t2',n2:'t0'})){await h.page.locator('[data-ct-action="select"][data-item="'+item+'"]').click();await h.page.locator('[data-ct-action="place"][data-zone="'+zone+'"]').click();}
   await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,false);eq((await snap(h.page)).state.attempt.firstOutcome,'incorrect');
   await h.page.locator('[data-ct-action="hint"]').click();await h.page.locator('[data-ct-action="reset"]').click();const attempt=plain((await snap(h.page)).state.attempt);ok(attempt.assistance.visual&&attempt.assistance.afterError&&attempt.assistance.explanation,'Reset retains explanation, hint and first error');
   await h.reopen();await h.page.locator('#practice-root').waitFor({state:'visible'});eq((await snap(h.page)).state.attempt,attempt,'Attempt and help survive reopening');eq((await snap(h.page)).state.placements,{});
   await conceptAnswer(h.page,t);await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,true);ok((await h.page.locator('.ct-feedback').innerText()).includes('слагаемые'),'Correct answer includes mathematical explanation');
   const first=await h.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).learning.observations.find(e=>e.taskId==='concept.math.add.match.0'),keys[folder]);eq(first.finalOutcome,'correct');eq(first.firstOutcome,'incorrect');eq(first.status,'assisted');ok(first.assistance.afterError);
   await h.shot(folder+'-concept-addition-explained');await h.page.locator('[data-ct-action="next"]').click();const next=await conceptTask(h.page);eq(next.id,'concept.math.add.value.0');await conceptAnswer(h.page,next);await h.page.locator('[data-ct-action="check"]').click();
   const event=await h.page.evaluate(key=>JSON.parse(localStorage.getItem(key)).learning.observations.find(e=>e.taskId==='concept.math.add.value.0'),keys[folder]);eq(event.status,'independent');eq(event.assistance.afterError,false,'New task does not inherit a former mistake');
  });
  await test('concept-grade-topics-whole-parts-draft','kubiki',async h=>{
   await openHub(h,'concepts');await h.page.locator('[data-ct-action="grade"][data-value="1"]').click();eq(await h.page.locator('[data-ct-action="topic"][data-topic="math.divide"]').count(),0);eq(await h.page.locator('[data-ct-action="topic"][data-topic="math.position"]').count(),0);
   await conceptTopic(h.page,'math.whole');eq((await conceptTask(h.page)).id,'concept.math.whole.whole.0');await h.page.locator('[data-ct-input="answer"]').fill('70');
   await h.page.locator('[data-ct-action="menu"]').click();await conceptTopic(h.page,'math.subtraction');await h.page.locator('[data-ct-action="menu"]').click();await conceptTopic(h.page,'math.whole');eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'70','Switching topics preserves the numeric draft');
   await h.reopen();await h.page.locator('[data-ct-input="answer"]').waitFor();eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'70');eq((await snap(h.page)).state.solved,false,'A saved draft is not an awarded answer');
   await h.page.locator('[data-ct-input="answer"]').fill('7');await h.page.locator('[data-ct-input="answer"]').press('Enter');eq((await snap(h.page)).state.solved,true);await h.shot('concept-whole-and-parts');
   await h.page.locator('[data-ct-action="next"]').click();eq((await conceptTask(h.page)).id,'concept.math.whole.part.0');eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'','Next card starts with an empty draft');
   await h.page.locator('[data-ct-action="grade"][data-value="2"]').click();eq(await h.page.locator('[data-ct-action="topic"][data-topic="math.divide"]').count(),1);eq(await h.page.locator('[data-ct-action="topic"][data-topic="math.position"]').count(),1);
  });
  await test('russian-speech-members-and-word-form','slovograd',async h=>{
   await openHub(h,'concepts');eq((await snap(h.page)).state.subject,'russian');await conceptTopic(h.page,'russian.speech');let t=await conceptTask(h.page);eq(t.id,'concept.rus.speech.classify.0');eq(t.answer,{w0:'c0',w1:'c1',w2:'c2'});
   await conceptAnswer(h.page,t);await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,true);await h.page.locator('[data-ct-action="next"]').click();t=await conceptTask(h.page);eq(t.id,'concept.rus.speech.questions.0');await conceptAnswer(h.page,t);await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,true);
   await conceptTopic(h.page,'russian.members');t=await conceptTask(h.page);eq(t.id,'concept.rus.members.match.0');eq(t.items.map(x=>x.text).sort(),['Подлежащее','Сказуемое'].sort());await conceptAnswer(h.page,t);await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,true);await h.shot('russian-sentence-members');
   await conceptTopic(h.page,'russian.wordparts');const ending=await conceptTask(h.page);eq(ending.id,'concept.rus.parts.ending.0');await conceptAnswer(h.page,ending);await h.page.locator('[data-ct-action="check"]').click();ok(/форм|окончан/.test(await h.page.locator('.ct-feedback').innerText()),'Word parts use a form-changing procedure');
   const changed=await skipToConcept(h.page,'concept.rus.parts.change-school');eq(changed.kind,'word');ok(!(await h.page.locator('.ct-task h3').innerText()).includes(changed.answer),'Word-form target is not printed in the question');
   await h.page.locator('[data-ct-input="answer"]').fill('шко');await h.reopen();await h.page.locator('[data-ct-input="answer"]').waitFor();eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'шко','Cyrillic draft is not stripped by the numeric host');
   await conceptAnswer(h.page,changed);await h.page.locator('[data-ct-action="check"]').click();await h.page.waitForFunction(()=>PracticeHub.snapshot()?.kind==='breaks');eq((await snap(h.page)).state.phase,'choose','Five completed concept cards offer an optional physical pause');
   const saved=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('slovograd-v1')).learning.modules['concept-russian'].state);eq(saved.solved,true);eq(saved.queue[saved.index],changed.id,'The fifth answer is saved before switching');await h.shot('automatic-break-after-five-tasks');
   await h.page.locator('[data-ab-action="skip"]').click();eq((await snap(h.page)).kind,'concepts');eq((await snap(h.page)).state.solved,true);eq((await conceptTask(h.page)).id,changed.id,'Skipping the pause returns to the same completed card');await h.shot('russian-word-form-application');
  });
  await test('life-sort-errors-undo-and-resume','kubiki',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.places.after-play');let q=await lifeQuest(h.page);const first=q.itemIds[0],wrong=q.zoneIds.find(z=>!q.accepted[first].includes(z));ok(!!wrong);
   for(const id of q.itemIds)await lifePlace(h.page,id,id===first?wrong:q.accepted[id][0]);await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,false);ok((await snap(h.page)).state.issues.some(i=>i.code==='wrong-zone'&&i.item===first));ok((await h.page.locator('.lq-feedback').innerText()).length>50,'An incorrect placement gets a concrete explanation');
   await h.page.locator('[data-lq-action="hint"]').click();const attempt=(await snap(h.page)).state.attempt;await h.page.locator('[data-lq-action="reset"]').click();eq((await snap(h.page)).state.attempt.attemptId,attempt.attemptId);ok((await snap(h.page)).state.attempt.assistance.afterError&&((await snap(h.page)).state.attempt.assistance.visual));
   await lifePlace(h.page,first,q.accepted[first][0]);await h.page.locator('[data-lq-action="undo"]').click();eq((await snap(h.page)).state.placements,{});await lifePlace(h.page,first,q.accepted[first][0]);
   const before=(await snap(h.page)).state;await h.reopen();await h.page.locator('#practice-root').waitFor({state:'visible'});eq((await snap(h.page)).state.placements,before.placements);eq((await snap(h.page)).state.attempt.attemptId,before.attempt.attemptId);ok((await snap(h.page)).state.attempt.assistance.afterError);
   q=await lifeQuest(h.page);for(const id of q.itemIds.filter(id=>id!==first))await lifePlace(h.page,id,q.accepted[id][0]);await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true);
   const event=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations.find(e=>e.taskId==='life.places.after-play'));eq(event.evidenceKind,'virtual-life-task');eq(event.status,'assisted');eq(event.firstOutcome,'incorrect');
   await h.shot('life-things-in-their-places');const events=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations);await h.page.locator('[data-lq-action="menu"]').first().click();await lifeOpen(h.page,q.id);eq((await snap(h.page)).state.solved,true,'Completed situation reopens as a review');eq(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations),events,'Reopening a completed scene does not invent another success');
  });
  await test('life-contextual-places-real-self-and-adult-reports','kubiki',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.places.clothes');const q=await lifeQuest(h.page);ok(q.itemIds.some(id=>q.accepted[id].length>1),'This scene allows contextual alternative places');for(const id of q.itemIds)await lifePlace(h.page,id,q.accepted[id].at(-1));
   await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true);const events=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations);
   await h.page.locator('[data-lq-action="real"]').click();eq(await h.page.locator('[data-lq-action="real-report"]').isDisabled(),true,'A real checklist starts unclaimed');const n=q.realSteps.length;ok(n>=3);
   for(let i=0;i<n;i++)await h.page.locator('[data-lq-action="real-toggle"][data-index="'+i+'"]').click();await h.page.locator('[data-lq-action="real-report"]').click();let real=(await snap(h.page)).state.real[q.id];eq(real.selfReported,true);eq(real.adultReported,false);ok((await h.page.locator('.lq-report-state').innerText()).includes('ребёнком'),'Child self-report is labelled');eq(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations),events,'A child click never becomes verified physical skill evidence');
   await h.page.locator('[data-lq-action="adult-open"]').click();await h.page.locator('[data-lq-action="adult-confirm"]').click();real=(await snap(h.page)).state.real[q.id];eq(real.adultReported,true);ok((await h.page.locator('.lq-report-state').innerText()).includes('Взрослый отметил'));eq(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.observations),events,'An adult declaration is kept separate from academic observations');
   await h.reopen();await h.page.locator('.lq-report-state').waitFor();eq((await snap(h.page)).state.real[q.id].adultReported,true);await h.shot('life-real-world-plan');await h.page.locator('[data-lq-action="real-toggle"][data-index="0"]').click();real=(await snap(h.page)).state.real[q.id];eq(real.selfReported,false);eq(real.adultReported,false,'Changing the checklist invalidates the previous declaration');
  });
  await test('life-school-pack-distractors-and-alternative-protection','kubiki',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.school.rain');const q=await lifeQuest(h.page);ok(q.required.length>0&&q.distractors.length>0&&q.alternatives.length>0);
   for(const id of q.required)await h.page.locator('[data-lq-action="toggle"][data-item="'+id+'"]').click();const extra=q.distractors[0];await h.page.locator('[data-lq-action="toggle"][data-item="'+extra+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,false);ok((await snap(h.page)).state.issues.some(i=>i.code==='extra'&&i.item===extra));
   await h.page.locator('[data-lq-action="toggle"][data-item="'+extra+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,false);ok((await snap(h.page)).state.issues.some(i=>i.code==='alternative-missing'),'Weather requires a suitable protective item');
   await h.page.locator('[data-lq-action="toggle"][data-item="'+q.alternatives[0].items[0]+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true);await h.shot('life-school-rain-packing');
   await h.page.locator('[data-lq-action="replay"]').click();if((await snap(h.page)).state.phase==='intro')await h.page.locator('[data-lq-action="begin"]').click();for(const id of q.required.concat(q.alternatives[0].items[1]))await h.page.locator('[data-lq-action="toggle"][data-item="'+id+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true,'The other protective item is also accepted');
  });
  await test('life-plan-partial-order-and-self-correction','kubiki',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.plan.bedtime');const q=await lifeQuest(h.page),valid=topological(q),alternative=topological(q,true);ok(q.before.length>0);ok(JSON.stringify(valid)!==JSON.stringify(alternative),'The plan has genuinely different valid orders');
   const bad=valid.slice(),[a,b]=q.before[0],ai=bad.indexOf(a),bi=bad.indexOf(b);[bad[ai],bad[bi]]=[bad[bi],bad[ai]];for(const id of bad)await h.page.locator('[data-lq-action="step"][data-step="'+id+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,false);ok((await snap(h.page)).state.issues.some(i=>i.code==='order'));
   await h.page.locator('[data-lq-action="reset"]').click();ok((await snap(h.page)).state.attempt.assistance.afterError);for(const id of alternative)await h.page.locator('[data-lq-action="step"][data-step="'+id+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true,'A valid alternative plan is accepted');await h.shot('life-evening-plan');
  });
  await test('life-choose-and-apply-own-sorting-rule','bricks',async h=>{
   await openHub(h,'quests');eq((await snap(h.page)).ownerKey,keys.kubiki);await lifeOpen(h.page,'life.sort.choose-rule');const q=await lifeQuest(h.page);ok(q.ruleChoices.length>=2);
   for(const rule of q.ruleChoices.slice(0,2)){
    if((await snap(h.page)).state.solved){await h.page.locator('[data-lq-action="replay"]').click();if((await snap(h.page)).state.phase==='intro')await h.page.locator('[data-lq-action="begin"]').click();}
    await h.page.locator('[data-lq-action="rule"][data-rule="'+rule.id+'"]').click();for(const id of q.itemIds)await lifePlace(h.page,id,rule.accepted[id][0]);await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true,'Chosen sorting criterion governs correctness');
   }
   await h.shot('life-own-sorting-rule');
  });
  await test('breaks-optional-self-report-and-no-awards','kubiki',async h=>{
   await openHub(h,'breaks');eq((await snap(h.page)).ownerKey,keys.kubiki);eq((await snap(h.page)).state.phase,'choose');
   const academic=()=>h.page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('kubiki-progress-v1')||'{}');return {solved:p.solved||{},modeSolved:p.modeSolved||{},read:p.read||[],observations:p.learning?.observations||[]};});
   const before=await academic(),first=(await snap(h.page)).state.routineId;
   await h.page.locator('[data-ab-action="replace"]').click();ok((await snap(h.page)).state.routineId!==first,'The child can replace a suggested movement');
   await h.page.locator('[data-ab-action="preference"][data-preference="gentle"]').click();eq((await snap(h.page)).state.preference,'gentle');
   await h.page.locator('[data-ab-action="start"]').click();eq((await snap(h.page)).state.phase,'moving');
   await h.page.locator('[data-ab-action="pause"]').click();eq((await snap(h.page)).state.running,false);
   await h.page.locator('[data-ab-action="resume"]').click();eq((await snap(h.page)).state.running,true);
   await h.page.locator('[data-ab-action="timer-toggle"]').click();eq((await snap(h.page)).state.timerEnabled,false);eq((await snap(h.page)).state.running,false);
   await h.page.locator('[data-ab-action="finish"]').click();eq((await snap(h.page)).state.completed,true);ok((await h.page.locator('#practice-root').innerText()).includes('Отмечено тобой'),'Completion is explicitly a self-report');
   eq(await academic(),before,'Movement never awards academic correctness or stars');
   await h.shot('active-break-self-report');await h.page.locator('[data-ab-action="return"]').click();await h.page.locator('#practice-root').waitFor({state:'hidden'});
   eq(await academic(),before,'Returning does not require an academic award');
   await h.page.locator('[data-practice-open="breaks"]').first().click();await h.page.locator('#practice-root').waitFor({state:'visible'});await h.page.locator('[data-ab-action="replace"]').click();await h.page.locator('[data-ab-action="skip"]').click();await h.page.locator('#practice-root').waitFor({state:'hidden'});eq(await academic(),before,'Skipping movement never reduces achievements');
  });
  await test('breaks-resume-paused-mobile','slovograd',async h=>{
   await openHub(h,'breaks');eq((await snap(h.page)).ownerKey,keys.kubiki,'Breaks use one existing canonical owner across subjects');
   await h.page.locator('[data-ab-action="start"]').click();await h.page.locator('[data-ab-action="next-step"]').click();const before=(await snap(h.page)).state;
   await h.reopen();await h.page.locator('#practice-root').waitFor({state:'visible'});const restored=(await snap(h.page)).state;eq(restored.routineId,before.routineId);eq(restored.step,before.step);eq(restored.running,false,'Reopening never counts unseen movement');eq(restored.completed,false);
   await noOverflow(h.page);await h.shot('active-break-mobile-320');await h.page.locator('[data-ab-action="skip"]').click();await h.page.locator('#practice-root').waitFor({state:'hidden'});
  },{width:320,height:844,touch:true});
  await test('life-shared-owner-cross-subject-conflict-and-reload','bricks',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.sport.pool');const q=await lifeQuest(h.page),first=q.required[0],second=q.required[1];await h.page.locator('[data-lq-action="toggle"][data-item="'+first+'"]').click();
   const p=await h.context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'slovograd/');await p.locator('[data-practice-open="quests"]').first().click();await p.locator('#practice-root').waitFor({state:'visible'});eq((await snap(p)).ownerKey,keys.kubiki);eq((await snap(p)).state.chosen,[first],'Russian opens the same shared life draft');
   await p.locator('[data-lq-action="toggle"][data-item="'+second+'"]').click();await h.page.waitForFunction(()=>PracticeHub.snapshot()?.conflict===true);eq(await h.page.locator('[data-lq-action="check"]').isDisabled(),true,'Stale scene cannot silently overwrite a newer draft');
   const raw=await p.evaluate(()=>localStorage.getItem('kubiki-progress-v1'));await h.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));eq(await p.evaluate(()=>localStorage.getItem('kubiki-progress-v1')),raw,'Passive stale tab leaves the active draft intact');
   await h.page.locator('[data-ph-action="reload"]').click();eq((await snap(h.page)).conflict,false);eq((await snap(h.page)).state.chosen,[first,second]);eq(errors,[]);await p.close();
  });
  await test('unrelated-module-write-keeps-focused-concept-draft','kubiki',async h=>{
   await openHub(h,'concepts');await conceptTopic(h.page,'math.whole');await h.page.locator('[data-ct-input="answer"]').fill('70');
   const p=await h.context.newPage();await p.goto(base+'slovograd/');await p.locator('[data-practice-open="quests"]').first().click();await p.locator('#practice-root').waitFor({state:'visible'});await lifeOpen(p,'life.sport.pool');const q=await lifeQuest(p);await p.locator('[data-lq-action="toggle"][data-item="'+q.required[0]+'"]').click();
   eq((await snap(h.page)).conflict,false,'Different named modules can coexist');eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'70');
   const modules=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.modules);ok(modules['concept-math']&&modules['life-quests'],'Both snapshots remain inside the existing owner');await p.close();
  });
  await test('failed-save-foreign-write-explicit-reload-discards-stale-memory','kubiki',async h=>{
   await openHub(h,'concepts');await conceptTopic(h.page,'math.whole');await h.page.locator('[data-ct-input="answer"]').fill('70');
   await h.page.evaluate(()=>{window.__qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='kubiki-progress-v1')throw new DOMException('Synthetic quota','QuotaExceededError');return window.__qaSetItem.call(this,k,v);};});
   await h.page.locator('[data-ct-input="answer"]').fill('71');ok(!!(await snap(h.page)).storageWarning,'Input write failure is visibly reported');ok(await h.page.locator('.ph-storage-note').isVisible());
   const p=await h.context.newPage();await p.goto(base+'kubiki/');await p.locator('#practice-root').waitFor({state:'visible'});eq(await p.locator('[data-ct-input="answer"]').inputValue(),'70','Failed input has not replaced the durable draft');await p.locator('[data-ct-input="answer"]').fill('72');
   await h.page.waitForFunction(()=>PracticeHub.snapshot()?.conflict===true);await h.page.evaluate(()=>{Storage.prototype.setItem=window.__qaSetItem;delete window.__qaSetItem;});await h.page.locator('[data-ph-action="reload"]').click();
   eq(await h.page.locator('[data-ct-input="answer"]').inputValue(),'72','Explicit reload uses the foreign durable draft, not unsaved memory');eq((await snap(h.page)).state.answer,'72');eq((await snap(h.page)).conflict,false);
   const saved=await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.modules['concept-math'].state.answer);eq(saved,'72');await p.close();
  });
  for(const variant of ['corrupt','future-learning','future-concept','future-routine'])await test('storage-safety-'+variant,'kubiki',async h=>{
   await h.open();const fixture=await h.page.evaluate(variant=>{
    const raw=JSON.parse(localStorage.getItem('kubiki-progress-v1')||'{}');raw.solved=Object.assign({},raw.solved,{'13:0':true});
    if(variant==='corrupt'){const text='{"synthetic-corrupt":';localStorage.setItem('kubiki-progress-v1',text);return {text};}
    if(variant==='future-learning'){raw.learning={version:99,generation:raw.resetEpoch||'initial',futureRecord:{keep:'exact'}};const text=JSON.stringify(raw);localStorage.setItem('kubiki-progress-v1',text);return {text};}
    const L=LearningProgress,id=variant==='future-concept'?'concept-math':'routine';raw.learning=L.setModule(L.clean(raw.learning,raw.resetEpoch||'initial'),id,{version:99,opaqueFuture:{keep:'exact'}},{ownerId:'future-client',updatedAt:99});localStorage.setItem('kubiki-progress-v1',JSON.stringify(raw));return {id,wrapper:raw.learning.modules[id]};
   },variant);
   await h.page.reload();await h.page.locator('[data-practice-open="concepts"]').first().waitFor();await h.page.locator('[data-practice-open="concepts"]').first().click();await h.page.locator('#practice-root').waitFor({state:'visible'});
   if(variant==='corrupt'||variant==='future-learning'){eq(await h.page.evaluate(()=>localStorage.getItem('kubiki-progress-v1')),fixture.text,'Broken or unknown whole progress stays byte-for-byte');ok(!!(await snap(h.page)).storageWarning);}
   else{eq(await h.page.evaluate(id=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.modules[id],fixture.id),fixture.wrapper,'Unknown module version stays opaque');if(variant==='future-concept'){eq((await snap(h.page)).conflict,true);eq(await h.page.locator('[data-ct-action="topic"]').first().isDisabled(),true);}else{await conceptTopic(h.page,'math.whole');await h.page.locator('[data-ct-input="answer"]').fill('70');eq(await h.page.evaluate(()=>JSON.parse(localStorage.getItem('kubiki-progress-v1')).learning.modules.routine),fixture.wrapper,'Unrelated writes do not downgrade a future routine');}}
  });
  await test('due-break-waits-for-completed-boundary','kubiki',async h=>{
   await h.open();await h.page.locator('[data-pv-open="practice"]').first().click();await h.page.locator('[data-pv-task-select]').selectOption('pv.value.247');
   const p=await h.context.newPage();await p.goto(base);await p.addScriptTag({url:base+'learning-progress.js'});await p.evaluate(()=>{
    const key='kubiki-progress-v1',raw=JSON.parse(localStorage.getItem(key)||'{}'),L=LearningProgress;
    let learning=L.clean(raw.learning,raw.resetEpoch||'initial');const prior=L.getModule(learning,'routine')?.state||{version:1,seen:{'kubiki-progress-v1':[]}};
    learning=L.setModule(learning,'routine',{...prior,version:1,tasks:5,seconds:600,taskLimit:5,minuteLimit:10,enabled:true},{ownerId:'synthetic-remote',updatedAt:Date.now()});
    const a=L.attempt('qa.foreign.correct',['qa.foreign.skill'],{generation:raw.resetEpoch||'initial'});learning=L.record(learning,{...a,outcome:'correct'});raw.learning=learning;localStorage.setItem(key,JSON.stringify(raw));
   });
   eq(await h.page.locator('#practice-root').isVisible(),false,'A foreign correct event cannot interrupt unfinished work');await h.page.locator('#pv-answer').fill('40');eq(await h.page.locator('#practice-root').isVisible(),false,'Typing a draft does not trigger the due pause');eq(await h.page.evaluate(()=>state.solved),false);
   await h.page.locator('[data-pv-action="check"]').click();await h.page.locator('#practice-root').waitFor({state:'visible'});eq((await snap(h.page)).kind,'breaks');eq(await h.page.evaluate(()=>state.solved),true,'The interrupted host task is already completed');await h.page.locator('[data-ab-action="skip"]').click();await h.page.locator('#practice-root').waitFor({state:'hidden'});eq(await h.page.locator('#pv-answer').inputValue(),'40');eq(await h.page.evaluate(()=>state.solved),true,'Skipping returns to the same completed answer');await p.close();
  });
  await test('mouse-drag-life-items-and-zero-loss','kubiki',async h=>{
   await openHub(h,'quests');await lifeOpen(h.page,'life.places.after-play');const q=await lifeQuest(h.page),item=q.itemIds[0],zone=q.accepted[item][0];
   const source=h.page.locator('[data-practice-drag="'+item+'"]').first(),target=h.page.locator('[data-practice-drop="'+zone+'"]').first();
   await source.scrollIntoViewIfNeeded();const a=await source.boundingBox(),b=await target.boundingBox();ok(!!a&&!!b);await h.page.mouse.move(a.x+a.width/2,a.y+a.height/2);await h.page.mouse.down();await h.page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await h.page.mouse.up();
   eq((await snap(h.page)).state.placements[item],zone,'Physical mouse drag moves the item to its zone');eq(await h.page.locator('.ph-drag-ghost').count(),0,'No drag ghost remains');await h.page.locator('[data-lq-action="undo"]').click();eq((await snap(h.page)).state.placements,{});await h.shot('mouse-drag-life-scene');
  });
  await test('touch-drag-and-mobile-concepts-320','slovograd',async h=>{
   await openHub(h,'concepts');await conceptTopic(h.page,'russian.speech');const task=await conceptTask(h.page),item=Object.keys(task.answer)[0],zone=task.answer[item];
   const source=h.page.locator('[data-practice-drag="'+item+'"]'),target=h.page.locator('[data-practice-drop="'+zone+'"]');await source.scrollIntoViewIfNeeded();
   let a=await source.boundingBox(),b=await target.boundingBox();await h.page.locator('#practice-root').evaluate((el,offset)=>{el.scrollTop+=offset;},Math.max(0,Math.min(a.y,b.y)-60));a=await source.boundingBox();b=await target.boundingBox();
   const from={x:a.x+a.width/2,y:a.y+a.height/2},to={x:b.x+b.width/2,y:b.y+b.height/2};ok(from.y>=0&&to.y>=0&&from.y<844&&to.y<844,'Touch source and zone fit the viewport');
   const cdp=await h.context.newCDPSession(h.page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[from]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   eq((await snap(h.page)).state.placements[item],zone,'A real touch event sequence places the word');await noOverflow(h.page);await h.shot('concepts-touch-320');
  },{width:320,height:844,touch:true});
  await test('mobile-quests-sort-pack-plan-320','bricks',async h=>{
   await openHub(h,'quests');for(const id of ['life.places.after-play','life.sport.pool','life.plan.bedtime']){await lifeOpen(h.page,id);await noOverflow(h.page);await h.shot('quests-'+id.split('.').at(-1)+'-320');}
  },{width:320,height:844,touch:true});
  for(const folder of ['kubiki','bricks','slovograd'])await test('standalone-new-modules-'+folder,folder,async h=>{
   const standaloneURL=base+folder+'/offline.html',html=fs.readFileSync(path.join(root,folder,'offline.html'),'utf8'),blocked=[];
   await h.context.route('**/*',r=>{if(r.request().url()===standaloneURL)return r.fulfill({status:200,contentType:'text/html',body:html});blocked.push(r.request().url());return r.abort();});
   await h.page.goto(standaloneURL);await h.page.locator('.app-shell').waitFor();await h.page.locator('[data-practice-open="concepts"]').first().click();await h.page.locator('#practice-root').waitFor({state:'visible'});
   await conceptTopic(h.page,folder==='slovograd'?'russian.speech':'math.whole');await conceptAnswer(h.page);await h.page.locator('[data-ct-action="check"]').click();eq((await snap(h.page)).state.solved,true,'Standalone concept works with every other request blocked');
   await h.page.locator('#practice-root [data-practice-open="quests"]').click();await lifeOpen(h.page,'life.sport.pool');const q=await lifeQuest(h.page);for(const id of q.required)await h.page.locator('[data-lq-action="toggle"][data-item="'+id+'"]').click();await h.page.locator('[data-lq-action="check"]').click();eq((await snap(h.page)).state.solved,true,'Standalone quest uses the same interactive logic');
   await h.page.locator('#practice-root [data-practice-open="breaks"]').click();await h.page.locator('[data-ab-action="start"]').click();await h.page.locator('[data-ab-action="skip"]').click();await h.page.locator('#practice-root').waitFor({state:'hidden'});eq(blocked,[],'No external dependency was requested by the new standalone written flows');
  });
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
 const sourceAfter=hashes(),changed=Object.keys(sourceBefore).filter(f=>sourceBefore[f]!==sourceAfter[f]);
 const report={success:results.length>0&&results.every(r=>r.success)&&changed.length===0,checks,cases:results.length,results,skipped,sourceHashes:sourceBefore,sourceFilesChanged:changed,localOnly:true,studentDataAccess:false,productionAccess:false,physicalDevices:false,engine:'Chromium /usr/bin/chromium',limitations:['Touch/viewport emulation is not a physical Safari or Huawei test.','No actual child session or real household action is automatically verified.']};
 fs.writeFileSync(path.join(out,'next-ui-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.success)process.exitCode=1;
}
run().catch(error=>{console.error(error);process.exitCode=1;});
