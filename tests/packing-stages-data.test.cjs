'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});let checks=0,storageReads=0;
Object.defineProperty(context,'localStorage',{get(){storageReads++;throw Error('Pure stage bank accessed storage');}});
for(const file of ['life-quest-data.js','life-school-schedule.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const D=context.LifeQuestData,S=context.LifeSchoolSchedule,plain=v=>JSON.parse(JSON.stringify(v)),eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;},sorted=a=>[...a].sort();
const common=['pencil-case','school-diary','change-shoes','shoe-bag'];
const oldBase=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'life-quest-data.js'),'utf8'),oldBase);
// This lesson order is a manual transcription of the supplied timetable.
const order={mon:['conversation','math','russian','foreign','reading','workshop-or-functional'],tue:['world','math','russian','pe','reading','pool'],wed:['reading','math','russian','world','club-or-professions'],thu:['foreign','russian','technology','reading','music','pool'],fri:['foreign','pe','russian','math','art']};
eq(D.quests.length,74);eq(S.validate().success,true);eq(D.validate().success,true);
const all=S.days.flatMap(d=>S.questsForDay(d.id));eq(all.length,20);
// Freeze the already reviewed day criteria independently of the new stage
// implementation: stages must not change answers, cards or saved real plans.
const beforeStageContract=all.map(q=>[q.id,q.required,q.optional,q.distractors,q.alternatives,q.itemIds,q.alreadyProvided,q.realSteps]);
eq(crypto.createHash('sha256').update(JSON.stringify(beforeStageContract)).digest('hex'),'25443d1769a34efaed893b9571ccdf7e6c03116376c0010a11bc1422ca2485c3','All 20 previous whole-day criteria remain unchanged');
let maxBank=0,emptyLessonStages=0,laterDistractors=0;
for(const q of all){
 const a=q.packingStages,lessons=a.filter(s=>s.kind==='lesson'),day=q.schedule.dayId;
 eq(a[0].id,'common');eq(a[0].kind,'common');eq(lessons.map(s=>s.lessonId),order[day],q.id+' exact lesson order');eq(lessons.map(s=>s.lessonIndex),order[day].map((_,i)=>i));eq(lessons.map(s=>s.title),q.schedule.selectedLessons);
 eq(sorted(a[0].required),sorted(common.filter(id=>!q.alreadyProvided.includes(id))),'Common things are a mandatory separate first step');eq(sorted(a[0].provided),sorted(common.filter(id=>q.alreadyProvided.includes(id))));
 for(const field of ['required','optional']){const values=a.flatMap(s=>s[field]);eq(sorted(values),sorted(q[field]),q.id+' exact '+field+' partition');eq(new Set(values).size,values.length,'A physical item is assigned only once');}
 eq(a.flatMap(s=>s.alternatives),q.alternatives,'Rain alternatives keep the original min/max');
 const owner=new Map();a.forEach((s,i)=>s.allowed.forEach(id=>{ok(!owner.has(id),'No duplicated ownership');owner.set(id,i);}));
 const earlier=new Set();
 for(let i=0;i<a.length;i++){
  const s=a[i];ok(typeof s.id==='string'&&s.id.length<160);ok(typeof s.instruction==='string'&&s.instruction.length>15);ok(Array.isArray(s.conditions)&&s.conditions.length>0);ok(s.conditions.every(t=>typeof t==='string'&&t.length>10));
  eq(sorted(s.allowed),sorted(s.required.concat(s.optional,s.alternatives.flatMap(g=>g.items))));eq(new Set(s.itemIds).size,s.itemIds.length);maxBank=Math.max(maxBank,s.itemIds.length);ok(s.itemIds.length<=14,'The child sees a compact current-step bank');
  ok(s.itemIds.every(id=>q.itemIds.includes(id)),'No arbitrary new cards appear');ok(s.allowed.every(id=>s.itemIds.includes(id)),'Every permitted current-step answer is selectable');ok(s.itemIds.every(id=>!s.provided.includes(id)&&!s.reused.includes(id)),'Prepared or reused things are not asked again');
  ok(s.provided.every(id=>q.alreadyProvided.includes(id)));ok(s.reused.every(id=>earlier.has(id)),'Reuse points to an earlier owned physical item');
  for(const id of s.itemIds){ok(typeof s.why[id]==='string'&&s.why[id].length>10,'Every visible card has an explanation');if(owner.has(id)&&owner.get(id)>i){ok(s.why[id].includes('позже'),'A later useful thing is not described as globally unnecessary');laterDistractors++;}}
  if(!s.allowed.length){eq(s.itemIds,[],'An itemless lesson is a short explanation, not a guessing bank');ok(s.conditions.some(t=>/ничего нового|отдельных вещей не нужно/.test(t)));if(s.kind==='lesson')emptyLessonStages++;}
  s.allowed.forEach(id=>earlier.add(id));
 }
 const optional=a.at(-1);eq(optional.kind,'optional');eq(optional.required,[],'Optional extras can be skipped without an error');ok(optional.optional.includes('water'));ok(!a[0].required.includes('water'),'Water is not silently made compulsory');
 const weather=a.filter(s=>s.kind==='weather');eq(weather.length,q.schedule.variantId==='rain'?1:0);
 if(weather.length){ok(a.indexOf(weather[0])>a.indexOf(lessons.at(-1)));eq(weather[0].required,[]);eq(sorted(weather[0].allowed),['raincoat','umbrella']);eq(weather[0].alternatives[0].min,1);eq(weather[0].alternatives[0].max,2);}
 const pool=lessons.find(s=>s.lessonId==='pool'),pe=lessons.find(s=>s.lessonId==='pe');
 eq(!!pool,['tue','thu'].includes(day));eq(!!pe,['tue','fri'].includes(day));if(pool){eq(pool.destination,'Отдельно в сумку бассейна');ok(!pool.allowed.includes('sport-shoes'));if(q.optional.includes('goggles'))ok(pool.optional.includes('goggles'));}if(pe){eq(pe.destination,'Отдельно для физкультуры');ok(!pe.allowed.includes('swim-cap'));}
}
const get=(day,v,id)=>S.questsForDay(day).find(q=>q.schedule.variantId===v).packingStages.find(s=>s.id===id);
const conversation=get('mon','base','lesson.conversation');eq(conversation.required,[]);eq(conversation.itemIds,[]);ok(conversation.conditions.some(x=>/общие/i.test(x)),'Conversation relies on the general school kit');
eq(sorted(get('mon','base','lesson.workshop-or-functional').reused),['math-book','math-notebook']);eq(get('mon','base','lesson.workshop-or-functional').required,[],'Functional literacy does not duplicate maths books');
eq(sorted(get('mon','ready','lesson.math').provided),['math-book','math-notebook']);eq(get('mon','ready','lesson.math').required,[]);eq(sorted(get('mon','ready','lesson.workshop-or-functional').provided),['math-book','math-notebook']);
eq(sorted(get('mon','request','lesson.workshop-or-functional').required),['glue','paper','project-folder','safe-scissors']);
eq(get('wed','base','lesson.club-or-professions').reused,['reading-book']);eq(get('wed','base','lesson.club-or-professions').required,['reader-diary']);
eq(sorted(get('wed','request','lesson.club-or-professions').required),['club-book','reader-diary']);eq(get('wed','ready','lesson.club-or-professions').required,['profession-cards']);
eq(sorted(get('thu','request','lesson.technology').required),['model-board','plasticine','technology-folder']);eq(sorted(get('thu','request','lesson.music').required),['music-folder','music-notebook']);
eq(sorted(get('fri','request','lesson.art').required),['art-album','pencils','ruler']);eq(get('fri','ready','lesson.art').required,['art-album']);eq(sorted(get('fri','ready','lesson.art').provided),['art-water-cup','brush','craft-cloth','paints']);
ok(emptyLessonStages>=8);ok(laterDistractors>50,'Banks actively distinguish the current lesson from later ones');
const partialOrders={
 'life.school.math-russian':[['math',1],['russian',2]],
 'life.school.reading-world':[['reading',0],['world',3],['club-or-professions',4]],
 'life.school.art':[['art',4]],'life.school.pe':[['pe',1],['math',3]],
 'life.school.rain':[['reading',0],['russian',2]],'life.pack.pencilcase':[],
 'life.pack.thursday-technology':[['technology',2]],'life.pack.friday-art':[['art',4]]
};
const partial=D.quests.filter(q=>q.packingScope?.kind==='partial');eq(partial.length,8);eq(D.quests.filter(q=>q.packingStages).length,28);eq(D.quests.filter(q=>!q.packingStages).length,46);
for(const q of partial){
 const old=oldBase.LifeQuestData.quests.find(x=>x.id===q.id),a=q.packingStages;
 eq([q.id,q.required,q.optional,q.distractors,q.alternatives||[],q.itemIds,q.realSteps],[old.id,old.required,old.optional,old.distractors,old.alternatives||[],old.itemIds,old.realSteps],'The partial task keeps its exact original answer criteria and real plan');
 eq(a[0].kind,'common');eq(a.filter(s=>s.kind==='lesson').map(s=>[s.lessonId,s.lessonIndex]),partialOrders[q.id],'Covered lessons follow their actual timetable positions');
 for(const field of ['required','optional']){const merged=a.flatMap(s=>s[field]);eq(sorted(merged),sorted(q[field]));eq(new Set(merged).size,merged.length);}
 eq(a.flatMap(s=>s.alternatives),q.alternatives||[]);ok(a[0].conditions.some(x=>/отдельн|досборк/.test(x)),'A mini preparation explains its partial scope');
 const seen=new Set();for(const s of a){ok(s.itemIds.every(id=>q.itemIds.includes(id)));ok(s.allowed.every(id=>s.itemIds.includes(id)));ok(s.reused.every(id=>seen.has(id)));s.allowed.forEach(id=>seen.add(id));}
}
const pePartial=partial.find(q=>q.id==='life.school.pe');eq(pePartial.packingStages[0].required,['pencil-case']);ok(pePartial.packingStages.find(s=>s.lessonId==='pe').required.includes('shoe-bag'),'This mini-story uses its shoe bag for sports, not as an invented general requirement');
for(const id of ['life.school.art','life.pack.thursday-technology','life.pack.friday-art']){const q=partial.find(q=>q.id===id);eq(q.packingStages[0].required,[]);eq(q.packingStages[0].itemIds,[]);ok(q.packingStages[0].conditions.some(x=>/уже готовы/.test(x)));}
const pencilcase=partial.find(q=>q.id==='life.pack.pencilcase');eq(pencilcase.packingStages.filter(s=>s.kind==='lesson').length,0);ok(pencilcase.packingStages[0].conditions.some(x=>x.includes('принадлежности')));ok(!pencilcase.packingStages[0].conditions.some(x=>x.includes('Пенал уже содержит')),'A pencil-case check must not say its required contents are already packed');
for(const q of D.quests.filter(q=>q.category!=='school'))eq(q,oldBase.LifeQuestData.quests.find(x=>x.id===q.id),'The 46 non-school adventures are unchanged');
for(const q of D.quests.filter(q=>q.packingStages)){const shown=new Set(q.packingStages.flatMap(s=>s.itemIds));ok(q.distractors.every(id=>shown.has(id)),'Every authored global distractor remains visible in at least one step');}
const original=plain(all.map(q=>q.packingStages));S.register(D);eq(D.quests.length,74,'Idempotent registration never duplicates tasks');eq(S.days.flatMap(d=>S.questsForDay(d.id)).map(q=>q.packingStages),original);eq(storageReads,0);
console.log(JSON.stringify({success:true,checks,weekdayVariants:20,partialPreparations:8,stagedQuests:28,unchangedOtherQuests:46,exactLessonOrder:true,mandatoryCommonFirst:true,previousDayCriteriaUnchanged:true,physicalItemsNotDuplicated:true,emptyLessonStages,laterDistractors,maxBank,storageReads,productionAccess:false}));
