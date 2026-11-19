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

const BASE={head:[180,59],ls:[158,99],rs:[202,99],le:[147,139],re:[213,139],lw:[141,176],rw:[219,176],lh:[166,171],rh:[194,171],lk:[161,216],rk:[199,216],la:[154,258],ra:[206,258],gaze:0,tilt:0,fingers:0,heelLift:0,profile:0,palms:0,wallHands:0};
function pose(name){
 const p=copy(BASE),set=v=>Object.assign(p,v);
 if(name==='reach')set({head:[180,55],ls:[158,94],rs:[202,94],le:[147,56],re:[213,56],lw:[151,24],rw:[209,24],fingers:.48});
 else if(name==='squat')set({head:[183,83],ls:[156,124],rs:[196,123],le:[175,143],re:[218,139],lw:[214,143],rw:[250,134],lh:[146,194],rh:[179,195],lk:[162,219],rk:[207,222],tilt:5,gaze:.35});
 else if(name==='wall-ready'||name==='wall-bent'){
  set({head:[221,67],ls:[200,105],rs:[211,101],le:[244,110],re:[249,124],lw:[295,111],rw:[295,131],lh:[167,174],rh:[180,174],lk:[151,216],rk:[165,216],la:[137,258],ra:[152,257],gaze:1,tilt:12,profile:1,wallHands:1});
  if(name==='wall-bent')set({head:[254,77],ls:[230,111],rs:[239,105],le:[251,144],re:[256,151],lh:[181,178],rh:[193,177],lk:[160,218],rk:[172,217],tilt:21});
 }else if(name==='shoulder-up')set({ls:[158,89],rs:[202,89],le:[149,132],re:[211,132],lw:[143,170],rw:[217,170]});
 else if(name==='cross-left')set({head:[185,60],ls:[160,98],rs:[201,104],le:[146,140],re:[188,148],lw:[145,177],rw:[158,189],lh:[170,172],rh:[196,171],lk:[158,190],la:[143,224],tilt:6});
 else if(name==='cross-right')set({head:[175,60],ls:[159,104],rs:[200,98],le:[172,148],re:[214,140],lw:[202,189],rw:[215,177],lh:[164,171],rh:[190,172],rk:[202,190],ra:[217,224],tilt:-6});
 else if(name==='heel-ready'||name==='heel-up'){
  set({head:[199,59],ls:[177,99],rs:[221,99],le:[165,139],re:[256,116],lw:[159,175],rw:[295,107],lh:[185,171],rh:[213,171],lk:[180,216],rk:[218,216],la:[174,258],ra:[224,258],wallHands:.5,gaze:.25});
  if(name==='heel-up'){
   for(const k of ['head','ls','rs','le','lw','lh','rh','lk','rk','la','ra'])p[k][1]-=10;
   p.re[1]-=5;p.heelLift=1;
  }
 }else if(name==='hands-ready'||name==='hands-open')set({le:[144,149],re:[216,149],lw:[141,116],rw:[219,116],palms:1,fingers:name==='hands-open'?1:0});
 else if(name==='posture-ready'||name==='posture-open'){
  set({le:[141,135],re:[219,135],lw:[163,162],rw:[197,162]});
  if(name==='posture-open')set({head:[180,56],ls:[155,94],rs:[205,94],le:[135,136],re:[225,136]});
 }else if(name==='look-right')set({head:[189,57],ls:[163,100],rs:[203,97],le:[153,140],re:[212,139],lw:[146,176],rw:[217,176],gaze:1,tilt:-5});
 else if(name==='star-left')set({head:[177,56],ls:[156,95],le:[140,56],lw:[147,24],tilt:-5,fingers:.42});
 else if(name==='star-right')set({head:[183,56],rs:[204,95],re:[220,56],rw:[213,24],tilt:5,fingers:.42});
 else if(name==='side-right'){for(const k of Object.keys(p))if(Array.isArray(p[k]))p[k][0]+=32;}
 else if(name==='walk-left')set({head:[184,57],ls:[161,99],rs:[205,98],lh:[171,171],rh:[196,170],lk:[153,192],la:[157,227],le:[146,143],lw:[137,174],re:[214,130],rw:[205,151],tilt:3});
 else if(name==='walk-right')set({head:[176,57],ls:[155,98],rs:[199,99],lh:[164,170],rh:[189,171],rk:[207,192],ra:[203,227],le:[146,130],lw:[155,151],re:[214,143],rw:[223,174],tilt:-3});
 return p;
}
function sideStep(progress,back){
 const p=pose('neutral'),direction=back?-1:1,t=progress*4,step=Math.min(3,Math.floor(t)),amount=t-step;
 const stride=16*direction,lead=back?'l':'r',follow=back?'r':'l';
 const offsets={[lead]:Math.ceil(step/2)*stride,[follow]:Math.floor(step/2)*stride};
 const swinging=step%2?follow:lead;
 offsets[swinging]+=stride*ease(amount);
 const origin=back?32:0,shift=origin+(offsets.l+offsets.r)/2;
 const lift=Math.sin(Math.PI*amount)*9;
 for(const key of Object.keys(p))if(Array.isArray(p[key]))p[key][0]+=shift;
 for(const side of ['l','r']){
  p[side+'a'][0]=BASE[side+'a'][0]+origin+offsets[side];
  p[side+'k'][0]+=(origin+offsets[side]-shift)*.46;
 }
 p[swinging+'a'][1]-=lift;p[swinging+'k'][1]-=lift*.62;
 p.lw[0]-=lift*.45;p.rw[0]+=lift*.45;
 return p;
}
function blend(a,b,t){const p={};for(const k of Object.keys(BASE))p[k]=Array.isArray(a[k])?a[k].map((v,i)=>lerp(v,b[k][i],t)):lerp(a[k],b[k],t);return p;}
function frame(state,data){
 data=data||{};const isPlaying=state.phase==='moving'&&state.running&&data.playing===true,clock=isPlaying?data:{index:state.coachIndex,progress:state.coachProgress},x=segmentAt(state,clock),r=current(state);if(!r)return null;
 const prepared=r.pose==='wall'?'wall-ready':r.pose==='heel'?'heel-ready':r.pose==='hands'?'hands-ready':r.pose==='posture'?'posture-ready':'neutral';
 if(state.phase!=='moving'||!x)return {points:pose(prepared),segmentId:null,index:0,progress:0,playing:false,text:r.short,rep:0,repTotal:root.CoachMovementPlan?.CONFIG[r.id]?.reps||0,step:0};
 const progress=clamp(clock.progress,0,1,state.coachProgress||0);
 const s=x.segment,t=ease(progress);let points=blend(pose(s.from),pose(s.to),t);
 if(s.motion==='walk-left'||s.motion==='walk-right')points=blend(pose('neutral'),pose(s.motion),Math.sin(Math.PI*progress)**2);
 if(s.motion==='side-out'||s.motion==='side-back')points=sideStep(progress,s.motion==='side-back');
 // Swing away from the body so lifting a straight arm never collapses it at mid-arc.
 for(const [arm,sign] of [['l',-1],['r',1]]){
  const raised=s.from==='reach'||s.to==='reach'||s.from===(arm==='l'?'star-left':'star-right')||s.to===(arm==='l'?'star-left':'star-right');
  if(raised){const arc=Math.sin(Math.PI*t);points[arm+'e'][0]+=sign*32*arc;points[arm+'w'][0]+=sign*65*arc;}
 }
 if(s.motion==='breathe'){const lift=Math.sin(progress*Math.PI*2)*1.8;points.ls[1]-=lift;points.rs[1]-=lift;}
 return {points,segmentId:s.id,index:x.index,progress,playing:isPlaying,text:s.text,rep:s.rep,repTotal:s.repTotal,step:s.step,clipId:s.clipId};
}
function num(n){return Number(n.toFixed(2));}
function pt(p){return num(p[0])+','+num(p[1]);}
function midpoint(a,b,t=.5){return [lerp(a[0],b[0],t),lerp(a[1],b[1],t)];}
function line(a,b){return 'M'+pt(a)+' L'+pt(b);}
function tapered(a,b,top,bottom){
 const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy)||1;
 const x=dy/length,y=-dx/length;
 const edge=(p,r)=>pt([p[0]+x*r,p[1]+y*r]);
 return 'M'+edge(a,top)+' L'+edge(b,bottom)+' A'+bottom+','+bottom+' 0 0 1 '+edge(b,-bottom)+' L'+edge(a,-top)+' A'+top+','+top+' 0 0 1 '+edge(a,top)+' Z';
}
function torsoShape(p){
 const shoulder=midpoint(p.ls,p.rs),hips=midpoint(p.lh,p.rh);
 const shoulderMargin=5+3*p.profile,hipMargin=6+3*p.profile;
 const left=[p.ls[0]-shoulderMargin,p.ls[1]+3],right=[p.rs[0]+shoulderMargin,p.rs[1]+3];
 const leftHip=[p.lh[0]-hipMargin,p.lh[1]+6],rightHip=[p.rh[0]+hipMargin,p.rh[1]+6];
 const waistCurve=8-3*p.profile;
 const waistLeft=midpoint(left,leftHip,.67),waistRight=midpoint(right,rightHip,.67);
 return 'M'+pt(left)+' Q'+pt([shoulder[0]-8,shoulder[1]-12])+' '+pt([shoulder[0],shoulder[1]-9])+' Q'+pt([shoulder[0]+10,shoulder[1]-11])+' '+pt(right)
  +' Q'+pt([waistRight[0]-waistCurve,waistRight[1]])+' '+pt(rightHip)+' Q'+pt([hips[0],hips[1]+14])+' '+pt(leftHip)
  +' Q'+pt([waistLeft[0]+waistCurve,waistLeft[1]])+' '+pt(left)+' Z';
}
function shoe(a,side,p){
 const sign=side==='l'?-1:1;
 const toeX=a[0]+lerp(sign*14,16,p.profile),toeY=lerp(a[1]+5,263,p.heelLift),facing=Math.sign(toeX-a[0]);
 const toe=[toeX+facing*5,toeY],heel=[a[0]-facing*6,a[1]+6];
 const toeTop=[toe[0]-facing*2,toe[1]-6],heelTop=[heel[0],heel[1]-10],lace=midpoint(heelTop,toeTop,.5);
 return {
  body:'M'+pt(heel)+' Q'+pt([heel[0]-facing*3,heel[1]-5])+' '+pt(heelTop)+' Q'+pt([lace[0],lace[1]-4])+' '+pt(toeTop)+' Q'+pt([toe[0]+facing*4,toeY-4])+' '+pt(toe)+' Q'+pt([toe[0],toeY+3])+' '+pt([toe[0]-facing*4,toeY+4])+' L'+pt([heel[0]+facing*2,heel[1]+3])+' Q'+pt([heel[0]-facing*2,heel[1]+3])+' '+pt(heel)+' Z',
  sole:'M'+pt([heel[0],heel[1]+.5])+' Q'+pt(midpoint(heel,toe,.5).map((n,i)=>n+(i===1?3:0)))+' '+pt([toe[0],toe[1]+1]),
  lace:line([lace[0]-facing*3,lace[1]+2],[lace[0]+facing,lace[1]-1])+' '+line([lace[0]+facing,lace[1]+4],[lace[0]+facing*5,lace[1]+1])
 };
}
function shapes(p){
 const shoulders=midpoint(p.ls,p.rs),hips=midpoint(p.lh,p.rh);
 const neckBase=midpoint([p.head[0],p.head[1]+17],shoulders,.9);
 const collar=[shoulders[0],shoulders[1]-6],hem=midpoint(shoulders,hips,.88);
 const torsoWidth=Math.hypot(p.rs[0]-p.ls[0],p.rs[1]-p.ls[1]);
 const s={
  torso:torsoShape(p),
  neck:tapered([p.head[0],p.head[1]+15],neckBase,7.8,8.6),
  collar:'M'+pt([collar[0]-torsoWidth*.24,collar[1]])+' Q'+pt([collar[0],collar[1]+18])+' '+pt([collar[0]+torsoWidth*.24,collar[1]]),
  hem:'M'+pt([hem[0]-torsoWidth*.23,hem[1]])+' Q'+pt([hem[0]-4,hem[1]+5])+' '+pt([hem[0]+torsoWidth*.13,hem[1]+5]),
  head:'translate('+pt(p.head)+') rotate('+num(p.tilt)+')',
  eyes:'translate('+num(p.profile?0:p.gaze*6)+',0) scale('+num(p.profile?1:1-p.gaze*.19)+',1)',
  floorShadow:'translate('+num(midpoint(p.la,p.ra)[0]-180)+',0)'
 };
 for(const [side,name] of [['l','left'],['r','right']]){
  const shoulder=p[side+'s'],elbow=p[side+'e'],wrist=p[side+'w'];
  const hip=p[side+'h'],knee=p[side+'k'],ankle=p[side+'a'];
  const sock=midpoint(knee,ankle,.86),sneaker=shoe(ankle,side,p);
  const sleeveEnd=midpoint(shoulder,elbow,.44);
  const elbowRadius=side==='r'&&p.profile?6.2:7.2;
  s[name+'Upper']=tapered(hip,knee,13,9);
  s[name+'Lower']=tapered(knee,sock,9.1,6.8);
  s[name+'Sock']=tapered(sock,ankle,6.7,5.9);
  s[name+'Shoe']=sneaker.body;s[name+'Sole']=sneaker.sole;s[name+'Laces']=sneaker.lace;
  s[name+'Arm']=tapered(shoulder,elbow,9,elbowRadius);
  s[name+'Forearm']=tapered(elbow,wrist,elbowRadius,4.7);
  s[name+'Sleeve']=tapered(shoulder,sleeveEnd,10.8,8.9);
  const angle=p.wallHands&&(side==='r'||p.profile)?0:Math.atan2(wrist[0]-elbow[0],elbow[1]-wrist[1])*180/Math.PI;
  s[name+'Hand']='translate('+pt(wrist)+') rotate('+num(angle)+')';
 }
 return s;
}
function fingerPath(p,left){
 const open=p.palms?p.fingers:p.wallHands&&(p.profile||!left)?1:Math.max(.16,p.fingers);
 const sign=left?-1:1,parts=[];
 for(let i=0;i<4;i++){
  const x=sign*((i-1.5)*lerp(1.7,3.6,open));
  const endY=-lerp(10,16-(i===0||i===3?3:0),open);
  parts.push('M'+num(x*.44)+',-4 Q'+num(x)+','+num(endY*.57)+' '+num(x)+','+num(endY));
 }
 parts.push('M'+(sign*3)+',-1 Q'+num(sign*lerp(6,7,open))+',-4 '+num(sign*lerp(5,10,open))+','+num(lerp(-5,-7,open)));
 return parts.join(' ');
}
const COACH_TRANSFORMS=new Set(['head','leftHand','rightHand','eyes','floorShadow']);
let coachDrawing=0;
function illustration(r,E,state){
 const f=frame(state||create({routineId:r.id}),{}),p=f.points,s=shapes(p),wall=r.pose==='wall'||r.pose==='heel';
 const id='ab-drawing-'+(++coachDrawing)+'-',paint=name=>'url(#'+id+name+')';
 const gradient=(name,attributes,stops)=>'<linearGradient id="'+id+name+'" '+attributes+'>'+stops.map(([at,color])=>'<stop offset="'+at+'" stop-color="'+color+'"/>').join('')+'</linearGradient>';
 const radial=(name,attributes,stops)=>'<radialGradient id="'+id+name+'" '+attributes+'>'+stops.map(([at,color,opacity])=>'<stop offset="'+at+'" stop-color="'+color+'" stop-opacity="'+(opacity??1)+'"/>').join('')+'</radialGradient>';
 const diagonal='x1="0" x2="1" y1="0" y2="1"';
 const defs='<defs>'
  +gradient('room',diagonal,[[0,'#fff9e9'],[.49,'#f4f7ec'],[1,'#d3e7dc']])
  +gradient('floor','x1="0" x2="0" y1="0" y2="1"',[[0,'#e0e7d9'],[1,'#f8e5cc']])
  +gradient('wall','x1="0" x2="1" y1="0" y2="0"',[[0,'#a9c7bd'],[.32,'#c7ddd0'],[1,'#e0e9d9']])
  +gradient('skin',diagonal,[[0,'#f7cb9e'],[.47,'#e5a16f'],[1,'#a85c46']])
  +radial('face','cx=".32" cy=".27" r=".89"',[[0,'#ffdbb2'],[.56,'#e4a06f'],[1,'#a96148']])
  +gradient('hair',diagonal,[[0,'#735244'],[.46,'#49332f'],[1,'#2f2528']])
  +gradient('shirt',diagonal,[[0,'#74c8ae'],[.35,'#329e88'],[.8,'#217a72'],[1,'#185d5f']])
  +gradient('pants',diagonal,[[0,'#708192'],[.32,'#465e73'],[1,'#2d435b']])
  +gradient('shoe',diagonal,[[0,'#f2ad82'],[.62,'#d47961'],[1,'#a85146']])
  +radial('shadow','cx=".5" cy=".5" r=".5"',[[0,'#52665d',.37],[.62,'#52665d',.19],[1,'#52665d',0]])
  +'<clipPath id="'+id+'room-clip"><rect x="11" y="8" width="338" height="280" rx="25"/></clipPath></defs>';
 const scene='<g clip-path="'+paint('room-clip')+'"><rect x="11" y="8" width="338" height="280" fill="'+paint('room')+'"/>'
  +'<path fill="#fff" opacity=".34" d="M-20 68 87 8h65L9 176zm21 58L175 8h22L15 153z"/>'
  +'<path fill="'+paint('floor')+'" d="M11 233h338v55H11z"/><path fill="none" stroke="#b9cfc1" stroke-width="2" d="M11 234h338"/>'
  +'<path fill="none" stroke="#b99e80" opacity=".25" d="m88 236-63 52m100-52-38 52m175-52 53 52M11 270h338"/>'
  +(wall?'<g><path fill="'+paint('wall')+'" d="M301 8h48v280l-48-26z"/><path fill="none" stroke="#7da698" stroke-width="3" d="M301 8v254l48 26"/><path fill="none" stroke="#91b3a5" d="m305 61 44 4m-44 46 44 7m-44 42 44 10m-44 38 44 15"/></g>':'')
  +(r.pose==='look'?'<g class="ab-scene-window"><rect x="263" y="32" width="61" height="76" rx="8"/><circle cx="308" cy="49" r="7"/><path d="M267 99q12-24 22-12t30 3M294 33v74m-27-38h53"/></g>':'')
  +(r.pose==='reach'?'<path class="ab-cloud" d="M168 19c1-8 11-11 16-5 5-3 12 0 13 5 7 0 10 5 6 9h-40c-5-4-1-9 5-9Z"/>':'')
  +(r.pose==='diagonal'?'<g class="ab-stars"><path d="m111 28 3 7 8 1-6 5 2 7-7-4-6 4 2-7-6-5 8-1Z"/><path d="m251 28 3 7 8 1-6 5 2 7-7-4-6 4 2-7-6-5 8-1Z"/></g>':'')
  +'</g><ellipse data-ab-node="floorShadow" cx="180" cy="268" rx="62" ry="10" fill="'+paint('shadow')+'" transform="'+s.floorShadow+'"/>';
 const shape=(name,fill,css='')=>'<path data-ab-node="'+name+'" d="'+s[name]+'" fill="'+(fill?paint(fill):'none')+'" class="'+css+'"/>';
 function leg(side){
  return '<g>'+shape(side+'Upper','pants')+shape(side+'Lower','pants')+shape(side+'Sock',null,'ab-coach-sock')+shape(side+'Shoe','shoe')+shape(side+'Sole',null,'ab-coach-sole')+shape(side+'Laces',null,'ab-coach-laces')+'</g>';
 }
 function arm(side){
  const left=side==='left';
  return '<g>'+shape(side+'Arm','skin')+shape(side+'Forearm','skin')+shape(side+'Sleeve','shirt')
   +'<g data-ab-node="'+side+'Hand" transform="'+s[side+'Hand']+'"><path fill="'+paint('skin')+'" d="M-4 3c-2-3-3-8 0-12 2-2 6-2 8 0 3 3 2 9 0 12-2 2-5 2-8 0Z"/>'
   +'<path data-ab-node="'+side+'Fingers" class="ab-coach-fingers" d="'+fingerPath(p,left)+'"/></g></g>';
 }
 const profile=p.profile>0;
 const face=profile
  ? '<path d="M-3 4c4-1 8-2 12-3" class="ab-coach-brow"/><path d="M1 8q4-3 8 0" class="ab-coach-eye"/><ellipse cx="6" cy="8" rx="1.5" ry="1.8"/><path d="M11 19q3 1 7-1" class="ab-coach-smile"/>'
  : '<path d="M-14 0q4-2 8-.5M5-.5q4-2 9 0" class="ab-coach-brow"/><path d="M-14 5q4-3 8-.1M5 5q4-3 9-.2" class="ab-coach-eye"/><ellipse cx="-10" cy="5" rx="1.9" ry="2.3"/><ellipse cx="9" cy="5" rx="1.9" ry="2.3"/><path d="M0 6l-1 7 3 .5" class="ab-coach-nose"/><path d="M-5 17q6 4 12-.5" class="ab-coach-smile"/>';
 const head='<g data-ab-node="head" transform="'+s.head+'">'
  +'<path fill="'+paint('hair')+'" d="M-13-16q-17-8-22 13c-3 15 3 31-13 42 17-1 25-13 29-28 3-8 6-14 10-17z"/><path class="ab-coach-hair-detail" d="M-19-15c-20 2-12 34-20 44"/>'
  +'<path fill="'+paint('face')+'" d="'+(profile?'M-17-14c11-12 30-8 34 6l-1 9 8 10-6 3c2 10-5 15-13 14-8-2-19-12-23-21-3-7-3-14 1-21Z':'M-18-12c6-10 31-13 37 2 8 22-3 36-16 39-13-1-25-12-24-28 0-6 1-10 3-13Z')+'"/>'
  +'<path fill="'+paint('hair')+'" d="'+(profile?'M-16 15c-8-8-9-20-6-30 5-13 31-18 39 3-7-6-12-7-19-5-3 7-7 10-10 13l1 11z':'M-19 11c-5-5-7-13-5-23 3-14 22-21 36-13 7 4 11 11 12 24-5-2-7-8-12-12-13 10-21 8-30 11z')+'"/>'
  +'<path class="ab-coach-hair-detail" d="M-19-12q12-14 27-9m-19 10q9-6 18-6"/><ellipse fill="'+paint('skin')+'" cx="-16" cy="7" rx="4.4" ry="6"/>'
  +'<path class="ab-coach-nose" d="M-17 8q-1-3 2-4"/><g data-ab-node="eyes" class="ab-coach-face" transform="'+s.eyes+'">'+face+'</g></g>';
 const body=shape('neck','skin')+shape('torso','shirt')+shape('collar',null,'ab-coach-collar')+shape('hem',null,'ab-coach-hem');
 return '<svg class="ab-figure ab-live-avatar" data-ab-avatar viewBox="0 0 360 300" role="img" aria-label="'+E(r.title+'. '+(state?.phase==='moving'?f.text:'Нажми Старт, чтобы увидеть движение.'))+'">'
  +defs+scene+leg('right')+leg('left')+(profile?arm('right')+body:body+arm('right'))+arm('left')+head+'</svg>';
}
const frameCache=typeof WeakMap==='function'?new WeakMap():null;
function updateFrame(container,state,data){
 if(!container||!state)return false;if(data?.playing===true)syncFrame(state,data);
 const svg=container.matches?.('[data-ab-avatar]')?container:container.querySelector?.('[data-ab-avatar]');if(!svg)return false;
 const f=frame(state,data);if(!f)return false;let drawing=frameCache?.get(svg);
 if(!drawing){
  drawing={nodes:{},values:{}};
  svg.querySelectorAll('[data-ab-node]').forEach(el=>{drawing.nodes[el.getAttribute('data-ab-node')]=el;});
  frameCache?.set(svg,drawing);
 }
 const s=shapes(f.points);s.leftFingers=fingerPath(f.points,true);s.rightFingers=fingerPath(f.points,false);
 for(const [key,value]of Object.entries(s)){
  const node=drawing.nodes[key];
  if(node&&drawing.values[key]!==value){
   node.setAttribute(COACH_TRANSFORMS.has(key)?'transform':'d',value);drawing.values[key]=value;
  }
 }
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
  content='<div class="ab-preview">'+illustration(r,E,state)+'<div><p class="ab-lead">'+E(r.short)+'</p><p>'+E(r.count)+' · примерно '+Math.round(length)+' секунд</p><p class="ab-prepare">Освободи место. Движения неглубокие и спокойные. Остановись, если стало неудобно.</p><span class="ab-audio-badge">'+audioLabel+'</span><div class="ab-actions"><button class="ab-primary" data-ab-action="start">Старт</button><button data-ab-action="replace">Другой вариант</button><button class="ab-text-button" data-ab-action="sound-toggle">'+(state.audioMode==='silent'?'Включить голос':'Без звука')+'</button></div></div></div>'+choice+'<details class="ab-library"><summary>Выбрать самому</summary><div class="ab-routine-grid">'+available(state.preference).map(item=>'<button class="ab-routine-card'+(item.id===r.id?' is-chosen':'')+'" data-ab-action="choose" data-routine="'+item.id+'" aria-pressed="'+(item.id===r.id)+'"><strong>'+E(item.title)+'</strong><small>'+E(item.short)+'</small><span>'+Math.round(duration(create({routineId:item.id})))+' сек.</span></button>').join('')+'</div></details><button class="ab-text-button" data-ab-action="skip">Сейчас пропущу, вернусь к заданиям</button>';
 }else if(state.phase==='moving'){
  const control=state.running?'<button data-ab-action="pause">Пауза</button>':'<button class="ab-primary" data-ab-action="resume">'+(state.coachFinished?'Повторить показ':'Продолжить')+'</button>';
  const status=state.coachStatus==='loading'?'Готовим запись…':state.coachStatus==='paused'?'Показ на паузе':state.coachStatus==='error'?'Запись не включилась':state.coachStatus==='ended'?'Показ завершён':audioLabel;
  content='<div class="ab-moving'+(state.running?' is-running':'')+'">'+illustration(r,E,state)+'<div class="ab-step" data-ab-stage><span class="ab-step-label" data-ab-repetition>'+(active?.rep?'Показ: '+active.rep+' из '+active.repTotal:'Готовимся')+'</span><p data-ab-current-instruction>'+E(active?.text||r.steps[state.step])+'</p><div class="ab-motion-track" aria-hidden="true"><i data-ab-motion-progress style="width:'+num(state.coachProgress*100)+'%"></i></div><span class="ab-audio-badge" data-ab-coach-status role="status">'+status+'</span></div></div><div class="ab-clock-panel"><div class="ab-timer" data-ab-timer role="timer" aria-label="Оставшееся время показа">'+time(length-state.elapsed)+'</div><div class="ab-clock-actions">'+control+'<button data-ab-action="repeat-demo">Сначала</button><button data-ab-action="sound-toggle">'+(state.audioMode==='silent'?'Включить голос':'Без звука')+'</button></div><p>Показ задаёт спокойный темп. Можно закончить раньше.</p></div>'+(state.feedback?'<p class="ab-message" role="status">'+E(state.feedback)+'</p>':'')+(state.coachStatus==='error'?'<div class="ab-actions"><button data-ab-action="resume">Повторить со звуком</button><button data-ab-action="silent-start">Показ без звука</button></div>':'')+'<div class="ab-actions"><button class="ab-primary" data-ab-action="finish">Я размялся, закончить</button><button data-ab-action="replace">Заменить упражнение</button><button class="ab-text-button" data-ab-action="skip">Пропустить</button></div>';
 }else content='<div class="ab-done"><span class="ab-done-mark" aria-hidden="true">✓</span><strong>Отмечено тобой</strong><p>Можно вернуться к заданиям. Таймер и анимация не проверяют, выполнял ли ты движения.</p><div class="ab-actions"><button class="ab-primary" data-ab-action="return">Вернуться к занятиям</button><button data-ab-action="replace">Выбрать другую разминку</button></div></div>';
 return '<section class="ab-shell" data-active-break="'+r.id+'" aria-label="Активная пауза">'+top+content+'</section>';
}
function capture(){return false;}
root.ActiveBreaks={VERSION,ROUTINES,create,restore,render,handle,capture,current,available,plan,duration,frame,pose,shapes,updateFrame,syncFrame};
})(typeof window==='undefined'?globalThis:window);
