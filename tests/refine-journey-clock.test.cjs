'use strict';
// Synthetic curriculum/clock fixtures only. No learner storage is opened.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),plain=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
let checks=0;const failures=[],passed=[],snapshotBytes={};
function eq(a,b,m){assert.deepEqual(plain(a),plain(b),m);checks++;}
function ok(a,m){assert.ok(a,m);checks++;}
function test(name,fn){try{fn();passed.push(name);}catch(e){failures.push({name,message:e.message,stack:e.stack});}}
function load(context,file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
function curriculum(extra={}){
 const c=vm.createContext(extra);c.window=c;
 for(const file of ['learning-progress.js','concepts.js','kubiki/course.js','math-journey.js','slovograd/lessons.js','russian-journey.js','learning-journey.js','study-clock.js'])load(c,file);
 c.MathJourney.register(c.ConceptTrainer,c.COURSE);return c;
}
const c=curriculum(),{LearningJourney:J,LearningProgress:LP,ConceptTrainer:C,MathJourney:M,RussianJourney:R,StudyClock:S,COURSE}=c;
const generation='synthetic-journey-clock',events=[];
const env={LP,generation,observe:e=>events.push(plain(e)),esc:s=>String(s)};
function state(subject='math',grade=2){return J.create({subject,grade,generation});}
function gate(lesson=1,context={trainerId:'kubiki',kind:'practice',lesson:1,index:0}){return Object.assign({},M.gate(lesson,COURSE),{context});}
function act(s,a,data={}){return J.handle(s,a,data,env);}
function begin(s){if(s.active.run.phase==='intro')ok(act(s,'begin'),'Begin explained prerequisite');}
function answer(s){const t=J.current(s);if(t.kind==='choice')ok(act(s,'choice',{value:t.answer}));else if(['match','classify'].includes(t.kind))for(const [zone,item]of Object.entries(t.answer))ok(act(s,'drop',t.kind==='match'?{zone,item}:{zone:item,item:zone}));else ok(J.capture(s,{querySelector:()=>({value:String(t.answer)})}));}
function solve(s){begin(s);answer(s);ok(act(s,'check'));ok(s.active.run.solved);}
function snapshot(s){const raw=J.snapshot(s),restored=J.restore(plain(raw),env);ok(restored,'Compact snapshot restores');return {raw,restored};}

test('clock-exact-15-minutes-and-no-early-task-count',()=>{
 let r=S.clean({version:1,minuteLimit:8,tasks:1000,seconds:0});eq(r.minimumSeconds,900);eq(r.minuteLimit,15);eq(S.due(r),false,'Task count can never trigger an early pause');
 for(let i=0;i<899;i++)r=S.advance(r,1,{visible:true,focused:true,studying:true});eq(r.seconds,899);eq(S.due(r),false);
 r=S.advance(r,.999,{visible:true,focused:true,studying:true});eq(S.due(r),false,'899.999 seconds is still before 15 minutes');
 r=S.advance(r,.001,{visible:true,focused:true,studying:true});eq(r.seconds,900);eq(S.due(r),true);
 eq(S.due({...r,enabled:false}),false);eq(S.clean({version:1,seconds:900,minimumSeconds:2}).minimumSeconds,900);
});
test('clock-counts-only-focused-visible-study-time',()=>{
 for(const visible of [false,true])for(const focused of [false,true])for(const studying of [false,true]){
  const input=S.clean({version:1,seconds:100}),before=plain(input),result=S.advance(input,1,{visible,focused,studying});
  eq(result.seconds,100+(visible&&focused&&studying?1:0));eq(input,before,'Clock operation does not mutate caller state');
 }
 for(const seconds of [0,-1,2.01,30,3600,NaN,Infinity,'1',undefined])eq(S.advance({version:1,seconds:31},seconds,{visible:true,focused:true,studying:true}).seconds,31,'Background gaps or invalid samples are not backfilled');
 for(const a of [{},{visible:true},{visible:true,focused:true},{visible:1,focused:true,studying:true}])eq(S.advance({version:1,seconds:31},1,a).seconds,31);
 eq(S.advance({version:1,seconds:7199.5},2,{visible:true,focused:true,studying:true}).seconds,7200);
});
test('clock-backward-compatible-clean-and-explicit-reset',()=>{
 const r=S.clean({version:1,seconds:912.25,tasks:12,enabled:false,minuteLimit:5,seen:{'kubiki-progress-v1':['old-award',null,'x'.repeat(161)],alien:['ignore']},lastPause:10});
 eq(r.seconds,912.25);eq(r.tasks,12);eq(r.enabled,false);eq(r.seen,{'kubiki-progress-v1':['old-award']});eq(r.minuteLimit,15);
 const n=S.reset(r,1234);eq(n.seconds,0);eq(n.tasks,0);eq(n.lastPause,1234);eq(n.seen,r.seen);eq(n.enabled,false);eq(r.seconds,912.25);
 eq(S.clean({version:2,seconds:1200}).seconds,0);eq(S.clean({version:1,seconds:-4}).seconds,0);eq(S.clean({version:1,tasks:Infinity}).tasks,0);
});
test('clock-historical-awards-and-new-task-awards-never-bypass-time-gate',()=>{
 const core=vm.createContext({});core.window=core;load(core,'study-clock.js');load(core,'practice-hub.js');const H=core.PracticeHubCore;
 let routine=H.countCorrect({}, {observations:[{eventId:'historical',finalOutcome:'correct'}]},'kubiki-progress-v1');eq(routine.added,0);eq(routine.routine.tasks,0);
 routine=H.countCorrect(routine.routine,{observations:[{eventId:'historical',finalOutcome:'correct'},{eventId:'new',finalOutcome:'correct'},{eventId:'wrong',finalOutcome:'incorrect'}]},'kubiki-progress-v1');eq(routine.added,1);eq(routine.routine.tasks,1);eq(H.due(routine.routine),false);
 eq(H.countCorrect(routine.routine,{observations:[{eventId:'new',finalOutcome:'correct'}]},'kubiki-progress-v1').added,0);eq(H.due({...routine.routine,seconds:899.999,tasks:100}),false);eq(H.due({...routine.routine,seconds:900}),true);
});

test('all-reviewed-gates-have-three-relevant-stable-card-ids',()=>{
 const original=C.TASKS.length;M.register(C,COURSE);R.register(C,c.RUS_LESSONS);eq(C.TASKS.length,original,'Registering reviewed banks twice cannot duplicate cards');
 const configs=[...M.coverage(COURSE),...R.bank.topics.flatMap(t=>[1,2].map(grade=>R.gateFor({grade,lessonId:t.id.slice('russian.lesson.'.length),section:'spelling',mode:'write'}))),...['build','read','exchange','arithmetic'].map(kind=>M.pvGate({kind}))];
 for(const raw of configs){const cfg=J.config(raw);ok(cfg,'Known reviewed gate accepted');eq(cfg.taskIds.length,3);eq(new Set(cfg.taskIds).size,3);eq(J.config(raw).taskIds,cfg.taskIds);ok(/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(cfg.id));
  for(const id of cfg.taskIds){const t=C.TASKS.find(t=>t.id===id);ok(t);eq(t.topic,cfg.topicId,'Every prerequisite card concerns the exact lesson family');}
 }
 const first=J.config(gate(1));ok(!first.taskIds.some(id=>/multiply|divide/.test(id)));
 const grade1=J.config(R.gateFor({grade:1,lessonId:'spell-zhishi'}));eq(grade1.grade,1,'Grade-1 gate is not silently promoted');
 const prefix=J.config(R.gateFor({grade:1,lessonId:'morph-prefix'}));eq(prefix.grade,2,'Reviewed advanced card requires internal grade 2');eq(prefix.context.grade,1,'The original grade-1 practice callback remains intact');
});
test('gate-configuration-rejects-missing-duplicate-unrelated-and-oversized-context',()=>{
 const cfg=gate(1);for(const bad of [null,{}, {...cfg,id:''},{...cfg,id:'bad id'}, {...cfg,taskIds:[]},{...cfg,taskIds:[cfg.taskIds[0],cfg.taskIds[0]]},{...cfg,taskIds:['missing.card']},{...cfg,topicId:'math.lesson.2'},{...cfg,context:{text:'x'.repeat(17000)}}])eq(J.config(bad),null);
 const cycle={};cycle.self=cycle;eq(J.config({...cfg,context:cycle}),null);
 const before=plain(state());let s=state();eq(J.requireGate(s,{...cfg,taskIds:['missing.card']},env),false);eq(s,before);
});
test('mandatory-gate-cannot-be-skipped-or-completed-by-navigation',()=>{
 const s=state();ok(J.requireGate(s,gate(1),env));eq(J.completed(s),false);eq(J.finish(s),null);
 for(const action of ['skip','grade','topic','menu','repeat','resume']){const old=J.snapshot(s);eq(act(s,action,{value:1,topic:'math.position'}),false,'Cannot bypass mandatory gate with '+action);eq(J.snapshot(s),old);}
 begin(s);eq(act(s,'next'),false);eq(s.active.run.index,0);eq(J.completed(s),false);
 const css=fs.readFileSync(path.join(root,'learning-journey.css'),'utf8');ok(css.includes('[data-ct-action="skip"]')&&css.includes('display:none'),'Skip is also absent from the visible prerequisite UI');
});
test('three-real-checks-complete-the-gate-and-preserve-context',()=>{
 const context={trainerId:'kubiki',kind:'math-next',lesson:5,index:7,mode:'play',draft:{answer:'127',zones:{hundred:1,ten:2,unit:7}}},cfg=gate(5,context),s=state();ok(J.requireGate(s,cfg,env));
 for(let i=0;i<3;i++){eq(s.active.run.index,i);solve(s);eq(J.completed(s),i===2);if(i<2){eq(J.finish(s),null);ok(act(s,'next'));}}
 const done=J.finish(s);eq(done,context);eq(s.active,null);eq(s.solved,false);eq(s.gates[cfg.id].status,'completed');eq(s.gates[cfg.id].revision,1);eq(s.gates[cfg.id].assisted,true,'Initial explanation remains assistance');eq(J.satisfied(s,cfg),true);eq(J.requireGate(s,cfg,env),false);eq(J.finish(s),null,'Completion callback cannot be emitted twice by the model');
 eq(J.satisfied(s,{...cfg,revision:2}),false,'New mastery criteria require a fresh checked gate');
});
test('compact-restore-keeps-attempt-id-first-error-and-all-help-flags',()=>{
 let s=state();ok(J.requireGate(s,gate(7),env));begin(s);answer(s);ok(act(s,'check'));ok(act(s,'next'));
 const t=J.current(s);ok(t.kind==='choice');ok(act(s,'choice',{value:t.options.find(o=>o.id!==t.answer).id}));ok(act(s,'check'));eq(s.active.run.solved,false);
 ok(act(s,'hint'));ok(act(s,'explain'));ok(act(s,'return'));LP.help(s.active.run.attempt,'workedExample');s.active.run.attempt.assistance.generic=true;
 const old=plain(s.active.run.attempt),priorEvents=events.length,{raw,restored}=snapshot(s);ok(raw.active.run.at,'Attempt is saved in compact form');eq(raw.active.run.queue,undefined,'Queue is recovered from stable gate configuration');
 s=restored;eq(s.active.run.attempt,old);eq(s.active.run.attempt.assistance,{explanation:true,visual:true,afterError:true,workedExample:true,generic:true});eq(s.active.run.attempt.firstOutcome,'incorrect');eq(s.active.run.attempt.errors,1);eq(events.length,priorEvents,'Restoring a draft does not emit or credit a new observation');
 answer(s);ok(act(s,'check'));eq(events.at(-1).attemptId,old.attemptId);eq(events.at(-1).assistance.afterError,true);eq(s.active.run.done[t.id].afterError,true);eq(s.active.run.done[t.id].assisted,true);
});
test('draft-switch-cancel-and-restore-retain-exact-unfinished-work',()=>{
 let s=state();const a=gate(3,{kind:'resume-a',answer:'123'}),b=gate(8,{kind:'resume-b'});ok(J.requireGate(s,a,env));begin(s);const first=J.current(s),[zone,item]=Object.entries(first.answer)[0];ok(act(s,'drop',{zone,item}));ok(act(s,'select',{item:first.items[1].id}));const before=plain(s.active.run);
 ok(J.requireGate(s,b,env));eq(s.active.config.id,b.id);eq(s.drafts[a.id].config.context,{},'Suspended curriculum drafts do not duplicate large parent task contexts');ok(J.requireGate(s,a,env));eq(s.active.run.index,before.index);eq(s.active.run.placements,before.placements);eq(s.active.run.selected,before.selected);eq(s.active.run.attempt,before.attempt);eq(s.active.config.context,a.context);
 ({restored:s}=snapshot(s));eq(s.active.run.placements,before.placements);eq(s.active.run.selected,before.selected);eq(s.active.run.attempt.attemptId,before.attempt.attemptId);eq(Object.keys(s.drafts).sort(),[a.id,b.id].sort());
});
test('schema-generation-and-pending-cycle-isolation',()=>{
 const s=state();ok(J.requireGate(s,gate(1),env));s.pendingCycles={kubiki:{kind:'math-next',lesson:1,index:3},bricks:{kind:'worksheet'},slovograd:{section:'spelling',mode:'dictation'},life:{quest:'fixture'}};const {raw,restored}=snapshot(s);eq(restored.pendingCycles,s.pendingCycles);
 eq(J.restore({...raw,version:2},env),null);eq(J.restore({...raw,generation:'previous-reset'},env),null);eq(J.restore(raw,{...env,generation:'new-reset'}),null);eq(J.restore(raw,{generation,LP:null}),null);
 const foreign=plain(raw);foreign.pendingCycles.unrelated={x:1};foreign.pendingCycles.kubiki={text:'x'.repeat(17000)};const clean=J.restore(foreign,env);eq(clean.pendingCycles.unrelated,undefined);eq(clean.pendingCycles.kubiki,undefined);eq(clean.pendingCycles.slovograd,s.pendingCycles.slovograd);
});
test('lossless-string-pool-and-old-uncompressed-drafts-are-both-readable',()=>{
 const s=state(),first=gate(3,{trainerId:'kubiki',kind:'resume',answer:'302',model:{hundred:2,ten:9,unit:12}}),second=gate(7);ok(J.requireGate(s,first,env));begin(s);answer(s);ok(act(s,'hint'));ok(J.requireGate(s,second,env));begin(s);ok(act(s,'hint'));
 const before=plain(s),raw=J.snapshot(s);eq(s,before,'Creating a compact snapshot cannot alter the in-memory draft');eq(raw.draftFormat,'strings-v1');eq(new Set(raw.draftStrings).size,raw.draftStrings.length,'The pool stores each exact string once');
 for(const id of first.taskIds)ok(raw.draftStrings.includes(id),'Pool contains the full stable ID, not a course/bank index');
 const restored=J.restore(raw,env);ok(restored);eq(restored.drafts,s.drafts);eq(restored.active.config.context,s.active.config.context);eq(J.snapshot(restored),raw,'Compaction is exactly reproducible across reloads');
 const old=plain(s);if(old.active)old.active.run=plain(s.active.run);const oldRestored=J.restore(old,env);ok(oldRestored,'Previously persisted full config/run drafts remain supported');eq(oldRestored.drafts,s.drafts);eq(oldRestored.active.run.attempt,s.active.run.attempt);eq(oldRestored.active.config.context,s.active.config.context);
 eq(J.restore({...raw,draftFormat:'future-format'},env),null,'A future snapshot encoding stays opaque');eq(J.restore({...raw,draftStrings:null},env),null);
});
test('all-math-and-both-russian-grade-drafts-fit-existing-48-KiB-module',()=>{
 for(const subject of ['math','russian']){
  const s=state(subject),configs=subject==='math'?M.coverage(COURSE):R.bank.topics.flatMap(t=>[1,2].map(grade=>R.gateFor({grade,lessonId:t.id.slice('russian.lesson.'.length),section:'spelling',mode:'write',topic:'synthetic',taskId:'fixture'})));
  for(const cfg of configs){s.grade=J.config(cfg).grade;ok(J.requireGate(s,cfg,env));begin(s);ok(act(s,'hint'));}
  const snap=J.snapshot(s),bytes=Buffer.byteLength(JSON.stringify(snap));snapshotBytes[subject]=bytes;ok(bytes<=LP.MAX_ACTIVITY_BYTES,subject+' realistic unfinished curriculum snapshot must fit 48 KiB; got '+bytes+' bytes');
  const learning=LP.setModule(LP.empty(generation),'journey',snap,{ownerId:'synthetic-test'});ok(LP.getModule(learning,'journey'),'Existing persistence accepts all drafts');
  const restored=J.restore(snap,env);ok(restored);eq(Object.keys(restored.drafts).sort(),Object.keys(s.drafts).sort(),'No unfinished prerequisite is evicted');for(const [id,draft]of Object.entries(s.drafts))eq(restored.drafts[id],draft,'Every config and attempt restores exactly: '+id);
 }
});

// Execute the real PracticeHub with a minimal DOM and controlled foreground
// clock. DOM geometry is intentionally not claimed as a browser/UI test.
function hostFixture(){
 let at=100,focused=true,studying=true,nextTimer=0;const timers=new Map(),intervals=[],storage={},windowEvents={},documentEvents={},trace={complete:[],cancel:[],closed:0};
 class Element{
  constructor(tag='div'){this.tagName=tag;this.dataset={};this.style={};this.hidden=false;this.listeners={};this.children=[];this.textContent='';this.attrs={};this.innerHTML='';this.className='';this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)};}
  addEventListener(n,f){(this.listeners[n]||(this.listeners[n]=[])).push(f);}
  setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}
  appendChild(el){el.parentNode=this;this.children.push(el);return el;}prepend(el){el.parentNode=this;this.children.unshift(el);}after(){}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}
  contains(){return false;}focus(){}matches(){return false;}getClientRects(){return[{}];}
  querySelector(selector){if(this.id==='practice-root'){if(selector==='#practice-content')return content;if(selector==='#practice-live')return live;if(selector==='#practice-clock-slot')return slot;if(selector==='.ph-back')return back;if(selector==='.ph-header')return header;if(selector==='.ph-fieldset')return fieldset;}
   if(this===app&&selector==='.practice-launcher')return launcher;return this.children.find(e=>selector==='.'+e.className)||null;}
  querySelectorAll(){return[];}
 }
 const app=new Element(),launcher=new Element('nav'),content=new Element(),live=new Element(),slot=new Element(),back=new Element('button'),header=new Element(),fieldset=new Element(),body=new Element('body');app.id='app';body.appendChild(app);app.appendChild(launcher);launcher.className='practice-launcher';
 const doc={body,activeElement:body,hidden:false,hasFocus:()=>focused,getElementById:id=>id==='app'?app:body.children.find(e=>e.id===id)||null,createElement:tag=>new Element(tag),querySelector:selector=>selector==='.practice-launcher'?launcher:null,querySelectorAll:selector=>selector==='.practice-break-offer'?[...launcher.children,...slot.children].filter(e=>e.className==='practice-break-offer'):[],addEventListener:(n,f)=>(documentEvents[n]||(documentEvents[n]=[])).push(f),dispatchEvent:e=>{if(e.type==='practice:closed')trace.closed++;for(const f of documentEvents[e.type]||[])f(e);}};
 class FakeDate extends Date{static now(){return 1_700_000_000_000+at;}}
 const ctx=curriculum({document:doc,Date:FakeDate,performance:{now:()=>at},CSS:{escape:s=>s},CustomEvent:class{constructor(type){this.type=type;}},MutationObserver:class{observe(){}},queueMicrotask:f=>f(),setInterval:f=>{intervals.push(f);return intervals.length;},setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms,at:at+ms});return id;},clearTimeout:id=>timers.delete(id),localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>{storage[k]=String(v);}},location:{href:'https://synthetic.invalid/kubiki/'},history:{replaceState(){}}});ctx.addEventListener=(n,f)=>(windowEvents[n]||(windowEvents[n]=[])).push(f);
 load(ctx,'coach-plan.js');load(ctx,'active-breaks.js');load(ctx,'practice-hub.js');const H=ctx.PracticeHub;H.mount({storageKey:'kubiki-progress-v1',subject:'math',trainerId:'kubiki',assessment:{},isStudyActive:()=>studying,atBoundary:()=>true,onConceptGateComplete:x=>trace.complete.push(plain(x)),onConceptGateCancel:x=>trace.cancel.push(plain(x))});
 function dispatchWindow(name){for(const f of windowEvents[name]||[])f({type:name});}
 function step(seconds=1){at+=seconds*1000;for(const f of intervals)f();}
 function flush(ms=2600){at+=ms;const pending=[...timers].filter(([,t])=>t.at<=at);for(const [id,t]of pending){if(!timers.has(id))continue;timers.delete(id);t.fn();}}
 function click(action,data={}){const host=doc.getElementById('practice-root'),button={dataset:{ctAction:action,...data},disabled:false,closest:s=>s==='button,a'?button:null};for(const f of host.listeners.click||[])f({target:button,preventDefault(){},stopPropagation(){}});}
 function solveCurrent(){let snapshot=H.snapshot();if(snapshot.state.active.run.phase==='intro'){click('begin');snapshot=H.snapshot();}const task=ctx.LearningJourney.current(snapshot.state);if(task.kind==='choice')click('choice',{value:task.answer});else for(const [zone,item]of Object.entries(task.answer))click('drop',{zone,item});click('check');}
 function routine(){const p=JSON.parse(storage['kubiki-progress-v1']||'{}');return ctx.LearningProgress.getModule(ctx.LearningProgress.clean(p.learning,'initial'),'routine')?.state;}
 return {ctx,H,trace,storage,timers,doc,click,solveCurrent,step,flush,routine,dispatchWindow,setFocus(value){focused=value;dispatchWindow(value?'focus':'blur');},setHidden(value){doc.hidden=value;doc.dispatchEvent({type:'visibilitychange'});},setStudying(value){studying=value;},html:()=>doc.getElementById('practice-root')?.innerHTML||''};
}
test('real-host-clock-does-not-count-background-blur-or-non-study',()=>{
 const h=hostFixture();for(let i=0;i<300;i++)h.step();eq(h.routine().seconds,300);
 h.setHidden(true);for(let i=0;i<90;i++)h.step();eq(h.routine().seconds,300);h.setHidden(false);
 h.setFocus(false);for(let i=0;i<60;i++)h.step();eq(h.routine().seconds,300);h.setFocus(true);
 h.setStudying(false);for(let i=0;i<50;i++)h.step();eq(h.routine().seconds,300);h.setStudying(true);
 h.step(3600);eq(h.routine().seconds,300,'Suspended background interval cannot create an hour of activity');for(let i=0;i<599;i++)h.step();eq(h.ctx.PracticeHubCore.due(h.routine()),false);h.step();eq(h.routine().seconds,900);eq(h.ctx.PracticeHubCore.due(h.routine()),true);
});
test('real-host-cycle-boundary-cannot-open-a-break-before-15-minutes',()=>{
 const h=hostFixture(),boundary={context:{trainerId:'kubiki',kind:'math-next',lesson:2,index:4}};eq(h.H.open('breaks'),false);eq(h.H.cycleBoundary(boundary),false);eq(h.H.snapshot(),null);
 for(let i=0;i<899;i++)h.step();eq(h.H.cycleBoundary(boundary),false);eq(h.H.open('breaks'),false);eq(h.H.snapshot(),null);
 h.step();eq(h.H.cycleBoundary(boundary),true);eq(h.H.snapshot().kind,'breaks');eq(h.H.snapshot().state.phase,'choose');eq(h.H.snapshot().state.running,false,'Even a due cycle pause waits for the child to press Start');
 const raw=JSON.parse(h.storage['kubiki-progress-v1']),journey=h.ctx.LearningProgress.getModule(raw.learning,'journey');eq(journey.state.pendingCycles.kubiki,boundary.context,'The exact next task is kept until returning from the pause');
});
test('real-host-gate-advances-automatically-only-after-correct-answer',()=>{
 const h=hostFixture(),cfg=gate(7,{trainerId:'kubiki',kind:'practice',lesson:7,index:2});ok(h.H.requireConcepts(cfg));eq(h.H.snapshot().state.active.run.index,0);eq(h.trace.complete,[]);h.solveCurrent();ok(h.H.snapshot().state.active.run.solved);eq(h.H.snapshot().state.active.run.index,0,'Success feedback is shown before progression');ok([...h.timers.values()].some(t=>t.ms===2600));h.flush(2599);eq(h.H.snapshot().state.active.run.index,0);h.flush(1);eq(h.H.snapshot().state.active.run.index,1);
 const t=h.ctx.LearningJourney.current(h.H.snapshot().state);h.click('choice',{value:t.options.find(o=>o.id!==t.answer).id});h.click('check');h.flush();eq(h.H.snapshot().state.active.run.index,1,'Wrong answer never advances');eq(h.H.snapshot().state.active.run.attempt.assistance.afterError,true);h.solveCurrent();h.flush();eq(h.H.snapshot().state.active.run.index,2);h.solveCurrent();h.flush();eq(h.H.snapshot(),null);eq(h.trace.complete,[cfg.context]);eq(h.H.requireConcepts(cfg),false,'Completed gate does not recur before every practice question');
});
test('real-host-manual-next-close-background-and-focus-cancel-stale-autonext',()=>{
 const h=hostFixture(),cfg=gate(8,{trainerId:'kubiki',kind:'resume',lesson:8,index:4});ok(h.H.requireConcepts(cfg));h.solveCurrent();h.click('next');eq(h.H.snapshot().state.active.run.index,1);h.flush();eq(h.H.snapshot().state.active.run.index,1,'Manual next cancels its earlier automatic callback');
 h.solveCurrent();const attempt=h.H.snapshot().state.active.run.attempt.attemptId;h.setFocus(false);h.flush();eq(h.H.snapshot().state.active.run.index,1,'Blur holds successful feedback');h.setFocus(true);h.flush();eq(h.H.snapshot().state.active.run.index,2);
 h.solveCurrent();h.setHidden(true);h.flush();eq(h.H.snapshot().state.active.run.index,2,'Hidden page cannot finish a gate');h.setHidden(false);h.H.close();eq(h.trace.cancel,[cfg.context]);h.flush();eq(h.trace.complete,[]);eq(h.H.snapshot(),null);
 ok(h.H.requireConcepts(cfg));eq(h.H.snapshot().state.active.run.index,2);ok(h.H.snapshot().state.active.run.solved,'Closing preserves the already checked last card');ok(h.H.snapshot().state.active.run.attempt.attemptId!==attempt);h.flush();eq(h.trace.complete,[cfg.context]);eq(h.H.snapshot(),null);
});

const result={success:failures.length===0,checks,tests:passed.length+failures.length,passed:passed.length,failed:failures.map(({name,message})=>({name,message})),snapshotBytes,syntheticDataOnly:true,physicalDevices:false};
console.log(JSON.stringify(result,null,2));if(failures.length){for(const f of failures)console.error(f.stack);process.exitCode=1;}
