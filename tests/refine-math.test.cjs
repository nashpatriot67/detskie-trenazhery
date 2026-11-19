'use strict';
// New gates/checks are exercised against the existing engine, course and
// legacy app harness. No storage from a real learner is read or copied.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),Module=require('node:module'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),plain=v=>JSON.parse(JSON.stringify(v));let checks=0;
function eq(a,b,message){assert.deepEqual(plain(a),plain(b),message);checks++;}
function ok(value,message){assert.ok(value,message);checks++;}
const c=vm.createContext({}),load=file=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
c.window=c;for(const file of ['kubiki/engine.js','kubiki/course.js','learning-progress.js','place-value.js','place-value-activities.js','concepts.js','learning-journey.js','math-journey.js','math-check.js'])load(file);
const {MathJourney:J,MathCheck:MC,ConceptTrainer:C,LearningProgress:LP,COURSE}=c;
const originalTasks=C.TASKS.length;eq(J.register(C,COURSE),true);eq(J.register(C,COURSE),true);eq(C.TASKS.length,originalTasks+108,'Contextual banks register only once');ok(C.validate().success);
const bank=J.bank(COURSE);for(const t of bank.tasks.filter(t=>t.kind==='choice'))eq(new Set(t.options.map(o=>o.text)).size,t.options.length,'Choice labels must be unambiguous: '+t.id);eq(bank.topics.length,36);eq(bank.tasks.length,108);eq(new Set(bank.tasks.map(x=>x.id)).size,108);
for(const lesson of COURSE){const g=J.gate(lesson.id,COURSE);eq(g.taskIds.length,3);ok(g.taskIds.every(id=>C.TASKS.some(t=>t.id===id&&t.topic===g.topicId)));ok(!/множитель|произведение|делимое|делитель|частное/i.test(bank.topics[lesson.id-1].rule));const roles=bank.tasks.find(t=>t.id===g.taskIds[0]);eq(roles.expression,lesson.example,'Concept expression exactly matches the already explained example');}
ok(/меньше 10/.test(bank.topics[0].rule));ok(!/10 единиц|один десяток|размен/i.test(bank.tasks.filter(t=>t.topic==='math.lesson.1').map(t=>t.prompt).join(' ')),'First lesson does not suddenly teach a carry');
for(const t of c.PlaceValueActivities.TASKS.filter(t=>!t.diagnostic)){const gate=J.pvGate(t);ok(gate);ok(c.LearningJourney.config({...gate,context:{}}),'Every PVA gate uses actual registered IDs');}
ok(MC.validate().success);eq(MC.validate().course,648);ok(MC.validate().placevalue>=24);ok(MC.catalog().filter(t=>t.source==='concept').every(t=>!['math.multiply','math.divide'].includes(t.topic)));
const selectedIds=new Set(),lessonIds=new Set(),conceptTopics=new Set();for(let seed=0;seed<160;seed++){const ids=MC.select({grade:2,seed:String(seed)}),pool=Object.fromEntries(MC.catalog().map(t=>[t.id,t])),cards=ids.map(id=>pool[id]);eq(ids.length,10);eq(new Set(ids).size,10);eq(new Set(cards.filter(t=>t.source==='course').map(t=>t.group)).size,6);eq(cards.filter(t=>t.source==='placevalue').length,2);eq(cards.filter(t=>t.source==='concept').length,2);for(const card of cards){selectedIds.add(card.id);if(card.lesson)lessonIds.add(card.lesson);if(card.topic)conceptTopics.add(card.topic);}}
eq(lessonIds.size,36,'The selector reaches all 36 topics');ok(conceptTopics.size>20);ok(selectedIds.size>300,'New mixtures are diverse');
let events=[],env={LP,generation:'initial',esc:s=>String(s),observe:e=>events.push(plain(e)),model:p=>'<div data-counted-model>'+JSON.stringify(p)+'</div>'};
function stateFor(t){const s=MC.create();s.queue=[t.id];s.phase='task';const raw={...s};if(t.kind==='concept'){const inner=C.create({subject:'math',grade:2});inner.topicId=t.topic;inner.queue=[t.ref];inner.phase='task';const q=C.TASKS.find(x=>x.id===t.ref);inner.attempt=LP.attempt(q.id,q.skillIds,{generation:'initial'});raw.concept=inner;}return MC.restore(raw,env);}
for(const t of MC.catalog()){
 const s=stateFor(t);ok(s,'Restore clean card '+t.id);const before=MC.render(s,env);ok(!before.includes('Полная запись:'),'No early completed arithmetic equation');
 if(t.kind==='number')s.answer=String(t.answer);else if(t.kind==='fields')s.answers=t.answer.map(String);else if(t.kind==='digits')s.digits=t.answer.slice();else{const q=C.TASKS.find(x=>x.id===t.ref);if(['number','word','choice'].includes(q.kind))s.concept.answer=String(q.answer);else s.concept.placements=plain(q.answer);}
 ok(MC.correct(s,t),'Verified answer '+t.id);const count=events.length;MC.handle(s,'check',{},env);ok(s.solved);eq(events.length,count+1,'One observation per checked card');eq(events.at(-1).taskId,t.id);eq(events.at(-1).mode,'assessment');const restored=MC.restore(plain(s),env);ok(restored);ok(restored.solved);eq(restored.results,s.results);ok(JSON.stringify(s).length<48*1024);
}
const numeric=MC.catalog().find(t=>t.source==='course'&&t.answer>0);let s=stateFor(numeric);s.answer=String(numeric.answer+1);MC.handle(s,'check',{},env);eq(s.solved,false);ok(s.attempt.assistance.afterError);s=MC.restore(plain(s),env);ok(s.attempt.assistance.afterError);MC.handle(s,'model',{},env);ok(s.attempt.assistance.visual);s.answer=String(numeric.answer);MC.handle(s,'check',{},env);ok(s.results[numeric.id].assisted);ok(s.results[numeric.id].afterError);eq(MC.restore({...plain(s),generation:'old'},env),null);
for(const kind of ['number','digits','fields','concept']){const t=MC.catalog().find(t=>t.kind===kind);const s=stateFor(t);MC.handle(s,'skip',{},env);ok(s.skipped);ok(MC.restore(plain(s),env).skipped);eq(s.results[t.id].outcome,'skipped');}
const digit=MC.catalog().find(t=>t.kind==='digits'),ds=stateFor(digit);MC.handle(ds,'digit',{value:3},env);MC.handle(ds,'place',{zone:0},env);MC.handle(ds,'drop',{item:0,zone:1},env);eq(ds.digits,[3,0,null]);eq(MC.restore(plain(ds),env).digits,[3,0,null]);ok(MC.render(ds,env).includes('data-practice-drag="0"'));
// Reuse the proven legacy harness, with new scripts and a faithful host contract.
let source=fs.readFileSync(path.join(root,'kubiki/progress.test.cjs'),'utf8').split('function finishLearn')[0];
source=source.replace("const context=vm.createContext({", "const mathTestTimers=new Map();let timerId=0;const context=vm.createContext({mathTestTimers,")
 .replace('setTimeout(){},console', 'setTimeout(fn,ms){const id=++timerId;mathTestTimers.set(id,{fn,ms});return id;},clearTimeout(id){mathTestTimers.delete(id);},console')
 .replace("'place-value-activities.js']", "'place-value-activities.js','concepts.js','math-journey.js','math-check.js']")
 .replace(" vm.runInContext(fs.readFileSync(path.join(root,folder,'app.js'),'utf8'),context",` vm.runInContext(\`var gates=[],boundaries=[],gateDone={},hubOpened=false,hubConfig=null,breakDue=false;window.PracticeHub={mount(config){hubConfig=config;},isOpen(){return hubOpened;},requireConcepts(g){if(gateDone[g.id])return false;gates.push(g);hubOpened=true;hubConfig.beforeOpen();return true;},cycleBoundary(b){boundaries.push(b);if(!breakDue)return false;hubOpened=true;hubConfig.beforeOpen();return true;}};\`,context);
 vm.runInContext(fs.readFileSync(path.join(root,folder,'app.js'),'utf8'),context`);
const harnessModule=new Module(path.join(root,'kubiki/progress.test.cjs'));harnessModule.filename=path.join(root,'kubiki/progress.test.cjs');harnessModule.paths=module.paths;harnessModule._compile(source+'\nmodule.exports={harness};',harnessModule.filename);const {harness}=harnessModule.exports;
function finishTheory(h){let guard=0;while(h.run("state.mode==='learn'&&!hubOpened")){ok(guard++<20);h.click({action:'learn-next'});}}
function gateDone(h){h.run("(()=>{const g=gates.at(-1);gateDone[g.id]=true;hubOpened=false;hubConfig.onConceptGateComplete(g.context);})();");}
function solve(h){h.run("state.zones={a:K.parts(isBuild()?task().answer:task().result),b:K.empty(),removed:!isBuild()&&task().op==='-'?K.parts(task().b):K.empty()};render();");h.input('#answer',String(h.run('task().answer')));h.click({action:'check'});}
function flush(h){h.run('(()=>{const pending=[...mathTestTimers.values()];mathTestTimers.clear();for(const t of pending)t.fn();})();');}
for(const [folder,key]of [['kubiki','kubiki-progress-v1'],['bricks','detalki-progress-v1']]){
 let storage={},h=harness(folder,storage);eq(h.run('state.mode'),'learn');h.click({mode:'play'});eq(h.run('state.mode'),'learn','Manual mode cannot bypass unread theory');finishTheory(h);ok(h.run('hubOpened'));eq(h.run('gates.at(-1).taskIds.length'),3);gateDone(h);eq(h.run('({mode:state.mode,index:state.index})'),{mode:'play',index:0});
 h.run('state.zones.a.unit=3;history();render();');h.input('#answer','71');const snapshot=plain(h.run('sessionSnapshot()'));h.run('gateDone={};');h.click({action:'check'});ok(h.run('hubOpened'));h.run('hubOpened=false;');h.click({action:'check'});ok(h.run('hubOpened'),'Closing the gate cannot bypass it');gateDone(h);eq(h.run('state.zones'),snapshot.zones);eq(h.run('state.answer'),'71');eq(h.run('state.undo'),snapshot.undo);
 h.input('#answer',String(h.run('task().answer+1')));h.click({action:'check'});eq(h.run('state.solved'),false);eq(h.run('mathAdvance'),null,'Wrong answer never schedules progression');solve(h);ok(h.run('state.solved'));eq(h.run('state.index'),0,'Success is visible before advancement');eq(h.run('mathAdvance.timer!==null'),true);eq(h.run('[...mathTestTimers.values()].at(-1).ms'),2200);flush(h);eq(h.run('state.index'),1,'Correct answer advances automatically');
 solve(h);h.click({action:'next-task'});eq(h.run('state.index'),2,'Manual Next is immediate');flush(h);eq(h.run('state.index'),2,'Old timeout does not skip an extra task');
 solve(h);h.run('hubOpened=true;hubConfig.beforeOpen();');flush(h);eq(h.run('state.index'),2,'An opened host pauses progression');h.run('hubOpened=false;armMathAdvance();');flush(h);eq(h.run('state.index'),3,'Close resumes exact completed task');
 h.run('breakDue=true;');solve(h);flush(h);ok(h.run('hubOpened'));eq(h.run('boundaries.at(-1).context.kind'),'math-next');eq(h.run('state.index'),3);h.run('(()=>{const b=boundaries.at(-1);hubOpened=false;breakDue=false;hubConfig.onCycleContinue(b.context);})();');eq(h.run('state.index'),4);
 // Existing marks and partial drafts survive gates without being reset or recredited.
 h.run("for(let i=0;i<17;i++)markModeDone('play',1,i);startTask(1,17);render();");solve(h);eq(h.run('state.mode'),'play');flush(h);eq(h.run('state.mode'),'worksheet');eq(h.run('modeCount(1,"play")'),18);eq(h.run('modeCount(1,"worksheet")'),0);
 h.input('[data-ws-input="1"]','73');const old=JSON.parse(storage[key]);h=harness(folder,storage);ok(h.run('hubOpened'));gateDone(h);eq(h.doc.querySelector('[data-ws-input="1"]').value,'73');eq(h.run('modeCount(1,"play")'),18);eq(h.run('progress.read'),old.read);
 h.run("for(let i=0;i<17;i++)markModeDone('worksheet',1,i);startTask(1,17,false,'worksheet');render();");solve(h);flush(h);eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:2,mode:'learn'});finishTheory(h);eq(h.run('gates.at(-1).topicId'),'math.lesson.2');gateDone(h);eq(h.run('({lesson:state.lesson,mode:state.mode,index:state.index})'),{lesson:2,mode:'play',index:0});
 // A last worksheet grid answer also has an immediate manual continuation.
 h.run("markRead(3);gateDone['math.lesson.3.concepts.v1']=true;for(let i=1;i<18;i++)markModeDone('worksheet',3,i);for(let i=0;i<18;i++)markModeDone('play',3,i);startWorksheet(3);render();");h.input('[data-ws-input="0"]',String(h.run('tasks()[0].answer')));h.click({action:'check-worksheet'});ok(h.run('state.solved'));ok(h.html().includes('data-action="next-task"'));h.click({action:'next-task'});eq(h.run('state.lesson'),4);
 // The old progress schema and IDs remain exactly the owners of course awards.
 // Existing PVA engine is wrapped, not replaced: four semantic prerequisite
 // families, exact snapshot restoration, auto-next only in practice.
 h.run("openPlaceValue('diagnostic');");eq(h.run('hubOpened'),false,'Diagnostics are not blocked by teaching gates');eq(h.run('mathAdvance'),null);
 h.run("openPlaceValue('practice');");ok(h.run('hubOpened'));eq(h.run('gates.at(-1).id'),'math.pv.build.concepts.v1');eq(h.run('gates.at(-1).taskIds'),['concept.math.position.order','concept.math.position.zero','concept.math.position.hundred']);
 gateDone(h);h.run('state.zones.a.unit=17;state.answer="24";history();pvDirty=true;userIntent=true;render();');const pvSnapshot=plain(h.run('A.snapshot(state)'));h.run("delete gateDone['math.pv.build.concepts.v1'];requirePvConcepts();");ok(h.run('hubOpened'));gateDone(h);eq(h.run('state.zones'),pvSnapshot.zones);eq(h.run('state.answer'),pvSnapshot.answer);eq(h.run('state.undo'),pvSnapshot.undo);
 h.run('state.answer="1";handlePlaceValue("check",{});');eq(h.run('state.solved'),false);eq(h.run('mathAdvance'),null);
 let pvCount=0,gateFamilies=new Set(['build']);
 while(!h.run('state.pv.finished')){
  if(h.run('hubOpened')){gateFamilies.add(h.run('gates.at(-1).id').split('.')[2]);gateDone(h);}
  const kind=h.run('A.current(state.pv).kind');
  h.run("(()=>{const t=A.current(state.pv);if(t.kind==='build'){state.zones.a=P.unitsOnly(t.target,K);state.answer=String(t.target);}else if(t.kind==='digits'||t.kind==='fix'){state.pv.digits=String(t.target).padStart(3,'0').split('').map(Number);}else if(t.kind==='expand'){state.pv.answers=[Math.floor(t.target/100)*100,Math.floor(t.target/10)%10*10,t.target%10].map(String);}else if(t.kind==='compare'){state.pv.answers=t.answers.map(String);}else if(t.kind==='value'||t.kind==='read'){state.answer=String(t.answer);}else if(t.kind==='exchange'){state.zones.a=P.unitsOnly(t.answer,K);state.answer=String(t.answer);}else if(t.kind==='arithmetic'){state.zones={a:P.unitsOnly(t.result,K),b:K.empty(),removed:t.op==='-'?P.unitsOnly(t.b,K):K.empty()};state.answer=String(t.answer);}handlePlaceValue('check',{});})();");
  ok(h.run('state.solved'),'PVA '+kind+' accepts existing criteria');eq(h.run('mathAdvance!==null'),true);const index=h.run('state.pv.index');if(pvCount===0){h.run('breakDue=true;');flush(h);ok(h.run('hubOpened'));eq(h.run('boundaries.at(-1).context.kind'),'math-pv-next');eq(h.run('state.pv.index'),index);h.run('(()=>{const b=boundaries.at(-1);hubOpened=false;breakDue=false;hubConfig.onCycleContinue(b.context);})();');}else flush(h);
  pvCount++;ok(pvCount<=24);
 }
 eq(pvCount,24,'All existing PVA tasks are retained');eq([...gateFamilies].sort(),['arithmetic','build','exchange','read']);
 h.run("openPlaceValue('practice','pv.digits.305');");h.click({pvAction:'digit',digit:'3'});h.click({pvAction:'place',place:'0'});eq(h.run('state.pv.digits'),[3,null,null]);eq(JSON.parse(storage[key]).learning.activity.state.pv.digits,[3,null,null],'A digit placement after a satisfied gate reaches the existing activity snapshot immediately');
 h.run("openPlaceValue('diagnostic');state.solved=true;render();");eq(h.run('mathAdvance'),null,'Diagnostic remains independent and does not auto-skip feedback');
 const stored=JSON.parse(storage[key]);eq(stored.modeSolved.version,1);ok(Object.keys(stored.solved).every(id=>/^[0-9]+:[0-9]+$/.test(id)));ok(!stored.solved['check.math.lesson.1.task.0']);
}
// Every original lesson still traverses concepts, play and its own worksheet
// before opening the next topic, including the final course boundary.
for(const folder of ['kubiki','bricks']){
 const h=harness(folder,{});
 for(let id=1;id<=36;id++){
  eq(h.run('state.lesson'),id);eq(h.run('state.mode'),'learn');finishTheory(h);eq(h.run('gates.at(-1).topicId'),'math.lesson.'+id);gateDone(h);
  h.run("for(let i=0;i<17;i++)markModeDone('play',state.lesson,i);startTask(state.lesson,17);render();");solve(h);flush(h);eq(h.run('state.lesson'),id);eq(h.run('state.mode'),'worksheet');eq(h.run('modeCount(state.lesson,\"worksheet\")'),0);
  h.run("for(let i=0;i<17;i++)markModeDone('worksheet',state.lesson,i);startTask(state.lesson,17,false,'worksheet');render();");solve(h);flush(h);ok(h.run('lessonComplete('+id+')'));
 }
 eq(h.run('state.view'),'progress');eq(h.run('gates.length'),36);eq(h.run('Object.keys(progress.modeSolved.play).length'),648);eq(h.run('Object.keys(progress.modeSolved.worksheet).length'),648);
}
console.log(JSON.stringify({success:true,checks,mathConcepts:108,mathCheck:MC.validate(),fullCurriculumSelection:true,exactGateResume:true,automaticProgression:true,legacyOwnersPreserved:true}));
