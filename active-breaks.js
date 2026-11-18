(function(root){
'use strict';
// Physical pauses are optional self-reports. This component never awards
// academic progress, observes a camera, schedules timers, or writes storage.
const VERSION=1,MAX_REPORTS=20;
const ROUTINES=[
 {id:'break.reach-cloud',title:'Потянись к облаку',short:'Встань и мягко потянись вверх.',seconds:40,pose:'reach',gentle:true,count:'3 спокойных потягивания',steps:['Встань удобно. Стопы стоят на полу, плечи расслаблены.','Подними руки и потянись вверх настолько, насколько удобно. Не спеши.','Опусти руки. Сделай ещё пару спокойных потягиваний и отдохни.']},
 {id:'break.squats',title:'Пять спокойных приседаний',short:'Приседай неглубоко, в удобном темпе.',seconds:45,pose:'squat',gentle:false,count:'До 5 раз, сколько удобно',steps:['Встань устойчиво. Руки можно вытянуть перед собой.','Немного согни колени и присядь. Стопы остаются на полу.','Спокойно встань. Повтори несколько раз; можно закончить раньше.']},
 {id:'break.wall-push',title:'Ладошки у стены',short:'Попробуй отжимания от стены.',seconds:45,pose:'wall',gentle:false,count:'До 5 раз, без спешки',steps:['Поставь ладони на стену примерно на высоте плеч. Немного отойди.','Мягко согни руки и приблизься к стене всем телом.','Оттолкнись ладонями и выпрями руки. Повтори, сколько удобно.']},
 {id:'break.room-walk',title:'Прогулка по комнате',short:'Отойди от экрана и немного походи.',seconds:60,pose:'walk',gentle:true,count:'Около минуты',steps:['Встань. Выбери свободную дорожку, где не мешают вещи.','Походи спокойным шагом. Можно дойти до двери и вернуться.','Остановись, расслабь плечи и выбери: вернуться или пройтись ещё.']},
 {id:'break.shoulders',title:'Разбуди плечи',short:'Подними и опусти плечи, расправься.',seconds:35,pose:'shoulder',gentle:true,count:'Несколько мягких движений',steps:['Встань или сядь удобно. Руки свободно опущены.','Медленно подними плечи и спокойно опусти их.','Сделай несколько небольших кругов плечами и расслабь руки.']},
 {id:'break.cross-march',title:'Ладошка и колено',short:'Шагаем на месте и меняем руки.',seconds:45,pose:'cross',gentle:false,count:'По 4 шага с каждой стороны',steps:['Встань устойчиво. Начни медленно шагать на месте.','Коснись правой ладонью левого колена. Затем наоборот.','Продолжай в удобном темпе. Если сложно, просто пошагай.']},
 {id:'break.heel-rise',title:'Вырастем повыше',short:'Приподнимись на носки и опустись.',seconds:35,pose:'heel',gentle:true,count:'До 5 спокойных подъёмов',steps:['Встань возле стены. При желании придерживайся рукой.','Медленно поднимись на носки, будто хочешь стать чуть выше.','Плавно поставь пятки на пол. Повтори, сколько удобно.']},
 {id:'break.side-steps',title:'Дорожка в стороны',short:'Два шага вправо, два шага влево.',seconds:40,pose:'side',gentle:true,count:'Несколько проходов туда и обратно',steps:['Найди место для двух небольших шагов в сторону.','Сделай два спокойных шага вправо, затем два влево.','Повтори дорожку. Руки двигаются свободно, бежать не нужно.']},
 {id:'break.fingers',title:'Пальчики проснулись',short:'Разомни ладони и пальцы.',seconds:30,pose:'hands',gentle:true,count:'5–8 лёгких движений',steps:['Отложи мышку или планшет. Вытяни руки перед собой.','Разведи пальцы, затем мягко собери ладони в кулачки.','Несколько раз раскрой ладони и легко потряси кистями.']},
 {id:'break.wings',title:'Расправь крылья',short:'Встань и дай спине сменить положение.',seconds:40,pose:'posture',gentle:true,count:'3–4 спокойных движения',steps:['Встань удобно. Поставь ладони на пояс.','Слегка отведи локти назад, расправь плечи. Не прогибайся сильно.','Вернись в удобное положение. Опусти руки и отдохни.']},
 {id:'break.look-far',title:'Посмотри вдаль',short:'Смени место и посмотри дальше экрана.',seconds:35,pose:'look',gentle:true,count:'Несколько спокойных вдохов',steps:['Встань и отойди от экрана на пару шагов.','Посмотри на дальнюю стену или другой далёкий предмет.','Постой спокойно, расслабь плечи и затем возвращайся.']},
 {id:'break.stars',title:'Дотянись до звёзд',short:'По очереди потяни вверх одну и другую руку.',seconds:45,pose:'diagonal',gentle:true,count:'По 3 раза каждой рукой',steps:['Встань удобно. Представь над собой две звёздочки.','Потяни вверх одну руку, опусти её. Теперь другую.','Чередуй руки медленно. Стой устойчиво и дыши спокойно.']}
];
const byId=Object.fromEntries(ROUTINES.map(r=>[r.id,r]));
const copy=v=>JSON.parse(JSON.stringify(v));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(value,min,max,fallback)=>Number.isFinite(value)?Math.max(min,Math.min(max,Math.floor(value))):fallback;
function available(preference){return ROUTINES.filter(r=>preference!=='gentle'||r.gentle);}
function current(state){return state&&byId[state.routineId]||null;}
function suggestion(preference,reports,avoid){
 const list=available(preference),last=avoid||reports&&reports.length&&reports[reports.length-1].routineId;
 const i=list.findIndex(r=>r.id===last);return list[(i+1)%list.length].id;
}
function create(options){
 options=options||{};const preference=options.preference==='gentle'?'gentle':'all';
 const requested=byId[options.routineId];
 return {version:VERSION,routineId:requested&&(preference==='all'||requested.gentle)?requested.id:suggestion(preference,[]),preference,phase:'choose',step:0,elapsed:0,running:false,timerEnabled:true,completed:false,solved:false,skipped:false,returnRequested:false,reportRecorded:false,reports:[],feedback:''};
}
function restore(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==VERSION||!byId[raw.routineId])return null;
 try{if(JSON.stringify(raw).length>48*1024)return null;}catch(_){return null;}
 const state=create({preference:raw.preference,routineId:raw.routineId}),r=current(state);
 state.phase=['choose','moving','done'].includes(raw.phase)?raw.phase:'choose';
 state.step=clamp(raw.step,0,r.steps.length-1,0);state.elapsed=clamp(raw.elapsed,0,r.seconds,0);
 state.timerEnabled=raw.timerEnabled!==false;
 // A restored/background interval must never count as performed movement.
 state.running=false;state.completed=raw.completed===true&&state.phase==='done';state.skipped=raw.skipped===true&&!state.completed;
 state.solved=state.completed||state.skipped;state.returnRequested=false;state.reportRecorded=raw.reportRecorded===true;
 state.reports=(Array.isArray(raw.reports)?raw.reports:[]).slice(-MAX_REPORTS).filter(x=>x&&byId[x.routineId]&&['self-reported','skipped'].includes(x.status)).map(x=>({routineId:x.routineId,status:x.status,elapsed:clamp(x.elapsed,0,byId[x.routineId].seconds,0),source:'child'}));
 state.feedback=state.phase==='moving'?'Пауза сохранена. Продолжай, когда будешь готов.':'';
 return state;
}
function prepare(state,id){
 const r=byId[id];if(!r)return false;
 Object.assign(state,{routineId:r.id,phase:'choose',step:0,elapsed:0,running:false,completed:false,solved:false,skipped:false,returnRequested:false,reportRecorded:false,feedback:''});return true;
}
function report(state,status){
 if(state.reportRecorded)return;
 state.reports.push({routineId:state.routineId,status,elapsed:state.elapsed,source:'child'});
 state.reports=state.reports.slice(-MAX_REPORTS);state.reportRecorded=true;
}
function handle(state,action,data,env){
 data=data||{};env=env||{};const r=current(state);if(!r)return false;
 if(action==='choose'){const chosen=byId[String(data.routine||data.id||'')];return !!chosen&&(state.preference==='all'||chosen.gentle)&&prepare(state,chosen.id);}
 if(action==='replace'){const id=suggestion(state.preference,state.reports,state.routineId);return prepare(state,id);}
 if(action==='preference'){
  if(!['all','gentle'].includes(data.preference))return false;
  state.preference=data.preference;if(state.preference==='gentle'&&!r.gentle)prepare(state,suggestion('gentle',state.reports));return true;
 }
 if(action==='start'){
  if(state.phase==='done')prepare(state,suggestion(state.preference,state.reports,state.routineId));
  else if(state.skipped)prepare(state,state.routineId);
  state.phase='moving';state.running=state.timerEnabled&&state.elapsed<current(state).seconds;state.returnRequested=false;state.feedback='';return true;
 }
 if(action==='timer-toggle'){state.timerEnabled=!state.timerEnabled;if(!state.timerEnabled)state.running=false;return true;}
 if(action==='pause'){state.running=false;state.feedback='Можно отдохнуть или продолжить в своём темпе.';return true;}
 if(action==='resume'){if(state.phase!=='moving'||!state.timerEnabled||state.elapsed>=r.seconds)return false;state.running=true;state.feedback='';return true;}
 if(action==='tick'){
  if(!state.running||state.phase!=='moving'||!state.timerEnabled)return false;
  if(data.visible===false){state.running=false;return true;}
  const seconds=Number(data.seconds);
  // Only short visible intervals count. Do not catch up a sleeping browser.
  if(!Number.isFinite(seconds)||seconds<=0||seconds>5)return false;
  state.elapsed=Math.min(r.seconds,state.elapsed+seconds);
  if(state.elapsed>=r.seconds){state.running=false;state.feedback='Время подсказки закончилось. Можно закончить или ещё немного подвигаться.';}
  return true;
 }
 if(action==='next-step'){state.step=Math.min(r.steps.length-1,state.step+1);return true;}
 if(action==='prev-step'){state.step=Math.max(0,state.step-1);return true;}
 if(action==='step'){const step=Number(data.step);if(!Number.isInteger(step)||step<0||step>=r.steps.length)return false;state.step=step;return true;}
 if(action==='finish'){
  if(state.phase!=='moving')return false;
  state.running=false;state.phase='done';state.completed=true;state.solved=true;state.skipped=false;state.returnRequested=false;state.feedback='';report(state,'self-reported');
  if(typeof env.announce==='function')env.announce('Ты отметил выполнение разминки. Можно вернуться к занятиям.');return true;
 }
 if(action==='skip'){
  if(state.phase==='done')return false;
  state.running=false;state.completed=false;state.skipped=true;state.solved=true;state.returnRequested=true;state.feedback='';report(state,'skipped');return true;
 }
 if(action==='return'||action==='back'){state.running=false;state.returnRequested=true;return true;}
 if(action==='reopen'){state.running=false;state.returnRequested=false;return true;}
 if(action==='speak'){
  if(typeof env.speak==='function')env.speak(r.title+'. '+(state.phase==='moving'?r.steps[state.step]:r.short)+' Можно выбрать другой вариант или пропустить.');return true;
 }
 return false;
}
function illustration(routine,step,E){
 const pose=routine.pose;
 let head='<circle cx="151" cy="49" r="19"/>',body='<path d="M151 70v60"/>',arms='',legs='<path d="m151 130-21 66m21-66 22 66"/>',decor='';
 if(pose==='reach'){arms='<path d="m151 87-39-48m39 48 39-48"/>';decor='<path class="ab-decoration" d="M94 22c0-12 18-15 23-5 5-16 28-16 33 0 13-9 30 2 23 15H98Z"/>';}
 else if(pose==='squat'){head='<circle cx="139" cy="83" r="19"/>';body='<path d="m139 104 15 43"/>';arms='<path d="m144 116 59 3m-59-3 51-6"/>';legs='<path d="m154 147-40 16 20 33m20-49 43 17-14 32"/>';decor='<path class="ab-direction" d="M224 87v52m-8-10 8 10 8-10"/>';}
 else if(pose==='wall'){head='<circle cx="136" cy="51" r="19"/>';body='<path d="m141 72 25 59"/>';arms='<path d="m148 86 53 5 45-5m-96 12 51 8 45-8"/>';legs='<path d="m166 131-24 65m24-65 12 65"/>';decor='<path class="ab-wall" d="M251 30v171m0-140h20m-20 35h20m-20 35h20m-20 35h20"/>';}
 else if(pose==='walk'){arms='<path d="m151 88-34 28-25-10m59-18 30 23 23-20"/>';legs='<path d="m151 130-26 29-30 32m56-61 34 29 23 37"/>';decor='<path class="ab-direction" d="M88 211h105m-11-7 11 7-11 7"/>';}
 else if(pose==='shoulder'){arms='<path d="m151 84-34 19-9 39m43-58 33 19 9 39"/>';decor='<path class="ab-direction" d="M104 66c-14 0-19 15-12 24m-3-10 3 10 10-3m98-21c14 0 19 15 12 24m-10-3 10 3 3-10"/>';}
 else if(pose==='cross'){arms='<path d="m151 87-28 30 42 23m-14-53 33 26 7 25"/>';legs='<path d="m151 130-21 66m21-66 27 16-29 21"/>';decor='<circle class="ab-decoration" cx="165" cy="140" r="9"/>';}
 else if(pose==='heel'){arms='<path d="m151 88-30 35m30-35 40-12 30-7"/>';legs='<path d="m151 130-16 59-10 7m26-66 16 59 11 7"/>';decor='<path class="ab-wall" d="M226 40v160"/><path class="ab-direction" d="M95 173v-36m-7 10 7-10 7 10"/>';}
 else if(pose==='side'){arms='<path d="m151 87-47 23m47-23 47 23"/>';legs='<path d="m151 130-38 66m38-66 38 66"/>';decor='<path class="ab-direction" d="M62 164h39m-10-7 10 7-10 7m167-7h-39m10-7-10 7 10 7"/>';}
 else if(pose==='hands'){arms='<path d="m151 86-31 29-27-17m58-12 31 29 27-17"/>';decor='<path class="ab-hands" d="m93 98-11-15m11 15-1-20m1 20 9-15m107 15 11-15m-11 15 1-20m-1 20-9-15"/>';}
 else if(pose==='posture'){arms='<path d="m151 86-43 30 28 13m15-43 43 30-28 13"/>';decor='<path class="ab-direction" d="M85 91 70 79m15 12-18 3m169-3 15-12m-15 12 18 3"/>';}
 else if(pose==='look'){head='<circle cx="151" cy="49" r="19"/><path d="m168 47 10 3-10 4"/>';arms='<path d="m151 87-30 41m30-41 30 41"/>';decor='<path class="ab-window" d="M217 36h59v65h-59Zm30 0v65m-30-33h59"/><path class="ab-direction" d="M185 51h20"/>';}
 else if(pose==='diagonal'){arms=step%2?'<path d="m151 87-33 44m33-44 38-55"/>':'<path d="m151 87-38-55m38 55 33 44"/>';decor='<path class="ab-decoration" d="m106 14 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Zm88 0 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"/>';}
 const eye=pose==='look'?'':'<path class="ab-face" d="M144 47h1m12 0h1m-15 10q8 6 16 0"/>';
 return '<svg class="ab-figure" viewBox="0 0 320 230" role="img" aria-label="'+E(routine.title+'. '+routine.steps[step])+'"><ellipse class="ab-shadow" cx="157" cy="201" rx="91" ry="10"/><g class="ab-person">'+decor+head+body+arms+legs+'</g>'+eye+'</svg>';
}
function time(seconds){seconds=Math.max(0,Math.ceil(seconds));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function render(state,env){
 env=env||{};const E=env.esc||esc,r=current(state);if(!r)return '<p>Выбери новую разминку.</p>';
 const top='<div class="ab-heading"><span class="ab-eyebrow">Короткая активная пауза</span><h2>'+E(state.phase==='done'?'Немного подвигались':r.title)+'</h2><p>Можно заменить, закончить раньше или пропустить.</p></div>';
 const voice='<button class="ab-icon-button" data-ab-action="speak" aria-label="Послушать короткую инструкцию">Послушать</button>';
 const choice='<div class="ab-preferences" role="group" aria-label="Выбрать нагрузку"><button data-ab-action="preference" data-preference="all" aria-pressed="'+(state.preference==='all')+'">Все варианты</button><button data-ab-action="preference" data-preference="gentle" aria-pressed="'+(state.preference==='gentle')+'">Помягче</button></div>';
 let content='';
 if(state.phase==='choose'){
  content='<div class="ab-preview">'+illustration(r,0,E)+'<div><p class="ab-lead">'+E(r.short)+'</p><p>'+E(r.count)+' · примерно '+r.seconds+' секунд</p><p class="ab-prepare">Сначала отложи экран и устройся удобно. Двигайся спокойно, без неприятных ощущений.</p>'+voice+'<div class="ab-actions"><button class="ab-primary" data-ab-action="start">Начать разминку</button><button data-ab-action="replace">Другой вариант</button></div></div></div>'+choice+'<details class="ab-library"><summary>Выбрать самому</summary><div class="ab-routine-grid">'+available(state.preference).map(item=>'<button class="ab-routine-card'+(item.id===r.id?' is-chosen':'')+'" data-ab-action="choose" data-routine="'+item.id+'" aria-pressed="'+(item.id===r.id)+'"><strong>'+E(item.title)+'</strong><small>'+E(item.short)+'</small><span>'+item.seconds+' сек.</span></button>').join('')+'</div></details><button class="ab-text-button" data-ab-action="skip">Сейчас пропущу, вернусь к заданиям</button>';
 }else if(state.phase==='moving'){
  const timer=state.timerEnabled?'<div class="ab-timer" data-ab-timer role="timer" aria-label="Осталось '+Math.ceil(r.seconds-state.elapsed)+' секунд">'+time(r.seconds-state.elapsed)+'</div>':'<div class="ab-no-timer">Двигайся в своём темпе</div>';
  content='<div class="ab-moving'+(state.running?' is-running':'')+'">'+illustration(r,state.step,E)+'<div class="ab-step" data-ab-stage><span class="ab-step-label">Шаг '+(state.step+1)+' из '+r.steps.length+'</span><p>'+E(r.steps[state.step])+'</p><div class="ab-step-nav"><button data-ab-action="prev-step" aria-label="Предыдущий шаг" '+(state.step===0?'disabled':'')+'>Назад</button><button data-ab-action="next-step" '+(state.step===r.steps.length-1?'disabled':'')+'>Следующий шаг</button></div>'+voice+'</div></div><div class="ab-clock-panel">'+timer+'<div class="ab-clock-actions">'+(state.timerEnabled&&state.elapsed<r.seconds?'<button data-ab-action="'+(state.running?'pause':'resume')+'">'+(state.running?'Пауза':'Продолжить таймер')+'</button>':'')+'<button data-ab-action="timer-toggle" aria-pressed="'+(!state.timerEnabled)+'">'+(state.timerEnabled?'Без таймера':'Включить таймер')+'</button></div><p>Таймер — только ориентир. Заверши, когда тебе удобно.</p></div>'+(state.feedback?'<p class="ab-message" role="status">'+E(state.feedback)+'</p>':'')+'<div class="ab-actions"><button class="ab-primary" data-ab-action="finish">Я размялся, закончить</button><button data-ab-action="replace">Заменить упражнение</button><button class="ab-text-button" data-ab-action="skip">Пропустить</button></div>';
 }else{
  content='<div class="ab-done"><span class="ab-done-mark" aria-hidden="true">✓</span><strong>Отмечено тобой</strong><p>Можно вернуться к заданиям или выбрать ещё одну короткую паузу.</p><div class="ab-actions"><button class="ab-primary" data-ab-action="return">Вернуться к занятиям</button><button data-ab-action="replace">Выбрать другую разминку</button></div></div>';
 }
 return '<section class="ab-shell" data-active-break="'+r.id+'" aria-label="Активная пауза">'+top+content+'</section>';
}
function capture(){return false;}
root.ActiveBreaks={VERSION,ROUTINES,create,restore,render,handle,capture,current,available};
})(typeof window==='undefined'?globalThis:window);
