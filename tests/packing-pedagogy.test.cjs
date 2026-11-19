'use strict';
// Independent checks against the parent's photo and the previously published
// game memo. A stage must explain its own job without changing the whole day.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({});let checks=0,storageReads=0;
Object.defineProperty(ctx,'localStorage',{get(){storageReads++;throw Error('Pure pedagogy checks must not read learner data');}});
for(const f of ['life-quest-data.js','life-school-schedule.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const D=ctx.LifeQuestData,Q=D.quests.filter(q=>q.schedule),plain=v=>JSON.parse(JSON.stringify(v)),set=a=>[...new Set(a)].sort();
const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;};
const photo={
 mon:['conversation','math','russian','foreign','reading','workshop-or-functional'],
 tue:['world','math','russian','pe','reading','pool'],
 wed:['reading','math','russian','world','club-or-professions'],
 thu:['foreign','russian','technology','reading','music','pool'],
 fri:['foreign','pe','russian','math','art']
};
const common=['pencil-case','school-diary','change-shoes','shoe-bag'];
const math=['math-book','math-notebook'],rus=['russian-book','russian-notebook'],foreign=['foreign-book','foreign-notebook'],world=['world-book','world-notebook'];
const pe=['sport-uniform','sport-shoes','gym-socks'],pool=['swimwear','swim-cap','towel','pool-slippers','shower-gel','pool-wet-bag','spare-underwear'];
const tech=['technology-folder','paper','glue','safe-scissors'],art=['art-album','paints','brush','art-water-cup','craft-cloth'];
const requiredBase={
 mon:[...common,...math,...rus,...foreign,'reading-book'],
 tue:[...common,...world,...math,...rus,...pe,'reading-book',...pool],
 wed:[...common,'reading-book',...math,...rus,...world,'reader-diary'],
 thu:[...common,...foreign,...rus,...tech,'reading-book','music-folder',...pool],
 fri:[...common,...foreign,...pe,...rus,...math,...art]
};
const provided={mon:[...math,'pencil-case'],tue:[...pe,'swim-cap','towel','pool-wet-bag'],wed:[...world,'pencil-case'],thu:[...tech,'shower-gel','towel'],fri:['paints','brush','art-water-cup','craft-cloth']};
function expectedRequired(day,variant){let r=requiredBase[day].slice();
 if(variant==='request'){
  if(day==='mon')r.push('project-folder','paper','glue','safe-scissors');
  if(day==='tue')r.push('observation-sheet','goggles');
  if(day==='wed')r.push('club-book');
  if(day==='thu')r=r.filter(id=>!['paper','glue','safe-scissors'].includes(id)).concat('plasticine','model-board','music-notebook');
  if(day==='fri')r=r.filter(id=>!['paints','brush','art-water-cup','craft-cloth'].includes(id)).concat('pencils','ruler');
 }
 if(variant==='ready'){
  if(day==='wed')r=r.filter(id=>id!=='reader-diary').concat('profession-cards');
  r=r.filter(id=>!provided[day].includes(id));
 }
 return set(r);
}
eq(Q.length,20);eq(D.quests.length,74);eq(D.validate().success,true);
for(const q of Q){
 const {dayId:day,variantId:variant}=q.schedule,stages=q.packingStages;ok(Array.isArray(stages)&&stages.length>photo[day].length,q.id+' has a complete route');
 eq(set(q.required),expectedRequired(day,variant),q.id+' keeps the actual full-day memo');eq(stages[0].kind,'common');eq(stages[0].id,'common');
 eq(set(stages[0].required),set(common.filter(id=>!(q.alreadyProvided||[]).includes(id))),q.id+' begins with the common mandatory school things');
 const lessons=stages.filter(s=>s.kind==='lesson');eq(lessons.map(s=>s.lessonId),photo[day],q.id+' follows the exact photo order');eq(lessons.map(s=>s.lessonIndex),photo[day].map((_,i)=>i));
 eq(stages.filter(s=>s.kind==='weather').length,variant==='rain'?1:0);eq(stages.at(-1).kind,'optional');
 eq(new Set(stages.map(s=>s.id)).size,stages.length,'Each step has a stable unique ID');
 const owners=new Map(),known=new Set(q.alreadyProvided||[]),required=[],optional=[],alternatives=[];
 for(const [index,s]of stages.entries()){
  ok(s.title&&s.instruction&&Array.isArray(s.conditions)&&s.conditions.length,'The current step explains its task');
  const eligible=set([...(s.required||[]),...(s.optional||[]),...(s.alternatives||[]).flatMap(g=>g.items)]);
  required.push(...s.required);optional.push(...s.optional);alternatives.push(...s.alternatives);
  for(const id of eligible){ok(!owners.has(id),q.id+'/'+s.id+' never asks for a second physical copy of '+id);owners.set(id,index);ok(!q.alreadyProvided.includes(id),'Already prepared is never selectable again');}
  for(const id of s.reused)ok(known.has(id),'A reused object must already have been prepared: '+id);
  for(const id of s.provided)ok(q.alreadyProvided.includes(id),'A provided object really is in the stated initial conditions');
  for(const id of s.itemIds){ok(!!D.items[id]&&typeof s.why[id]==='string','Every card has a real object and meaningful feedback');ok(!s.provided.includes(id)&&!s.reused.includes(id),'Prepared objects are described rather than selected twice');}
  ok(s.itemIds.length<=eligible.length+7&&s.itemIds.length<q.itemIds.length,'The child receives a current-step bank, rather than all the day objects at once');
  if(!eligible.length){eq(s.itemIds,[],'No extra equipment means an explicit reading/confirmation step');ok(/не нужно|не нужен|не просили|ничего нового/.test(s.conditions.join(' ')),'An empty step has a reason, not a mystery');}
  [...eligible,...s.provided].forEach(id=>known.add(id));
 }
 eq(set(required),set(q.required),'The stages neither add nor lose a mandatory whole-day object');eq(required.length,set(required).length);eq(set(optional),set(q.optional));eq(optional.length,set(optional).length);
 eq(set(alternatives.flatMap(g=>g.items)),set(q.alternatives.flatMap(g=>g.items)));eq(alternatives.map(g=>[g.id,g.min,g.max]),q.alternatives.map(g=>[g.id,g.min,g.max]));
 for(const [index,s]of stages.entries())for(const id of s.distractors){const target=owners.get(id);if(target>index&&q.required.includes(id))ok(/позже/.test(s.why[id]),'An item needed later is not called globally unnecessary');}
 const conversation=lessons.find(s=>s.lessonId==='conversation');if(conversation){eq(conversation.required,[]);eq(conversation.itemIds,[]);}
 const functional=lessons.find(s=>s.lessonId==='workshop-or-functional');if(functional&&variant!=='request'){eq(functional.required,[]);eq(set([...functional.provided,...functional.reused]),set(math),'The existing maths book and notebook serve the second maths activity');}
 const club=lessons.find(s=>s.lessonId==='club-or-professions');if(club&&variant!=='ready'){ok(club.reused.includes('reading-book'),'The same reading book is reused in the club');ok(!club.required.includes('reading-book'));}
 const poolStep=lessons.find(s=>s.lessonId==='pool'),peStep=lessons.find(s=>s.lessonId==='pe');eq(!!poolStep,['tue','thu'].includes(day));eq(!!peStep,['tue','fri'].includes(day));
 if(poolStep){for(const id of poolStep.required)ok(!pe.includes(id),'Pool and gym equipment remain distinct');if(q.optional.includes('goggles'))ok(poolStep.optional.includes('goggles'),'Swimming glasses remain optional unless the specific memo requires them');}
}
vm.runInContext(fs.readFileSync(path.join(root,'school-packing-flow.js'),'utf8'),ctx,{filename:'school-packing-flow.js'});
const F=ctx.SchoolPackingFlow;
function solve(q,options={}){
 const flow=F.create(q);ok(flow,'A full lesson route can be constructed');
 for(const stage of q.packingStages){
  eq(F.current(q,flow).id,stage.id);eq(F.completed(q,flow),false,'No result is awarded while still preparing a stage');
  for(const id of stage.required)ok(F.toggle(q,flow,id),'Required current-stage thing is selectable');
  if(options.optional)for(const id of stage.optional)ok(F.toggle(q,flow,id));
  for(const group of stage.alternatives){const chosen=options.allAlternatives?group.items:group.items.slice(0,group.min);for(const id of chosen)ok(F.toggle(q,flow,id));}
  const checked=F.check(q,flow);eq(checked.correct,true,q.id+'/'+stage.id+' accepts the specified current task');eq(F.stateFor(q,flow).checked,true);ok(F.next(q,flow),'The child can explicitly continue after checking');
 }
 eq(F.current(q,flow),null);eq(F.completed(q,flow),true);eq(F.evaluate(q,flow).correct,true);return flow;
}
for(const q of Q){
 const flow=solve(q),minimal=q.required.concat(q.alternatives.flatMap(g=>g.items.slice(0,g.min)));
 eq(set(F.chosen(q,flow)),set(minimal),'Skipping optional extras still completes the entire day');eq(F.chosen(q,flow).length,new Set(F.chosen(q,flow)).size);
 const rich=solve(q,{optional:true,allAlternatives:true});eq(set(F.chosen(q,rich)),set(q.required.concat(q.optional,q.alternatives.flatMap(g=>g.items))),'Every suitable optional thing and permitted rain alternative is accepted');
 const restored=F.restore(plain(F.snapshot(rich)),q);ok(restored);eq(plain(restored),plain(rich),'Checked steps and exact selection order survive compact save');
 const legacy=F.create(q,{chosen:minimal,solved:false});ok(legacy);eq(set(F.chosen(q,legacy)),set(minimal),'Existing unfinished bulk answers are retained');eq(legacy.index,0);eq(F.completed(q,legacy),false);eq(F.next(q,legacy),false);ok(Object.values(legacy.steps).every(s=>!s.checked),'A legacy correct-looking draft is not silently treated as confirmed understanding');
 const oldSolved=F.create(q,{chosen:minimal,solved:true});ok(F.completed(q,oldSolved),'An already solved old lesson keeps its existing result');
 const dayChoices=q.required.concat(q.optional,q.alternatives.flatMap(g=>g.items)),nextThing=q.packingStages[0].distractors.find(id=>dayChoices.includes(id));ok(nextThing,'Common step includes a relevant later-preparation choice');
 const mistake=F.create(q);ok(F.toggle(q,mistake,nextThing));const result=F.check(q,mistake);eq(result.correct,false);ok(result.issues.some(i=>i.code==='needed-later'&&i.item===nextThing&&i.belongsTo&&i.targetTitle),'Feedback distinguishes useful-later from globally unnecessary');ok(F.selection(q,mistake).includes(nextThing),'An error never silently removes the child\'s choice');eq(F.next(q,mistake),false,'A wrong stage never advances');ok(F.toggle(q,mistake,nextThing),'The child can fix the choice without resetting');
 const tampered=plain(F.snapshot(flow));tampered.s.common=[[],1];tampered.i=q.packingStages.length;const repaired=F.restore(tampered,q);ok(repaired);eq(repaired.index,0);eq(F.completed(q,repaired),false,'Saved checked flags cannot bypass missing mandatory common things');
 const bypass=F.create(q);eq(F.goto(q,bypass,1),false,'Lesson one cannot bypass the common mandatory preparation');
}
const monday=Q.find(q=>q.schedule.dayId==='mon'&&q.schedule.variantId==='base'),complete=solve(monday),mathIndex=monday.packingStages.findIndex(s=>s.lessonId==='math');
ok(F.goto(monday,complete,mathIndex));const beforeEdit=plain(F.snapshot(complete)),laterAnswers=plain(monday.packingStages.slice(mathIndex+1).map(s=>F.stateFor(monday,complete,s.id).selected));
ok(F.toggle(monday,complete,'math-book'));eq(F.check(monday,complete).correct,false);ok(monday.packingStages.slice(mathIndex).every(s=>!F.stateFor(monday,complete,s.id).checked),'Editing maths invalidates the dependent later confirmations');eq(plain(monday.packingStages.slice(mathIndex+1).map(s=>F.stateFor(monday,complete,s.id).selected)),laterAnswers,'Later answers are preserved when earlier preparation changes');
const undo=F.restore(beforeEdit,monday);ok(undo);eq(undo.index,mathIndex);ok(F.stateFor(monday,undo,'lesson.math').checked);ok(F.goto(monday,undo,monday.packingStages.length));ok(F.completed(monday,undo),'Restoring the exact pre-edit model can undo a change without losing checked progress');
const functionalIndex=monday.packingStages.findIndex(s=>s.lessonId==='workshop-or-functional');ok(F.goto(monday,undo,functionalIndex));eq(F.toggle(monday,undo,'math-book'),false,'The same physical maths book cannot be added a second time at the reuse step');eq(F.check(monday,undo).correct,true);
// The earlier small school games stay small. They must not secretly require a
// second full school bag or reorder the covered lessons from the photo.
const legacyIds=['life.school.math-russian','life.school.reading-world','life.school.art','life.school.pe','life.school.rain','life.pack.pencilcase','life.pack.thursday-technology','life.pack.friday-art'];
const partial=D.quests.filter(q=>q.packingScope?.kind==='partial');eq(set(partial.map(q=>q.id)),set(legacyIds));
for(const q of partial){
 eq(q.packingStages[0].kind,'common');ok(/часть|маленькая|отдельная/.test(q.packingScope.note.toLowerCase()),'A mini-game is clearly labelled as a partial preparation');
 eq(set(q.packingStages.flatMap(s=>s.required)),set(q.required),'A partial task does not invent extra mandatory common objects');
 eq(set(q.packingStages.flatMap(s=>s.optional)),set(q.optional));
 const lessons=q.packingStages.filter(s=>s.kind==='lesson');if(q.packingScope.dayId){const photoIds=photo[q.packingScope.dayId],covered=new Set(lessons.map(s=>s.lessonId));eq(lessons.map(s=>s.lessonId),photoIds.filter(id=>covered.has(id)),'The covered lessons still follow the real day order');eq(lessons.map(s=>s.lessonIndex),lessons.map(s=>photoIds.indexOf(s.lessonId)));}
 if(!q.packingStages[0].required.length)ok(/уже готовы|уже приготовлены/.test(q.packingStages[0].conditions.join(' ')),'An empty common step explains that the rest is already prepared');
 const small=solve(q),answer=q.required.concat((q.alternatives||[]).flatMap(g=>g.items.slice(0,g.min)));eq(set(F.chosen(q,small)),set(answer));
 const old=F.create(q,{chosen:answer,solved:false});ok(old);eq(set(F.chosen(q,old)),set(answer));eq(F.completed(q,old),false,'A pre-update partial answer remains unconfirmed');
}
eq(D.quests.filter(q=>F.supports(q)).length,28,'Only the twenty full days and eight school preparations use the lesson flow');
eq(storageReads,0);
console.log(JSON.stringify({success:true,checks,quests:Q.length,partialSchoolQuests:partial.length,independentPhotoOrder:true,commonFirst:true,noDuplicatePhysicalObjects:true,wholeDayCriteriaUnchanged:true,optionalNeverMandatory:true,legacyDraftsUnconfirmed:true,oldSolvedRetained:true,backEditingRetainsAnswers:true,storageReads,productionWrites:false}));
