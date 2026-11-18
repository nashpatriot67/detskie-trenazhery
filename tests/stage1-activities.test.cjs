'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let checks=0,paths=0;
const plain=x=>JSON.parse(JSON.stringify(x));
function ok(x,m){assert.ok(x,m);checks++;}function eq(a,b,m){assert.deepEqual(plain(a),plain(b),m);checks++;}
function load(folder){const c=vm.createContext({window:{},console});for(const name of ['math-range.js','learning-progress.js',folder+'/engine.js','place-value.js','place-value-activities.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),c,{filename:name});return {K:c.window.Kubiki,P:c.window.PlaceValue,LP:c.window.LearningProgress,A:c.window.PlaceValueActivities};}
for(const folder of ['kubiki','bricks']){
 const {K,P,LP,A}=load(folder);let learning=LP.empty('initial'),events=[];
 function state(id){const s={};A.start(s,'practice',K,LP,learning,id);return s;}
 const task=id=>A.TASKS.find(t=>t.id===id);
 const env={K,P,LP,learning,esc:s=>String(s),generation:'initial',pieces:p=>'MODEL',zone:()=>'<div class="board-zone"></div>',bank:()=>'',exchangeTools:()=>'<button data-exchange="pack100">Обмен</button>',observe:event=>{events.push(plain(event));learning=LP.record(learning,event);env.learning=learning;}};
 eq(new Set(A.TASKS.map(t=>t.id)).size,A.TASKS.length,'Stable IDs are unique');
 for(const t of A.TASKS){ok(/^[A-Za-z0-9_.:/-]+$/.test(t.id),'LP accepts every registered ID');ok(t.skillIds.every(id=>A.SKILLS[id]),'Registered skills only');ok(LP.attempt(t.id,t.skillIds),'Each activity can start an observation');}
 eq(A.current({}),null,'Incomplete current metadata is harmless');
 eq(task('pv.arithmetic.add.15.12').skillIds,['math.placevalue.expression'],'No exchange credited when none is required');
 eq(task('pv.arithmetic.add.180.35').skillIds,['math.placevalue.expression','math.exchange.hundred'],'No unit carry credited for 180+35');
 eq(task('pv.arithmetic.add.198.7').skillIds,['math.placevalue.expression','math.exchange.ten','math.exchange.hundred']);
 eq(task('pv.diag.expression').skillIds,['math.placevalue.expression'],'Reading expressions alone does not prove an exchange');
 for(const t of A.TASKS.filter(t=>!t.diagnostic)){
  const s=state(t.id);ok(!s.solved);ok(!A.correct(s,K),'Blank activity is not automatically correct: '+t.id);
  if(t.kind==='build'){s.zones.a=K.empty();s.zones.a.unit=t.target;s.answer=String(t.target);ok(A.correct(s,K),'Quantity goal accepts equivalent noncanonical grouping');s.answer='';ok(!A.correct(s,K));}
  if(t.kind==='digits'||t.kind==='fix'){s.pv.digits=[...String(t.target).padStart(3,'0')].map(Number);ok(A.correct(s,K));s.pv.digits[2]=(s.pv.digits[2]+1)%10;ok(!A.correct(s,K));}
  if(t.kind==='expand'){s.pv.answers=[Math.floor(t.target/100)*100,Math.floor(t.target/10)%10*10,t.target%10].map(String);ok(A.correct(s,K));s.pv.answers[1]='';ok(!A.correct(s,K),'Omitted zero differs from explicit zero');}
  if(t.kind==='value'||t.kind==='read'){s.answer=String(t.answer);ok(A.correct(s,K));s.answer=String(t.answer+1);ok(!A.correct(s,K));}
  if(t.kind==='compare'){s.pv.answers=t.answers.map(String);ok(A.correct(s,K));s.pv.answers[0]='4';ok(!A.correct(s,K));}
  if(t.kind==='exchange'){s.answer=String(t.answer);ok(!A.correct(s,K),'Quantity does not complete a canonical-form task');const before=K.total(s.zones.a);while(s.zones.a.unit>=10)ok(K.exchange(s.zones.a,'pack'));while(s.zones.a.ten>=10)ok(K.exchange(s.zones.a,'pack100'));eq(K.total(s.zones.a),before);ok(A.correct(s,K));}
  if(t.kind==='arithmetic'){
   const conserved=Object.values(s.zones).reduce((sum,p)=>sum+K.total(p),0);
   function invariant(){eq(Object.values(s.zones).reduce((sum,p)=>sum+K.total(p),0),conserved);}
   function exchange(action){ok(K.exchange(s.zones.a,action));invariant();}
   function move(from,to,type,count){for(let i=0;i<count;i++){ok(K.move(s.zones,from,to,type));invariant();}}
   if(t.op==='+'){for(const type of Object.keys(K.values))move('b','a',type,s.zones.b[type]);while(s.zones.a.unit>=10)exchange('pack');while(s.zones.a.ten>=10)exchange('pack100');}
   else{const removed=K.parts(t.b,{unitsOnly:true});if(s.zones.a.unit<removed.unit){if(!s.zones.a.ten)exchange('split100');exchange('split');}if(s.zones.a.ten<removed.ten)exchange('split100');for(const type of ['hundred','ten','unit'])move('a','removed',type,removed[type]);}
   s.answer=String(t.answer);ok(A.correct(s,K),'Real engine sequence solves '+t.id);eq(K.total(s.zones.a),t.answer);paths++;
  }
 }
 // The diagnostic is short and does not ask two variants of one family at once.
 let queue=A.diagnosticQueue(LP.empty(),LP);eq(queue.length,3);eq(new Set(queue.map(id=>task(id).familyId)).size,3);
 let seen=LP.empty();for(const id of queue){const t=task(id);seen=LP.record(seen,{...LP.attempt(t.id,t.skillIds),outcome:'correct'});}
 const next=A.diagnosticQueue(seen,LP);ok(next.every(id=>!queue.includes(id)),'Unchecked families are preferred after successful initial cards');
 let failed=LP.record(seen,{...LP.attempt('pv.diag.position',['math.placevalue.position']),outcome:'incorrect'});eq(A.diagnosticQueue(failed,LP)[0],'pv.diag.position','A recent difficulty gets a short return');
 // Prediction cannot be retrospectively read after seeing the exchanged model.
 let s=state('pv.diag.predict');s.pv.answers=['3','5','0'];A.handle(s,'check',{},env);ok(!s.solved);ok(s.pv.predictionConfirmed);eq(s.zones.a.hundred,2);eq(s.zones.a.ten,15);ok(!A.correct(s,K),'After prediction the real action is still required');ok(K.exchange(s.zones.a,'pack100'));A.handle(s,'check',{},env);ok(s.solved);eq(LP.status(learning,'math.exchange.hundred'),'independent');
 s=state('pv.diag.predict-ten');s.pv.answers=['0','3','5'];A.handle(s,'check',{},env);ok(!s.solved);ok(K.exchange(s.zones.a,'pack'));A.handle(s,'check',{},env);ok(s.solved);eq(s.zones.a.unit,5,'Five singles remain singles');
 s=state('pv.diag.conservation');s.answer='302';s.pv.choice='same';ok(!A.correct(s,K),'Reading the unchanged total without acting is insufficient');ok(K.exchange(s.zones.a,'split100'));eq({h:s.zones.a.hundred,t:s.zones.a.ten,u:s.zones.a.unit},{h:2,t:10,u:2});ok(!A.correct(s,K));ok(K.exchange(s.zones.a,'split'));ok(A.correct(s,K));
 s=state('pv.diag.conservation-ten');s.answer='32';s.pv.choice='same';ok(!A.correct(s,K));ok(K.exchange(s.zones.a,'split'));ok(A.correct(s,K));
 s=state('pv.diag.expression');s.pv.answers=['180','35','215','110'];ok(A.correct(s,K));s.pv.answers[3]='11';ok(!A.correct(s,K),'Eleven rods mean 110 units');
 // Help and initial error are preserved within the same attempt after reset.
 s=state('pv.read.109');s.answer='190';A.handle(s,'check',{},env);ok(!s.solved);eq(s.pv.firstOutcome,'incorrect');ok(s.pv.help.afterError);const attemptId=s.pv.attempt.attemptId;A.handle(s,'hint',{},env);A.handle(s,'reset',{},env);eq(s.pv.attempt.attemptId,attemptId);ok(s.pv.help.visual&&s.pv.help.afterError);s.answer='109';A.handle(s,'check',{},env);ok(s.solved);eq(LP.latest(learning,'math.placevalue.read').status,'assisted');eq(LP.latest(learning,'math.placevalue.read').firstOutcome,'incorrect');
 s=state('pv.diag.position');A.handle(s,'skip',{},env);ok(s.solved&&s.pv.skipped);eq(LP.status(learning,'math.placevalue.position'),'skipped');const rendered=A.render(s,env);ok(!rendered.includes('4 в 247 означает 40'),'Skipped task does not reveal worked answer');
 // Restoring a noncanonical boundary model preserves raw composition and undo.
 s=state('pv.arithmetic.add.999.1');s.zones.a=K.empty();s.zones.a.hundred=9;s.zones.a.ten=9;s.zones.a.unit=10;s.zones.b=K.empty();s.answer='1000';s.undo=[JSON.stringify({a:K.parts(999,{unitsOnly:true}),b:K.parts(1,{unitsOnly:true}),removed:K.empty()})];const restored=A.restore(A.snapshot(s),K,LP);ok(restored);eq(restored.zones.a,s.zones.a);eq(restored.answer,'1000');eq(restored.undo,s.undo);ok(!A.restore({...A.snapshot(s),zones:{...s.zones,a:{...s.zones.a,hundred:11}}},K,LP));ok(!A.restore({...A.snapshot(s),pv:{...s.pv,queue:['unknown']}},K,LP));
 // Malformed saved flags cannot reveal answers or create invalid digit models.
 const invalidFlags=A.snapshot(state('pv.digits.305'));invalidFlags.pv.selectedDigit=11;invalidFlags.pv.frame=1.5;invalidFlags.pv.teaching='false';invalidFlags.pv.help={visual:'false',explanation:true};const safe=A.restore(invalidFlags,K,LP);eq(safe.pv.selectedDigit,null);eq(safe.pv.frame,0);eq(safe.pv.teaching,false);eq(safe.pv.help.visual,false);eq(safe.pv.help.explanation,true);
 // Optional meaning question has a separate attempt and no reviewed board.
 s=state('pv.arithmetic.add.15.12');s.pv.queue=['pv.arithmetic.add.15.12','pv.value.247'];s.pv.index=0;s.solved=true;A.handle(s,'meaning-open',{},env);const meaningId=s.pv.meaningAttempt.attemptId;const isolated=A.render(s,{...env,zone(){throw Error('Meaning must not render reviewed answer board');}});ok(isolated.includes('data-pv-meaning-active'));ok(!isolated.includes('pv-reviewed'));ok(!isolated.includes('20'),'No twenty is exposed before this answer');s.pv.meaningAnswer='2';A.handle(s,'meaning-check',{},env);A.handle(s,'meaning-skip',{},env);ok(!s.pv.meaningDone);A.handle(s,'meaning-open',{},env);eq(s.pv.meaningAttempt.attemptId,meaningId,'Reopening does not erase previous error');s.pv.meaningAnswer='20';A.handle(s,'meaning-check',{},env);ok(s.pv.meaningDone);ok(LP.latest(learning,'math.placevalue.position').assistance.afterError);A.handle(s,'next',{},env);ok(s.pv.meaningAttempt===null);ok(!s.pv.meaningActive&&!s.pv.meaningDone&&!s.pv.predictionConfirmed&&!s.pv.skipped);eq(s.pv.meaningAnswer,'');
 // The diagnostic follow-up is a real short question, not a diagnostic label.
 s=state('pv.value.247');s.answer='4';A.handle(s,'check',{},env);ok(A.render(s,env).includes('data-pv-action="clarify"'));A.handle(s,'clarify',{value:'10'},env);ok(s.pv.help.visual);ok(!s.solved);ok(s.feedback.text.includes('причина ошибки ещё не определена'));
 // Invalid drag payloads do not put a two-digit/negative value into a digit cell.
 s=state('pv.digits.305');A.handle(s,'digit',{digit:'-1'},env);eq(s.pv.selectedDigit,null);A.handle(s,'digit',{digit:'10'},env);eq(s.pv.selectedDigit,null);A.handle(s,'digit',{digit:'3'},env);A.handle(s,'place',{place:'0'},env);eq(s.pv.digits,[3,null,null]);
}
console.log(JSON.stringify({success:true,checks,arithmeticPaths:paths,trainers:2,diagnosticFamilies:6,diagnosticVariants:8,stableIdentifiers:true,assistanceAndSkipDistinct:true,meaningIsolated:true,rawBoundaryResume:true}));
