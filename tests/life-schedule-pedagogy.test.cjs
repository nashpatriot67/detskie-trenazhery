'use strict';
// Independent expectations transcribed from the parent's timetable/photo.
// These tests do not derive the expected weekdays or packing answers from the generator.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});let checks=0,storageAccess=0;
Object.defineProperty(context,'localStorage',{get(){storageAccess++;throw Error('No learner data belongs in this audit');}});
for(const file of ['learning-progress.js','life-quest-data.js','life-school-schedule.js','life-quests.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const D=context.LifeQuestData,S=context.LifeSchoolSchedule,L=context.LifeQuests,LP=context.LearningProgress;
const plain=v=>JSON.parse(JSON.stringify(v)),eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
const quest=id=>{const q=D.quests.find(q=>q.id===id);assert.ok(q,id);return q;};
const photo={
 mon:['conversation','math','russian','foreign','reading','workshop-or-functional'],
 tue:['world','math','russian','pe','reading','pool'],
 wed:['reading','math','russian','world','club-or-professions'],
 thu:['foreign','russian','technology','reading','music','pool'],
 fri:['foreign','pe','russian','math','art']
};
const COMMON=['pencil-case','school-diary','change-shoes','shoe-bag'];
const MATH=['math-book','math-notebook'],RUS=['russian-book','russian-notebook'],FOREIGN=['foreign-book','foreign-notebook'],WORLD=['world-book','world-notebook'];
const PE=['sport-uniform','sport-shoes','gym-socks'],POOL=['swimwear','swim-cap','towel','pool-slippers','shower-gel','pool-wet-bag','spare-underwear'];
const baseExpected={
 mon:[...COMMON,...MATH,...RUS,...FOREIGN,'reading-book'],
 tue:[...COMMON,...WORLD,...MATH,...RUS,'reading-book',...PE,...POOL],
 wed:[...COMMON,'reading-book',...MATH,...RUS,...WORLD,'reader-diary'],
 thu:[...COMMON,...FOREIGN,...RUS,'reading-book','technology-folder','paper','glue','safe-scissors','music-folder',...POOL],
 fri:[...COMMON,...FOREIGN,...RUS,...MATH,...PE,'art-album','paints','brush','art-water-cup','craft-cloth']
};
eq(D.validate().success,true);eq(S.validate().success,true);eq(S.days.map(d=>d.id),Object.keys(photo));
for(const [day,lessons]of Object.entries(photo)){
 eq(S.day(day).lessons.map(l=>l.id),lessons,'Exact ordered lessons from photo: '+day);
 eq(quest('life.school.week.'+day+'.base').required.slice().sort(),baseExpected[day].slice().sort(),'Independent full-day packing memo: '+day);
 eq(S.questsForDay(day).length,4);
 for(const q of S.questsForDay(day)){
  const needs=new Set(q.required),provided=new Set(q.alreadyProvided),covered=new Set([...needs,...provided]);
  eq(q.schedule.lessons.map(l=>l.id),lessons,'No extra lessons introduced by scenario');
  eq(q.schedule.pool,day==='tue'||day==='thu','Golden Fish means pool only Tuesday/Thursday');
  for(const id of PE)eq(covered.has(id),day==='tue'||day==='fri','PE clothes and shoes follow the real weekday: '+q.id+'/'+id);
  for(const id of POOL)eq(covered.has(id),day==='tue'||day==='thu','Pool and PE are distinct preparations: '+q.id+'/'+id);
  for(const [subject,items]of [['math',MATH],['russian',RUS],['foreign',FOREIGN],['world',WORLD],['reading',['reading-book']]])for(const id of items)eq(covered.has(id),lessons.includes(subject),'Subject quantity follows weekday: '+q.id+'/'+id);
  for(const id of provided){ok(!q.itemIds.includes(id),'Already prepared cards are never requested again');ok(!needs.has(id));ok(q.conditions.some(text=>text.includes(D.items[id].label)),'Prepared item is disclosed before answering');}
  for(const id of q.required)ok(q.conditions.join(' ').toLowerCase().includes(D.items[id].label.toLowerCase()),'Every required thing is specified before the answer: '+q.id+'/'+id);
  ok(q.conditions.length>=3);ok(/условия этой игры/.test(q.adultNote),'Photo is not treated as an invented equipment list');
  ok(/не новое требование/.test(q.adultNote));ok(!/английск|English/i.test(q.schedule.subjects.join(' ')),'Photo does not identify the foreign language');
  ok(q.itemIds.length>=18&&q.itemIds.length<=28);ok(q.distractors.length>=3,'Full day retains meaningful distractors');
  ok(!/первого урока/.test(q.firstMove),'Conversation or prepared first-lesson equipment creates no hidden obligation');
 }
}
// Alternating lessons remain alternatives, including their actual materials.
eq(S.day('mon').lessons[5].options,['Проектная мастерская','Функциональная грамотность (математика)']);
eq(S.day('wed').lessons[4].options,['Читательский клуб','Азбука профессий']);
const monProject=quest('life.school.week.mon.request');
for(const id of ['paper','glue','safe-scissors']){ok(monProject.required.includes(id));ok(!/В расписании есть технология/.test(monProject.why[id]),'Project materials must not invent a Monday technology lesson');}
ok(!quest('life.school.week.mon.base').required.includes('project-folder'));
ok(quest('life.school.week.wed.ready').required.includes('profession-cards'));ok(!quest('life.school.week.wed.ready').required.includes('reader-diary'));
// Independent student actions: a plausible wrong weekday/object is an error.
const env={generation:'pedagogy-test',LP,observe(){},announce(){}};
function prepared(id,items){const s=L.create(env);L.handle(s,'open',{quest:id},env);L.handle(s,'begin',{},env);for(const item of items)L.handle(s,'toggle',{item},env);return s;}
for(const day of Object.keys(photo)){
 const id='life.school.week.'+day+'.base',s=prepared(id,baseExpected[day]);eq(L.evaluate(s).correct,true,'Authored learner actions match independently specified day');
 const ownNeed=day==='thu'?'foreign-book':'math-book';L.handle(s,'toggle',{item:ownNeed},env);eq(L.evaluate(s).correct,false,'A real missing school requirement is detected');
}
for(const day of ['tue','thu']){
 const q=quest('life.school.week.'+day+'.base'),s=prepared(q.id,baseExpected[day]);
 L.handle(s,'toggle',{item:'pool-slippers'},env);eq(L.evaluate(s).correct,false,'PE shoes cannot replace pool slippers');
}
const thu=quest('life.school.week.thu.base');ok(thu.distractors.includes('math-book'));const wrongThu=prepared(thu.id,baseExpected.thu.concat('math-book'));eq(L.evaluate(wrongThu).correct,false,'A school object is not automatically needed every day');
for(const day of Object.keys(photo)){
 const q=quest('life.school.week.'+day+'.rain'),a=q.alternatives.find(a=>a.id==='rain-protection');eq([a.min,a.max],[1,2]);
 const s=prepared(q.id,q.required);eq(L.evaluate(s).correct,false,'Rain needs a deliberate choice');L.handle(s,'toggle',{item:'umbrella'},env);eq(L.evaluate(s).correct,true);L.handle(s,'toggle',{item:'raincoat'},env);eq(L.evaluate(s).correct,true,'Both sensible rain choices remain valid');
 const weather=q.bagGroups.find(g=>g.id==='weather');ok(/выход/.test(weather.label),'Clothing is prepared for the journey rather than placed among books');
}
// Calendar recommendation is preparation for a named school day, never a fabricated weekend lesson.
eq(S.recommended(new Date(2026,10,20,23,30)).dayId,'mon'); // Friday night
eq(S.recommended(new Date(2026,10,21,9)).dayId,'mon');eq(S.recommended(new Date(2026,10,21,9)).weekend,true);
eq(S.recommended(new Date(2026,10,22,18)).dayId,'mon');eq(S.recommended(new Date(2026,10,19,19)).dayId,'fri');
ok(/выходной/.test(S.recommended(new Date(2026,10,21,9)).reason));
// Exact regressions for the parent's examples and the independently audited old conditions.
const after=quest('life.places.school-return');ok(after.accepted['math-notebook'].includes('bookshelf'));ok(after.accepted['math-notebook'].includes('stationery'));ok(/выходной/.test(after.story));ok(/хранить/.test(after.story));
ok(/без измерений и линейки/.test(quest('life.places.desk').story));ok(/тёплый и солнечный/.test(quest('life.trip.sunny-walk').story));
const bridge=quest('life.places.weekend-project');ok(!bridge.accepted['math-notebook'].includes('desk'));ok(bridge.accepted.paper.includes('desk'));
const wet=quest('life.sort.wet-dry');eq(wet.accepted['wet-swimwear'],['wet-now']);eq(wet.accepted['math-book'],['dry-now']);
const pet=quest('life.plan.pet-clean');ok(pet.before.some(([a,b])=>a==='ask'&&b==='clear'));ok(pet.before.some(([a,b])=>a==='check'&&b==='hands'));ok(!pet.itemIds.includes('kitten'));
eq(storageAccess,0);
console.log(JSON.stringify({success:true,checks,photoDays:5,independentDayMemos:5,weekdayScenarios:20,allLifeScenarios:D.quests.length,conditionsAudited:true,realChildDataAccess:false,productionWrites:false}));
