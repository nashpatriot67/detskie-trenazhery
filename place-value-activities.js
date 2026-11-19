(function(root){
'use strict';
const SKILLS={
 'math.placevalue.position':'Стоимость цифры',
 'math.placevalue.zero':'Ноль в записи числа',
 'math.placevalue.build':'Построение числа',
 'math.placevalue.read':'Чтение предметной модели',
 'math.exchange.ten':'Образование десятка',
 'math.exchange.hundred':'Образование сотни',
 'math.exchange.split-ten':'Размен десятка',
 'math.exchange.split-hundred':'Размен сотни',
 'math.placevalue.conservation':'Сохранение количества',
 'math.placevalue.expression':'Модель и выражение'
};
const TASKS=[];
function add(id,kind,title,prompt,extra){TASKS.push(Object.assign({id,kind,title,prompt,skillIds:[],lesson:6,version:1,familyId:'pv.'+kind},extra));}
add('pv.build.247','build','Построй число','Построй 247 из сотен, десятков и единиц.',{target:247,skillIds:['math.placevalue.build']});
add('pv.build.420','build','Построй число с нулём','Построй 420. Подумай, нужны ли отдельные единицы.',{target:420,skillIds:['math.placevalue.build','math.placevalue.zero']});
add('pv.digits.305','digits','Цифры по местам','Поставь цифры так, чтобы получилось 305. Ноль занимает своё место.',{target:305,skillIds:['math.placevalue.zero','math.placevalue.position']});
add('pv.digits.247','digits','Разрядная таблица','Размести цифры числа 247 в ячейках сотен, десятков и единиц.',{target:247,skillIds:['math.placevalue.position']});
add('pv.expand.470','expand','Разрядные слагаемые','Разложи 470: сколько единиц обозначают сотни, десятки и единицы?',{target:470,skillIds:['math.placevalue.zero','math.placevalue.position']});
add('pv.expand.109','expand','Ноль в середине','Разложи 109 на разрядные слагаемые. Не пропускай пустой разряд.',{target:109,skillIds:['math.placevalue.zero','math.placevalue.position']});
add('pv.value.247','value','Стоимость цифры','Сколько единиц обозначает цифра 4 в числе 247?',{number:247,digit:4,place:1,answer:40,skillIds:['math.placevalue.position']});
add('pv.read.109','read','Прочитай модель','Какое число построено? Считай клетки и целые группы.',{model:109,answer:109,skillIds:['math.placevalue.read','math.placevalue.zero']});
add('pv.read.305','read','Модель без подписи','Назови число по модели. Если какого-то разряда нет, не потеряй его место.',{model:305,answer:305,skillIds:['math.placevalue.read','math.placevalue.zero']});
add('pv.compare.4','compare','Одна цифра — разные величины','Что означает цифра 4 в каждом числе? Запиши количество единиц.',{numbers:[247,427,274],answers:[40,400,4],skillIds:['math.placevalue.position']});
add('pv.fix.305','fix','Исправь чужую запись','К числу 305 поставили цифры неправильно. Исправь таблицу.',{target:305,initialDigits:[3,5,0],skillIds:['math.placevalue.zero','math.placevalue.position']});
add('pv.exchange.13t','exchange','Собери сотню','На поле 13 десятков. Собери полную сотню вручную. Запиши число.',{initial:{hundred:0,ten:13,unit:0},answer:130,required:'canonical',skillIds:['math.exchange.hundred'],lesson:19});
add('pv.exchange.2h15t','exchange','Сотни и десятки','На поле 2 сотни и 15 десятков. Собери полные сотни вручную. Запиши число.',{initial:{hundred:2,ten:15,unit:0},answer:350,required:'canonical',skillIds:['math.exchange.hundred','math.placevalue.conservation'],lesson:19});
add('pv.exchange.9t15u','exchange','Два обмена','На поле 9 десятков и 15 единиц. Собери полные десятки и сотню. Запиши число.',{initial:{hundred:0,ten:9,unit:15},answer:105,required:'canonical',skillIds:['math.exchange.ten','math.exchange.hundred'],lesson:13});
const examples=[[95,8,'+'],[180,35,'+'],[270,45,'+'],[198,7,'+'],[302,8,'-'],[300,18,'-'],[405,27,'-'],[500,176,'-'],[999,1,'+'],[15,12,'+']];
function arithmeticSkills(a,b,op){
 const ids=['math.placevalue.expression'],at=Math.floor(a/10)%10,bt=Math.floor(b/10)%10;
 if(op==='+'){const carry=a%10+b%10>=10;if(carry)ids.push('math.exchange.ten');if(at+bt+(carry?1:0)>=10)ids.push('math.exchange.hundred');}
 else{const borrow=a%10<b%10;if(borrow)ids.push('math.exchange.split-ten');if(at-(borrow?1:0)<bt)ids.push('math.exchange.split-hundred');}
 return ids;
}
examples.forEach(([a,b,op])=>add('pv.arithmetic.'+(op==='+'?'add':'subtract')+'.'+a+'.'+b,'arithmetic','Считаем с разрядами',op==='+'?'Перенеси вторую группу к первой. Обмены выполняй сам.':'Убери второе количество в область справа. Размени группы, если нужно.',{a,b,op,result:op==='+'?a+b:a-b,answer:op==='+'?a+b:a-b,missing:'result',skillIds:arithmeticSkills(a,b,op),familyId:'pv.arithmetic.'+(op==='+'?'add':'subtract')+'.'+arithmeticSkills(a,b,op).filter(id=>id!=='math.placevalue.expression').join('.'),lesson:op==='+'?13:16}));
add('pv.diag.position','compare','Стоимость цифры','Сколько единиц обозначает цифра 4 в каждом числе?',{numbers:[247,427,274],answers:[40,400,4],skillIds:['math.placevalue.position'],diagnostic:true});
add('pv.diag.read','read','Прочитай неподписанную модель','Какое число построено? Запиши его.',{model:305,answer:305,skillIds:['math.placevalue.read','math.placevalue.zero'],diagnostic:true});
add('pv.diag.build','build','Построй заданное число','Построй 420. Форма групп может быть разной.',{target:420,skillIds:['math.placevalue.build','math.placevalue.zero'],diagnostic:true});
add('pv.diag.predict','predict','Предскажи обмен','Есть 2 сотни и 15 десятков. Обменяем ровно 10 десятков на сотню. Сколько сотен, десятков и единиц будет? Сначала запиши прогноз.',{initial:{hundred:2,ten:15,unit:0},prediction:[3,5,0],answer:350,exchangeAction:'pack100',skillIds:['math.exchange.hundred','math.placevalue.conservation'],lesson:19,diagnostic:true});
add('pv.diag.conservation','conservation','Почему количество прежнее?','Размени одну сотню на десятки, затем десяток на единицы. После размена количество стало больше, меньше или осталось тем же?',{initial:{hundred:3,ten:0,unit:2},answer:302,skillIds:['math.exchange.split-hundred','math.exchange.split-ten','math.placevalue.conservation'],lesson:16,diagnostic:true});
add('pv.diag.expression','expression','Модель и запись','Две неподписанные группы складывают. Запиши первое число, второе число и результат. Затем укажи, сколько единиц обозначают все палочки-десятки вместе.',{a:180,b:35,op:'+',result:215,answers:[180,35,215,110],skillIds:['math.placevalue.expression'],lesson:23,diagnostic:true});
add('pv.diag.predict-ten','predict','Предскажи новый десяток','Есть 2 десятка и 15 единиц. Обменяем ровно 10 единиц на десяток. Сколько сотен, десятков и единиц будет? Сначала запиши прогноз.',{initial:{hundred:0,ten:2,unit:15},prediction:[0,3,5],answer:35,exchangeAction:'pack',skillIds:['math.exchange.ten','math.placevalue.conservation'],lesson:3,diagnostic:true});
add('pv.diag.conservation-ten','conservation','Размен десятка','Размени один десяток на единицы. Количество стало больше, меньше или осталось тем же?',{initial:{hundred:0,ten:3,unit:2},answer:32,expected:{hundred:0,ten:2,unit:12},skillIds:['math.exchange.split-ten','math.placevalue.conservation'],lesson:8,diagnostic:true});
const byId=Object.fromEntries(TASKS.map(t=>[t.id,t]));
const statusNames={independent:'Самостоятельно',assisted:'С помощью',incorrect:'Пока не получилось',skipped:'Пропущено',notchecked:'Не проверено'};
const copy=v=>JSON.parse(JSON.stringify(v));
function current(pv){return pv&&Array.isArray(pv.queue)&&Number.isInteger(pv.index)&&byId[pv.queue[pv.index]]||null;}
function blankZones(K){return {a:K.empty(),b:K.empty(),removed:K.empty()};}
function fromCounts(p,K){const out=K.empty();for(const k of Object.keys(out))out[k]=p[k]||0;return out;}
function diagnosticQueue(learning,LP){
 const items=TASKS.filter(t=>t.diagnostic);
 const ranked=items.map((t,i)=>({id:t.id,family:t.familyId,i,priority:Math.max(...t.skillIds.map(id=>{const s=LP?LP.status(learning,id):'notchecked';return s==='incorrect'?4:s==='notchecked'?3:s==='skipped'?2:s==='assisted'?1:0;}))})).sort((a,b)=>b.priority-a.priority||a.i-b.i);
 const families=new Set(),queue=[];for(const item of ranked){if(families.has(item.family))continue;families.add(item.family);queue.push(item.id);if(queue.length===3)break;}return queue;
}
function prepare(state,K,LP){
 const t=current(state.pv);if(!t)return;
 state.zones=blankZones(K);state.answer='';state.solved=false;state.selected=null;state.undo=[];state.feedback=null;
 state.pv.answers=[];state.pv.digits=t.initialDigits?copy(t.initialDigits):[null,null,null];state.pv.selectedDigit=null;state.pv.choice='';state.pv.teaching=false;state.pv.frame=0;state.pv.help={explanation:false,visual:false,afterError:false,workedExample:false};state.pv.errors=0;state.pv.firstOutcome='notchecked';state.pv.recorded=false;state.pv.finished=false;state.pv.skipped=false;state.pv.predictionConfirmed=false;state.pv.meaningActive=false;state.pv.meaningDone=false;state.pv.meaningAnswer='';state.pv.meaningAttempt=null;state.pv.clarificationDone=false;
 state.pv.attempt=LP?LP.attempt(t.id,t.skillIds,{variantId:'v1',familyId:t.familyId}):null;
 if(t.initial)state.zones.a=fromCounts(t.initial,K);
 else if(t.kind==='read')state.zones.a=K.parts(t.model,{unitsOnly:true});
 else if(t.kind==='arithmetic'||t.kind==='expression'){state.zones.a=K.parts(t.a,{unitsOnly:true});if(t.op==='+')state.zones.b=K.parts(t.b,{unitsOnly:true});}
}
function start(state,track,K,LP,learning,id){
 let queue=track==='diagnostic'?diagnosticQueue(learning,LP):TASKS.filter(t=>!t.diagnostic).map(t=>t.id);
 if(id&&byId[id]){track=byId[id].diagnostic?'diagnostic':'practice';queue=track==='diagnostic'?[id]:TASKS.filter(t=>!t.diagnostic).map(t=>t.id);}
 state.view='placevalue';state.pv={version:1,track,queue,index:id?Math.max(0,queue.indexOf(id)):0};state.pvConflict=false;prepare(state,K,LP);
}
function restore(raw,K,LP){
 if(!raw||raw.version!==1||!raw.pv||raw.pv.version!==1||!Array.isArray(raw.pv.queue)||!raw.pv.queue.length||raw.pv.queue.some(id=>!byId[id]))return null;
 const pv=copy(raw.pv);if(!Number.isInteger(pv.index)||pv.index<0||pv.index>=pv.queue.length)return null;
 if(!['practice','diagnostic'].includes(pv.track))return null;
 const zones=blankZones(K);
 for(const zone of Object.keys(zones)){if(!raw.zones||!raw.zones[zone])return null;for(const key of Object.keys(K.values)){const n=raw.zones[zone][key];if(!Number.isInteger(n)||n<0||n*K.values[key]>1000)return null;zones[zone][key]=n;}if(K.total(zones[zone])>1000)return null;}
 pv.answers=Array.isArray(pv.answers)?pv.answers.slice(0,4).map(s=>String(s||'').replace(/[^0-9]/g,'').slice(0,4)):[];
 pv.digits=Array.isArray(pv.digits)&&pv.digits.length===3?pv.digits.map(n=>Number.isInteger(n)&&n>=0&&n<=9?n:null):[null,null,null];
 pv.help=Object.fromEntries(['explanation','visual','afterError','workedExample'].map(k=>[k,!!(pv.help&&pv.help[k]===true)]));pv.errors=Number.isInteger(pv.errors)?Math.min(100,Math.max(0,pv.errors)):0;pv.frame=Number.isInteger(pv.frame)?Math.max(0,Math.min(15,pv.frame)):0;
 pv.selectedDigit=Number.isInteger(pv.selectedDigit)&&pv.selectedDigit>=0&&pv.selectedDigit<=9?pv.selectedDigit:null;
 for(const flag of ['teaching','finished','skipped','predictionConfirmed','meaningActive','meaningDone','clarificationDone'])pv[flag]=pv[flag]===true;
 pv.meaningAnswer=typeof pv.meaningAnswer==='string'?pv.meaningAnswer.replace(/[^0-9]/g,'').slice(0,4):'';
 const undo=Array.isArray(raw.undo)?raw.undo.slice(-20).filter(x=>{try{return !!restore({version:1,pv:{version:1,track:pv.track,queue:pv.queue,index:pv.index},zones:JSON.parse(x)},K,LP);}catch(_){return false;}}):[];
 return {view:'placevalue',pv,zones,answer:String(raw.answer||'').replace(/[^0-9]/g,'').slice(0,4),undo,solved:raw.solved===true,feedback:raw.feedback&&typeof raw.feedback.text==='string'?{text:raw.feedback.text.slice(0,1000),type:raw.feedback.type==='success'?'success':'hint'}:null,selected:null};
}
function snapshot(state){return {version:1,pv:copy(state.pv),zones:copy(state.zones),answer:state.answer,undo:state.undo.slice(-20),solved:state.solved,feedback:state.feedback};}
function boardTask(t){return ['build','exchange','arithmetic','predict','conservation'].includes(t.kind);}
function fixedModel(p,env,label){return `<div class="pv-fixed-model" role="group" aria-label="${env.esc(label||'Предметная модель. Посчитай группы и клетки.')}" tabindex="0"><div class="mini-pieces">${env.pieces(p,'',true)||'<span>Нет предметов</span>'}</div></div>`;}
function fields(state,labels,env){return `<div class="pv-fields">${labels.map((label,i)=>`<label>${env.esc(label)}<input data-pv-field="${i}" inputmode="numeric" maxlength="4" autocomplete="off" value="${env.esc(state.pv.answers[i]||'')}" ${state.solved?'disabled':''}></label>`).join('')}</div>`;}
function table(state,env,interactive){return `<div class="pv-place-table" role="group" aria-label="Разрядная таблица">${['Сотни','Десятки','Единицы'].map((label,i)=>`<div><strong>${label}</strong>${interactive?`<button data-pv-action="place" data-place="${i}" class="pv-digit-slot" aria-label="${label}: ${state.pv.digits[i]===null?'пустая ячейка':state.pv.digits[i]}" ${state.solved?'disabled':''}>${state.pv.digits[i]===null?'?':state.pv.digits[i]}</button>`:`<b>${state.pv.digits[i]===null?'?':state.pv.digits[i]}</b>`}</div>`).join('')}</div>`;}
function input(state,env,label){return `<label class="pv-answer-label" for="pv-answer">${env.esc(label||'Мой ответ')}<input id="pv-answer" inputmode="numeric" autocomplete="off" maxlength="4" value="${env.esc(state.answer)}" ${state.solved?'disabled':''}></label>`;}
function modelPanel(state,env){const t=current(state.pv),single=t.kind!=='arithmetic';const tools=t.kind==='predict'&&!state.pv.predictionConfirmed?env.exchangeTools().replace(/<button /g,'<button disabled '):env.exchangeTools();return `<div class="board pv-board ${single?'single-board':''} ${Object.values(state.zones).some(p=>p.hundred>0)?'has-hundred':''}">${env.zone('a',t.kind==='build'?'Моя постройка':'На поле','Количество подсчитай сам')}${t.kind==='arithmetic'?env.zone(t.op==='+'?'b':'removed',t.op==='+'?'Добавляем':'Убрали',t.op==='+'?'Переноси в первую группу':`Нужно убрать ${t.b}`):''}</div>${t.kind==='build'?env.bank():''}${tools}<div class="board-actions"><button class="btn ghost" data-pv-action="reset">Заново</button><button class="btn ghost" data-action="undo" ${state.solved||!state.undo.length?'disabled':''}>Отменить</button>${t.kind==='arithmetic'&&t.op==='+'?`<button class="btn secondary" data-action="combine" ${state.solved||env.K.total(state.zones.b)===0?'disabled':''}>Соединить группы</button>`:''}</div>`;}
function usesHundred(t){return !!(t.initial&&t.initial.hundred>0||t.a>=100||t.model>=100||t.target>=100);}
function hintFor(t){if(['digits','fix','expand'].includes(t.kind))return 'Сотни занимают третье место справа, десятки — второе, единицы — первое. Если групп нет, на их месте нужен ноль.';if(t.kind==='value'||t.kind==='compare')return 'Одна и та же цифра имеет разную стоимость. Вспомни, сколько единиц в одной группе на её месте.';if(t.kind==='conservation')return 'Сотню можно заменить ровно десятью десятками, а один десяток — десятью единицами. Ничего нового извне не добавляется.';if(t.kind==='predict'||t.kind==='exchange')return 'Ровно десять групп одного разряда можно заменить одной группой следующего. Остальные группы не меняются.';if(t.kind==='arithmetic')return t.op==='+'?'Добавляй предметы. Ровно десять единиц меняются на десяток, десять десятков — на сотню.':'Если отдельных единиц не хватает, получи десятки из сотни, затем единицы из десятка. Обмен сохраняет количество.';return 'Одна синяя клетка — единица. В палочке десять таких клеток, в квадрате сто. Посчитай каждую группу по её величине.';}
function teachingFrames(state,env){
 const t=current(state.pv);if(t?.kind!=='arithmetic')return [];
 const plan=env.P.explanation(t,env.K);return [plan.initial,...plan.transformations,plan.final];
}
function renderTeaching(state,env){const t=current(state.pv);if(t.kind!=='arithmetic')return `<div class="pv-explanation"><h3>Разберёмся на другом числе</h3><p>${env.esc(hintFor(t))}</p><p>Например, 124 — это сотня, два десятка и четыре единицы: 100 + 20 + 4.</p>${fixedModel(env.K.parts(124,{unitsOnly:true}),env,'Пример: сто двадцать четыре')}<button class="btn primary" data-pv-action="return">Вернуться к моей задаче</button></div>`;
 const frames=teachingFrames(state,env),f=frames[Math.min(state.pv.frame,frames.length-1)];return `<div class="pv-explanation" data-pv-teach-operation="${f.operation}"><div class="equation">${t.a} ${t.op==='+'?'+':'−'} ${t.b} = ${f.phase==='final'?t.result:'?'}</div><h3>${env.esc(f.label)}</h3><p>${env.esc(f.caption)}</p><div class="pv-teach-models">${['a','b','removed'].filter(k=>k==='a'||env.K.total(f.zones[k])>0).map(k=>`<div data-learn-zone="${k}"><strong>${k==='removed'?'Убрали':k==='b'?'Добавляем':'На поле'}</strong>${fixedModel(f.zones[k],env,'Учебный пример')}<p class="pv-teach-quantity">${env.esc(env.P.describe(f.zones[k],env.K).actualText)}${f.showTotal?' = '+env.K.total(f.zones[k]):''}</p></div>`).join('')}</div>${f.conservationText?`<p class="pv-conservation">${env.esc(f.conservationText)}</p>`:''}<div class="board-actions"><button class="btn ghost" data-pv-action="teach-back" ${state.pv.frame===0?'disabled':''}>Назад</button>${state.pv.frame<frames.length-1?`<button class="btn primary" data-pv-action="teach-next">${env.esc(f.actionLabel)}</button>`:''}<button class="btn secondary" data-pv-action="return">Вернуться к задаче</button></div><p class="muted">Разбор — помощь. Следующее новое задание можно выполнить самостоятельно.</p></div>`;}
function render(state,env){
 const pv=state.pv,t=current(pv);if(!t)return '<section class="lesson-panel"><h2>Выбери задание</h2></section>';
 const supported=env.LP?env.LP.clean(env.learning):{observations:[]};
 const nav=pv.meaningActive&&!pv.meaningDone?'':pv.track==='diagnostic'?`<p class="muted">Короткая проверка · карточка ${pv.index+1} из ${pv.queue.length}. Можно пропустить или закончить.</p>`:`<label class="pv-task-picker">Выбрать упражнение<select data-pv-task-select>${TASKS.filter(x=>!x.diagnostic).map((x,i)=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${i+1}. ${env.esc(x.title)}${x.kind==='arithmetic'?' · '+x.a+(x.op==='+'?'+':'−')+x.b:''}</option>`).join('')}</select></label>`;
 let content='';
 if(pv.teaching)content=renderTeaching(state,env);
 else if(pv.meaningActive&&!pv.meaningDone)content=`<section class="pv-meaning" data-pv-meaning-active><h3>А почему так?</h3><p>15 + 12 = 27. Сколько единиц обозначают две цифры 1 в десятках чисел 15 и 12 вместе?</p><label>Мой ответ<input id="pv-meaning-answer" inputmode="numeric" maxlength="4" value="${env.esc(pv.meaningAnswer||'')}"></label><button class="btn secondary" data-pv-action="meaning-check">Проверить смысл</button><button class="btn ghost" data-pv-action="meaning-skip">Позже</button>${state.feedback?`<div class="feedback ${state.feedback.type}" role="status">${env.esc(state.feedback.text)}</div>`:''}</section>`;
 else if(pv.finished)content=`<h3>На сегодня достаточно</h3><p>Показано ${pv.queue.length} карточки. Не все навыки обязательно проверять за один раз.</p>${renderSkills(env.learning,env.LP,env.esc)}<button class="btn primary" data-pv-open="practice">К упражнениям</button>`;
 else{
  content=`<p class="activity-instruction">${env.esc(t.prompt)}</p>`;
  if(t.kind==='arithmetic')content+=`<div class="equation">${t.a} ${t.op==='+'?'+':'−'} ${t.b} = <span class="eq-answer">${state.solved&&!pv.skipped?t.result:'?'}</span></div>`;
  if(boardTask(t))content+=modelPanel(state,env);
  else if(t.kind==='read')content+=fixedModel(state.zones.a,env);
  else if(t.kind==='expression')content+=`<div class="pv-two-models">${fixedModel(state.zones.a,env,'Первое количество')}<b>+</b>${fixedModel(state.zones.b,env,'Второе количество')}</div>`;
  if(t.kind==='digits'||t.kind==='fix'){
   content+=table(state,env,true)+`<div class="pv-digit-bank" role="group" aria-label="Цифры для размещения">${Array.from({length:10},(_,n)=>`<button draggable="true" data-pv-action="digit" data-digit="${n}" class="${pv.selectedDigit===n?'selected':''}" ${state.solved?'disabled':''}>${n}</button>`).join('')}</div><p class="muted">Выбери цифру и нажми на её место. Можно перетащить мышкой или пальцем.</p>`;
   if(pv.digits.every(n=>n!==null)){const n=pv.digits[0]*100+pv.digits[1]*10+pv.digits[2];content+=fixedModel(env.K.parts(n,{unitsOnly:true}),env,'Модель твоей записи');}
  }else if(t.kind==='expand')content+=fields(state,['Сотни: величина','Десятки: величина','Единицы: величина'],env);
  else if(t.kind==='compare')content+=fields(state,t.numbers.map(n=>'Цифра 4 в '+n),env);
  else if(t.kind==='predict')content+=fields(state,['После обмена: сотен','После обмена: десятков','После обмена: единиц'],env)+`<p class="muted">Кнопки обмена можно использовать после проверки прогноза. До этого модель не меняется.</p>`;
  else if(t.kind==='conservation')content+=`<div class="pv-choice-row">${[['same','Столько же'],['more','Больше'],['less','Меньше']].map(([id,label])=>`<button class="btn secondary ${pv.choice===id?'selected':''}" data-pv-action="choice" data-choice="${id}" ${state.solved?'disabled':''}>${label}</button>`).join('')}</div>`+input(state,env,'Общее количество после размена');
  else if(t.kind==='expression')content+=fields(state,['Первое число','Второе число','Результат','Все палочки обозначают единиц'],env);
  else content+=input(state,env,t.kind==='build'?'Какое число ты построил?':'Мой ответ');
  if(!state.solved)content+=`<div class="pv-check-row"><button class="btn primary" data-pv-action="check">Проверить</button><button class="btn ghost" data-pv-action="hint">Подсказка</button><button class="btn ghost" data-pv-action="explain">Разобраться с примером</button>${pv.track==='diagnostic'?'<button class="btn ghost" data-pv-action="skip">Пропустить</button>':''}</div>`;
  else content+=`<div class="pv-check-row"><button class="btn primary" data-pv-action="next">Дальше</button></div>`;
  if(state.feedback)content+=`<div class="feedback ${state.feedback.type}" role="status">${env.esc(state.feedback.text)}</div>`;
  if(state.solved&&!pv.skipped)content+=`<div class="pv-reviewed"><p>${solutionText(t,env)}</p>${env.K.total(state.zones.a)===1000?'<p>10 сотен — одна тысяча. Запись: 1000. Для неё нужен следующий разряд.</p>':''}</div>`;
  if(state.solved&&!pv.skipped&&t.id==='pv.arithmetic.add.15.12')content+=pv.meaningActive&&!pv.meaningDone?`<section class="pv-meaning"><h3>А почему так?</h3><p>Сколько единиц обозначают две цифры 1 в десятках чисел 15 и 12 вместе?</p><label>Мой ответ<input id="pv-meaning-answer" inputmode="numeric" maxlength="4" value="${env.esc(pv.meaningAnswer||'')}"></label><button class="btn secondary" data-pv-action="meaning-check">Проверить смысл</button><button class="btn ghost" data-pv-action="meaning-skip">Позже</button></section>`:!pv.meaningDone?'<button class="btn secondary" data-pv-action="meaning-open">Один вопрос на понимание</button>':'<p class="pv-conservation">Каждая цифра 1 обозначает десяток: 10 + 10 = 20 единиц.</p>';
  if(pv.errors&&!state.solved)content+=`<div class="pv-remediation"><p>Одна ошибка ещё не определяет причину. Проверим короткую связь: ${usesHundred(t)?'сколько десятков в одной сотне?':'сколько единиц в одном десятке?'}</p><div class="pv-choice-row">${[1,10,100].map(n=>`<button class="btn secondary" data-pv-action="clarify" data-value="${n}">${n}</button>`).join('')}</div><p>Можно вернуться к знакомому объяснению.</p><button class="btn ghost" data-lesson="${t.lesson}">Открыть подходящий урок ${t.lesson}</button></div>`;
 }
 return `<div class="page-intro"><div><div class="eyebrow">ЕДИНИЦЫ · ДЕСЯТКИ · СОТНИ</div><h1>${pv.track==='diagnostic'?'Короткая проверка':'Сотни и разряды'}</h1><p>Строим, сравниваем и объясняем количество. Прежние уроки остаются на месте.</p></div></div><section class="lesson-panel pv-activity" data-pv-task="${t.id}"><div class="lesson-heading"><h2>${env.esc(t.title)}</h2></div><div class="activity-wrap">${nav}${state.pvConflict?'<div class="feedback error"><p>Эту работу продолжили в другой вкладке. Сначала открой актуальное состояние, чтобы не потерять ответы.</p><button class="btn primary" data-pv-action="reload">Открыть актуальное</button></div>':''}<fieldset class="pv-fieldset" ${state.pvConflict?'disabled':''}>${content}</fieldset></div></section>${pv.track==='diagnostic'&&!pv.finished?'<p class="pv-diagnostic-note">Одна ошибка ещё не объясняет причину. После уточнения можно открыть подходящее упражнение.</p>':''}<details class="pv-skill-summary"><summary>Что уже проверяли?</summary>${renderSkills(supported,env.LP,env.esc)}</details>`;
}
function solutionText(t,env){if(t.kind==='build')return `${t.target} можно построить разными группами. В стандартной записи: ${env.P.describe(env.K.parts(t.target,{unitsOnly:true}),env.K).canonicalText}.`;if(['digits','fix','expand'].includes(t.kind)){const h=Math.floor(t.target/100),d=Math.floor(t.target/10)%10,u=t.target%10;return `${t.target} = ${h*100} + ${d*10} + ${u}. Ноль сохраняет место отсутствующего разряда.`;}if(t.kind==='compare')return t.numbers.map((n,i)=>'4 в '+n+' означает '+t.answers[i]).join('; ')+'.';if(t.kind==='value')return t.digit+' в '+t.number+' означает '+t.answer+' единиц.';if(t.kind==='expression')return `${t.a} + ${t.b} = ${t.result}. Все палочки означают ${t.answers[3]} единиц.`;if(t.kind==='predict')return 'После обмена: '+t.prediction[0]+' сотен, '+t.prediction[1]+' десятков, '+t.prediction[2]+' единиц. Количество '+t.answer+' не изменилось.';if(t.kind==='conservation')return t.answer===32?'3Д2Е = 2Д12Е = 32. Количество прежнее.':'3С0Д2Е = 2С10Д2Е = 2С9Д12Е = 302. Изменились группы, количество прежнее.';return 'Получилось '+t.answer+'. '+env.P.describe(stateModelFor(t,env.K),env.K).canonicalText+'.';}
function stateModelFor(t,K){return K.parts(t.answer,{unitsOnly:true});}
function renderSkills(learning,LP,esc){return `<div class="pv-skills">${Object.entries(SKILLS).map(([id,name])=>{const last=LP&&LP.latest(learning,id),a=last&&last.assistance||{},labels=[];if(a.explanation)labels.push('после объяснения');if(a.visual)labels.push('с визуальной помощью');if(a.afterError)labels.push('после ошибки');return `<div><span>${esc(name)}</span><strong>${statusNames[LP?LP.status(learning,id):'notchecked']||'Не проверено'}${labels.length?'<small>'+labels.join(' · ')+'</small>':''}</strong></div>`;}).join('')}</div><p class="muted">Это наблюдения отдельных попыток, а не окончательная оценка понимания.</p>`;}
function correct(state,K){const t=current(state.pv),a=state.pv.answers||[],nums=a.map(s=>/^\d{1,4}$/.test(s)?Number(s):NaN);switch(t.kind){case 'build':return K.total(state.zones.a)===t.target&&Number(state.answer)===t.target&&/^\d{1,4}$/.test(state.answer);case 'digits':case 'fix':return state.pv.digits.every((v,i)=>v===Number(String(t.target).padStart(3,'0')[i]));case 'expand':return nums.length>=3&&nums[0]===Math.floor(t.target/100)*100&&nums[1]===Math.floor(t.target/10)%10*10&&nums[2]===t.target%10;case 'value':case 'read':return /^\d{1,4}$/.test(state.answer)&&Number(state.answer)===t.answer;case 'compare':case 'expression':return t.answers.every((n,i)=>nums[i]===n);case 'exchange':return Number(state.answer)===t.answer&&/^\d{1,4}$/.test(state.answer)&&K.total(state.zones.a)===t.answer&&K.canonical(state.zones.a);case 'arithmetic':return /^\d{1,4}$/.test(state.answer)&&Number(state.answer)===t.answer&&K.check(t,state.zones,false);case 'predict':return t.prediction.every((n,i)=>nums[i]===n)&&(!state.pv.predictionConfirmed||state.zones.a.hundred===t.prediction[0]&&state.zones.a.ten===t.prediction[1]&&state.zones.a.unit===t.prediction[2]);case 'conservation':{const p=t.expected||{hundred:2,ten:9,unit:12};return state.pv.choice==='same'&&Number(state.answer)===t.answer&&/^\d{1,4}$/.test(state.answer)&&state.zones.a.hundred===p.hundred&&state.zones.a.ten===p.ten&&state.zones.a.unit===p.unit;}default:return false;}}
function capture(state,doc){if(state.view!=='placevalue'||!state.pv||state.pv.teaching)return false;let changed=false;const meaning=doc.querySelector('#pv-meaning-answer');if(meaning){const v=meaning.value.replace(/[^0-9]/g,'').slice(0,4);if(state.pv.meaningAnswer!==v){state.pv.meaningAnswer=v;changed=true;}}const input=doc.querySelector('#pv-answer');if(input&&!state.solved){const v=input.value.replace(/[^0-9]/g,'').slice(0,4);if(state.answer!==v){state.answer=v;changed=true;}}doc.querySelectorAll('[data-pv-field]').forEach(el=>{const i=Number(el.dataset.pvField),v=el.value.replace(/[^0-9]/g,'').slice(0,4);if(state.pv.answers[i]!==v){state.pv.answers[i]=v;changed=true;}});return changed;}
function assist(state,kind,LP){state.pv.help[kind==='error'?'afterError':kind]=true;if(kind==='error')state.pv.errors++;if(state.pv.attempt&&LP)LP.help(state.pv.attempt,kind);}
function observation(state,outcome){const t=current(state.pv);return Object.assign({},state.pv.attempt||{taskId:t.id,skillIds:t.skillIds},{taskId:t.id,skillIds:t.skillIds,outcome,assistance:copy(state.pv.help),firstOutcome:state.pv.firstOutcome,evidenceKind:t.kind,variantId:'v1',familyId:t.familyId,errors:state.pv.errors});}
function handle(state,action,data,env){
 const t=current(state.pv);if(!t)return false;
 if(state.pvConflict&&action!=='reload')return true;
 if(action==='meaning-open'){state.pv.meaningActive=true;state.feedback=null;if(!state.pv.meaningAttempt)state.pv.meaningAttempt=env.LP?env.LP.attempt('pv.meaning.tens-15-12',['math.placevalue.position'],{generation:env.generation}):null;}
 else if(action==='meaning-skip'){state.pv.meaningActive=false;state.feedback=null;if(env.observe&&state.pv.meaningAttempt)env.observe(Object.assign({},state.pv.meaningAttempt,{outcome:'skipped',evidenceKind:'meaning-question'}));}
 else if(action==='meaning-check'){const ok=/^\d{1,4}$/.test(state.pv.meaningAnswer||'')&&Number(state.pv.meaningAnswer)===20;if(!ok&&env.LP&&state.pv.meaningAttempt)env.LP.help(state.pv.meaningAttempt,'error');if(env.observe)env.observe(Object.assign({},state.pv.meaningAttempt||{taskId:'pv.meaning.tens-15-12',skillIds:['math.placevalue.position']},{outcome:ok?'correct':'incorrect',evidenceKind:'meaning-question'}));state.pv.meaningDone=ok;state.feedback={text:ok?'Да: два десятка — это двадцать единиц.':'Вспомни, какое количество означает цифра в разряде десятков.',type:ok?'success':'hint'};}
 else if(action==='clarify'){assist(state,'visual',env.LP);state.pv.clarificationDone=true;const ok=Number(data.value)===10;if(!ok)assist(state,'error',env.LP);state.feedback={text:(usesHundred(t)?'Одна сотня равна десяти десяткам.':'Один десяток равен десяти единицам.')+' Это уточнение помогает вернуться к твоей задаче; причина ошибки ещё не определена.',type:ok?'hint':'error'};}
 else if(action==='hint'){assist(state,'visual',env.LP);state.feedback={text:hintFor(t),type:'hint'};}
 else if(action==='explain'){assist(state,'explanation',env.LP);state.pv.teaching=true;state.pv.frame=0;}
 else if(action==='return'){state.pv.teaching=false;state.feedback={text:'Попробуй решить задачу. Чтение объяснения отмечено как помощь.',type:'hint'};}
 else if(action==='teach-next')state.pv.frame++;
 else if(action==='teach-back')state.pv.frame=Math.max(0,state.pv.frame-1);
 else if(action==='digit'){if(state.solved)return true;const n=Number(data.digit);if(Number.isInteger(n)&&n>=0&&n<=9)state.pv.selectedDigit=n;}
 else if(action==='place'){if(state.solved)return true;const i=Number(data.place);if(i>=0&&i<3&&Number.isInteger(state.pv.selectedDigit)){state.pv.digits[i]=state.pv.selectedDigit;state.feedback=null;}}
 else if(action==='choice'){state.pv.choice=data.choice;state.feedback=null;}
 else if(action==='reset'){const help=copy(state.pv.help),attempt=state.pv.attempt,errors=state.pv.errors,first=state.pv.firstOutcome;prepare(state,env.K,env.LP);state.pv.help=help;state.pv.attempt=attempt;state.pv.errors=errors;state.pv.firstOutcome=first;}
 else if(action==='check'){
  if(state.solved)return true;
  const ok=correct(state,env.K);
  if(state.pv.firstOutcome==='notchecked')state.pv.firstOutcome=ok?'correct':'incorrect';
  if(ok&&t.kind==='predict'&&!state.pv.predictionConfirmed){state.pv.predictionConfirmed=true;state.feedback={text:'Прогноз записан. Теперь выполни обмен кнопкой и проверь предметную модель.',type:'hint'};return true;}
  if(ok){state.solved=true;state.selected=null;state.feedback={text:state.pv.help.afterError?'Получилось после исправления. Проверим эту связь позже на другом числе.':Object.values(state.pv.help).some(Boolean)?'Получилось с помощью. Следующий новый пример можно попробовать самостоятельно.':'Получилось самостоятельно. Покажи эту связь и на другом примере.',type:'success'};if(env.observe)env.observe(observation(state,'correct'));}
  else{assist(state,'error',env.LP);state.feedback={text:t.kind==='conservation'?'Проверь замену сотни и десятка и сравни количество. Ничего извне не добавляй.':t.kind==='arithmetic'?'Пока не сходится. Проверь свой подсчёт и предметное действие. Можно открыть объяснение.':'Проверь условие и свою запись. Можно исправить ответ или открыть короткую подсказку.',type:'error'};if(env.observe)env.observe(observation(state,'incorrect'));}
 }
 else if(action==='skip'){state.pv.skipped=true;if(env.observe)env.observe(observation(state,'skipped'));state.solved=true;state.feedback={text:'Карточка пропущена. Это не ошибка. Навык можно проверить позже.',type:'hint'};}
 else if(action==='next'){
  if(!state.solved)return true;
  if(state.pv.index+1>=state.pv.queue.length){state.pv.finished=true;state.feedback=null;}
  else{state.pv.index++;prepare(state,env.K,env.LP);}
 }
 else return false;
 return true;
}
root.PlaceValueActivities={TASKS,SKILLS,current,start,prepare,restore,snapshot,diagnosticQueue,render,teachingFrames,handle,correct,capture,boardTask,observation,assist,hintFor};
})(typeof window==='undefined'?globalThis:window);
