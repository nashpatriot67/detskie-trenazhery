'use strict';
// Deterministic authored content: no storage, network or real learner records.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),plain=v=>JSON.parse(JSON.stringify(v));let checks=0,storageReads=0;
const eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(a,m)=>{assert.ok(a,m);checks++;};
function context(source){const c=vm.createContext({});Object.defineProperty(c,'localStorage',{get(){storageReads++;throw Error('Content accessed storage');}});vm.runInContext(source||fs.readFileSync(path.join(root,'life-quest-data.js'),'utf8'),c);return c;}
const c=context(),D=c.LifeQuestData,baseline=context(execFileSync('git',['show','683e3c362dfbcbc7cfaacdd9f11362de5e655cf9:life-quest-data.js'],{cwd:root,encoding:'utf8'})).LifeQuestData;
eq(D.validate().success,true);eq(D.quests.length,54);eq(baseline.quests.length,38);eq(Object.keys(D.items).length,122);ok(Object.keys(D.zones).length>=30);
for(const old of baseline.quests){const q=D.quests.find(q=>q.id===old.id);ok(q,'Old quest is retained: '+old.id);
 for(const key of ['mode','category','itemIds','zoneIds','required','optional','distractors','steps','before','realSteps']){
  // Zone and permitted-destination expansion is additive. No old real action
  // checkbox, task object, required packing item or dependency is reinterpreted.
  if(key==='zoneIds')for(const id of old.zoneIds)ok(q.zoneIds.includes(id));
  else eq(q[key]??null,old[key]??null,old.id+' preserves '+key);
 }
 if(old.accepted)for(const [id,places]of Object.entries(old.accepted))for(const z of places)ok(q.accepted[id].includes(z),old.id+' old valid layout remains valid');
 eq(q.realSteps,old.realSteps,'Existing positional real-life reports keep their meaning');
}
const byId=id=>D.quests.find(q=>q.id===id);
const weekend=byId('life.places.school-return');ok(weekend.story.includes('завтра выходной'));ok(weekend.story.includes('закрытом лотке'));ok(weekend.story.includes('договорились постирать'));eq(weekend.accepted['math-notebook'],['bookshelf','stationery','desk']);
const free=byId('life.places.weekend-project');ok(free.story.includes('суббота'));ok(free.accepted['math-notebook'].includes('bookshelf'));ok(!free.accepted['math-notebook'].includes('desk'),'A non-school weekend never forces an idle notebook onto the work surface');
ok(byId('life.places.desk').story.includes('без измерений и линейки'),'Ruler condition exists before the child answers');ok(byId('life.trip.sunny-walk').story.includes('тёплый и солнечный'));ok(byId('life.trip.overnight').story.includes('или обе'));ok(byId('life.trip.rain-walk').story.includes('Ботинки и дождевик наденешь'));ok(byId('life.school.rain').story.includes('оба тоже разрешены'));
for(const id of ['life.school.math-russian','life.school.reading-world','life.school.art','life.school.pe','life.school.rain']){const q=byId(id);ok(/часть|этап|отдельн/i.test(q.story));ok(/уже (?:собран|готов|в рюкзаке)/.test(q.story),id+' makes partial preparation explicit');}
ok(byId('life.school.math-russian').why['reading-book'].includes('есть чтение'));ok(byId('life.school.reading-world').why['math-book'].includes('есть математика'));ok(byId('life.school.pe').why['russian-book'].includes('в пятницу есть'));ok(byId('life.sport.pool').story.includes('Во вторник и четверг'));ok(byId('life.sport.music-flute').story.includes('отдельно от школьной музыки'));
for(const q of D.quests.filter(q=>q.prepare)){ok(q.bagGroups.length>0);const groups=q.bagGroups.flatMap(g=>g.itemIds);ok(groups.every(id=>q.itemIds.includes(id)));ok(groups.every(id=>!(q.distractors||[]).includes(id)));ok((q.required||[]).every(id=>groups.includes(id)));}
for(const file of ['learning-progress.js','life-quests.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
const L=c.LifeQuests,LP=c.LearningProgress,env={LP,generation:'content-test',observe(){},announce(){}};
function topological(q,reverse=false){const out=[],todo=q.steps.map(s=>s.id);while(todo.length){const ready=todo.filter(id=>q.before.every(([a,b])=>b!==id||out.includes(a))),id=reverse?ready.at(-1):ready[0];assert.ok(id);out.push(id);todo.splice(todo.indexOf(id),1);}return out;}
function act(s,a,p){return L.handle(s,a,p||{},env);}
function fresh(q){const s=L.create(env);act(s,'open',{quest:q.id});act(s,'begin');return s;}
function fill(s,q,variant=false){if(q.mode==='rule')act(s,'rule',{rule:q.ruleChoices[variant?1:0].id});
 if(['sort','rule'].includes(q.mode)){const map=q.mode==='rule'?q.ruleChoices[variant?1:0].accepted:q.accepted;for(const id of q.itemIds)act(s,'drop',{item:id,zone:variant?map[id].at(-1):map[id][0]});}
 if(q.mode==='pack'){for(const id of q.required)act(s,'toggle',{item:id});if(variant)for(const id of q.optional)act(s,'toggle',{item:id});for(const g of q.alternatives||[])for(const id of g.items.slice(variant?-g.min:0,variant?undefined:g.min))act(s,'toggle',{item:id});}
 if(q.mode==='sequence')for(const id of topological(q,variant))act(s,'step',{step:id});}
for(const q of D.quests){
 ok(q.story.length>30&&q.instruction.length>20&&q.hint.length>20);ok(q.firstMove.length>15&&q.microReal.length>20);eq(new Set(q.itemIds).size,q.itemIds.length);
 if(q.mode==='sort')for(const id of q.itemIds)ok(q.why[id]?.length>15,q.id+' explains actual destination '+id);
 for(const variant of [false,true]){const s=fresh(q);eq(L.evaluate(s).correct,false);fill(s,q,variant);eq(L.evaluate(s).correct,true,q.id+' accepts '+(variant?'alternative':'authored')+' strategy');act(s,'check');eq(s.solved,true);ok(L.restore(plain(s),env));}
 if(q.mode==='pack'){const s=fresh(q);fill(s,q);act(s,'toggle',{item:q.required[0]});ok(L.evaluate(s).issues.some(x=>x.code==='missing'));act(s,'toggle',{item:q.required[0]});for(const id of q.distractors){act(s,'toggle',{item:id});ok(L.evaluate(s).issues.some(x=>x.code==='extra'&&x.item===id));act(s,'toggle',{item:id});}}
 if(q.mode==='sequence'){const s=fresh(q),order=topological(q),[a,b]=q.before[0],ia=order.indexOf(a),ib=order.indexOf(b);[order[ia],order[ib]]=[order[ib],order[ia]];s.order=order;eq(L.evaluate(s).correct,false);}
}
// Extension joins the existing bank, preserves authored metadata and is idempotent.
const ex=context(),E=ex.LifeQuestData,proposal={id:'life.test.extension',title:'Проверяем рюкзак',mode:'pack',category:'school',story:'Отдельная проба: нужна только одна ручка. Остальное уже собрано.',instruction:'Выбери синюю ручку из этой игровой памятки.',hint:'Смотри цель и один названный предмет.',required:['blue-pen'],optional:[],distractors:['toy-car'],itemIds:['blue-pen','toy-car'],zoneIds:['bag'],why:{'blue-pen':'Ручка указана в этой памятке.','toy-car':'Машинку в этой пробе не просили.'},realSteps:['Посмотри памятку.','Найди ручку.','Проверь ручку.'],conditions:['Остальное уже готово.'],schedule:{dayId:'mon'},bagGroups:[{id:'school',label:'В рюкзак',itemIds:['blue-pen']}],firstMove:'Сначала посмотри на одну нужную ручку.',microReal:'Проверь, пишет ли одна твоя синяя ручка.'};
eq(E.extend({quests:[proposal]}).quests,1);const created=E.quests.at(-1);eq(created.firstMove,proposal.firstMove);eq(created.microReal,proposal.microReal);eq(created.conditions,proposal.conditions);eq(created.schedule,proposal.schedule);eq(created.bagGroups,proposal.bagGroups);eq(E.validate().success,true);eq(E.extend({quests:[proposal]}).quests,0);eq(E.quests.filter(q=>q.id===proposal.id).length,1);eq(E.extend({items:[{id:'constructor',label:'bad'}],quests:[{id:'__proto__'}]}),{items:0,zones:0,quests:0});
eq(storageReads,0);console.log(JSON.stringify({success:true,checks,oldIdsRetained:38,baseQuests:D.quests.length,newNonWeekdayQuests:16,items:Object.keys(D.items).length,zones:Object.keys(D.zones).length,oldRealPlansUnchanged:true,weekendStorageAlternatives:true,allAuthoredSolutionsChecked:true,storageAccess:storageReads,productionAccess:false}));
