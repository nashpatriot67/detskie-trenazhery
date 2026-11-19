'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let checks=0,storageReads=0;
const context=vm.createContext({});Object.defineProperty(context,'localStorage',{get(){storageReads++;throw Error('Pure schedule accessed student storage');}});
function run(file){vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});}
for(const file of ['learning-progress.js','life-quest-data.js'])run(file);
const baselineIds=JSON.parse(JSON.stringify(context.LifeQuestData.quests.map(q=>q.id)));
run('life-school-schedule.js');run('life-quests.js');
const D=context.LifeQuestData,S=context.LifeSchoolSchedule,L=context.LifeQuests,LP=context.LearningProgress;
const plain=x=>JSON.parse(JSON.stringify(x)),eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
const env={LP,generation:'schedule-test',observe(){},announce(){}};
const photo={mon:['conversation','math','russian','foreign','reading','workshop-or-functional'],tue:['world','math','russian','pe','reading','pool'],wed:['reading','math','russian','world','club-or-professions'],thu:['foreign','russian','technology','reading','music','pool'],fri:['foreign','pe','russian','math','art']};
eq(S.days.map(d=>d.id),Object.keys(photo));eq(S.days.filter(d=>d.pool).map(d=>d.id),['tue','thu']);
for(const d of S.days){eq(d.lessons.map(l=>l.id),photo[d.id],d.id+' exact photographed lesson order');eq(d.subjects,d.lessons.map(l=>l.title));eq(S.day(d.id),d);eq(S.variantsFor(d.id).map(v=>v.id),['base','rain','request','ready']);eq(S.questsForDay(d.id).length,4);}
for(const invalid of ['__proto__','constructor','toString',null,undefined,{},['mon']]){eq(S.day(invalid),null);eq(S.questId(invalid),null);}
 eq(S.day('sat'),null);eq(S.questId('sat'),null);eq(S.questId('mon','wrong'),null);eq(S.variantsFor('sun'),[]);eq(S.questsForDay('sun'),[]);
eq(S.day('mon').lessons[5].options,['Проектная мастерская','Функциональная грамотность (математика)']);eq(S.day('wed').lessons[4].options,['Читательский клуб','Азбука профессий']);
ok(S.days.every(d=>!d.subjects.some(x=>/английск/i.test(x))),'Foreign language was not guessed from the photo');
const next=['mon','tue','wed','thu','fri','mon','mon'];for(let n=0;n<7;n++){eq(S.nextSchoolDay(n),next[n]);eq(S.weekend(n),n===0||n===6);const rec=S.recommended(n);eq(rec.dayId,next[n]);eq(rec.questId,S.questId(next[n]));eq(rec.weekend,n===0||n===6);if(n===0||n===6)ok(rec.reason.includes('Сегодня выходной'));}
for(let n=0;n<28;n++){const date=new Date(2026,10,1+n,23,45);eq(S.nextSchoolDay(date),next[date.getDay()]);}
eq(S.nextSchoolDay({getDay(){return 6;},getUTCDay(){return 1;}}),'mon','Use local weekday, not UTC');
for(const bad of [null,-1,7,1.2,'2026-11-16',{},new Date(NaN)])eq(S.nextSchoolDay(bad),null);
eq(S.recommended(null).reason,'Выбери учебный день вручную.');
 let weekdayCalls=0;const oneRead=S.recommended({getDay(){return ++weekdayCalls===1?1:2;}});eq(weekdayCalls,1,'A recommendation reads local weekday once, even across midnight');eq(oneRead.dayId,'tue');eq(oneRead.todayId,'mon');
eq(D.validate().success,true);eq(S.validate().success,true);eq(S.validate().quests,20);
for(const id of baselineIds)ok(D.quests.some(q=>q.id===id),'Existing adventure retained: '+id);
function fresh(id){const state=L.create(env);ok(L.handle(state,'open',{quest:id},env));ok(L.handle(state,'begin',{},env));return state;}
function fill(s,q,optional=false,alt=0){for(const id of q.required)L.handle(s,'toggle',{item:id},env);if(optional)for(const id of q.optional)L.handle(s,'toggle',{item:id},env);for(const g of q.alternatives||[])L.handle(s,'toggle',{item:g.items[alt]},env);}
const newQuests=S.days.flatMap(d=>S.questsForDay(d.id));eq(new Set(newQuests.map(q=>q.id)).size,20);let minBank=100,maxBank=0,seenNontrivialOrder=0;
for(const q of newQuests){
 ok(q.id.startsWith('life.school.week.'+q.schedule.dayId+'.'));eq(q.schedule.source,S.source);eq(q.schedule.subjects,S.day(q.schedule.dayId).subjects);eq(q.category,'school');eq(q.mode,'pack');
 ok(q.story.includes('по расписанию 2 А класса'));ok(q.adultNote.includes('условия этой игры'));ok(q.adultNote.includes('не новое требование настоящего учителя'));
 ok(q.conditions.length>=3&&q.conditions.every(s=>typeof s==='string'&&s.length>10));ok(!/для первого урока/.test(q.firstMove));
 eq(q.schedule.provided,q.alreadyProvided);ok(q.itemIds.every(id=>!q.alreadyProvided.includes(id)));ok(q.required.every(id=>!q.alreadyProvided.includes(id)));ok(q.itemIds.length>=18&&q.itemIds.length<=28);minBank=Math.min(minBank,q.itemIds.length);maxBank=Math.max(maxBank,q.itemIds.length);
 const alternatives=q.alternatives.flatMap(g=>g.items),all=q.required.concat(q.optional,q.distractors,alternatives);eq(new Set(all).size,all.length);eq([...q.itemIds].sort(),[...all].sort());eq(new Set(q.itemIds).size,q.itemIds.length);
 if(q.itemIds.join()!==q.required.concat(q.optional,alternatives,q.distractors).join())seenNontrivialOrder++;
 for(const id of q.itemIds){ok(!!D.items[id]);ok(typeof q.why[id]==='string'&&q.why[id].length>20);}
 const grouped=q.bagGroups.flatMap(g=>g.itemIds);eq([...new Set(grouped)].sort(),[...new Set(q.required.concat(q.optional,alternatives))].sort(),'Groups cover correct visible items');ok(grouped.every(id=>!q.distractors.includes(id)));
 if(q.schedule.dayId==='mon'){eq(q.schedule.selectedLessons.filter(s=>s==='Проектная мастерская'||s==='Функциональная грамотность (математика)').length,1);if(q.schedule.variantId==='request'){ok(q.required.includes('project-folder'));ok(!/В расписании есть технология/.test(q.why.paper));}else ok(!q.required.includes('project-folder'));}
 if(q.schedule.dayId==='wed'){const professions=q.schedule.selectedLessons.includes('Азбука профессий');eq(q.required.includes('profession-cards'),professions);eq(q.required.includes('reader-diary'),!professions);}
 if(q.schedule.variantId==='ready'){ok(q.alreadyProvided.length>0);ok(q.conditions.some(s=>s.startsWith('Уже приготовлено')));}
 const s=fresh(q.id);eq(L.evaluate(s).correct,false);fill(s,q);eq(L.evaluate(s).correct,true,q.id+' authored answer works through actual actions');
 const restored=L.restore(plain(s),env);ok(restored);eq(L.model(restored),L.model(s));eq(restored.attempt.attemptId,s.attempt.attemptId);L.handle(s,'check',{},env);eq(s.solved,true);eq(s.real[q.id]?.selfReported===true,false,'Virtual packing is not actual packing');
 const withOptional=fresh(q.id);fill(withOptional,q,true);eq(L.evaluate(withOptional).correct,true,'Optional objects are allowed, not required');
 const absent=fresh(q.id);fill(absent,q);L.handle(absent,'toggle',{item:q.required[0]},env);ok(L.evaluate(absent).issues.some(x=>x.code==='missing'&&x.item===q.required[0]));
 const extra=fresh(q.id);fill(extra,q);L.handle(extra,'toggle',{item:q.distractors[0]},env);ok(L.evaluate(extra).issues.some(x=>x.code==='extra'&&x.item===q.distractors[0]));L.handle(extra,'check',{},env);eq(extra.solved,false);L.handle(extra,'undo',{},env);eq(L.evaluate(extra).correct,true,'Undo restores the last meaningful selection');
}
eq(seenNontrivialOrder,20,'Answer order is not the first N cards');
// Independent checks for the full days, rather than reusing the generator.
for(const variant of ['base','rain','request']){
 const tue=D.quests.find(q=>q.id===S.questId('tue',variant));for(const id of ['math-book','russian-book','world-book','reading-book','sport-uniform','sport-shoes','gym-socks','swimwear','swim-cap','towel','pool-slippers','pool-wet-bag'])ok(tue.required.includes(id));
 for(const id of ['foreign-book','music-folder','art-album'])ok(!tue.required.includes(id));
 const thursday=D.quests.find(q=>q.id===S.questId('thu',variant));for(const id of ['foreign-book','russian-book','reading-book','technology-folder','music-folder','swimwear','swim-cap','pool-slippers'])ok(thursday.required.includes(id));for(const id of ['math-book','sport-uniform','world-book'])ok(!thursday.required.includes(id));
 const friday=D.quests.find(q=>q.id===S.questId('fri',variant));for(const id of ['foreign-book','russian-book','math-book','sport-uniform','sport-shoes','art-album'])ok(friday.required.includes(id));for(const id of ['reading-book','world-book','swimwear'])ok(!friday.required.includes(id));
}
const tuesday=D.quests.find(q=>q.id===S.questId('tue'));for(const missing of ['sport-uniform','sport-shoes','pool-slippers','swim-cap']){const s=fresh(tuesday.id);fill(s,tuesday);L.handle(s,'toggle',{item:missing},env);eq(L.evaluate(s).correct,false,'Pool and PE supplies cannot substitute each other');}
for(const d of S.days){const q=D.quests.find(q=>q.id===S.questId(d.id,'rain'));for(const n of [0,1]){const s=fresh(q.id);fill(s,q,false,n);eq(L.evaluate(s).correct,true);L.handle(s,'toggle',{item:q.alternatives[0].items[1-n]},env);eq(L.evaluate(s).correct,true,'Both sensible rain preparations remain valid');}ok(q.bagGroups.some(g=>g.id==='weather'&&g.label==='Приготовлю для выхода'));}
const beforeCount=D.quests.length,beforeItems=Object.keys(D.items).length;ok(S.register(D));eq(D.quests.length,beforeCount);eq(Object.keys(D.items).length,beforeItems);eq(S.validate().success,true,'Register is idempotent');
const other=vm.createContext({});for(const file of ['life-quest-data.js','life-school-schedule.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),other);eq(S.days.map(d=>S.questsForDay(d.id).map(q=>q.itemIds)),other.LifeSchoolSchedule.days.map(d=>other.LifeSchoolSchedule.questsForDay(d.id).map(q=>q.itemIds)),'Reopening never changes bank order');
eq(storageReads,0);console.log(JSON.stringify({success:true,checks,days:5,newQuests:20,minBank,maxBank,existingQuestsKept:baselineIds.length,foreignLanguageNotGuessed:true,weekendsExplicit:true,poolAndPeSeparate:true,providedNeverRequired:true,storageReads,productionAccess:false}));
