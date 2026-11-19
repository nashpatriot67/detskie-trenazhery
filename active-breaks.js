(function(root){
'use strict';
// Physical pauses are optional self-reports. This component never awards
// academic progress, observes a camera, schedules timers, or writes storage.
const VERSION=1,MAX_REPORTS=20;
const ROUTINES=[
 {id:'break.reach-cloud',title:'Потянись к облаку',short:'Встань и мягко потянись вверх.',seconds:40,pose:'reach',gentle:true,count:'3 спокойных потягивания',steps:['Встань удобно. Стопы стоят на полу, плечи расслаблены.','Подними руки и потянись вверх настолько, насколько удобно. Не спеши.','Опусти руки. Сделай ещё пару спокойных потягиваний и отдохни.']},
 {id:'break.squats',title:'Три спокойных приседания',short:'Приседай неглубоко, в удобном темпе.',seconds:45,pose:'squat',gentle:false,count:'До 3 раз, сколько удобно',steps:['Встань устойчиво. Руки можно вытянуть перед собой.','Немного согни колени и присядь. Стопы остаются на полу.','Спокойно встань. Повтори несколько раз; можно закончить раньше.']},
 {id:'break.wall-push',title:'Ладошки у стены',short:'Попробуй отжимания от стены.',seconds:45,pose:'wall',gentle:false,count:'До 3 раз, без спешки',steps:['Поставь ладони на стену примерно на высоте плеч. Немного отойди.','Мягко согни руки и приблизься к стене всем телом.','Оттолкнись ладонями и выпрями руки. Повтори, сколько удобно.']},
 {id:'break.room-walk',title:'Шагаем на месте',short:'Спокойно пошагай на месте.',seconds:60,pose:'walk',gentle:true,count:'12 спокойных шагов',steps:['Встань. Выбери свободную дорожку, где не мешают вещи.','Спокойно шагай на месте, поднимая по очереди одну и другую ногу.','Остановись, расслабь плечи и выбери: вернуться или пройтись ещё.']},
 {id:'break.shoulders',title:'Разбуди плечи',short:'Подними и опусти плечи, расправься.',seconds:35,pose:'shoulder',gentle:true,count:'Несколько мягких движений',steps:['Встань или сядь удобно. Руки свободно опущены.','Медленно подними плечи и спокойно опусти их.','Сделай ещё два спокойных подъёма и опусти плечи.']},
 {id:'break.cross-march',title:'Ладошка и колено',short:'Шагаем на месте и меняем руки.',seconds:45,pose:'cross',gentle:false,count:'По 3 движения с каждой стороны',steps:['Встань устойчиво. Начни медленно шагать на месте.','Коснись правой ладонью левого колена. Затем наоборот.','Продолжай в удобном темпе. Если сложно, просто пошагай.']},
 {id:'break.heel-rise',title:'Вырастем повыше',short:'Приподнимись на носки и опустись.',seconds:35,pose:'heel',gentle:true,count:'До 3 спокойных подъёмов',steps:['Встань возле стены. При желании придерживайся рукой.','Медленно поднимись на носки, будто хочешь стать чуть выше.','Плавно поставь пятки на пол. Повтори, сколько удобно.']},
 {id:'break.side-steps',title:'Дорожка в стороны',short:'Два шага вправо, два шага влево.',seconds:40,pose:'side',gentle:true,count:'Несколько проходов туда и обратно',steps:['Найди место для двух небольших шагов в сторону.','Сделай два спокойных шага вправо, затем два влево.','Повтори дорожку. Руки двигаются свободно, бежать не нужно.']},
 {id:'break.fingers',title:'Пальчики проснулись',short:'Разомни ладони и пальцы.',seconds:30,pose:'hands',gentle:true,count:'3 мягких раскрытия ладоней',steps:['Отложи мышку или планшет. Вытяни руки перед собой.','Разведи пальцы, затем мягко собери ладони в кулачки.','Несколько раз раскрой ладони и легко потряси кистями.']},
 {id:'break.wings',title:'Расправь крылья',short:'Встань и дай спине сменить положение.',seconds:40,pose:'posture',gentle:true,count:'До 3 спокойных движений',steps:['Встань удобно. Поставь ладони на пояс.','Слегка отведи локти назад, расправь плечи. Не прогибайся сильно.','Вернись в удобное положение. Опусти руки и отдохни.']},
 {id:'break.look-far',title:'Посмотри вдаль',short:'Смени место и посмотри дальше экрана.',seconds:35,pose:'look',gentle:true,count:'Несколько спокойных вдохов',steps:['Встань и отойди от экрана на пару шагов.','Посмотри на дальнюю стену или другой далёкий предмет.','Постой спокойно, расслабь плечи и затем возвращайся.']},
 {id:'break.stars',title:'Дотянись до звёзд',short:'По очереди потяни вверх одну и другую руку.',seconds:45,pose:'diagonal',gentle:true,count:'По 2 раза каждой рукой',steps:['Встань удобно. Представь над собой две звёздочки.','Потяни вверх одну руку, опусти её. Теперь другую.','Чередуй руки медленно. Стой устойчиво и дыши спокойно.']}
];
const byId=Object.fromEntries(ROUTINES.map(r=>[r.id,r]));
const copy=v=>JSON.parse(JSON.stringify(v));
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,min,max,fallback)=>Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback;
const integer=(v,min,max,fallback)=>Math.floor(clamp(v,min,max,fallback));
const lerp=(a,b,p)=>a+(b-a)*p;
const ease=p=>p*p*(3-2*p);
function available(preference){return ROUTINES.filter(r=>preference!=='gentle'||r.gentle);}
function current(state){return state&&byId[state.routineId]||null;}
function plan(state){
 const list=root.CoachMovementPlan?root.CoachMovementPlan.build(typeof state==='string'?state:state.routineId):[];
 const clips=root.CoachAudioManifest&&root.CoachAudioManifest.clips||{};
 return list.map(s=>Object.assign({},s,{seconds:Math.max(s.seconds,Number(clips[s.clipId]&&clips[s.clipId].duration)||0)}));
}
function duration(state){const p=plan(state);return p.length?p.reduce((n,s)=>n+s.seconds,0):(current(state)?.seconds||0);}
function suggestion(preference,reports,avoid){const list=available(preference),last=avoid||reports&&reports.length&&reports[reports.length-1].routineId;return list[(list.findIndex(r=>r.id===last)+1)%list.length].id;}
function create(options){
 options=options||{};const preference=options.preference==='gentle'?'gentle':'all',requested=byId[options.routineId];
 return {version:VERSION,routineId:requested&&(preference==='all'||requested.gentle)?requested.id:suggestion(preference,[]),preference,phase:'choose',step:0,elapsed:0,running:false,timerEnabled:true,completed:false,solved:false,skipped:false,returnRequested:false,reportRecorded:false,reports:[],feedback:'',audioMode:'voice',coachStatus:'idle',coachIndex:0,coachTime:0,coachProgress:0,coachFinished:false,demoReps:0};
}
function restore(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==VERSION||!byId[raw.routineId])return null;
 try{if(JSON.stringify(raw).length>48*1024)return null;}catch(_){return null;}
 const state=create({preference:raw.preference,routineId:raw.routineId}),r=current(state),p=plan(state);
 state.phase=['choose','moving','done'].includes(raw.phase)?raw.phase:'choose';state.step=integer(raw.step,0,r.steps.length-1,0);
 state.elapsed=clamp(raw.elapsed,0,duration(state),0);state.timerEnabled=raw.timerEnabled!==false;
 state.completed=raw.completed===true&&state.phase==='done';state.skipped=raw.skipped===true&&!state.completed;state.solved=state.completed||state.skipped;
 state.returnRequested=false;state.reportRecorded=raw.reportRecorded===true;state.running=false;
 state.audioMode=raw.audioMode==='silent'?'silent':'voice';state.coachIndex=integer(raw.coachIndex,0,Math.max(0,p.length-1),0);
 state.coachTime=clamp(raw.coachTime,0,p[state.coachIndex]?.seconds||0,0);state.coachProgress=clamp(raw.coachProgress,0,1,0);
 state.coachFinished=raw.coachFinished===true&&state.phase==='moving';state.coachStatus=state.phase==='moving'?(state.coachFinished?'ended':'paused'):'idle';
 state.demoReps=integer(raw.demoReps,0,p[0]?.repTotal||12,0);
 state.reports=(Array.isArray(raw.reports)?raw.reports:[]).slice(-MAX_REPORTS).filter(x=>x&&byId[x.routineId]&&['self-reported','skipped'].includes(x.status)).map(x=>({routineId:x.routineId,status:x.status,elapsed:clamp(x.elapsed,0,600,0),source:'child'}));
 state.feedback=state.phase==='moving'?'Показ сохранён на паузе. Нажми «Продолжить», когда будешь готов.':'';return state;
}
function prepare(state,id){if(!byId[id])return false;const fresh=create({routineId:id,preference:state.preference});Object.assign(state,fresh,{reports:state.reports||[]});return true;}
function report(state,status){if(state.reportRecorded)return;state.reports.push({routineId:state.routineId,status,elapsed:state.elapsed,source:'child'});state.reports=state.reports.slice(-MAX_REPORTS);state.reportRecorded=true;}
function segmentAt(state,data){const p=plan(state);if(!p.length)return null;let index=Number.isInteger(data?.index)?data.index:state.coachIndex||0;if(data?.segmentId){const found=p.findIndex(s=>s.id===data.segmentId);if(found<0)return null;index=found;}if(index<0||index>=p.length)return null;return {p,index,segment:p[index]};}
function syncFrame(state,data){
 if(state.phase!=='moving'||!state.running||data.playing!==true)return false;
 const x=segmentAt(state,data);if(!x)return false;const progress=clamp(data.progress,0,1,0),d=clamp(data.duration,0.1,120,x.segment.seconds);
 state.coachIndex=x.index;state.coachProgress=progress;state.coachTime=clamp(data.audioTime,0,d,progress*d);state.coachStatus='playing';state.step=x.segment.step;
 state.elapsed=x.p.slice(0,x.index).reduce((n,s)=>n+s.seconds,0)+state.coachTime;
 state.demoReps=x.p.slice(0,x.index).filter(s=>s.completesRep).length+(progress>=0.999&&x.segment.completesRep?1:0);return true;
}
function handle(state,action,data,env){
 data=data||{};env=env||{};const r=current(state);if(!r)return false;
 if(action==='choose'){const chosen=byId[String(data.routine||data.id||'')];return !!chosen&&(state.preference==='all'||chosen.gentle)&&prepare(state,chosen.id);}
 if(action==='replace')return prepare(state,suggestion(state.preference,state.reports,state.routineId));
 if(action==='preference'){if(!['all','gentle'].includes(data.preference))return false;state.preference=data.preference;if(state.preference==='gentle'&&!r.gentle)prepare(state,suggestion('gentle',state.reports));return true;}
 if(action==='start'||action==='resume'||action==='silent-start'){
  if(state.phase==='done')prepare(state,suggestion(state.preference,state.reports,state.routineId));else if(state.skipped)prepare(state,state.routineId);
  if(state.coachFinished){state.coachIndex=0;state.coachTime=0;state.coachProgress=0;state.elapsed=0;state.demoReps=0;state.coachFinished=false;}
  state.phase='moving';state.running=true;state.returnRequested=false;state.feedback='';if(action==='silent-start')state.audioMode='silent';
  state.coachStatus=state.audioMode==='silent'?'playing':'loading';return true;
 }
 if(action==='pause'||action==='hide'){state.running=false;state.coachStatus='paused';state.feedback='Пауза. Можно отдохнуть или продолжить в своём темпе.';return true;}
 if(action==='sound-toggle'){state.running=false;state.audioMode=state.audioMode==='silent'?'voice':'silent';state.coachStatus=state.phase==='moving'?'paused':'idle';state.feedback='';return true;}
 if(action==='repeat-demo'){state.coachIndex=0;state.coachTime=0;state.coachProgress=0;state.elapsed=0;state.demoReps=0;state.coachFinished=false;state.running=false;state.coachStatus='paused';state.feedback='Нажми «Продолжить», чтобы начать показ сначала.';return true;}
 if(action==='coach-frame')return syncFrame(state,data);
 if(action==='coach-playing'){if(state.phase!=='moving'||!state.running)return false;state.coachStatus='playing';return true;}
 if(action==='coach-end'){state.running=false;state.coachStatus='ended';state.coachFinished=true;state.elapsed=duration(state);state.demoReps=plan(state).filter(s=>s.completesRep).length;state.feedback='Показ закончен. Отметь сам, если ты подвигался. Можно закончить раньше или повторить.';return true;}
 if(action==='audio-error'){state.running=false;state.coachStatus='error';state.feedback='Не удалось включить запись. Можно повторить со звуком или явно выбрать показ без звука.';return true;}
 // Kept only for older explicit silent callers. Recorded speech is never
 // advanced by the old independent one-second timer.
 if(action==='tick'){
  if(state.audioMode!=='silent'||!state.running||state.phase!=='moving')return false;
  if(data.visible===false){state.running=false;state.coachStatus='paused';return true;}
  const seconds=Number(data.seconds);if(!Number.isFinite(seconds)||seconds<=0||seconds>5)return false;state.elapsed=Math.min(duration(state),state.elapsed+seconds);return true;
 }
 if(action==='timer-toggle'){state.timerEnabled=!state.timerEnabled;return true;}
 if(['next-step','prev-step','step'].includes(action)){
  const p=plan(state);let step=action==='step'?Number(data.step):state.step+(action==='next-step'?1:-1);if(!Number.isInteger(step)||step<0||step>2)return false;
  state.step=step;state.coachIndex=Math.max(0,p.findIndex(s=>s.step===step));state.coachTime=0;state.coachProgress=0;state.running=false;state.coachStatus='paused';return true;
 }
 if(action==='finish'){if(state.phase!=='moving')return false;state.running=false;state.phase='done';state.completed=true;state.solved=true;state.skipped=false;state.returnRequested=false;state.feedback='';report(state,'self-reported');env.announce?.('Ты отметил выполнение разминки. Можно вернуться к занятиям.');return true;}
 if(action==='skip'){if(state.phase==='done')return false;state.running=false;state.completed=false;state.skipped=true;state.solved=true;state.returnRequested=true;state.coachStatus='paused';state.feedback='';report(state,'skipped');return true;}
 if(action==='return'||action==='back'){state.running=false;state.returnRequested=true;return true;}
 if(action==='reopen'){state.running=false;state.returnRequested=false;if(state.phase==='moving')state.coachStatus='paused';return true;}
 if(action==='speak'){env.speak?.(r.title+'. '+(state.phase==='moving'?r.steps[state.step]:r.short)+' Можно выбрать другой вариант или пропустить.');return true;}
 return false;
}

const BASE={head:[180,58],ls:[158,99],rs:[202,99],le:[145,139],re:[215,139],lw:[143,177],rw:[217,177],lh:[168,173],rh:[192,173],lk:[162,216],rk:[198,216],la:[154,258],ra:[206,258],gaze:0,fingers:0,heelLift:0};
function pose(name){
 const p=copy(BASE),set=v=>Object.assign(p,v);
 if(name==='reach')set({head:[180,54],le:[143,57],re:[217,57],lw:[153,17],rw:[207,17]});
 else if(name==='squat')set({head:[172,91],ls:[152,131],rs:[196,131],le:[180,140],re:[211,140],lw:[227,141],rw:[241,140],lh:[151,204],rh:[175,204],lk:[149,228],rk:[209,228]});
 else if(name==='wall-ready'||name==='wall-bent'){
  set({head:[210,64],ls:[193,103],rs:[208,111],le:[246,117],re:[250,147],lw:[296,118],rw:[296,148],lh:[170,175],rh:[181,181],lk:[155,215],rk:[172,219],la:[140,258],ra:[161,258],gaze:1});
  if(name==='wall-bent')set({head:[238,72],ls:[222,110],rs:[235,119],le:[262,139],re:[267,166],lh:[183,178],rh:[194,183],lk:[163,216],rk:[176,219]});
 }else if(name==='shoulder-up')set({ls:[158,88],rs:[202,88],le:[145,131],re:[215,131],lw:[143,173],rw:[217,173]});
 else if(name==='cross-left')set({le:[145,139],re:[196,141],lw:[143,177],rw:[157,189],lk:[157,189],la:[137,220]});
 else if(name==='cross-right')set({le:[164,141],re:[215,139],lw:[203,189],rw:[217,177],rk:[203,189],ra:[223,220]});
 else if(name==='heel-ready'||name==='heel-up'){
  set({re:[252,123],rw:[296,120]});if(name==='heel-up'){for(const k of ['head','ls','rs','le','re','lw','lh','rh','lk','rk','la','ra'])p[k][1]-=10;p.heelLift=1;}
 }else if(name==='hands-ready'||name==='hands-open')set({le:[145,149],re:[215,149],lw:[136,119],rw:[224,119],fingers:name==='hands-open'?1:0});
 else if(name==='posture-ready'||name==='posture-open'){
  set({le:[141,137],re:[219,137],lw:[163,167],rw:[197,167]});if(name==='posture-open')set({head:[180,55],ls:[155,94],rs:[205,94],le:[128,136],re:[232,136]});
 }else if(name==='look-right')set({gaze:1});
 else if(name==='star-left')set({le:[141,55],lw:[146,17]});
 else if(name==='star-right')set({re:[219,55],rw:[214,17]});
 else if(name==='side-right'){for(const k of Object.keys(p))if(Array.isArray(p[k]))p[k][0]+=32;}
 else if(name==='walk-left')set({lk:[152,203],la:[153,232],le:[146,125],lw:[161,142],re:[212,148],rw:[227,177]});
 else if(name==='walk-right')set({rk:[208,203],ra:[207,232],re:[214,125],rw:[199,142],le:[148,148],lw:[133,177]});
 return p;
}
function blend(a,b,t){const p={};for(const k of Object.keys(BASE))p[k]=Array.isArray(a[k])?a[k].map((v,i)=>lerp(v,b[k][i],t)):lerp(a[k],b[k],t);return p;}
function frame(state,data){
 data=data||{};const isPlaying=state.phase==='moving'&&state.running&&data.playing===true,clock=isPlaying?data:{index:state.coachIndex,progress:state.coachProgress},x=segmentAt(state,clock),r=current(state);if(!r)return null;
 const prepared=r.pose==='wall'?'wall-ready':r.pose==='heel'?'heel-ready':r.pose==='hands'?'hands-ready':r.pose==='posture'?'posture-ready':'neutral';
 if(state.phase!=='moving'||!x)return {points:pose(prepared),segmentId:null,index:0,progress:0,playing:false,text:r.short,rep:0,repTotal:root.CoachMovementPlan?.CONFIG[r.id]?.reps||0,step:0};
 const progress=clamp(clock.progress,0,1,state.coachProgress||0);
 const s=x.segment;let points=blend(pose(s.from),pose(s.to),ease(progress));
 if(s.motion==='walk-left'||s.motion==='walk-right')points=blend(pose('neutral'),pose(s.motion),Math.sin(Math.PI*progress));
 if(s.motion==='side-out'||s.motion==='side-back'){
  const lift=Math.sin(Math.PI*((progress*2)%1))*12;points=blend(pose(s.from),pose(s.to),ease(progress));const leg=Math.floor(progress*2)%2?'ra':'la';points[leg][1]-=lift;points[leg==='la'?'lk':'rk'][1]-=lift*.6;
 }
 if(s.motion==='breathe'){const lift=Math.sin(progress*Math.PI*2)*1.8;points.ls[1]-=lift;points.rs[1]-=lift;}
 return {points,segmentId:s.id,index:x.index,progress,playing:isPlaying,text:s.text,rep:s.rep,repTotal:s.repTotal,step:s.step,clipId:s.clipId};
}
function num(n){return Number(n.toFixed(2));}
function pt(p){return num(p[0])+','+num(p[1]);}
function line(a,b,c){return 'M'+pt(a)+' L'+pt(b)+(c?' L'+pt(c):'');}
function shapes(p){
 const shoulderMid=[(p.ls[0]+p.rs[0])/2,(p.ls[1]+p.rs[1])/2],torso='M'+pt(p.ls)+' Q'+num(shoulderMid[0])+','+num(shoulderMid[1]-14)+' '+pt(p.rs)+' L'+pt(p.rh)+' Q'+num((p.lh[0]+p.rh[0])/2)+','+num((p.lh[1]+p.rh[1])/2+10)+' '+pt(p.lh)+' Z';
 const foot=(a,left)=>{const toeY=lerp(a[1]+5,263,p.heelLift);return line([a[0]+(left?6:-6),a[1]+4],[a[0]+(left?-15:15),toeY]);};
 return {torso,neck:line([p.head[0],p.head[1]+18],shoulderMid),leftArm:line(p.ls,p.le,p.lw),rightArm:line(p.rs,p.re,p.rw),leftUpper:line(p.lh,p.lk),rightUpper:line(p.rh,p.rk),leftLower:line(p.lk,p.la),rightLower:line(p.rk,p.ra),leftShoe:foot(p.la,true),rightShoe:foot(p.ra,false),head:'translate('+pt(p.head)+')',leftHand:'translate('+pt(p.lw)+')',rightHand:'translate('+pt(p.rw)+')',leftSleeve:line(p.ls,[lerp(p.ls[0],p.le[0],.35),lerp(p.ls[1],p.le[1],.35)]),rightSleeve:line(p.rs,[lerp(p.rs[0],p.re[0],.35),lerp(p.rs[1],p.re[1],.35)]),eyes:'translate('+num(p.gaze*4)+',0)'};
}
function fingerPath(open,left){const sign=left?-1:1,parts=[];for(let i=0;i<4;i++){const x=sign*((i-1.5)*lerp(2.5,5,open)),endY=-lerp(7,16-(i===0||i===3?3:0),open);parts.push('M'+num(x*.4)+',-2 Q'+num(x)+','+num(endY*.5)+' '+num(x)+','+num(endY));}parts.push('M'+(sign*4)+',1 Q'+num(sign*lerp(8,12,open))+',-3 '+num(sign*lerp(8,15,open))+','+num(lerp(0,-7,open)));return parts.join(' ');}
function illustration(r,step,E,state){
 const f=frame(state||create({routineId:r.id}),{}),p=f.points,s=shapes(p),wall=r.pose==='wall'||r.pose==='heel';
 const scene='<rect class="ab-room-back" x="15" y="9" width="330" height="276" rx="25"/><ellipse class="ab-floor-shadow" cx="180" cy="269" rx="105" ry="11"/><path class="ab-floor-line" d="M38 272H324"/>'+(wall?'<path class="ab-scene-wall" d="M298 29V273M299 67h25m-25 42h25m-25 42h25m-25 42h25m-25 42h25"/>':'')+(r.pose==='look'?'<g class="ab-scene-window"><rect x="265" y="32" width="54" height="69" rx="8"/><path d="M292 33v66m-26-34h52"/><circle cx="305" cy="48" r="6"/></g>':'')+(r.pose==='reach'?'<path class="ab-cloud" d="M142 19c-10-12-30-8-30 7-12-3-22 8-16 17h153c8-11-3-25-16-19-4-16-26-18-33-5-13-11-29-11-39 1Z"/>':'')+(r.pose==='diagonal'?'<g class="ab-stars"><path d="m133 16 4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1Z"/><path d="m222 16 4 9 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1Z"/></g>':'');
 return '<svg class="ab-figure ab-live-avatar" data-ab-avatar viewBox="0 0 360 300" role="img" aria-label="'+E(r.title+'. Нажми Старт, чтобы увидеть движение.')+'">'+scene+'<g class="ab-avatar-limbs"><path data-ab-node="leftUpper" class="ab-leg-upper" d="'+s.leftUpper+'"/><path data-ab-node="rightUpper" class="ab-leg-upper" d="'+s.rightUpper+'"/><path data-ab-node="leftLower" class="ab-leg-lower" d="'+s.leftLower+'"/><path data-ab-node="rightLower" class="ab-leg-lower" d="'+s.rightLower+'"/><path data-ab-node="leftShoe" class="ab-shoe" d="'+s.leftShoe+'"/><path data-ab-node="rightShoe" class="ab-shoe" d="'+s.rightShoe+'"/><path data-ab-node="neck" class="ab-neck" d="'+s.neck+'"/><path data-ab-node="leftArm" class="ab-arm" d="'+s.leftArm+'"/><path data-ab-node="rightArm" class="ab-arm" d="'+s.rightArm+'"/><path data-ab-node="torso" class="ab-shirt" d="'+s.torso+'"/><path data-ab-node="leftSleeve" class="ab-sleeve" d="'+s.leftSleeve+'"/><path data-ab-node="rightSleeve" class="ab-sleeve" d="'+s.rightSleeve+'"/></g><g data-ab-node="leftHand" class="ab-avatar-hand" transform="'+s.leftHand+'"><circle r="7"/><path data-ab-node="leftFingers" class="ab-finger-lines" d="'+fingerPath(p.fingers,true)+'"/></g><g data-ab-node="rightHand" class="ab-avatar-hand" transform="'+s.rightHand+'"><circle r="7"/><path data-ab-node="rightFingers" class="ab-finger-lines" d="'+fingerPath(p.fingers,false)+'"/></g><g data-ab-node="head" transform="'+s.head+'"><circle class="ab-head" r="23"/><path class="ab-hair" d="M-23-1c-2-34 50-36 48 1L17-8 9-15-2-9-13-6Z"/><g data-ab-node="eyes" class="ab-avatar-face" transform="'+s.eyes+'"><circle cx="-7" cy="0" r="2"/><circle cx="8" cy="0" r="2"/><path d="M-7 10q7 7 14 0"/></g></g></svg>';
}
const frameCache=typeof WeakMap==='function'?new WeakMap():null;
function updateFrame(container,state,data){
 if(!container||!state)return false;if(data?.playing===true)syncFrame(state,data);
 const svg=container.matches?.('[data-ab-avatar]')?container:container.querySelector?.('[data-ab-avatar]');if(!svg)return false;
 const f=frame(state,data);if(!f)return false;let refs=frameCache?.get(svg);
 if(!refs){refs={};svg.querySelectorAll('[data-ab-node]').forEach(el=>{refs[el.getAttribute('data-ab-node')]=el;});frameCache?.set(svg,refs);}
 const s=shapes(f.points);for(const [key,value]of Object.entries(s)){const el=refs[key];if(el)el.setAttribute(['head','leftHand','rightHand','eyes'].includes(key)?'transform':'d',value);}
 refs.leftFingers?.setAttribute('d',fingerPath(f.points.fingers,true));refs.rightFingers?.setAttribute('d',fingerPath(f.points.fingers,false));
 if(svg.dataset.segmentId!==String(f.segmentId)){svg.dataset.segmentId=f.segmentId||'';svg.setAttribute('aria-label',current(state).title+'. '+f.text);const instruction=container.querySelector('[data-ab-current-instruction]');if(instruction)instruction.textContent=f.text;const repetition=container.querySelector('[data-ab-repetition]');if(repetition)repetition.textContent=f.rep?'Показ: '+f.rep+' из '+f.repTotal:'Готовимся';}
 const progress=container.querySelector('[data-ab-motion-progress]');if(progress)progress.style.width=num(f.progress*100)+'%';
 const status=container.querySelector('[data-ab-coach-status]');if(status){const label=state.coachStatus==='loading'?'Готовим запись…':state.coachStatus==='paused'?'Показ на паузе':state.coachStatus==='error'?'Запись не включилась':state.coachStatus==='ended'?'Показ завершён':state.audioMode==='silent'?'Показ без звука':'Женский голос тренера';if(status.textContent!==label)status.textContent=label;}
 const clock=container.querySelector('[data-ab-timer]');if(clock){const text=time(duration(state)-state.elapsed);if(clock.textContent!==text)clock.textContent=text;}
 return true;
}
function time(seconds){seconds=Math.max(0,Math.ceil(seconds));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function render(state,env){
 env=env||{};const E=env.esc||esc,r=current(state);if(!r)return '<p>Выбери новую разминку.</p>';
 const p=plan(state),active=p[state.coachIndex]||p[0],length=duration(state),audioLabel=state.audioMode==='silent'?'Показ без звука':'Женский голос тренера';
 const top='<div class="ab-heading"><span class="ab-eyebrow">Короткая активная пауза</span><h2>'+E(state.phase==='done'?'Немного подвигались':r.title)+'</h2><p>Смотри на движение и повторяй в удобном темпе. Можно заменить или пропустить.</p></div>';
 const choice='<div class="ab-preferences" role="group" aria-label="Выбрать нагрузку"><button data-ab-action="preference" data-preference="all" aria-pressed="'+(state.preference==='all')+'">Все варианты</button><button data-ab-action="preference" data-preference="gentle" aria-pressed="'+(state.preference==='gentle')+'">Помягче</button></div>';
 let content='';
 if(state.phase==='choose'){
  content='<div class="ab-preview">'+illustration(r,0,E,state)+'<div><p class="ab-lead">'+E(r.short)+'</p><p>'+E(r.count)+' · примерно '+Math.round(length)+' секунд</p><p class="ab-prepare">Освободи место. Движения неглубокие и спокойные. Остановись, если стало неудобно.</p><span class="ab-audio-badge">'+audioLabel+'</span><div class="ab-actions"><button class="ab-primary" data-ab-action="start">Старт</button><button data-ab-action="replace">Другой вариант</button><button class="ab-text-button" data-ab-action="sound-toggle">'+(state.audioMode==='silent'?'Включить голос':'Без звука')+'</button></div></div></div>'+choice+'<details class="ab-library"><summary>Выбрать самому</summary><div class="ab-routine-grid">'+available(state.preference).map(item=>'<button class="ab-routine-card'+(item.id===r.id?' is-chosen':'')+'" data-ab-action="choose" data-routine="'+item.id+'" aria-pressed="'+(item.id===r.id)+'"><strong>'+E(item.title)+'</strong><small>'+E(item.short)+'</small><span>'+Math.round(duration(create({routineId:item.id})))+' сек.</span></button>').join('')+'</div></details><button class="ab-text-button" data-ab-action="skip">Сейчас пропущу, вернусь к заданиям</button>';
 }else if(state.phase==='moving'){
  const control=state.running?'<button data-ab-action="pause">Пауза</button>':'<button class="ab-primary" data-ab-action="resume">'+(state.coachFinished?'Повторить показ':'Продолжить')+'</button>';
  const status=state.coachStatus==='loading'?'Готовим запись…':state.coachStatus==='paused'?'Показ на паузе':state.coachStatus==='error'?'Запись не включилась':state.coachStatus==='ended'?'Показ завершён':audioLabel;
  content='<div class="ab-moving'+(state.running?' is-running':'')+'">'+illustration(r,state.step,E,state)+'<div class="ab-step" data-ab-stage><span class="ab-step-label" data-ab-repetition>'+(active?.rep?'Показ: '+active.rep+' из '+active.repTotal:'Готовимся')+'</span><p data-ab-current-instruction>'+E(active?.text||r.steps[state.step])+'</p><div class="ab-motion-track" aria-hidden="true"><i data-ab-motion-progress style="width:'+num(state.coachProgress*100)+'%"></i></div><span class="ab-audio-badge" data-ab-coach-status role="status">'+status+'</span></div></div><div class="ab-clock-panel"><div class="ab-timer" data-ab-timer role="timer" aria-label="Оставшееся время показа">'+time(length-state.elapsed)+'</div><div class="ab-clock-actions">'+control+'<button data-ab-action="repeat-demo">Сначала</button><button data-ab-action="sound-toggle">'+(state.audioMode==='silent'?'Включить голос':'Без звука')+'</button></div><p>Показ задаёт спокойный темп. Можно закончить раньше.</p></div>'+(state.feedback?'<p class="ab-message" role="status">'+E(state.feedback)+'</p>':'')+(state.coachStatus==='error'?'<div class="ab-actions"><button data-ab-action="resume">Повторить со звуком</button><button data-ab-action="silent-start">Показ без звука</button></div>':'')+'<div class="ab-actions"><button class="ab-primary" data-ab-action="finish">Я размялся, закончить</button><button data-ab-action="replace">Заменить упражнение</button><button class="ab-text-button" data-ab-action="skip">Пропустить</button></div>';
 }else content='<div class="ab-done"><span class="ab-done-mark" aria-hidden="true">✓</span><strong>Отмечено тобой</strong><p>Можно вернуться к заданиям. Таймер и анимация не проверяют, выполнял ли ты движения.</p><div class="ab-actions"><button class="ab-primary" data-ab-action="return">Вернуться к занятиям</button><button data-ab-action="replace">Выбрать другую разминку</button></div></div>';
 return '<section class="ab-shell" data-active-break="'+r.id+'" aria-label="Активная пауза">'+top+content+'</section>';
}
function capture(){return false;}
root.ActiveBreaks={VERSION,ROUTINES,create,restore,render,handle,capture,current,available,plan,duration,frame,pose,shapes,updateFrame,syncFrame};
})(typeof window==='undefined'?globalThis:window);
