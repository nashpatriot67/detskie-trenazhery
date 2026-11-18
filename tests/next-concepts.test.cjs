'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});
for(const file of ['learning-progress.js','concepts.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=context.ConceptTrainer,LP=context.LearningProgress,plain=x=>JSON.parse(JSON.stringify(x));
let checks=0,maxBytes=0;const eq=(a,b,msg)=>{assert.deepEqual(plain(a),plain(b),msg);checks++;},ok=(value,msg)=>{assert.ok(value,msg);checks++;};
const generation='synthetic-concepts',events=[];
const env={LP,generation,learning:LP.empty(generation),observe:event=>{events.push(plain(event));env.learning=LP.record(env.learning,event);},esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))};
function create(subject,grade=2){return C.create({subject,grade,generation,LP});}
function act(s,a,d={}){const result=C.handle(s,a,d,env);ok(result,'Action handled: '+a);return result;}
function topic(s,id){act(s,'topic',{topic:id});if(s.phase==='intro')act(s,'begin');}
function answer(s,t=C.current(s)){
 if(t.kind==='choice')act(s,'choice',{value:t.answer});
 else if(t.kind==='number'||t.kind==='word'){const value=String(t.answer);eq(C.capture(s,{querySelector:()=>({value})}),true,'Input captured');}
 else for(const [k,v]of Object.entries(t.answer))act(s,'drop',t.kind==='match'?{item:v,zone:k}:{item:k,zone:v});
}
function checkState(s){const json=JSON.stringify(s),bytes=Buffer.byteLength(json);maxBytes=Math.max(maxBytes,bytes);ok(bytes<=48*1024,'Snapshot fits existing module48KiB bound');const restored=C.restore(JSON.parse(json),env);ok(restored,'Snapshot restores');eq(restored.subject,s.subject);eq(restored.grade,s.grade);eq(restored.phase,s.phase);if(s.phase!=='menu'){eq(C.current(restored).id,C.current(s).id);eq(restored.answer,s.answer);eq(restored.placements,s.placements);eq(restored.attempt.assistance,s.attempt.assistance);}if(LP.setModule){const data=LP.setModule(LP.empty(generation),'concept-'+s.subject,s,{ownerId:'test'});ok(LP.getModule(data,'concept-'+s.subject)?.state,'Host persistence accepts complete state');}}
eq(C.validate().success,true,'All bank records valid');eq(C.validate().tasks,138);eq(C.validate().topics,11);ok(C.TASKS.every(t=>t.explanation&&t.skillIds.length),'Everytask haswhyandstable skillIDs');
// Real arithmetic metadata and part models are independently recalculated.
for(const t of C.TASKS){
 if(t.expression){const e=t.expression;eq(e.result,e.op==='+'?e.a+e.b:e.op==='-'?e.a-e.b:e.op==='*'?e.a*e.b:e.a/e.b,'Expression quantity');}
 if(t.bar)eq(t.bar.left+t.bar.right,t.bar.whole,'Part models conserve quantity');
}
// Every actual activity is solved through public actions, not by setting solved.
for(const subject of ['math','russian']){
 const s=create(subject);
 for(const t of C.TOPICS.filter(t=>t.subject===subject)){
  topic(s,t.id);eq(s.queue.length,C.TASKS.filter(q=>q.topic===t.id&&q.grade<=s.grade).length);
  const first=C.current(s);ok(s.attempt.assistance.explanation,'Firstread countsashelp');
  for(let guard=0;guard<40&&s.phase!=='summary';guard++){
   const current=C.current(s),before=events.length;answer(s,current);eq(C.correct(s),true,'Correctaction solves '+current.id);act(s,'check');eq(s.solved,true);eq(events.length,before+1);eq(events.at(-1).outcome,'correct');checkState(s);
   const html=C.render(s,env);ok(html.includes(current.explanation.replace(/&/g,'&amp;')),'Success explains why');act(s,'next');
  }
  eq(s.phase,'summary','Finite topicprogression');act(s,'menu');checkState(s);
 }
 // Switchinggradesand revisitingtopicsmustnotdiscard eachotheror exceedbounds.
 act(s,'grade',{value:1});
 for(const t of C.TOPICS.filter(t=>t.subject===subject&&t.grade===1)){topic(s,t.id);answer(s);act(s,'check');act(s,'next');act(s,'menu');checkState(s);}
}
// An empty checkisnot a mathematical/linguisticerror.
const empty=create('math');topic(empty,'math.addition');const errorsBefore=empty.attempt.errors;act(empty,'check');eq(empty.attempt.errors,errorsBefore);eq(empty.solved,false);
// Wrong→hint→reset→reopen→correctretainsallassistance and first outcome.
const corrected=create('math');topic(corrected,'math.addition');eq(C.handle(corrected,'next',{},env),false,'Cannot advance unfinishedtask');answer(corrected);act(corrected,'check');act(corrected,'next');
eq(corrected.attempt.assistance.explanation,false,'Nextcard hasnewunassistedattempt');
let t=C.current(corrected);act(corrected,'choice',{value:t.options.find(o=>o.id!==t.answer).id});act(corrected,'check');eq(corrected.solved,false);eq(corrected.attempt.firstOutcome,'incorrect');
act(corrected,'hint');act(corrected,'reset');eq(corrected.attempt.assistance.visual,true);eq(corrected.attempt.assistance.afterError,true);
const restored=C.restore(plain(corrected),env);ok(restored);eq(restored.attempt.firstOutcome,'incorrect');eq(restored.attempt.assistance.visual,true);answer(restored);act(restored,'check');eq(restored.solved,true);eq(events.at(-1).firstOutcome,'incorrect');eq(events.at(-1).assistance.afterError,true);eq(LP.classify(LP.latest(env.learning,t.skillIds[0])),'assisted');
act(restored,'next');answer(restored);act(restored,'check');eq(restored.attempt.assistance.visual,false);eq(LP.classify(LP.latest(env.learning,C.current(restored).skillIds[0])),'independent','Newexample isindependent');
// Clickthenplace anddragproduceidenticalmatchingmodels.
const tap=create('math'),drag=create('math');topic(tap,'math.subtraction');topic(drag,'math.subtraction');t=C.current(tap);
for(const [zone,item]of Object.entries(t.answer)){act(tap,'select',{item});act(tap,'place',{zone});act(drag,'drop',{item,zone});}
eq(tap.placements,drag.placements);act(tap,'check');eq(tap.solved,true);
// Assigning atermtoanewslotmovesit; partialplacementdoesnottriggererror.
const partial=create('math');topic(partial,'math.addition');act(partial,'drop',{item:'t0',zone:'n0'});act(partial,'drop',{item:'t0',zone:'n1'});eq(partial.placements,{n1:'t0'});act(partial,'check');eq(partial.attempt.errors,0);eq(partial.solved,false);
// Per-topicdraftspreserve anunfinished answerandhelp throughmenu/topicchanges.
const drafts=create('math');topic(drafts,'math.whole');C.capture(drafts,{querySelector:()=>({value:'19'})});act(drafts,'hint');const attemptId=drafts.attempt.attemptId;act(drafts,'menu');topic(drafts,'math.subtraction');act(drafts,'menu');topic(drafts,'math.whole');eq(drafts.answer,'19');eq(drafts.attempt.attemptId,attemptId);eq(drafts.attempt.assistance.visual,true);checkState(drafts);
// Skipped isdistinctfromunseen; emptyoldresults neverbecomeindependent.
const skipped=create('russian');topic(skipped,'russian.members');act(skipped,'skip');eq(skipped.solved,true);eq(events.at(-1).outcome,'skipped');ok(!skipped.done['concept.rus.members.question.0'],'Unseentask hasnoresult');
// Grade1doesnot silentlyinclude advancedmath/morphemecards.
for(const subject of ['math','russian']){const s=create(subject,1),html=C.render(s,env);for(const topic of C.TOPICS.filter(t=>t.subject===subject&&t.grade===2)){eq(C.handle(s,'topic',{topic:topic.id},env),false);ok(!html.includes('data-topic="'+topic.id+'"'));}for(const topic of C.TOPICS.filter(t=>t.subject===subject&&t.grade===1)){C.handle(s,'topic',{topic:topic.id},env);ok(s.queue.every(id=>C.TASKS.find(t=>t.id===id).grade===1));}}
// Writtenformchangerequires actualRussianinputandnotjust adefinitionchoice.
const forms=create('russian');topic(forms,'russian.wordparts');forms.index=forms.queue.indexOf('concept.rus.parts.change-school');forms.attempt=LP.attempt('concept.rus.parts.change-school',['concept.russian.wordparts'],{generation});forms.phase='task';forms.solved=false;
eq(C.capture(forms,{querySelector:()=>({value:'ШКОЛЫ'})}),true);eq(C.correct(forms),true);act(forms,'check');eq(forms.solved,true);ok(C.render(forms,env).includes('а сменилось на ы'));
// Speechandmemberbankseparate thetwotypesofanalysis explicitly.
const distinction=C.TASKS.find(t=>t.id==='concept.rus.speech.samesense');ok(distinction.options.find(o=>o.id===distinction.answer).text==='Имя существительное');ok(C.TASKS.find(t=>t.id==='concept.rus.members.different').explanation.includes('работу'));
// No targetword/inputanswerappears inmenunavigation.
const menu=create('russian');const menuHTML=C.render(menu,env);ok(!menuHTML.includes('школы'));ok(!menuHTML.includes('лесок'));ok(!menuHTML.includes('concept.rus.parts.change-school'));
// Displaypositionsvarybutarestableafterreopen; childcannotalwayspickfirst.
const firstPositions=new Set();for(const task of C.TASKS.filter(t=>t.kind==='choice')){const s=create(task.subject,2);topic(s,task.topic);s.index=s.queue.indexOf(task.id);s.phase='task';s.solved=false;const html=C.render(s,env);const ids=[...html.matchAll(/data-ct-action="choice" data-value="(o\d+)"/g)].map(x=>x[1]);firstPositions.add(ids.indexOf(task.answer));const reopened=C.restore(plain(s),env);eq(C.render(reopened,env),html,'Choiceorderstableafterresume');}ok(firstPositions.size>=3,'Correctchoicepositionvaries');
// Restoring a task retains the entire attempt metadata, including its start.
forms.attempt.startedAt=1234567890123;
eq(C.restore(plain(forms),env).attempt.startedAt,1234567890123,'Reopen never regenerates the attempt timestamp');
for(const task of C.TASKS.filter(t=>t.kind==='word'))ok(task.prompt.includes('единственном числе'),'Written form tasks specify the intended number');
// Unknownschema/generationneverreadsasa validcurrentactivity.
eq(C.restore({...plain(forms),version:2},env),null);eq(C.restore({...plain(forms),generation:'old'},env),null);eq(C.restore({...plain(forms),queue:['missing.task']},env).phase,'menu');
console.log(JSON.stringify({success:true,checks,tasks:C.TASKS.length,topics:C.TOPICS.length,mechanics:[...new Set(C.TASKS.map(t=>t.kind))],maxSnapshotBytes:maxBytes,independentAndAssistedDistinct:true,firstErrorRetained:true,gradeFilters:true,stableOrder:true,storageAccess:false,productionAccess:false}));
