'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});let storageAccess=0;
Object.defineProperty(context,'localStorage',{get(){storageAccess++;throw Error('Pure module accessed storage');}});
for(const file of ['learning-progress.js','life-quest-data.js','life-quests.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const L=context.LifeQuests,D=context.LifeQuestData,LP=context.LearningProgress;let checks=0,events=[],learning=LP.empty('test-generation');
const eq=(a,b,message)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),message);checks++;};const ok=(a,message)=>{assert.ok(a,message);checks++;};
const env={LP,generation:'test-generation',observe(event){events.push(event);learning=LP.record(learning,event);},announce(){}};
function fresh(id){const state=L.create(env);if(id){L.handle(state,'open',{quest:id},env);L.handle(state,'begin',{},env);}return state;}
function action(s,a,p){return L.handle(s,a,p||{},env);}
function topological(q,reverse){const pool=q.steps.map(s=>s.id),order=[];while(pool.length){const candidates=pool.filter(id=>q.before.every(([a,b])=>b!==id||order.includes(a))),id=reverse?candidates.at(-1):candidates[0];if(!id)throw Error('Cyclic content');order.push(id);pool.splice(pool.indexOf(id),1);}return order;}
function fill(s,q,{alternative=0,reverse=false,optional=false}={}){
 if(q.mode==='rule')action(s,'rule',{rule:q.ruleChoices[alternative%q.ruleChoices.length].id});
 if(q.mode==='sort'||q.mode==='rule'){const accepted=q.mode==='rule'?q.ruleChoices[alternative%q.ruleChoices.length].accepted:q.accepted;for(const id of q.itemIds)action(s,'drop',{item:id,zone:accepted[id][Math.min(alternative,accepted[id].length-1)]});}
 if(q.mode==='pack'){for(const id of q.required)action(s,'toggle',{item:id});if(optional)for(const id of q.optional)action(s,'toggle',{item:id});for(const g of q.alternatives||[])for(const id of g.items.slice(alternative,alternative+g.min))action(s,'toggle',{item:id});}
 if(q.mode==='sequence')for(const id of topological(q,reverse))action(s,'step',{step:id});
}
eq(D.validate().success,true);eq(D.validate().quests,38);ok(Object.keys(D.items).length>=80);eq(D.validate().modes,{sort:15,rule:1,pack:14,sequence:8});
eq(storageAccess,0,'Loading banks and pure engines never reads storage');
const menu=fresh();const html=L.render(menu,{});for(const name of ['Вещи по местам','Сортируем','В школу','На тренировку','На музыку','Прогулки и поездки','Планы на день'])ok(html.includes(name),'Readable category '+name);ok(!/https?:|<img\b|<iframe\b/.test(html),'No external image/network dependency');
let solvedVariants=0;
for(const q of D.quests){
 const s=fresh(q.id);eq(s.phase,'play');eq(s.solved,false);eq(L.current(s).id,q.id);eq(L.evaluate(s).correct,false,'Empty activity is not a successful answer');
 fill(s,q);eq(L.evaluate(s).correct,true,q.id+' exact authored conditions');
 const before=events.length;action(s,'check');eq(s.solved,true,q.id+' actual actions complete');eq(events.length,before+1);eq(events.at(-1).evidenceKind,'virtual-life-task');eq(events.at(-1).subject,'life');eq(s.done[q.id].count,1);
 const restored=L.restore(JSON.parse(JSON.stringify(s)),env);ok(restored,q.id+' raw saved state restores');eq(L.model(restored),L.model(s));eq(restored.solved,true);ok(L.byteSize(s)<48*1024);
 const finalHTML=L.render(restored,{});ok(finalHTML.includes('Попробовать в жизни'));ok(!/привычка освоена|проверено системой|камера|серия дней/i.test(finalHTML));
 const observations=events.length;action(s,'real');eq(s.phase,'real');const r=s.real[q.id];eq(r.selfReported,false);eq(action(s,'real-report'),false,'No report before real-plan ticks');
 q.realSteps.forEach((_,i)=>action(s,'real-toggle',{index:i}));action(s,'real-report');eq(r.selfReported,true);eq(r.adultReported,false);eq(events.length,observations,'Child real-world report is not a new correct learning observation');
 eq(action(s,'adult-confirm'),false,'Adult mark requires separate adult area');action(s,'adult-open');action(s,'adult-confirm');eq(r.adultReported,true);eq(events.length,observations,'Adult mark stays distinct and manual');
 action(s,'real-toggle',{index:0});eq(r.selfReported,false);eq(r.adultReported,false,'Changing plan invalidates both reporting flags');
 action(s,'menu');eq(s.view,'menu');eq(s.questId,null);ok(s.done[q.id]);action(s,'open',{quest:q.id});eq(s.solved,true,'Known completed layout remains available without a new observation');eq(events.length,observations);action(s,'replay');eq(s.solved,false);eq(s.phase,'intro');eq(s.done[q.id].count,1,'Replay does not erase prior virtual completion');
 solvedVariants++;
}
// Contextually valid placements are all accepted, not a hard-coded single zone.
let alternativeDestinations=0;
for(const q of D.quests.filter(q=>q.mode==='sort'&&q.itemIds.some(id=>q.accepted[id].length>1))){const s=fresh(q.id);fill(s,q,{alternative:1});eq(L.evaluate(s).correct,true);alternativeDestinations++;}
ok(alternativeDestinations>=1);
// Rule choice is an explicit action. Every supported rule must be usable.
const qr=D.quests.find(q=>q.mode==='rule');for(let i=0;i<qr.ruleChoices.length;i++){const s=fresh(qr.id);eq(action(s,'drop',{item:qr.itemIds[0],zone:'match'}),true);eq(s.placements,{},'Unchosen rule cannot silently sort');fill(s,qr,{alternative:i});eq(L.evaluate(s).correct,true);}
const changedRule=fresh(qr.id);fill(changedRule,qr);const prior=JSON.parse(JSON.stringify(changedRule.placements)),oldRule=changedRule.ruleId;action(changedRule,'rule',{rule:qr.ruleChoices[1].id});eq(changedRule.placements,{});action(changedRule,'undo');eq(changedRule.placements,prior);eq(changedRule.ruleId,oldRule);
// Packing: required, suitable optional, distractors and genuine alternatives.
for(const q of D.quests.filter(q=>q.mode==='pack')){
 const s=fresh(q.id);fill(s,q,{optional:true});eq(L.evaluate(s).correct,true,q.id+' optional suitable things are allowed');
 const needed=q.required[0];action(s,'toggle',{item:needed});ok(L.evaluate(s).issues.some(i=>i.code==='missing'&&i.item===needed));action(s,'toggle',{item:needed});
 if(q.distractors.length){const extra=q.distractors[0];action(s,'toggle',{item:extra});ok(L.evaluate(s).issues.some(i=>i.code==='extra'&&i.item===extra));action(s,'check');ok(s.feedback.text.includes('провер'));ok(L.render(s,{}).includes(q.why[extra]));action(s,'undo');eq(L.evaluate(s).correct,true);}
}
const rain=D.quests.find(q=>q.id==='life.school.rain');for(const rainItem of ['umbrella','raincoat']){const s=fresh(rain.id);for(const id of rain.required)action(s,'toggle',{item:id});eq(L.evaluate(s).correct,false);action(s,'toggle',{item:rainItem});eq(L.evaluate(s).correct,true,'Either rain-protection alternative is sufficient');action(s,'toggle',{item:rainItem==='umbrella'?'raincoat':'umbrella'});eq(L.evaluate(s).correct,true,'Both permitted alternatives are also valid');}
// A partial order accepts equivalent strategies and rejects actual reversals.
let flexiblePlans=0;
for(const q of D.quests.filter(q=>q.mode==='sequence')){
 const forward=topological(q,false),reverse=topological(q,true),s=fresh(q.id);for(const id of reverse)action(s,'step',{step:id});eq(L.evaluate(s).correct,true,'Alternative topological plan is accepted');if(forward.join()!==reverse.join())flexiblePlans++;
 const [a,b]=q.before[0],bad=forward.slice(),ia=bad.indexOf(a),ib=bad.indexOf(b);[bad[ia],bad[ib]]=[bad[ib],bad[ia]];s.order=bad;eq(L.evaluate(s).correct,false,'Actual prerequisite reversal is rejected');ok(L.evaluate(s).issues.some(i=>i.code==='order'));
}
ok(flexiblePlans>=6,'Most routines admit independent-step alternatives');
const planQ=D.quests.find(q=>q.mode==='sequence'),plan=fresh(planQ.id);action(plan,'step',{step:planQ.steps[0].id});action(plan,'step',{step:planQ.steps[1].id});action(plan,'up',{step:planQ.steps[1].id});eq(plan.order,[planQ.steps[1].id,planQ.steps[0].id]);action(plan,'undo');eq(plan.order,[planQ.steps[0].id,planQ.steps[1].id]);action(plan,'drop',{item:planQ.steps[1].id,zone:'bank'});eq(plan.order,[planQ.steps[0].id]);
// Errors/help survive reset, undo, reopening and the later correct answer.
const q=D.quests.find(q=>q.mode==='sort'),s=fresh(q.id);action(s,'hint');action(s,'check');const attemptId=s.attempt.attemptId;ok(s.attempt.assistance.visual);ok(s.attempt.assistance.afterError);const errorCount=s.attempt.errors;action(s,'reset');eq(s.attempt.attemptId,attemptId);eq(s.attempt.errors,errorCount);ok(s.attempt.assistance.visual);fill(s,q);const pending=L.restore(JSON.parse(JSON.stringify(s)),env);ok(pending);eq(pending.attempt.attemptId,attemptId);eq(pending.undo.length,s.undo.length);action(pending,'check');eq(events.at(-1).firstOutcome,'incorrect');ok(events.at(-1).assistance.visual);eq(LP.classify(learning.observations.find(e=>e.attemptId===attemptId)),'assisted');
eq(L.restore({...JSON.parse(JSON.stringify(s)),version:99},env),null);eq(L.restore(JSON.parse(JSON.stringify(s)),{...env,generation:'another-reset'}),null);const tooBig=JSON.parse(JSON.stringify(s));tooBig.feedback={text:'я'.repeat(25000),type:'hint'};ok(JSON.stringify(tooBig).length<48*1024);eq(L.restore(tooBig,env),null,'Restoration limit is UTF8 bytes, not JS character count');
const escaped=JSON.parse(JSON.stringify(s));escaped.feedback={text:'<img src=x onerror=alert(1)>',type:'hint'};const safe=L.restore(escaped,env);ok(L.render(safe,{}).includes('&lt;img'));ok(!L.render(safe,{}).includes('<img src=x'));
const material=fresh('life.sort.wood'),materialHTML=L.render(material,{});ok(materialHTML.includes('дерево'));ok(materialHTML.includes('пластик'));ok(materialHTML.includes('<svg'));ok(materialHTML.includes('fill="#dc7167"'));ok(materialHTML.includes('scale(.625)'),'Small shapes are visually smaller');
// Stress every authored quest, all real checklists, and all unfinished replays.
let stress=L.create(env);
for(const q of D.quests){action(stress,'open',{quest:q.id});action(stress,'begin');fill(stress,q);action(stress,'check');action(stress,'real');q.realSteps.forEach((_,i)=>action(stress,'real-toggle',{index:i}));action(stress,'real-report');action(stress,'adult-open');action(stress,'adult-confirm');stress=L.restore(JSON.parse(JSON.stringify(stress)),env);ok(stress);}
eq(Object.keys(stress.done).length,38);eq(Object.keys(stress.real).length,38);const completedBytes=L.byteSize(stress);
for(const q of D.quests){action(stress,'open',{quest:q.id});action(stress,'replay');action(stress,'begin');fill(stress,q,{reverse:true,optional:true});action(stress,'hint');action(stress,'reset');fill(stress,q,{reverse:true,optional:true});if(q.mode==='sort'||q.mode==='rule'){const id=q.itemIds[0];action(stress,'remove',{item:id});}else if(q.mode==='pack')action(stress,'toggle',{item:q.required[0]});else action(stress,'unstep',{step:q.steps[0].id});action(stress,'check');}
eq(Object.keys(stress.drafts).length,38,'Every unfinished quest remains saved, without a count-based eviction');eq(Object.keys(stress.done).length,38,'Earlier completions remain');eq(Object.keys(stress.real).length,38,'Real action reports remain');ok(L.byteSize(stress)<48*1024);const stressBytes=L.byteSize(stress);const moduleProgress=LP.setModule(LP.empty(env.generation),'life-quests',stress,{ownerId:'test-writer'});ok(LP.getModule(moduleProgress,'life-quests'),'Complete catalogue state fits existing module snapshot limit');
const savedStress=L.restore(JSON.parse(JSON.stringify(stress)),env);eq(Object.keys(savedStress.drafts).length,38);eq(Object.keys(savedStress.done).length,38);for(const q of D.quests){const snapshot=JSON.parse(JSON.stringify(savedStress.drafts[q.id]));action(savedStress,'open',{quest:q.id});eq(L.model(savedStress),{placements:snapshot.placements||{},chosen:snapshot.chosen||[],order:snapshot.order||[],ruleId:snapshot.ruleId||null},q.id+' unfinished answer retained');ok(savedStress.attempt.assistance.visual);ok(savedStress.attempt.assistance.afterError);}
eq(storageAccess,0);
console.log(JSON.stringify({success:true,checks,quests:38,solvedVariants,alternativeDestinations,flexiblePlans,ruleVariants:qr.ruleChoices.length,completedCatalogueBytes:completedBytes,allUnfinishedAndDoneBytes:stressBytes,all38DraftsRetained:true,realActionsAreManualReports:true,storageAccess,networkAccess:false}));
