(function(root){
'use strict';
// Independent checks reuse the course data, concept checker and existing
// base-ten renderer. They never write lesson ledgers or award old tasks.
const VERSION=1;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),clone=v=>JSON.parse(JSON.stringify(v));
const escDefault=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const topicAllowed=id=>['math.addition','math.subtraction','math.whole','math.position'].includes(id)||/^math\.lesson\.\d+$/.test(id);
function shuffle(list,seed){const a=list.slice();let n=2166136261;for(const c of String(seed))n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;for(let i=a.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1),v=a[i];a[i]=a[j];a[j]=v;}return a;}
function parts(n){return {hundred:Math.floor(n/100),ten:Math.floor(n/10)%10,unit:n%10};}
function curriculum(){return Array.isArray(root.COURSE)?root.COURSE:[];}
function catalog(){
 const list=[];
 for(const lesson of curriculum())for(const [index,t]of lesson.exercises.concat(lesson.draw||[]).entries()){
  list.push({id:'check.math.lesson.'+lesson.id+'.task.'+index,kind:'number',source:'course',lesson:lesson.id,group:lesson.id<=5?0:lesson.id<=12?1:lesson.id<=17?2:lesson.id<=22?3:lesson.id<=28?4:5,title:lesson.title,prompt:'Найди число на месте вопроса.',equation:{a:t.a,b:t.b,op:t.op,result:t.result,missing:t.missing||'result'},answer:t.answer,skillIds:['math.lesson.'+lesson.id,'math.arithmetic.'+(t.op==='+'?'add':'subtract')],hint:t.op==='+'?'Вспомни: слагаемые вместе образуют сумму. Неизвестное слагаемое можно найти вычитанием.':'Уменьшаемое разделяется на вычитаемое и разность. Неизвестную часть ищем по связи сложения и вычитания.',explanation:'Полная запись: '+t.a+' '+(t.op==='+'?'+':'−')+' '+t.b+' = '+t.result+'.',grade:lesson.id<=17?1:2});
 }
 const pv=root.PlaceValueActivities?.TASKS||[];
 for(const t of pv.filter(x=>!x.diagnostic)){
  const common={id:'check.'+t.id,source:'placevalue',grade:2,title:'Разряды и количество',skillIds:t.skillIds.slice(),hint:'Начни справа: единицы, десятки, сотни. Каждый следующий разряд содержит десять предыдущих.'};
  if(t.kind==='read')list.push({...common,kind:'number',prompt:'Запиши число по неподписанной предметной модели.',fixedModel:parts(t.model),answer:t.answer,explanation:'В модели построено '+t.answer+'.'});
  else if(t.kind==='value')list.push({...common,kind:'number',prompt:t.prompt,answer:t.answer,explanation:'Цифра '+t.digit+' в числе '+t.number+' обозначает '+t.answer+' единиц.'});
  else if(['digits','fix','build'].includes(t.kind))list.push({...common,kind:'digits',prompt:'Размести цифры числа '+t.target+' в разрядах: сотни, десятки, единицы.',answer:[Math.floor(t.target/100),Math.floor(t.target/10)%10,t.target%10],explanation:t.target+' состоит из '+Math.floor(t.target/100)+' сотен, '+Math.floor(t.target/10)%10+' десятков и '+t.target%10+' единиц.'});
  else if(t.kind==='expand')list.push({...common,kind:'fields',prompt:'Разложи '+t.target+' на разрядные слагаемые. Запиши количество единиц каждого разряда.',labels:['Сотни обозначают','Десятки обозначают','Единицы обозначают'],answer:[Math.floor(t.target/100)*100,Math.floor(t.target/10)%10*10,t.target%10],explanation:t.target+' = '+Math.floor(t.target/100)*100+' + '+Math.floor(t.target/10)%10*10+' + '+t.target%10+'.'});
  else if(t.kind==='compare')list.push({...common,kind:'fields',prompt:t.prompt,labels:t.numbers.map(n=>'Цифра 4 в '+n),answer:t.answers.slice(),explanation:'Положение цифры меняет её значение: '+t.answers.join(', ')+'.'});
  else if(t.kind==='exchange'){const n=t.answer,p=parts(n);list.push({...common,kind:'fields',prompt:'На поле '+t.initial.hundred+' сотен, '+t.initial.ten+' десятков и '+t.initial.unit+' единиц. Представь обмены. Сколько полных сотен, десятков и отдельных единиц получится?',fixedModel:t.initial,labels:['Сотен','Десятков','Единиц'],answer:[p.hundred,p.ten,p.unit],explanation:'Количество не меняется: стандартный состав — '+p.hundred+'С '+p.ten+'Д '+p.unit+'Е.'});}
  else if(t.kind==='arithmetic')list.push({...common,kind:'number',prompt:'Вычисли, учитывая разряды.',equation:{a:t.a,b:t.b,op:t.op,result:t.result,missing:'result'},answer:t.answer,explanation:t.a+' '+(t.op==='+'?'+':'−')+' '+t.b+' = '+t.result+'. Обмены меняют группировку, сохраняя количество.'});
 }
 for(const t of root.ConceptTrainer?.TASKS||[])if(t.subject==='math'&&topicAllowed(t.topic))list.push({id:'check.'+t.id,source:'concept',kind:'concept',ref:t.id,topic:t.topic,grade:t.grade,title:'Проверим смысл',skillIds:t.skillIds.slice()});
 return list;
}
function map(){return Object.fromEntries(catalog().map(t=>[t.id,t]));}
function select(options){
 options=options||{};const grade=options.grade===1?1:2,seed=String(options.seed||Date.now()),all=catalog().filter(t=>t.grade<=grade),selected=[];
 const groups=[...new Set(all.filter(t=>t.source==='course').map(t=>t.group))];
 for(const group of groups){const pool=shuffle(all.filter(t=>t.source==='course'&&t.group===group),seed+':course:'+group);if(pool.length)selected.push(pool[0]);}
 const pv=shuffle(all.filter(t=>t.source==='placevalue'&&!t.equation),seed+':placevalue');const pvArithmetic=shuffle(all.filter(t=>t.source==='placevalue'&&t.equation),seed+':hundreds');if(pv.length)selected.push(pv[0]);if(pvArithmetic.length)selected.push(pvArithmetic[0]);else if(pv.length>1)selected.push(pv[1]);
 const concepts=shuffle(all.filter(t=>t.source==='concept'),seed+':concept');
 const knownTopics=new Set();for(const t of concepts){if(knownTopics.has(t.topic))continue;knownTopics.add(t.topic);selected.push(t);if(knownTopics.size===2)break;}
 for(const t of shuffle(all,seed+':fill')){if(selected.length>=10)break;if(!selected.some(x=>x.id===t.id))selected.push(t);}
 return shuffle(selected.slice(0,10),seed+':order').map(t=>t.id);
}
function create(options){options=options||{};return {version:VERSION,generation:options.generation||'initial',grade:options.grade===1?1:2,phase:'intro',seed:String(options.seed||Date.now()).slice(0,80),queue:[],index:0,answer:'',answers:[],digits:[null,null,null],selected:null,showModel:false,solved:false,skipped:false,feedback:null,attempt:null,concept:null,results:{},returnRequested:false};}
function current(state){return state?.queue&&map()[state.queue[state.index]]||null;}
function newAttempt(t,state,env){return env.LP.attempt(t.id,t.skillIds,{generation:state.generation,subject:'math',mode:'assessment',evidenceKind:t.source==='course'?'arithmetic':t.kind,variantId:'v1',materialRevision:1,criteriaRevision:1});}
function conceptEnvironment(state,env){return {...env,observe(){}};}
function setup(state,env){
 const t=current(state);if(!t)return;
 Object.assign(state,{answer:'',answers:[],digits:[null,null,null],selected:null,showModel:false,solved:false,skipped:false,feedback:null,concept:null,attempt:newAttempt(t,state,env)});
 if(t.kind==='concept'){
  const C=root.ConceptTrainer,card=C.TASKS.find(x=>x.id===t.ref),s=C.create({subject:'math',grade:state.grade,generation:state.generation});
  s.topicId=card.topic;s.queue=[card.id];s.index=0;s.phase='task';s.attempt=env.LP.attempt(card.id,card.skillIds,{generation:state.generation,subject:'math',mode:'assessment',evidenceKind:card.kind,variantId:'v1',materialRevision:1,criteriaRevision:1});state.concept=s;
 }
}
function restore(raw,env){
 if(!object(raw)||raw.version!==VERSION||raw.generation!==(env?.generation||'initial')||!env?.LP)return null;
 let bytes;try{bytes=JSON.stringify(raw).length;}catch(_){return null;}if(bytes>48*1024)return null;
 const state=create(raw),by=map();state.phase=['intro','task','summary'].includes(raw.phase)?raw.phase:'intro';state.queue=Array.isArray(raw.queue)?raw.queue.filter(id=>by[id]&&by[id].grade<=state.grade).slice(0,10):[];
 if(new Set(state.queue).size!==state.queue.length||state.phase!=='intro'&&!state.queue.length)return null;
 state.index=Number.isInteger(raw.index)?Math.max(0,Math.min(state.queue.length-1,raw.index)):0;state.results=object(raw.results)?Object.fromEntries(Object.entries(raw.results).filter(([id,v])=>state.queue.includes(id)&&object(v)).map(([id,v])=>[id,{outcome:['correct','incorrect','skipped'].includes(v.outcome)?v.outcome:'notchecked',assisted:v.assisted===true,afterError:v.afterError===true}])):{};
 if(state.phase==='intro')return state;
 setup(state,env);const t=current(state);state.answer=typeof raw.answer==='string'?raw.answer.replace(/[^0-9]/g,'').slice(0,4):'';state.answers=Array.isArray(raw.answers)?raw.answers.slice(0,3).map(x=>String(x??'').replace(/[^0-9]/g,'').slice(0,4)):[];state.digits=Array.isArray(raw.digits)&&raw.digits.length===3?raw.digits.map(n=>Number.isInteger(n)&&n>=0&&n<=9?n:null):[null,null,null];state.selected=Number.isInteger(raw.selected)&&raw.selected>=0&&raw.selected<=9?raw.selected:null;state.showModel=raw.showModel===true;state.solved=raw.solved===true;state.skipped=raw.skipped===true;
 if(raw.attempt?.taskId===t.id&&raw.attempt.generation===state.generation){
  const a=env.LP.attempt(t.id,t.skillIds,{attemptId:raw.attempt.attemptId,startedAt:raw.attempt.startedAt,generation:state.generation,subject:'math',mode:'assessment',evidenceKind:t.kind,variantId:'v1',materialRevision:1,criteriaRevision:1});
  a.firstOutcome=['notchecked','correct','incorrect'].includes(raw.attempt.firstOutcome)?raw.attempt.firstOutcome:'notchecked';a.errors=Number.isInteger(raw.attempt.errors)?Math.min(1000,Math.max(0,raw.attempt.errors)):0;for(const k of Object.keys(a.assistance))a.assistance[k]=raw.attempt.assistance?.[k]===true;state.attempt=a;
 }
 if(t.kind==='concept'){const restored=root.ConceptTrainer.restore(raw.concept,{LP:env.LP,generation:state.generation});if(!restored||restored.queue.length!==1||restored.queue[0]!==t.ref)return null;state.concept=restored;state.solved=restored.solved;state.skipped=restored.skipped;}
 state.feedback=raw.feedback&&typeof raw.feedback.text==='string'?{text:raw.feedback.text.slice(0,900),type:['success','error','hint'].includes(raw.feedback.type)?raw.feedback.type:'hint'}:null;
 return state;
}
function complete(state,t){if(t.kind==='number')return /^\d{1,4}$/.test(state.answer);if(t.kind==='fields')return t.answer.every((_,i)=>/^\d{1,4}$/.test(state.answers[i]||''));if(t.kind==='digits')return state.digits.every(n=>n!==null);return t.kind==='concept'&&state.concept?.solved;}
function correct(state,t){t=t||current(state);if(!t)return false;if(t.kind==='concept')return root.ConceptTrainer.correct(state.concept);if(!complete(state,t))return false;if(t.kind==='number')return Number(state.answer)===t.answer;if(t.kind==='fields')return t.answer.every((n,i)=>Number(state.answers[i])===n);return t.answer.every((n,i)=>state.digits[i]===n);}
function observe(state,outcome,env){const t=current(state),a=t.kind==='concept'?state.concept.attempt:state.attempt;env.observe?.({...clone(a),taskId:t.id,skillIds:t.skillIds,outcome,mode:'assessment',subject:'math',evidenceKind:'assessment-'+t.kind});const help=a.assistance||{};state.results[t.id]={outcome,assisted:!!(help.visual||help.explanation||help.workedExample||help.generic),afterError:help.afterError===true};}
function handle(state,action,data,env){
 data=data||{};if(!state||!env?.LP)return false;
 if(action==='exit'){state.returnRequested=true;return true;}
 if(action==='start'||action==='restart'){state.seed=String(data.seed||Date.now());state.queue=select({grade:state.grade,seed:state.seed});state.index=0;state.results={};state.phase='task';state.returnRequested=false;setup(state,env);return true;}
 const t=current(state);if(!t||state.phase!=='task')return false;
 if(action==='next'){if(!state.solved)return false;if(state.index+1>=state.queue.length){state.phase='summary';state.solved=false;}else{state.index++;setup(state,env);}return true;}
 if(action==='skip'){if(state.solved)return false;if(t.kind==='concept')root.ConceptTrainer.handle(state.concept,'skip',{},conceptEnvironment(state,env));state.solved=true;state.skipped=true;observe(state,'skipped',env);state.feedback={type:'hint',text:'Пропущено. Это не ошибка. Можно проверить эту тему позже.'};return true;}
 if(state.solved)return false;
 if(t.kind==='concept'){
  const allowed=['select','place','drop','clear','choice','check','hint','explain','return','begin'];if(!allowed.includes(action))return false;
  const before=state.concept.solved,changed=root.ConceptTrainer.handle(state.concept,action,data,conceptEnvironment(state,env));state.solved=state.concept.solved;state.skipped=state.concept.skipped;
  if(!before&&state.solved)observe(state,'correct',env);else if(action==='check'&&state.concept.feedback?.type==='error')observe(state,'incorrect',env);
  return changed;
 }
 if(action==='digit'){const n=Number(data.value??data.item);if(!Number.isInteger(n)||n<0||n>9)return false;state.selected=n;return true;}
 if(action==='place'||action==='drop'){const n=action==='drop'?Number(data.item):state.selected,i=Number(data.zone);if(t.kind!=='digits'||!Number.isInteger(n)||n<0||n>9||!Number.isInteger(i)||i<0||i>2)return false;state.digits[i]=n;state.selected=null;state.feedback=null;return true;}
 if(action==='hint'||action==='model'){env.LP.help(state.attempt,'visual');state.showModel=action==='model'||state.showModel;state.feedback={type:'hint',text:t.hint||'Вспомни смысл действия. Каждый десяток содержит 10 единиц.'};return true;}
 if(action==='explain'){env.LP.help(state.attempt,'explanation');state.feedback={type:'hint',text:t.hint||'Прочитай условие ещё раз. В записи числа место цифры определяет её значение.'};return true;}
 if(action==='check'){
  if(!complete(state,t)){state.feedback={type:'hint',text:'Сначала запиши ответ во все пустые места.'};return true;}
  const yes=correct(state,t);if(!yes)env.LP.help(state.attempt,'error');state.solved=yes;observe(state,yes?'correct':'incorrect',env);state.feedback={type:yes?'success':'error',text:yes?t.explanation+' '+(state.attempt.assistance.afterError?'Ответ исправлен.':state.attempt.assistance.visual||state.attempt.assistance.explanation?'Получилось с помощью.':'Получилось самостоятельно.'):'Пока не сходится. Можно исправить ответ или открыть подсказку. Одна ошибка ещё не объясняет причину затруднения.'};return true;
 }
 return false;
}
function capture(state,container){if(!state||state.phase!=='task'||state.solved||!container)return false;const t=current(state);if(t?.kind==='concept')return root.ConceptTrainer.capture(state.concept,container);let changed=false;const answer=container.querySelector('[data-mc-input="answer"]');if(answer){const value=answer.value.replace(/[^0-9]/g,'').slice(0,4);if(value!==state.answer){state.answer=value;changed=true;}}container.querySelectorAll('[data-mc-field]').forEach(el=>{const i=Number(el.dataset.mcField),value=el.value.replace(/[^0-9]/g,'').slice(0,4);if(state.answers[i]!==value){state.answers[i]=value;changed=true;}});return changed;}
const button=(action,label,attrs='',cls='')=>'<button class="ct-btn '+cls+'" data-mc-action="'+action+'" '+attrs+'>'+label+'</button>';
function renderModel(p,env){if(env.model)return env.model(p);const K=root.Kubiki,P=root.PlaceValue;if(K&&P&&root.pieces)return '<div class="mini-pieces">'+root.pieces(p,'',true)+'</div>';return '<div class="mc-model-fallback">'+['hundred','ten','unit'].map((k,i)=>'<span>'+Array.from({length:p[k]||0},()=>i===0?'▦':i===1?'▥':'▪').join(' ')+'</span>').join('')+'</div>';}
function render(state,env){
 const e=env?.esc||escDefault,t=current(state);let content='';
 if(state.phase==='intro')content='<section class="ct-rule"><h3>Смешанная контрольная</h3><p>Десять коротких заданий из разных тем: вычисления, разряды и смысл понятий. Ответы не показаны заранее.</p><p>Можно исправить ошибку, попросить помощь или пропустить. Помощь будет отмечена отдельно. Результат контрольной не заменяет прохождение уроков.</p>'+button('start','Начать контрольную','','primary')+'</section>';
 else if(state.phase==='summary'){const rows=state.queue.map(id=>({t:map()[id],r:state.results[id]})),independent=rows.filter(x=>x.r?.outcome==='correct'&&!x.r.assisted&&!x.r.afterError).length;content='<section class="ct-summary"><h3>Проверка закончена</h3><p>Без помощи с первой попытки: '+independent+' из '+state.queue.length+'. Это наблюдение за этой работой, а не окончательный вывод об освоении.</p><ol class="mc-results">'+rows.map(({t,r})=>'<li><span>'+e(t.title)+'</span><strong>'+(!r?'Не проверено':r.outcome==='skipped'?'Пропущено':r.outcome==='correct'?r.assisted?'С помощью':r.afterError?'После исправления':'Самостоятельно':'Нужна ещё проверка')+'</strong></li>').join('')+'</ol><div class="ct-actions">'+button('restart','Новая смесь заданий','','primary')+button('exit','К урокам')+'</div></section>';}
 else if(t){
  content='<div class="ct-toprow"><span>Карточка '+(state.index+1)+' из '+state.queue.length+'</span><span>Разные темы · свой темп</span></div><div class="ct-progress"><span style="width:'+state.index/state.queue.length*100+'%"></span></div><section class="ct-task"><h3>'+e(t.kind==='concept'?'Проверь смысл понятия':t.prompt)+'</h3>';
  if(t.kind==='concept')content+='<div class="mc-concept">'+root.ConceptTrainer.render(state.concept,env)+'</div>';
  else{
   if(t.equation){const q=t.equation;content+='<div class="equation"><span>'+e(q.missing==='a'?'?':q.a)+'</span><span>'+(q.op==='+'?'+':'−')+'</span><span>'+e(q.missing==='b'?'?':q.b)+'</span><span>=</span><span>'+e(q.missing==='result'?'?':q.result)+'</span></div>';}
   if(t.fixedModel)content+='<div class="mc-model" role="group" aria-label="Предметная модель. Посчитай группы и клетки.">'+renderModel(t.fixedModel,env)+'</div>';
   else if(state.showModel&&t.equation){const q=t.equation;content+='<div class="mc-model">'+(q.missing!=='a'?renderModel(parts(q.a),env):'')+(q.missing!=='b'?'<span>'+(q.op==='+'?'+':'−')+'</span>'+renderModel(parts(q.b),env):'')+'</div>';}
   if(t.kind==='number')content+='<label class="ct-input-label">Мой ответ<input data-mc-input="answer" inputmode="numeric" maxlength="4" autocomplete="off" value="'+e(state.answer)+'" '+(state.solved?'disabled':'')+'></label>';
   if(t.kind==='fields')content+='<div class="mc-fields">'+t.labels.map((label,i)=>'<label>'+e(label)+'<input data-mc-field="'+i+'" inputmode="numeric" maxlength="4" autocomplete="off" value="'+e(state.answers[i]||'')+'" '+(state.solved?'disabled':'')+'></label>').join('')+'</div>';
   if(t.kind==='digits')content+='<div class="mc-digits">'+['Сотни','Десятки','Единицы'].map((label,i)=>'<div><strong>'+label+'</strong>'+button('place',state.digits[i]===null?'?':state.digits[i],'data-zone="'+i+'" data-practice-drop="'+i+'" '+(state.solved?'disabled':''),'ct-drop')+'</div>').join('')+'</div><div class="ct-card-bank">'+Array.from({length:10},(_,i)=>button('digit',i,'data-value="'+i+'" data-practice-drag="'+i+'" aria-pressed="'+(state.selected===i)+'" '+(state.solved?'disabled':''),state.selected===i?'selected':'')).join('')+'</div><p class="ct-instruction">Выбери цифру, затем её разряд. Можно перетащить.</p>';
   if(state.feedback)content+='<div class="ct-feedback '+state.feedback.type+'" role="status">'+e(state.feedback.text)+'</div>';
  }
  content+='<div class="ct-actions">'+(state.solved?button('next',state.index+1===state.queue.length?'Посмотреть итог':'Следующая карточка','','primary'):t.kind==='concept'&&state.concept.phase==='intro'?button('return','Вернуться к проверке','','primary'):button('check','Проверить','','primary')+button('hint','Подсказка')+(t.equation?button('model','Показать предметы'):'')+button('skip','Пропустить'))+'</div></section>';
 }
 return '<section class="mc-shell"><div class="ct-heading"><div><span class="ct-eyebrow">ПРОВЕРЯЕМ СЕБЯ</span><h2>Математика · контрольная</h2></div></div>'+content+'</section>';
}
function validate(){const c=catalog(),errors=[],seen=new Set();for(const t of c){if(seen.has(t.id))errors.push('duplicate:'+t.id);seen.add(t.id);if(t.source==='course'){const q=t.equation,result=q.op==='+'?q.a+q.b:q.a-q.b,expected=q.missing==='a'?q.a:q.missing==='b'?q.b:q.result;if(result!==q.result||t.answer!==expected)errors.push('arithmetic:'+t.id);}if(t.kind==='number'&&(!Number.isInteger(t.answer)||t.answer<0||t.answer>1000))errors.push('range:'+t.id);}return {success:!errors.length,errors,cards:c.length,course:c.filter(t=>t.source==='course').length,placevalue:c.filter(t=>t.source==='placevalue').length,concepts:c.filter(t=>t.source==='concept').length};}
root.MathCheck={VERSION,create,restore,render,handle,capture,current,catalog,select,correct,validate,automatic:true};
})(typeof window==='undefined'?globalThis:window);
