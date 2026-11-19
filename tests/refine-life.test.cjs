'use strict';
// Synthetic learners only. This exercises guidance, semantic scenes and tiny
// real-world self reports without touching browser storage or published data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let storageAccess=0,checks=0;
function context(reduced=false){const c=vm.createContext({matchMedia:()=>({matches:reduced})});Object.defineProperty(c,'localStorage',{get(){storageAccess++;throw Error('Engine must not access storage');}});for(const f of ['learning-progress.js','life-quest-data.js','life-quests.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});return c;}
const c=context(),L=c.LifeQuests,D=c.LifeQuestData,LP=c.LearningProgress,plain=x=>JSON.parse(JSON.stringify(x));let events=[];
const env={LP,generation:'refine-test',day:'2026-11-19',observe:e=>events.push(plain(e)),announce(){}};
const eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;};
const act=(s,a,p,e=env)=>L.handle(s,a,p||{},e),fresh=id=>{const s=L.create(env);if(id){act(s,'open',{quest:id});act(s,'begin');}return s;};
function topo(q,reverse=false){const out=[],todo=q.steps.map(s=>s.id);while(todo.length){const ready=todo.filter(id=>q.before.every(([a,b])=>b!==id||out.includes(a))),id=reverse?ready.at(-1):ready[0];assert.ok(id,'Authored ordering is acyclic');out.push(id);todo.splice(todo.indexOf(id),1);}return out;}
function solve(s,q){if(q.mode==='rule')act(s,'rule',{rule:q.ruleChoices[0].id});if(['sort','rule'].includes(q.mode)){const expected=q.mode==='rule'?q.ruleChoices[0].accepted:q.accepted;for(const id of q.itemIds)act(s,'drop',{item:id,zone:expected[id].at(-1)});}if(q.mode==='pack'){for(const id of q.required)act(s,'toggle',{item:id});for(const g of q.alternatives||[])for(const id of g.items.slice(-g.min))act(s,'toggle',{item:id});}if(q.mode==='sequence')for(const id of topo(q,true))act(s,'step',{step:id});}
function guide(s){act(s,'show-how');act(s,'guide-next');act(s,'guide-select');act(s,'guide-place',{zone:'demo-target'});}

// All old content is retained. New teaching metadata belongs to the same bank.
eq(D.validate().success,true);eq(D.quests.length,38);for(const q of D.quests){ok(q.scene);ok(q.firstMove.length>15&&q.firstMove.length<140);ok(q.microReal.length>20&&q.microReal.length<180);ok((q.realSteps||[]).length>1);}
const menu=L.render(fresh(),env);for(const id of ['life.places.after-play','life.school.math-russian','life.plan.bedtime'])ok(menu.includes('data-quest="'+id+'"'));ok(!/серия дней|потерял|штраф|привычка сформирована/i.test(menu));

// The example teaches a method. It never moves a real answer, verifies a task,
// records an error for an unfinished demo or makes later work independent.
for(const q of D.quests){
 let s=fresh(q.id);if(q.mode==='sort')act(s,'drop',{item:q.itemIds[0],zone:q.zoneIds.at(-1)});if(q.mode==='pack')act(s,'toggle',{item:q.itemIds[0]});if(q.mode==='sequence')act(s,'step',{step:q.steps[0].id});
 const model=plain(L.model(s)),undo=plain(s.undo),prior=events.length;
 act(s,'show-how');eq(s.phase,'guide');eq(s.guide.step,0);ok(s.attempt.assistance.explanation);eq(L.model(s),model);eq(s.undo,undo);eq(s.solved,false);ok(!s.done[q.id]);eq(events.length,prior);
 let html=L.render(s,env);ok(html.includes('Это отдельный учебный пример'));ok(!html.includes('data-practice-drop='),'The demo cannot drop a real task object');
 s=L.restore(plain(s),env);eq(s.phase,'guide');eq(s.guide.step,0);eq(L.model(s),model);
 act(s,'guide-next');act(s,'guide-place',{zone:'demo-target'});eq(s.guide.step,1);eq(s.attempt.errors,0,'An incomplete teaching interaction is not an assessment error');
 act(s,'guide-select');s=L.restore(plain(s),env);eq(s.guide.selected,true);act(s,'guide-place',{zone:'demo-target'});eq(s.guide.step,2);eq(s.guideSeen[q.id],true);eq(L.model(s),model);eq(s.undo,undo);eq(s.solved,false);eq(events.length,prior);
 act(s,'guide-finish');eq(s.phase,'play');ok(s.attempt.assistance.explanation);eq(L.model(s),model);act(s,'reset');ok(s.attempt.assistance.explanation);solve(s,q);act(s,'check');eq(s.solved,true);ok(s.done[q.id].helped);ok(events.at(-1).assistance.explanation);
 const p=LP.record(LP.empty(env.generation),events.at(-1));eq(LP.classify(p.observations[0]),'assisted','A taught solution remains assisted');
}

// Scene layout is a projection of the learner's current choices, even a wrong
// choice. It never silently sends a thing to the expected destination.
for(const q of D.quests){const s=fresh(q.id);let scene=L.sceneState(s);eq(scene.type,q.scene);eq(scene.complete,false);eq(scene.items.length,q.itemIds.length);for(const point of scene.items)ok(point.x>=0&&point.x<=800&&point.y>=0&&point.y<=338);
 if(q.mode==='sort'){const id=q.itemIds[0],wrong=q.zoneIds.find(z=>!q.accepted[id].includes(z))||q.zoneIds[0];act(s,'drop',{item:id,zone:wrong});scene=L.sceneState(s);eq(scene.items.find(v=>v.id===id).place,wrong);eq(s.motion.kind,'item');eq(s.motion.to,wrong);act(s,'undo');eq(L.sceneState(s).items.find(v=>v.id===id).place,'floor');}
 if(q.mode==='pack'){const id=q.distractors[0]||q.itemIds[0];act(s,'toggle',{item:id});eq(L.sceneState(s).items.find(v=>v.id===id).place,'bag');eq(s.solved,false);act(s,'toggle',{item:id});eq(L.sceneState(s).items.find(v=>v.id===id).place,'floor');}
 if(q.mode==='sequence'){for(const id of topo(q,true))act(s,'step',{step:id});eq(L.sceneState(s).planned,topo(q,true));const html=L.render(s,env);for(const id of s.order)ok(html.includes('data-plan-layer="'+id+'"'),q.id+' has an actual scene layer for '+id);eq(s.solved,false);act(s,'scene-play');eq(s.motion.kind,'preview');eq(s.solved,false,'A plan animation is not completion');}
 const html=L.render(s,env);ok(html.includes('Сейчас — один шаг'));ok(!/<img\b|<iframe\b|https?:/i.test(html),'Scenes need no remote images');}

// A very small real action can be attempted directly. It is distinct from
// virtual mastery, the complete routine and the adult's manual confirmation.
let small=fresh(),before=events.length;
act(small,'mission-real',{quest:'life.plan.bed'});eq(small.phase,'small-real');eq(small.solved,false);const q=L.current(small);eq(small.real[q.id].checks,q.realSteps.map(()=>false));
act(small,'small-done');eq(small.real[q.id].microDay,env.day);eq(small.real[q.id].selfReported,false);eq(small.real[q.id].adultReported,false);eq(small.real[q.id].checks,q.realSteps.map(()=>false));eq(Object.keys(small.done).length,0);eq(events.length,before);eq(small.mission.history.length,1);
act(small,'small-done');eq(small.mission.history.length,1,'A repeated same-day tap is not a new action');small=L.restore(plain(small),env);eq(small.phase,'small-real');ok(L.render(small,env).includes('Маленький шаг отмечен тобой'));act(small,'small-game');eq(small.phase,'play');eq(small.solved,false);
for(let day=1;day<=24;day++){const e={...env,day:'2026-10-'+String(day).padStart(2,'0')};act(small,'real-small',{},e);act(small,'small-done',{},e);}eq(small.mission.history.length,14);eq(small.mission.history.at(-1).source,'child');eq(small.mission.history.at(-1).day,'2026-10-24');eq(events.length,before);ok(!/штраф|потеря|серия|привычка сформирована/i.test(L.render(small,{...env,day:'2026-11-30'})));
act(small,'small-later');eq(small.view,'menu');act(small,'open',{quest:q.id});eq(small.phase,'small-real');act(small,'small-game');solve(small,q);act(small,'check');act(small,'real');act(small,'real-toggle',{index:0});ok(L.render(small,env).includes('Отмечено 1 из '+q.realSteps.length+' шагов'));act(small,'real-later');small=L.restore(plain(small),env);act(small,'open',{quest:q.id});act(small,'real');eq(small.real[q.id].checks[0],true);eq(small.real[q.id].checks.filter(Boolean).length,1);eq(small.real[q.id].selfReported,false);

// Older version-1 snapshots without these optional fields still restore.
const old=plain(fresh(q.id));for(const k of ['guide','guideSeen','motion','motionSeq','mission'])delete old[k];old.real[q.id]={checks:q.realSteps.map(()=>false),selfReported:false,adultReported:false};const restored=L.restore(old,env);ok(restored);eq(restored.mission.history,[]);eq(restored.real[q.id].microDay,'');eq(L.model(restored),L.model(old));

// Semantic animation uses the actual chosen route, with a static fallback.
function element(attrs={},animated=true){return {attrs,style:{},calls:[],getAttribute(k){return this.attrs[k];},animate:animated?function(frames,options){const a={frames,options,cancelled:false,cancel(){this.cancelled=true;},finished:new Promise(()=>{})};this.calls.push(a);return a;}:undefined};}
function dom(s,animated=true){const q=L.current(s),scene=element(),flight=element({},animated),source=element({},animated),target=element({},animated),items=L.sceneState(s).items.map(v=>element({'data-scene-item':v.id},animated));return {scene,flight,source,target,items,querySelector(sel){if(sel==='.lq-scene,.lq-guide-scene,.lq-small-real')return scene;if(sel==='[data-guide-flight]'||sel==='[data-lq-flight]')return flight;if(sel==='[data-guide-source]')return source;if(sel==='[data-guide-target]')return s.guide?.done?target:null;return null;},querySelectorAll(sel){return sel==='[data-scene-item]'?items:[];}};}
let moving=fresh('life.places.after-play'),mq=L.current(moving),id=mq.itemIds[0],dest=mq.zoneIds.at(-1);act(moving,'drop',{item:id,zone:dest});let d=dom(moving),raw=plain(moving),animation=L.afterRender(d,moving);eq(animation.kind,'item');eq(animation.animated,true);eq(d.flight.calls[0].options.duration,720);eq(d.flight.calls[0].frames.at(-1).transform,'translate('+L.sceneState(moving).items.find(v=>v.id===id).x+'px,'+L.sceneState(moving).items.find(v=>v.id===id).y+'px)');eq(moving,raw);eq(L.afterRender(d,moving).animated,false);eq(d.flight.calls[0].cancelled,false,'An idempotent post-render call does not interrupt motion');
d=dom(moving,false);eq(L.afterRender(d,moving).animated,false);eq(d.items.find(v=>v.getAttribute('data-scene-item')===id).style.opacity,'1','Older browsers keep the actual destination visible');eq(d.flight.style.opacity,'0');
act(moving,'show-how');d=dom(moving);animation=L.afterRender(d,moving);eq(animation.duration,1800);eq(animation.kind,'demo');eq(moving.solved,false);act(moving,'guide-next');eq(moving.motion,null,'Advancing from the demo does not replay a stale movement');
const reduced=context(true),RL=reduced.LifeQuests,rs=RL.create(env);RL.handle(rs,'open',{quest:mq.id},env);RL.handle(rs,'show-how',{},env);const rd=dom(rs),rBefore=plain(rs),rr=RL.afterRender(rd,rs);eq(rr.reduced,true);eq(rd.flight.calls.length,0);eq(rd.flight.style.opacity,'1','Reduced motion leaves a visible before/after example');eq(rs,rBefore);

// Every draft survives alongside all historical completions, manual full
// reports, daily steps and all guided examples inside the existing 48KiB cap.
let stress=fresh();for(const q of D.quests){act(stress,'open',{quest:q.id});act(stress,'begin');guide(stress);act(stress,'guide-finish');solve(stress,q);act(stress,'check');act(stress,'real');q.realSteps.forEach((_,index)=>act(stress,'real-toggle',{index}));act(stress,'real-report');act(stress,'adult-open');act(stress,'adult-confirm');act(stress,'real-small');act(stress,'small-done');act(stress,'menu');}
for(const q of D.quests){act(stress,'open',{quest:q.id});act(stress,'replay');act(stress,'begin');solve(stress,q);guide(stress);}
eq(Object.keys(stress.done).length,38);eq(Object.keys(stress.drafts).length,38);eq(Object.keys(stress.real).length,38);eq(Object.keys(stress.guideSeen).length,38);ok(L.byteSize(stress)<48*1024);const bytes=L.byteSize(stress);stress=L.restore(plain(stress),env);eq(Object.keys(stress.drafts).length,38);for(const q of D.quests){const draft=plain(stress.drafts[q.id]);act(stress,'open',{quest:q.id});eq(stress.phase,'guide');eq(stress.guide.step,2);eq(L.model(stress),{placements:draft.placements||{},chosen:draft.chosen||[],order:draft.order||[],ruleId:draft.ruleId||null});eq(stress.real[q.id].selfReported,true);eq(stress.real[q.id].adultReported,true);eq(stress.real[q.id].microDay,env.day);}
const progress=LP.setModule(LP.empty(env.generation),'life-quests',stress,{ownerId:'synthetic-test'});ok(LP.getModule(progress,'life-quests'));eq(storageAccess,0);
console.log(JSON.stringify({success:true,checks,quests:38,guidanceNeverSolvesTask:true,guidedResultsAreAssisted:true,dynamicSceneProjection:true,tinyRealStepsAreSeparate:true,allDraftsRetained:true,stressBytes:bytes,oldVersionOneCompatible:true,noGlobalStorageAccess:true,physicalDevices:false}));
