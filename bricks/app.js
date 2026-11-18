'use strict';
const K=window.Kubiki, $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let P=window.PlaceValue, M=window.PlaceValueMotion;
const LP=window.LearningProgress,A=window.PlaceValueActivities,R=window.MathRange||{MAX:1000,draft:v=>typeof v==='string'?v.replace(/[^0-9]/g,'').slice(0,4):''};
const writerId='math-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let storageBlocked=false,userIntent=false,pvDirty=false,pvSeenRevision=0;
const icons={cube:'<rect x="3" y="8" width="18" height="12" rx="2"/><ellipse cx="7.5" cy="7" rx="2.5" ry="1.5"/><ellipse cx="16.5" cy="7" rx="2.5" ry="1.5"/>',play:'<path d="m9 5 11 7-11 7Z"/>',grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',build:'<path d="m12 3 8 4-8 4-8-4ZM4 12l8 4 8-4M4 17l8 4 8-4"/>',chart:'<path d="M4 3v17h17M8 15v-4M13 15V7M18 15V4"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .5-1.5 1-1.5 2M12 16h.01"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',left:'<path d="m14 6-6 6 6 6"/>',check:'<path d="m5 12 4 4L19 6"/>',reset:'<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',bulb:'<path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z"/>',sound:'<path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>'};
const icon=(name,cls='')=>`<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.cube}</svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORAGE_KEY='detalki-progress-v1';
let memory=false, saved, lastStoredRaw=null, booting=true, resetting=false;
const pendingModeAwards=new Set(),pendingReadAwards=new Set();
try{lastStoredRaw=localStorage.getItem(STORAGE_KEY);saved=JSON.parse(lastStoredRaw||'{}');if(!saved||typeof saved!=='object'||Array.isArray(saved))throw Error('invalid-progress');}catch(e){saved={};memory=true;storageBlocked=true;}
let progress=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
progress.resetEpoch=typeof progress.resetEpoch==='string'&&progress.resetEpoch.length<100?progress.resetEpoch:'initial';
if(LP)progress.learning=LP.clean(progress.learning,progress.resetEpoch);
progress.solved=cleanMarks(progress.solved);
const hasModeProgress=record(progress.modeSolved)&&progress.modeSolved.version===1;
progress.modeSolved={version:1,play:hasModeProgress?cleanMarks(progress.modeSolved.play):{...progress.solved},worksheet:hasModeProgress?cleanMarks(progress.modeSolved.worksheet):{}};
for(const mode of ['play','worksheet'])Object.assign(progress.solved,progress.modeSolved[mode]);
progress.modeSessions=record(progress.modeSessions)?Object.fromEntries(Object.entries(progress.modeSessions).filter(([key])=>/^(?:[1-9]|[12][0-9]|3[0-6]):(?:learn|play|worksheet)$/.test(key))):{};
progress.read=Array.isArray(progress.read)?progress.read.filter(validLesson):[];
progress.worksheet=cleanWorksheet(progress.worksheet);
const storedLesson=Number(progress.lastLesson);
const state={view:'trainer',lesson:storedLesson>=1&&storedLesson<=36?storedLesson:1,mode:'play',index:0,demo:true,step:0,zones:{},feedback:null,solved:false,selected:null,undo:[],answer:'',learnFrame:0,worksheetTask:false,repeating:false,freeTarget:23,pv:null,pvConflict:false,legacyAttempt:null,countPoints:false};
// Keep achievements and the active lesson separate: leaving a page must not
// turn a partially completed lesson back into its introductory example.
function record(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function numericDraft(value){return R.draft(value);}
function validLesson(value){return Number.isInteger(value)&&value>=1&&value<=COURSE.length;}
function cleanZones(value){
 if(!record(value))return null;
 const result={};
 for(const zone of ['a','b','removed']){
  if(!record(value[zone]))return null;
  const parts=K.empty();
  for(const type of Object.keys(K.values)){const n=value[zone][type];if(!Number.isInteger(n)||n<0||n*K.values[type]>R.MAX)return null;parts[type]=n;}
  if(K.total(parts)>R.MAX)return null;result[zone]=parts;
 }
 return result;
}
function readSession(value){
 if(!record(value)||![1,2].includes(value.version)||!validLesson(value.lesson)||!['play','learn','worksheet'].includes(value.mode)||!Number.isInteger(value.index)||value.index<0||value.index>=18||typeof value.demo!=='boolean')return null;
 const zones=cleanZones(value.zones);
 if(!zones)return null;
 return {lesson:value.lesson,mode:value.mode,index:value.index,demo:value.demo,step:Number.isInteger(value.step)&&value.step>=0&&value.step<=2?value.step:0,zones,answer:numericDraft(value.answer),solved:value.solved===true,undo:Array.isArray(value.undo)?value.undo.slice(-20).map(item=>{try{return cleanZones(JSON.parse(item));}catch{return null;}}).filter(Boolean).map(item=>JSON.stringify(item)):[],countPoints:value.countPoints===true,worksheetTask:value.version===2&&value.mode==='worksheet'&&value.worksheetTask===true,repeating:value.version===2&&value.repeating===true,legacyAttempt:cleanLegacyAttempt(value.legacyAttempt)};
}
function contextKey(){return state.view==='placevalue'?'placevalue:'+A.current(state.pv)?.id:`${state.view}:${state.lesson}:${state.mode}:${state.demo}:${state.index}:${state.worksheetTask}`;}
function captureDrafts(){
 if(state.view==='placevalue'){if($('#app').dataset.context===contextKey()&&A.capture(state,document))pvDirty=true;return;}
 if(state.view!=='trainer'||$('#app').dataset.context!==contextKey())return;
 const answer=$('#answer');if(answer&&!state.solved)state.answer=numericDraft(answer.value);
 if(state.mode==='worksheet'){
  const drafts=progress.worksheet[state.lesson]||(progress.worksheet[state.lesson]={});
  $$('[data-ws-input]').forEach(input=>{const i=Number(input.dataset.wsInput);if(Number.isInteger(i)&&i>=0&&i<16){const value=numericDraft(input.value);if(value&&!modeDone('worksheet',state.lesson,i))drafts[i]=value;else delete drafts[i];}});
 }
}
function sessionSnapshot(){return {version:2,lesson:state.lesson,mode:state.mode,index:state.index,demo:state.demo,step:state.step,zones:JSON.parse(JSON.stringify(state.zones)),answer:state.answer,solved:state.solved,undo:state.undo.slice(-20),countPoints:state.countPoints===true,worksheetTask:state.worksheetTask,repeating:state.repeating,legacyAttempt:state.legacyAttempt};}
function save(passive=false){
 if((storageBlocked||LP&&!LP.isSupported(progress.learning))&&!resetting){memory=true;return;}
 let currentRaw;
 try{
  currentRaw=localStorage.getItem(STORAGE_KEY);
  if((passive||booting||state.view==='placevalue'&&!userIntent)&&currentRaw!==lastStoredRaw)return;
  if(!resetting&&currentRaw!==lastStoredRaw){
   let latest;try{latest=JSON.parse(currentRaw||'{}');if(!record(latest))throw Error('invalid');}catch(_){storageBlocked=true;memory=true;return;}
   if(foreignPvConflict(latest)){blockPvWrite(latest);return;}
   mergeStoredAchievements(currentRaw);
  }
 }catch(_){memory=true;return;}
 if(state.view==='placevalue'&&state.pvConflict)return;
 captureDrafts();
 if(state.view==='trainer'){progress.lastLesson=state.lesson;progress.session=sessionSnapshot();progress.modeSessions[`${state.lesson}:${state.mode}`]=progress.session;}
 else if(state.view==='workshop')progress.workshop={zones:JSON.parse(JSON.stringify(state.zones)),target:state.freeTarget,countPoints:state.countPoints===true};
 else if(state.view==='placevalue'&&learningReady()&&pvDirty&&userIntent){
  progress.learning=LP.setActivity(progress.learning,A.snapshot(state),{ownerId:writerId,revision:Math.max(pvSeenRevision,progress.learning.activity?.revision||0)+1});pvSeenRevision=progress.learning.activity.revision;
 }
 progress.lastView=state.view;
 try{const raw=JSON.stringify(progress);localStorage.setItem(STORAGE_KEY,raw);lastStoredRaw=raw;pendingModeAwards.clear();pendingReadAwards.clear();resetting=false;memory=false;storageBlocked=false;pvDirty=false;userIntent=false;}catch(_){memory=true;}
}

// Stage 1 adds observations and one new activity snapshot to the existing key.
// Legacy lesson IDs, ledgers and session v2 remain their original owners.
function learningReady(){return !!(LP&&A&&LP.isSupported(progress.learning));}
function cleanLegacyAttempt(value){
 if(!LP||!record(value)||typeof value.taskId!=='string'||!/^math\.legacy\./.test(value.taskId)||!Array.isArray(value.skillIds))return null;
 try{const result=LP.attempt(value.taskId,value.skillIds,{attemptId:value.attemptId,generation:value.generation||progress.resetEpoch,mode:value.mode,evidenceKind:'calculation-and-model'});result.firstOutcome=['correct','incorrect'].includes(value.firstOutcome)?value.firstOutcome:'notchecked';result.errors=Number.isInteger(value.errors)?Math.min(1000,Math.max(0,value.errors)):0;for(const kind of ['explanation','visual','workedExample'])if(value.assistance?.[kind])LP.help(result,kind);if(value.assistance?.afterError){result.assistance.afterError=true;result.firstOutcome='incorrect';}return result;}catch(_){return null;}
}
function startLegacyAttempt(){if(!LP||state.mode==='learn')return null;const t=task();return LP.attempt('math.legacy.'+state.lesson+'.'+activeTaskMode()+'.'+(state.demo?'demo':state.index),['math.arithmetic.'+(t.op==='+'?'add':'subtract')],{generation:progress.resetEpoch,mode:activeTaskMode(),evidenceKind:'calculation-and-model'});}
function legacyHelp(kind){if(LP&&state.view==='trainer'&&state.mode!=='learn'){if(!state.legacyAttempt)state.legacyAttempt=startLegacyAttempt();LP.help(state.legacyAttempt,kind);}}
function observeLegacy(outcome){if(!learningReady()||state.view!=='trainer'||state.mode==='learn')return;if(!state.legacyAttempt)state.legacyAttempt=startLegacyAttempt();if(outcome==='incorrect')legacyHelp('error');progress.learning=LP.record(progress.learning,{...state.legacyAttempt,outcome});}
function observePv(event){if(!learningReady()||state.pvConflict)return;progress.learning=LP.record(progress.learning,{...event,generation:state.pv.attempt?.generation||progress.resetEpoch});pvDirty=true;}
function pvEnv(){return {K,P,LP,esc,pieces,bank,zone,exchangeTools,icon,learning:progress.learning,generation:progress.resetEpoch,observe:observePv};}
function adoptPv(wrapper){if(!learningReady()||!wrapper?.state)return false;const value=A.restore(wrapper.state,K,LP);if(!value)return false;Object.assign(state,value);state.pvConflict=false;pvSeenRevision=wrapper.revision||0;pvDirty=false;$('#app').dataset.context='';return true;}
function openPlaceValue(track='practice',id){
 save();if(!learningReady()){feedback('Новые упражнения пока недоступны: открой актуальную версию. Сохранённые результаты не изменены.');render();return;}
 const wrapper=progress.learning.activity,current=wrapper&&A.restore(wrapper.state,K,LP);
 if(!id&&current&&current.pv.track===track&&!current.pv.finished)adoptPv(wrapper);
 else{A.start(state,track,K,LP,progress.learning,id);if(state.pv.attempt)state.pv.attempt.generation=progress.resetEpoch;pvSeenRevision=wrapper?.revision||0;pvDirty=true;}
 userIntent=true;renderFresh();
}
function reloadPlaceValue(){
 let raw,latest;try{raw=localStorage.getItem(STORAGE_KEY);latest=JSON.parse(raw||'{}');if(!record(latest))throw Error('invalid');}catch(_){storageBlocked=true;memory=true;return;}
 progress={...latest};progress.resetEpoch=typeof latest.resetEpoch==='string'?latest.resetEpoch:'initial';
 progress.solved=cleanMarks(latest.solved);const modes=record(latest.modeSolved)&&latest.modeSolved.version===1;progress.modeSolved={version:1,play:modes?cleanMarks(latest.modeSolved.play):{...progress.solved},worksheet:modes?cleanMarks(latest.modeSolved.worksheet):{}};
 for(const mode of ['play','worksheet'])Object.assign(progress.solved,progress.modeSolved[mode]);
 progress.read=Array.isArray(latest.read)?latest.read.filter(validLesson):[];progress.worksheet=cleanWorksheet(latest.worksheet);progress.modeSessions=record(latest.modeSessions)?latest.modeSessions:{};
 progress.learning=LP.clean(latest.learning,progress.resetEpoch);lastStoredRaw=raw;
 if(!adoptPv(progress.learning.activity)){A.start(state,'diagnostic',K,LP,progress.learning);if(state.pv.attempt)state.pv.attempt.generation=progress.resetEpoch;pvDirty=false;}
 state.pvConflict=false;userIntent=false;renderFresh();
}
function foreignPvConflict(latest){
 if(state.view!=='placevalue'||!LP)return false;
 const epoch=typeof latest.resetEpoch==='string'?latest.resetEpoch:'initial',incoming=LP.clean(latest.learning,epoch)?.activity;
 return epoch!==progress.resetEpoch||!!(incoming&&incoming.ownerId!==writerId&&incoming.revision>pvSeenRevision);
}
function blockPvWrite(latest){state.pvConflict=true;pvDirty=false;if(LP)progress.learning=LP.merge(progress.learning,latest.learning,{generation:typeof latest.resetEpoch==='string'?latest.resetEpoch:'initial'});announce('Эту работу продолжили в другой вкладке. Открой актуальное состояние.');}

function cleanMarks(value){return record(value)?Object.fromEntries(Object.entries(value).filter(([key,done])=>/^(?:[1-9]|[12][0-9]|3[0-6]):(?:[0-9]|1[0-7])$/.test(key)&&done===true)):{};}
function cleanWorksheet(value){return record(value)?Object.fromEntries(Object.entries(value).filter(([id,drafts])=>validLesson(Number(id))&&record(drafts)).map(([id,drafts])=>[id,Object.fromEntries(Object.entries(drafts).filter(([i,value])=>/^(?:[0-9]|1[0-5])$/.test(i)&&numericDraft(value)).map(([i,value])=>[i,numericDraft(value)]))])):{};}
function markRead(id){if(!progress.read.includes(id))progress.read.push(id);pendingReadAwards.add(id);}
function mergeStoredAchievements(raw){
 let latest;try{latest=JSON.parse(raw||'{}');}catch{return;}
 if(!record(latest))return;
 const owned=new Set(['resetEpoch','solved','read','worksheet','modeSolved','modeSessions','session','lastView','lastLesson','workshop','learning']);for(const [key,value]of Object.entries(latest))if(!owned.has(key))progress[key]=value;
 const epoch=typeof latest.resetEpoch==='string'&&latest.resetEpoch.length<100?latest.resetEpoch:raw===null?'cleared':'initial';
 if(LP)progress.learning=LP.merge(progress.learning,latest.learning,{generation:epoch});
 const sameEpoch=epoch===progress.resetEpoch,remoteSolved=cleanMarks(latest.solved),remoteModes=record(latest.modeSolved)&&latest.modeSolved.version===1?{play:cleanMarks(latest.modeSolved.play),worksheet:cleanMarks(latest.modeSolved.worksheet)}:{play:{...remoteSolved},worksheet:{}};
 const remoteRead=Array.isArray(latest.read)?latest.read.filter(validLesson):[];
 const remoteSessions=record(latest.modeSessions)?Object.fromEntries(Object.entries(latest.modeSessions).filter(([key])=>/^(?:[1-9]|[12][0-9]|3[0-6]):(?:learn|play|worksheet)$/.test(key))):{};
 if(sameEpoch){Object.assign(progress.solved,remoteSolved);progress.read=[...new Set([...progress.read,...remoteRead])];for(const mode of ['play','worksheet'])Object.assign(progress.modeSolved[mode],remoteModes[mode]);progress.modeSessions={...progress.modeSessions,...remoteSessions};}
 else{progress.solved=remoteSolved;progress.read=remoteRead;progress.modeSolved={version:1,...remoteModes};progress.modeSessions=remoteSessions;progress.worksheet=cleanWorksheet(latest.worksheet);progress.resetEpoch=epoch;for(const key of ['session','lastLesson','workshop']){if(Object.hasOwn(latest,key))progress[key]=latest[key];else delete progress[key];}}
 // Only awards earned since this document's last successful write may cross a reset.
 for(const award of pendingModeAwards){const [mode,id,index]=award.split(':');progress.modeSolved[mode][`${id}:${index}`]=true;progress.solved[`${id}:${index}`]=true;}
 for(const id of pendingReadAwards)if(!progress.read.includes(id))progress.read.push(id);
 for(const mode of ['play','worksheet'])Object.assign(progress.solved,progress.modeSolved[mode]);
}
function modeDone(mode,id,index){return progress.modeSolved[mode]?.[`${id}:${index}`]===true;}
function modeCount(id,mode){return Array.from({length:18},(_,i)=>modeDone(mode,id,i)).filter(Boolean).length;}
function lessonComplete(id){return progress.read.includes(id)&&modeCount(id,'play')===18&&modeCount(id,'worksheet')===18;}
function lessonPercent(id){return ((progress.read.includes(id)?1:0)+modeCount(id,'play')/18+modeCount(id,'worksheet')/18)/3*100;}
function activeTaskMode(){return state.mode==='worksheet'?'worksheet':'play';}
function stageStatus(id){return `Разбор ${progress.read.includes(id)?'✓':'○'} · Игра ${modeCount(id,'play')}/18 · Тетрадь ${modeCount(id,'worksheet')}/18`;}
function markModeDone(mode,id,index){progress.modeSolved[mode][`${id}:${index}`]=true;progress.solved[`${id}:${index}`]=true;pendingModeAwards.add(`${mode}:${id}:${index}`);}
function firstModeTask(id,mode,after=-1){for(let step=1;step<=18;step++){const index=(after+step)%18;if(!modeDone(mode,id,index))return index;}return -1;}
function startTask(lessonId,index,demo=false,mode='play'){
 state.view='trainer';state.lesson=lessonId;state.mode=mode;state.index=index;state.demo=demo;state.step=0;state.worksheetTask=mode==='worksheet';state.repeating=false;setup();
}
function startLearn(id,repeating=false){startTask(id,0,true);state.mode='learn';state.worksheetTask=false;state.repeating=repeating;setup();}
function startWorksheet(id){startTask(id,Math.max(0,firstModeTask(id,'worksheet')),false,'worksheet');state.worksheetTask=false;}
function restoreStage(id,mode){
 const value=readSession(progress.modeSessions[`${id}:${mode}`]);
 if(!value||value.solved||value.repeating||value.lesson!==id||value.mode!==mode)return false;
 if(mode==='play'&&!value.demo&&modeDone('play',id,value.index))return false;
 if(mode==='worksheet'&&value.worksheetTask&&modeDone('worksheet',id,value.index))return false;
 state.view='trainer';Object.assign(state,value);state.feedback=null;state.selected=null;return true;
}
function continueRoute(id=state.lesson){
 for(let current=id;current<=COURSE.length;current++){
  if(!progress.read.includes(current)){if(!restoreStage(current,'learn'))startLearn(current);return;}
  if(modeCount(current,'play')<18){if(!restoreStage(current,'play'))startTask(current,firstModeTask(current,'play'));return;}
  if(modeCount(current,'worksheet')<18){if(!restoreStage(current,'worksheet'))startWorksheet(current);return;}
 }
 state.view='progress';state.solved=false;state.repeating=false;
}
function resumeTraining(advance=true){
 const session=readSession(progress.session);
 if(session){
  state.view='trainer';Object.assign(state,session);state.feedback=null;state.selected=null;
  if(advance&&!state.repeating&&(session.solved||(session.mode==='worksheet'&&modeCount(session.lesson,'worksheet')===18)))continueRoute(session.lesson);
  return;
 }
 continueRoute(validLesson(Number(progress.lastLesson))?Number(progress.lastLesson):1);
}
function selectMode(mode){
 if(!['learn','play','worksheet'].includes(mode))return;
 if(mode==='learn')legacyHelp('explanation');save();state.learnFrame=0;const stored=readSession(progress.modeSessions[`${state.lesson}:${mode}`]);
 if(stored&&!stored.solved){state.view='trainer';Object.assign(state,stored);state.feedback=null;state.selected=null;}
 else if(mode==='learn')startLearn(state.lesson,progress.read.includes(state.lesson));
 else if(mode==='worksheet'){startWorksheet(state.lesson);state.repeating=modeCount(state.lesson,'worksheet')===18;}
 else{const index=firstModeTask(state.lesson,'play');startTask(state.lesson,index<0?0:index);state.repeating=index<0;}
 renderFresh();
}
function openPractice(index,mode=activeTaskMode()){
 if(!Number.isInteger(index)||index<0||index>=18)return;
 save();const id=state.lesson;startTask(id,index,false,mode);state.repeating=modeDone(mode,id,index);renderFresh();
}
function backToWorksheet(){save();state.worksheetTask=false;state.solved=false;state.repeating=false;state.feedback=null;state.answer='';$('#app').dataset.context='';renderFresh();}
function modeTabs(){return `<div class="mode-tabs" role="tablist" aria-label="Этапы урока">${[['learn','Разберёмся'],['play','Поиграем'],['worksheet','Тетрадь']].map(([mode,label],i)=>{const complete=mode==='learn'?progress.read.includes(state.lesson):modeCount(state.lesson,mode)===18;return `<button role="tab" aria-selected="${state.mode===mode}" class="${state.mode===mode?'active':''} ${complete?'stage-complete':''}" data-mode="${mode}"><span class="tab-num">${complete?'✓':'0'+(i+1)}</span><span>${label}<small>${mode==='learn'?(complete?'Понятно':'3 шага'):modeCount(state.lesson,mode)+' / 18'}</small></span></button>`;}).join('')}</div><p class="stage-sequence">Разберёмся → Поиграем → Тетрадь → следующий урок</p>`;}
function openWorkshop(){
 state.view='workshop';state.solved=false;state.feedback=null;state.selected=null;state.undo=[];
 const saved=record(progress.workshop)?progress.workshop:{};state.zones=cleanZones(saved.zones)||{a:K.empty(),b:K.empty(),removed:K.empty()};
 state.freeTarget=Number.isInteger(saved.target)&&saved.target>=0&&saved.target<=R.MAX?saved.target:23;
 if('countPoints' in state)state.countPoints=saved.countPoints===true;
}
function taskMap(){const mode=activeTaskMode();return `<section class="task-route" aria-label="Задания текущего этапа"><div class="task-route-heading"><strong>${mode==='worksheet'?'Задания тетради':'Задания игры'}</strong><span>${modeCount(state.lesson,mode)} из 18 решено</span></div><div class="task-route-grid">${tasks().map((t,i)=>{const done=modeDone(mode,state.lesson,i),active=state.mode!=='learn'&&!state.demo&&state.index===i&&(state.mode!=='worksheet'||state.worksheetTask);return `<button class="task-route-item ${done?'done':''} ${active?'current':''}" data-practice="${i}" data-owner="${mode}" ${active?'aria-current="step"':''} aria-label="Задание ${i+1}: ${done?'решено в этом режиме, можно повторить':'ещё не решено в этом режиме'}${active?', текущее':''}"><span>${i+1}</span>${done?icon('check'):'<span class="task-route-dot" aria-hidden="true"></span>'}</button>`;}).join('')}</div><p class="task-route-legend"><span>✓ Решено в выбранном режиме</span><span>Контур — текущее задание</span><span>Точка — ещё впереди</span></p></section>`;}


const lesson=()=>COURSE[state.lesson-1];
const tasks=()=>[...lesson().exercises,...lesson().draw];
const task=()=>state.view==='placevalue'?A.current(state.pv):state.demo?{...lesson().example,answer:lesson().example.result,missing:'result'}:tasks()[state.index];
const solvedCount=id=>Array.from({length:18},(_,i)=>!!progress.solved[`${id}:${i}`]).filter(Boolean).length;
const allSolved=()=>COURSE.reduce((sum,l)=>sum+solvedCount(l.id),0);
function announce(s){$('#live').textContent=s;}
function isBuild(){if(state.view==='placevalue')return A.current(state.pv)?.kind==='build';return state.view==='workshop'||(!state.demo&&(state.index>=16||task().missing!=='result'));}
function setup(){
 stopVoice();
 const t=task();state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};
 if(!isBuild()){state.zones.a=modelParts(t.a);if(t.op==='+')state.zones.b=modelParts(t.b);}
 state.feedback=null;state.solved=false;state.selected=null;state.undo=[];state.answer='';state.learnFrame=0;state.legacyAttempt=startLegacyAttempt();$('#app').dataset.context='';
}
function chooseLesson(id){if(!validLesson(id))return;if(state.view==='placevalue'&&state.pv){A.assist(state,'explanation',LP);pvDirty=true;}save();const session=readSession(progress.session);if(session&&session.lesson===id&&!session.solved){resumeTraining(false);}else if(lessonComplete(id))startLearn(id,true);else continueRoute(id);renderFresh();window.scrollTo({top:0,behavior:'smooth'});}
function tasksFor(id){return [...COURSE[id-1].exercises,...COURSE[id-1].draw];}
function history(){state.undo.push(JSON.stringify(state.zones));if(state.undo.length>60)state.undo.shift();}
function feedback(text,type='hint'){state.feedback={text,type};announce(text);}

function presentationPolicy(frame){return P.visibility({context:state.view==='placevalue'?(state.pv?.teaching?'teaching':state.solved&&!state.pv?.skipped&&!(A.current(state.pv)?.id==='pv.arithmetic.add.15.12'&&!state.pv.meaningDone)?'reviewed':'independent'):state.view==='trainer'&&state.mode!=='learn'?(state.solved?'reviewed':'independent'):'teaching',frame:frame});}
function lessonName(value){return presentationPolicy().context==='independent'?`Урок ${value.id}. ${value.example.op==='+'?'Сложение':'Вычитание'}`:value.title;}
function lessonRule(value){return presentationPolicy().context==='independent'?'Считай предметы на поле. Обмен меняет способ представления, а количество остаётся тем же.':value.rule;}
function hasHundred(zones){return Object.values(zones).some(p=>p&&p.hundred>0);}
function modelParts(n){return P.unitsOnly(n,K);}
function quantitySummary(p,frame){const info=P.describe(p,K),policy=presentationPolicy(frame);if(!policy.showRepresentation)return `<div class="quantity-summary" data-presentation-context="independent">Посчитай сотни, десятки и единицы на поле</div>`;return `<div class="quantity-summary" data-presentation-context="${policy.context}"><strong data-actual>${info.actualText}</strong><span data-expanded>${info.expandedText}${policy.showTotal?` = <b data-total>${info.total}</b>`:''}</span>${policy.showCanonical?`<span data-standard>Стандартная запись: ${info.canonicalText}</span>`:''}</div>`;}
const explanationCache={};
function learningPlan(){const t=lesson().example,key=state.lesson+':'+t.a+':'+t.op+':'+t.b;if(!explanationCache[key])explanationCache[key]=P.explanation(t,K);return explanationCache[key];}
function learningFrame(){const plan=learningPlan();return state.step===0?plan.initial:state.step===2?plan.final:plan.transformations[Math.min(state.learnFrame||0,plan.transformations.length-1)];}
function advanceExplanation(delta){
 stopVoice();M.cancel();const old=learningFrame(),snapshot=M.capture($('.learn-visual [data-learn-zone="a"]'),K),plan=learningPlan();
 if(delta<0){if(state.step===2){state.step=1;state.learnFrame=plan.transformations.length-1;}else if(state.step===1&&(state.learnFrame||0)>0)state.learnFrame--;else state.step=0;}
 else if(state.step===0){state.step=1;state.learnFrame=0;}
 else if(state.step===1&&(state.learnFrame||0)<plan.transformations.length-1)state.learnFrame=(state.learnFrame||0)+1;
 else if(state.step===1)state.step=2;
 else{markRead(state.lesson);save();continueRoute(state.lesson);renderFresh();return;}
 render();const next=learningFrame();if(delta>0&&['pack','split','pack100','split100'].includes(next.operation))M.animate($('.learn-visual [data-learn-zone="a"]'),snapshot,old.zones.a,next.zones.a,K,{action:next.operation});
}
function exchangeAvailable(p,action){if(K.canExchange)return K.canExchange(p,action);return action==='pack'?p.unit>=10:action==='split'?p.ten>0:action==='pack100'?p.ten>=10:action==='split100'?p.hundred>0:false;}
function exchangeOnBoard(action){
 if(M.isBusy())return;const before=JSON.parse(JSON.stringify(state.zones.a)),snapshot=M.capture($('[data-zone="a"]'),K);let changed=false;
 mutate(()=>{changed=K.exchange(state.zones.a,action);return changed;});if(!changed)return;
 const after=JSON.parse(JSON.stringify(state.zones.a)),policy=presentationPolicy();M.animate($('[data-zone="a"]'),snapshot,before,after,K,{action});
 const message=policy.context==='independent'?'Обмен выполнен. Количество осталось тем же.':P.describe(before,K).actualText+' → '+P.describe(after,K).actualText+'. Количество '+K.total(after)+' не изменилось.';
 const tools=$('.exchange-tools');if(tools){const note=document.createElement('div');note.className='pv-exchange-note';note.textContent=message;tools.appendChild(note);}announce(message);
}

function nice(n){if(n===1000)return '10 сотен — одна тысяча';return `${Math.floor(n/100)?Math.floor(n/100)+' сот. · ':''}${Math.floor(n/10)%10} дес. · ${n%10} ед.`;}
function piece(type,zone,mini=false,offset=0){
 const val=K.values[type],cols={unit:1,double:2,five:5,ten:5,hundred:10}[type],rows=type==='hundred'?10:type==='ten'?2:1;
 const label=type==='hundred'?'Пластина на 100 точек':`Деталь на ${val} ${val===1?'точку':val===2?'точки':'точек'}`;
 return `<button type="button" class="piece brick ${type}${mini?' mini':''}" style="--cols:${cols};--rows:${rows}" ${mini?'tabindex="-1" aria-hidden="true"':`data-piece="${type}" data-from="${zone}" aria-label="${label}. ${zone==='bank'?'Добавить на поле':'Выбрать для перемещения'}"`}><span class="brick-studs" aria-hidden="true">${Array.from({length:val},(_,i)=>`<i class="stud" data-n="${offset+i+1}"></i>`).join('')}</span><span class="sr-only">${val}</span></button>`;
}
function pieces(p,zone,mini=false){let offset=0;return ['hundred','ten','five','double','unit'].map(type=>Array.from({length:p[type]},()=>{const html=piece(type,zone,mini,offset);offset+=K.values[type];return html;}).join('')).join('');}
function pointCount(n){const last=n%10,teen=n%100;return `${n} ${last===1&&teen!==11?'точка':last>=2&&last<=4&&(teen<12||teen>14)?'точки':'точек'}`;}
function visual(n){return `<div class="mini-pieces">${pieces(K.parts(n),'',true)||'<span class="zero">0</span>'}</div><span class="quantity-label">${pointCount(n)}</span>`;}
function equation(t,showAnswer=false){let a=t.missing==='a'&&!showAnswer?'?':t.a,b=t.missing==='b'&&!showAnswer?'?':t.b,r=(t.missing==='result'||!t.missing)&&!showAnswer?'?':t.result;return `<div class="equation"><span class="${a==='?'?'eq-answer':''}">${a}</span><span class="operator">${t.op==='-'?'−':'+'}</span><span class="${b==='?'?'eq-answer':''}">${b}</span><span class="operator">=</span><span class="${r==='?'?'eq-answer':''}">${r}</span></div>`;}
function shell(content){const done=allSolved();return `<div class="app-shell">
<aside class="sidebar"><a class="brand" href="#" data-action="home"><span class="brand-icon">${icon('cube')}</span><span><span class="brand-name">детальки<span class="brand-dot">.</span></span><span class="brand-sub">Считаем. Соединяем. Строим.</span></span></a>
<div class="side-label">УЧИМСЯ И ИГРАЕМ</div><nav aria-label="Основная навигация">${[['trainer','play','Тренажёр'],['course','grid','Все уроки'],['workshop','build','Мастерская'],['progress','chart','Мои успехи']].map(([view,ic,name])=>`<button class="nav-btn ${state.view===view?'active':''}" data-view="${view}" aria-label="${name}" ${state.view===view?'aria-current="page"':''}><span class="nav-icon">${icon(ic)}</span><span>${name}</span>${view==='course'?'<span class="nav-count">36</span>':''}</button>`).join('')}<button class="nav-btn ${state.view==='placevalue'&&state.pv?.track==='practice'?'active':''}" data-pv-open="practice"><span class="nav-icon">${icon('build')}</span><span>Сотни и разряды</span></button><button class="nav-btn ${state.view==='placevalue'&&state.pv?.track==='diagnostic'?'active':''}" data-pv-open="diagnostic"><span class="nav-icon">${icon('bulb')}</span><span>Короткая проверка</span></button></nav>
<div class="sidebar-illustration"><div class="deco-cube one"></div><div class="deco-cube two"></div><div class="deco-cube three"></div><span>Большие открытия<br>из маленьких деталей</span></div>
<div class="sidebar-bottom"><div class="mini-progress"><div><strong>Твой путь</strong><span>${done} / 648</span></div><div class="progress-bar"><i style="width:${done/648*100}%"></i></div><small>Каждая точка — шаг вперёд</small></div><button class="nav-btn" data-action="help">${icon('help')}<span>Как здесь играть</span></button></div></aside>
<main class="main"><header class="topbar"><div class="topbar-context"><a class="hub-link" href="../" aria-label="На главную — выбор игр">${icon('left')}<span>Все игры</span></a><div class="breadcrumb">Математика <span>/</span> <strong>${{trainer:'Тренажёр',course:'Все уроки',workshop:'Мастерская',progress:'Мои успехи',placevalue:'Сотни и разряды'}[state.view]}</strong></div></div><div class="top-actions"><span class="pill grade-pill">2 класс</span><span class="pill star-pill">${icon('star')} ${done}</span><button class="icon-btn" data-action="help" aria-label="Помощь">${icon('help')}</button></div></header>${content}<footer class="app-footer">Детальки · на основе курса «Математика в кубиках» <span>36 уроков до 100 · разряды до 1000</span></footer></main></div>`;}
function intro(eyebrow,title,note){return `<div class="page-intro"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${note}</p></div><div class="intro-note"><span class="small-spark">✦</span> Можно потрогать.<br>Легче понять.</div></div>`;}
function trainer(){const l=lesson(),count=solvedCount(l.id);return intro('МАЛЕНЬКИЕ ШАГИ. БОЛЬШИЕ ОТКРЫТИЯ.','Строим числа из деталей','Как с LEGO: считаем точки, соединяем детали и открываем математику.')+`<div class="learning-layout"><section class="lesson-panel" aria-labelledby="lesson-title"><div class="lesson-heading"><span class="lesson-number">${String(l.id).padStart(2,'0')}</span><div><div class="lesson-meta">УРОК ${l.id} ИЗ 36 <span>·</span> ${esc(l.section.split('•')[1]?.trim()||'Математика')}</div><h2 id="lesson-title" class="lesson-title">${esc(lessonName(l))}</h2></div><button class="icon-btn read-button" data-action="speak" aria-label="${voicePlaying?'Остановить озвучку':'Послушать задание женским голосом'}" aria-pressed="${voicePlaying}" title="${voicePlaying?'Остановить':'Послушать'}">${icon(voicePlaying?'close':'sound')}</button></div>${modeTabs()}${taskMap()}${state.mode==='learn'?learnView():state.mode==='worksheet'?(state.worksheetTask?`<div class="worksheet-board-nav"><span>Тетрадь · задание ${state.index+1}</span><button class="btn ghost" data-action="back-worksheet">Ко всей тетради</button></div>${playView()}`:worksheet()):playView()}<div class="lesson-footer"><button class="btn ghost" data-action="prev-lesson" ${l.id===1?'disabled':''}>${icon('left')} Предыдущий урок</button><button class="btn ghost" data-view="course">Все 36 уроков ${icon('grid')}</button></div></section>
<aside class="lesson-aside"><div class="tip-card rule-card"><span class="tip-icon">${icon('bulb')}</span><div class="eyebrow">СЕКРЕТ УРОКА</div><h3>Сначала — понять</h3><p>${esc(lessonRule(l))}</p><div class="point-rule"><i class="legend-unit"></i><strong>1 точка = 1 единица</strong></div><div class="legend"><span><i class="legend-double"></i>2 точки</span><span><i class="legend-five"></i>5 точек</span><span><i class="legend-ten"></i>10 = десяток</span></div><p class="brick-info">Считай точки на деталях. У разных деталей разное количество точек. Число — сумма всех точек.</p></div><div class="tip-card journey-card"><div class="card-head"><h3>Урок за уроком</h3><span class="lesson-stage-status">${stageStatus(l.id)}</span></div><div class="lesson-list">${COURSE.slice(Math.max(0,Math.min(l.id-2,33)),Math.max(0,Math.min(l.id-2,33))+3).map(x=>`<button class="lesson-list-item ${x.id===l.id?'active':''}" data-lesson="${x.id}"><span class="list-number">${lessonComplete(x.id)?icon('check'):String(x.id).padStart(2,'0')}</span><span>${esc(lessonName(x))}</span>${x.id===l.id?'<i class="active-dot"></i>':''}</button>`).join('')}</div><button class="btn ghost full-width" data-view="course">Открыть все уроки ${icon('arrow')}</button></div><div class="gentle-note">${icon('star')} Здесь можно ошибаться.<br>Попробуй ещё — ты научишься!</div></aside></div>`;}
function learnView(){const t=lesson().example,frame=learningFrame(),plan=learningPlan();const model=(zone,title)=>`<div class="pv-model" data-learn-zone="${zone}"><span class="zone-title">${title}</span><div class="mini-pieces">${pieces(frame.zones[zone],'',true)||'<span class="zero">Нет предметов</span>'}</div>${quantitySummary(frame.zones[zone],frame)}</div>`;return `<div class="activity-wrap learn-wrap"><div class="activity-top"><span class="step-tag">РАЗБИРАЕМ ВМЕСТЕ</span><span class="muted">Шаг ${state.step+1} из 3</span></div>${equation({...t,missing:'result'},state.step===2)}<div class="read-step"><span class="read-number">${state.step+1}</span><div class="read-content"><h3>${frame.label}</h3><p>${frame.caption}</p>${state.step===1?`<span class="pv-learning-status">Действие ${(state.learnFrame||0)+1} из ${plan.transformations.length}</span>`:''}</div></div><div class="learn-visual pv-learning ${hasHundred(frame.zones)?'has-hundred':''}" data-learn-phase="${frame.phase}" data-learn-operation="${frame.operation}" data-learn-frame="${state.learnFrame||0}">${model('a',state.step===0?'Первое количество':'На поле')}${((t.op==='+'&&state.step===0)||K.total(frame.zones.b)>0)?`<b aria-hidden="true">+</b>${model('b','Добавляем')}`:''}${K.total(frame.zones.removed)>0?model('removed','Убрали'):''}</div>${frame.conservationText?`<div class="pv-conservation"><strong>${frame.conservationText}</strong>Количество не изменилось — изменился способ представления.</div>`:''}<div class="board-actions"><button class="btn secondary" data-action="learn-back" ${state.step===0?'disabled':''}>${icon('left')} Назад</button><button class="btn primary" data-action="learn-next">${frame.actionLabel} ${icon('arrow')}</button></div></div>`;}
function zone(key,title,caption){const p=state.zones[key],empty=K.total(p)===0;return `<div class="zone ${key==='removed'?'removed-zone':''}" data-zone="${key}" role="group" aria-label="${title}"><div class="zone-header"><span class="zone-title">${title}</span><span class="zone-caption">${caption}</span></div><div class="pieces">${pieces(p,key)}${empty?`<span class="empty-state">Здесь пока нет предметов</span>`:''}</div><div class="zone-value">${quantitySummary(p)}</div></div>`;}
function exchangeTools(){const p=state.zones.a,composite=K.values.double!==undefined,extra=composite&&(state.view==='workshop'||p.double>0||p.five>0);const button=(action,label)=>`<button class="btn secondary small" data-exchange="${action}" ${!exchangeAvailable(p,action)||state.solved?'disabled':''}>${label}</button>`;return `<div class="exchange-tools"><div class="exchange-head"><span class="muted">Обмен на поле: количество не меняется</span>${composite&&presentationPolicy().showTotal?`<button class="btn ghost count-toggle" data-action="count-points" aria-pressed="${state.countPoints}">${state.countPoints?'Скрыть номера точек':'Посчитать точки'}</button>`:''}</div><div class="exchange-buttons">${extra?button('pack2','1 + 1 → деталь 2')+button('pack5','5 единиц → деталь 5'):''}${button('pack','10 единиц → десяток')}${button('split','Десяток → 10 единиц')}${extra?button('split2','2 → 1 + 1')+button('split5','5 → пять единиц'):''}${p.ten>=10||p.hundred>0?button(p.ten>=10?'pack100':'split100',p.ten>=10?'10 десятков → сотня':'Сотня → 10 десятков'):''}</div>${composite&&K.small(p)>=10&&!exchangeAvailable(p,'pack')?'<p class="pv-action-note">Для точного обмена сначала разбери деталь на 2 или 5 единиц.</p>':''}</div>`;}
function bank(){return `<div class="toolbox brick-catalog" data-zone="bank" role="group" aria-label="Коробка — верни сюда лишние детали"><div class="tool-copy"><strong>Выбери деталь</strong><span>Нажми или перетащи. Лишнее верни сюда.</span></div><div class="bank-pieces">${(state.view==='workshop'?K.types:['unit','ten','hundred']).map(type=>`<div>${piece(type,'bank')}<small>${K.values[type]} ${type==='unit'?'точка':type==='double'?'точки':'точек'}</small></div>`).join('')}</div></div>`;}
function playView(){const t=task(),build=isBuild();let instruction=build?(t.missing!=='result'?'Найди пропущенное число и собери столько точек на деталях.':'Реши пример и собери ответ из деталей. Считай точки!'):(t.op==='+'?'Соедини детали: перенеси их справа налево и сосчитай точки.':`Убери вправо ${pointCount(t.b)} на деталях. Если нужно — разбери деталь.`);return `<div class="activity-wrap"><div class="activity-top"><span class="step-tag">${state.demo?'ПРОБНЫЙ ПРИМЕР':state.index>=16?'СОБИРАЕМ ОТВЕТ':'ТВОЯ ОЧЕРЕДЬ'}</span><span class="muted">${state.demo?'Учимся без спешки':`Задание ${state.index+1} из 18`}</span></div>${!state.demo&&modeDone(activeTaskMode(),state.lesson,state.index)?'<p class="task-completed-note">✓ Это задание уже решено в этом режиме. Сейчас можно повторить.</p>':''}${equation(t,state.solved)}<p class="activity-instruction">${instruction}</p><div class="interaction-note">${icon('build')} Перетаскивай мышкой или пальцем. Можно нажать на деталь, затем на область.</div><div class="board ${build?'single-board':''} ${hasHundred(state.zones)?'has-hundred':''}">${zone('a',build?'Твоя сборка':t.op==='+'?'Собираем вместе':'Что осталось',build?'Собери пропущенное число точками':t.op==='+'?'Переноси сюда →':'Оставь ответ на поле')}${!build?zone(t.op==='+'?'b':'removed',t.op==='+'?'Добавляем':'Убираем',t.op==='+'?`Всего ${pointCount(t.b)}`:`Убери ${pointCount(t.b)}`):''}</div>${build?bank():''}${exchangeTools()}<div class="board-actions"><div class="action-buttons"><button class="btn ghost" data-action="reset" title="Начать пример заново">${icon('reset')} Заново</button><button class="btn ghost" data-action="undo" ${!state.undo.length||state.solved?'disabled':''}>Отменить</button></div>${!build&&t.op==='+'?`<button class="btn secondary" data-action="combine" ${K.total(state.zones.b)===0||state.solved?'disabled':''}>Соединить всё ${icon('arrow')}</button>`:''}<button class="btn ghost hint-button" data-action="hint">${icon('bulb')} Подсказка</button></div><div class="answer-row"><label for="answer">${t.missing!=='result'?'Пропущенное число':'Мой ответ'}<input id="answer" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="?" value="${state.solved?t.answer:esc(state.answer)}" ${state.solved?'disabled':''}></label><button class="btn primary" data-action="${state.solved?'next-task':'check'}">${state.solved?(state.repeating?'Продолжить маршрут':'Дальше'): 'Проверить'} ${icon(state.solved?'arrow':'check')}</button></div>${feedbackView()}</div>`;}
function feedbackView(){return state.feedback?`<div class="feedback ${state.feedback.type}" role="status">${icon(state.feedback.type==='success'?'check':'bulb')}<span>${esc(state.feedback.text)}</span></div>`:'';}
function worksheet(){let ts=tasks();return `<div class="activity-wrap"><div class="activity-top"><span class="step-tag">РАБОЧАЯ ТЕТРАДЬ</span><span class="muted">16 примеров + 2 сборки</span></div><p class="worksheet-intro">Впиши пропущенные числа. Если трудно — открой пример с деталями.</p><div class="worksheet-grid">${ts.slice(0,16).map((t,i)=>{let solved=modeDone('worksheet',state.lesson,i);return `<div class="worksheet-item ${solved?'solved':''}" data-ws="${i}"><small>${i+1}.</small><div class="ws-equation">${t.missing==='a'?wsInput(i,t,solved):t.a} ${t.op==='-'?'−':'+'} ${t.missing==='b'?wsInput(i,t,solved):t.b} = ${t.missing==='result'?wsInput(i,t,solved):t.result}</div><button class="icon-btn" data-practice="${i}" data-owner="worksheet" aria-label="Пример ${i+1}: решить с деталями">${icon('cube')}</button></div>`;}).join('')}</div><div class="board-actions"><button class="btn ghost" data-action="hint">${icon('bulb')} Помощь</button><button class="btn primary" data-action="check-worksheet">Проверить ответы ${icon('check')}</button></div>${feedbackView()}<div class="draw-tasks"><h3>А теперь собери ответ</h3><p class="muted">Вместо рисунка в тетради — сборка из деталей.</p>${ts.slice(16).map((t,i)=>`<button class="draw-task ${modeDone('worksheet',state.lesson,i+16)?'done':''}" data-practice="${i+16}" data-owner="worksheet"><span class="list-number">${i+17}</span><strong>${t.a} ${t.op==='-'?'−':'+'} ${t.b} = ?</strong><span>${modeDone('worksheet',state.lesson,i+16)?'✓ Решено · повторить':'Собрать'} ${icon('arrow')}</span></button>`).join('')}</div></div>`;}
function wsInput(i,t,solved){return `<input type="text" inputmode="numeric" maxlength="4" autocomplete="off" data-ws-input="${i}" aria-label="Пропущенное число в примере ${i+1}: ${esc(t.text)}" value="${solved?t.answer:esc(progress.worksheet[state.lesson]?.[i]||'')}" ${solved?'disabled':''}>`;}
function courseView(){const sections=[...new Set(COURSE.map(l=>l.section))];return intro('ОТ ПЕРВОЙ ТОЧКИ ДО СОТНИ','Твой маршрут открытий','Все уроки открыты. Начни с первого или выбери то, что хочется потренировать.')+sections.map(s=>`<section class="course-section"><div class="section-heading"><h2>${esc(s.split('•')[1].trim())}</h2><span>${COURSE.filter(l=>l.section===s).length} уроков</span></div><div class="course-grid">${COURSE.filter(l=>l.section===s).map(l=>`<button class="course-card ${state.lesson===l.id?'selected':''} ${lessonComplete(l.id)?'done':''}" data-lesson="${l.id}"><div class="course-card-top"><span class="course-card-number">${String(l.id).padStart(2,'0')}</span><span class="muted">${solvedCount(l.id)}/18 ${lessonComplete(l.id)?'✓':''}</span></div><h3>${esc(lessonName(l))}</h3><p>${l.example.a} ${l.example.op==='-'?'−':'+'} ${l.example.b} = ?</p><div class="progress-bar"><i style="width:${lessonPercent(l.id)}%"></i></div><small class="lesson-stage-status">${stageStatus(l.id)}</small><span class="course-card-link">Открыть урок ${icon('arrow')}</span></button>`).join('')}</div></section>`).join('');}
function workshop(){return intro('МЕСТО ДЛЯ ЭКСПЕРИМЕНТОВ','Мастерская чисел','Собери число из деталей и сосчитай точки. Одинаковое число можно построить по-разному.')+`<section class="lesson-panel workshop-panel"><div class="lesson-heading"><span class="lesson-number">${icon('build')}</span><div><h2 class="lesson-title">Что построим сегодня?</h2><p class="lesson-subtitle">1 точка — единица. В детали-десятке — 10 точек. На пластине — 100.</p></div></div><div class="activity-wrap"><div class="free-controls"><label for="free-target">Собери число <input id="free-target" type="number" min="0" max="1000" value="${state.freeTarget}"></label><button class="btn secondary" data-action="random-target">Другое число ↻</button></div><div class="board single-board ${hasHundred(state.zones)?'has-hundred':''}">${zone('a','Твоя мастерская','Нажми на деталь на поле, чтобы вернуть её в коробку')}</div>${bank()}${exchangeTools()}<div class="board-actions"><div class="action-buttons"><button class="btn ghost" data-action="reset">${icon('reset')} Очистить</button><button class="btn ghost" data-action="undo" ${!state.undo.length?'disabled':''}>Отменить</button></div><button class="btn primary" data-action="check-free">Проверить сборку ${icon('check')}</button></div>${feedbackView()}<div class="tip-inline">${icon('bulb')} Две детали с 1 точкой и одна деталь с 2 точками — одно и то же число. Считай точки, а не детали.</div></div></section>`;}
function progressView(){const count=allSolved(),complete=COURSE.filter(l=>lessonComplete(l.id)).length;return intro('ТЫ УЖЕ СТОЛЬКО УМЕЕШЬ','Каждый шаг считается','Здесь растёт твоя коллекция маленьких побед.')+`<div class="stat-row"><div class="stat-card"><span class="stat-icon">${icon('check')}</span><strong>${count}<small> / 648</small></strong><span>заданий решено</span></div><div class="stat-card"><span class="stat-icon lavender">${icon('grid')}</span><strong>${complete}<small> / 36</small></strong><span>уроков пройдено</span></div><div class="stat-card"><span class="stat-icon gold">${icon('star')}</span><strong>${Math.round(COURSE.reduce((sum,l)=>sum+lessonPercent(l.id),0)/36)}<small>%</small></strong><span>всего курса</span></div></div><section class="lesson-panel progress-panel"><h2>Твоя карта уроков</h2><div class="progress-map">${COURSE.map(l=>`<button class="map-item ${lessonComplete(l.id)?'done':solvedCount(l.id)||progress.read.includes(l.id)?'started':''}" data-lesson="${l.id}" aria-label="Урок ${l.id}: ${esc(lessonName(l))}, ${stageStatus(l.id)}"><span>${lessonComplete(l.id)?icon('check'):l.id}</span><small>И ${modeCount(l.id,'play')}/18 · Т ${modeCount(l.id,'worksheet')}/18</small></button>`).join('')}</div><p class="muted">${memory?'Хранилище браузера недоступно: прогресс сохраняется только до закрытия страницы.':'Прогресс сохраняется автоматически в этом браузере на этом устройстве.'}</p><div class="board-actions"><button class="btn ghost" data-action="reset-progress">Начать курс заново</button><button class="btn primary" data-view="trainer">Продолжить ${icon('arrow')}</button></div></section><div class="milestone">${icon('star')} ${count===0?'Первое открытие впереди. Начнём с одной точки?':count<18?'Отличное начало! Впереди ещё много открытий.':complete===36?'Все уроки пройдены. Ты настоящий мастер конструктора!':'Ты молодец! Продолжай в своём темпе.'}</div>`;}
function render(){
 M.cancel();
 captureDrafts();
 const context=contextKey();
 const same=$('#app').dataset.context===context;
 const focusId=document.activeElement?.id;
 const inputs=same?$$('[data-ws-input]').map(el=>({index:el.dataset.wsInput,value:el.value,wrong:el.getAttribute('aria-invalid')==='true'})):[];
 $('#app').innerHTML=shell(state.view==='placevalue'?A.render(state,pvEnv()):state.view==='trainer'?trainer():state.view==='course'?courseView():state.view==='workshop'?workshop():progressView());
 $('#app').dataset.context=context;
 if(storageBlocked||LP&&!LP.isSupported(progress.learning)){const warning=document.createElement('p');warning.className='feedback error';warning.textContent='Сохранённые данные требуют восстановления или более новой версии. Они не перезаписаны.';$('#app').prepend?.(warning);}
 $('#app').classList.toggle('show-counts',state.countPoints&&presentationPolicy(state.view==='trainer'&&state.mode==='learn'?learningFrame():null).showTotal);
 inputs.forEach(item=>{const el=$(`[data-ws-input="${item.index}"]`);if(el&&!el.disabled){el.value=item.value;if(item.wrong){el.setAttribute('aria-invalid','true');el.closest('.worksheet-item').classList.add('wrong');}}});
 if(focusId&&$('#'+focusId))$('#'+focusId).focus({preventScroll:true});
 if(state.selected){const el=$(`[data-from="${state.selected.from}"][data-piece="${state.selected.type}"]`);if(el)el.classList.add('selected-piece');}
 save();
}
function renderFresh(){$('#app').dataset.context='';render();}
function mutate(fn){if(state.solved||state.view==='placevalue'&&(state.pvConflict||A.current(state.pv)?.kind==='predict'&&!state.pv.predictionConfirmed))return;userIntent=true;history();if(fn()===false){state.undo.pop();return;}state.selected=null;state.feedback=null;if(state.view==='placevalue')pvDirty=true;render();}
function movePiece(from,to,type){mutate(()=>K.move(state.zones,from,to,type));$(`[data-zone="${to}"]`)?.focus({preventScroll:true});}
function hint(){
 legacyHelp('visual');
 if(state.mode==='worksheet'&&!state.worksheetTask){feedback('Впиши число в пустое окошко. Нажми на значок детали у примера, чтобы решить его на поле.');render();return;}
 const t=task(),p=state.zones.a;
 let text;
 if(isBuild())text=`Реши ${t.text||`${t.a} ${t.op} ${t.b} = ?`}, затем собери столько точек на деталях. Считай точки, не количество деталей.`;
 else if(t.op==='+')text=K.total(state.zones.b)>0?'Перенеси детали из правой группы в левую. Нажми «Соединить всё» или перетащи их.':K.small(p)>=10?'На мелких деталях уже 10 или больше точек. Нажми «10 точек → десяток».':p.ten>=10?'Десять десятков — это сотня. Собери пластину кнопкой обмена.':'Сосчитай все точки слева. Одна большая деталь может стоить столько же, сколько несколько маленьких.';
 else{const left=t.b-K.total(state.zones.removed);text=left<0?'Справа больше точек, чем нужно убрать. Верни лишние детали влево или отмени действие.':left===0?'Нужное количество уже убрано. Сосчитай точки, оставшиеся слева; полные десятки собери в детали по 10.':p.unit>0?`Осталось убрать ${pointCount(left)}. Переноси детали, считая точки сверху. Можно разбирать крупные детали.`:p.double>0?'Чтобы убрать одну точку из детали на 2, нажми «2 → 1 + 1».':p.five>0?'Нужна часть детали на 5 точек? Нажми «5 → пять одиночных».':p.ten>0?'Нужны отдельные точки? Нажми «10 → десять одиночных».':p.hundred>0?'Разбери пластину на 100 точек: получится 10 деталей-десятков.':`Справа должно быть ровно ${t.b} точек. Если ошибся, отмени действие.`;}
 feedback(text);render();
}
function checkAnswer(){const t=task(),raw=$('#answer').value.trim();if(!/^\d{1,4}$/.test(raw)){feedback('Впиши пропущенное число в окошко ответа.','error');render();$('#answer').focus();return;}
 if(Number(raw)!==t.answer){observeLegacy('incorrect');feedback('Пока не сходится. Посчитай точки ещё раз. Можно воспользоваться подсказкой.','error');render();return;}
 if(!K.check(t,state.zones,isBuild())){observeLegacy('incorrect');feedback(isBuild()?'Число верное! Теперь собери его на поле. Каждые 10 точек на мелких деталях собирай в десяток.':t.op==='+'?'Ответ верный! Осталось перенести все детали влево и собрать полные десятки.':'Ответ верный! Теперь покажи вычитание: убери нужное количество вправо, а ответ оставь слева.','hint');render();return;}
 const mode=activeTaskMode(),repeating=state.repeating;
 observeLegacy('correct');state.solved=true;state.selected=null;if(!state.demo)markModeDone(mode,state.lesson,state.index);save();
 if(!state.demo&&!repeating&&modeCount(state.lesson,mode)===18){const completed=mode;continueRoute(state.lesson);feedback(completed==='play'&&state.mode==='worksheet'?'Игра пройдена! Теперь решим задания тетради самостоятельно.':state.mode==='learn'?'Этап завершён. Сначала разберём правило урока.':'Этап завершён. Продолжаем маршрут.','success');render();celebrate();return;}
 feedback(state.demo?'Всё получилось! Теперь попробуй задания урока.':repeating?'Повторение получилось. Можно продолжить маршрут.':'Здорово! И ответ, и детали на своих местах.','success');render();celebrate();}
function nextTask(){
 stopVoice();
 if(state.repeating){continueRoute(state.lesson);renderFresh();return;}
 const mode=activeTaskMode(),next=firstModeTask(state.lesson,mode,state.demo?-1:state.index);
 if(next<0||!progress.read.includes(state.lesson))continueRoute(state.lesson);
 else if(mode==='worksheet'){if(next>=16)startTask(state.lesson,next,false,'worksheet');else backToWorksheet();}
 else startTask(state.lesson,next);
 renderFresh();
}
function checkWorksheet(){let answered=0,correct=0,wrong=0;$$('[data-ws-input]:not(:disabled)').forEach(input=>{let v=input.value.trim();if(!v)return;answered++;const idx=+input.dataset.wsInput,t=tasks()[idx];if(/^\d{1,4}$/.test(v)&&Number(v)===t.answer){markModeDone('worksheet',state.lesson,idx);correct++;}else{wrong++;input.setAttribute('aria-invalid','true');input.closest('.worksheet-item').classList.add('wrong');}});save();
 if(modeCount(state.lesson,'worksheet')===18&&!state.repeating){continueRoute(state.lesson);feedback('Тетрадь пройдена! Продолжаем со следующего непройденного этапа.','success');render();celebrate();return;}
 const text=!answered?'Впиши ответы хотя бы в один пример.':wrong?`Верно: ${correct}. Ещё подумай над ${wrong} — они отмечены розовым.`:`Отлично! Проверено верных ответов: ${correct}. Осталось решить задания без галочки.`;state.feedback={text,type:wrong?'error':correct?'success':'hint'};render();announce(text);if(correct&&!wrong)celebrate();}

function celebrate(){if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const div=document.createElement('div');div.className='confetti';div.setAttribute('aria-hidden','true');div.innerHTML=Array.from({length:22},(_,i)=>`<i style="--x:${Math.random()*100}vw;--r:${Math.random()*600}deg;--delay:${Math.random()*.3}s;background:${['#64b9e5','#f6ce60','#93c7b6','#b8a4e3'][i%4]}"></i>`).join('');document.body.append(div);setTimeout(()=>div.remove(),1800);}
function modal(content){lastModalFocus=document.activeElement;$('#overlay').innerHTML=`<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="icon-btn modal-close" data-action="close-modal" aria-label="Закрыть">${icon('close')}</button>${content}</section></div>`;$('.modal-close').focus();}
let lastModalFocus=null;
function closeModal(){$('#overlay').innerHTML='';lastModalFocus?.focus();}
function help(){stopVoice();modal(`<span class="tip-icon">${icon('cube')}</span><h2 id="modal-title">Считаем точки, строим числа</h2><p><b>Одна точка сверху = одна единица.</b> У синей детали 1 точка, у красной — 2, у зелёной — 5, у жёлтой — 10. Фиолетовая пластина с 100 точками — сотня.</p><p><b>Считай точки, а не детали:</b> красная деталь на 2 точки и синяя на 1 дают число 3. Две зелёные детали на 5 дают число 10.</p><ol class="help-list"><li><b>Передвигай.</b> Перетаскивай деталь мышкой или пальцем. Или нажми на неё, затем на нужную область. Клавиатурой: выбери деталь через Tab и Enter, перейди к области и нажми Enter.</li><li><b>Соединяй.</b> 1 + 1 можно собрать в деталь 2. Пять точек — в деталь 5. Десять — в десяток. Общее количество точек не меняется.</li><li><b>Разбирай.</b> Чтобы убрать часть детали, разбери её на одиночные. Например, 5 − 1: разбери зелёную деталь и убери одну синюю.</li><li><b>Проверяй.</b> Покажи действие на поле и впиши ответ. Кнопка «Посчитать точки» покажет номера точек.</li></ol><p><b>В каждом уроке:</b> разбор, 16 примеров и 2 задания на сборку — те же задания из курса «Математика в кубиках».</p><p class="muted">В мастерской можно свободно строить числа. Новый тренажёр хранит прогресс отдельно в этом браузере. Задания в скачанном HTML работают без интернета. Для женской озвучки нужен интернет.</p><p class="muted"><a href="voice-credits.txt" target="_blank" rel="noopener">Об озвучке</a></p><button class="btn primary" data-action="download">${icon('download')} Скачать для занятий офлайн</button>`);}
async function download(){await window.TrainerBundle.download($('[data-action="download"]'));}
// Recorded lessons keep the same voice on every device. Unknown operands stay unknown.
let voiceSession=0,voicePlaying=false;
function voiceButton(){const button=$('[data-action="speak"]');if(!button)return;button.setAttribute('aria-label',voicePlaying?'Остановить озвучку':'Послушать задание женским голосом');button.setAttribute('aria-pressed',String(voicePlaying));button.setAttribute('title',voicePlaying?'Остановить':'Послушать');button.innerHTML=icon(voicePlaying?'close':'sound');}
function stopVoice(){voiceSession++;voicePlaying=false;if(window.RecordedVoice)window.RecordedVoice.stop();voiceButton();}
function spokenNumber(n){const units=['ноль','один','два','три','четыре','пять','шесть','семь','восемь','девять','десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'],tens=['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];if(n===100)return 'сто';if(n<20)return units[n];return tens[Math.floor(n/10)]+(n%10?' '+units[n%10]:'');}
function taskVoice(){const t=task(),a=t.missing==='a'?'неизвестное число':spokenNumber(t.a),b=t.missing==='b'?'неизвестное число':spokenNumber(t.b);return [`${a} ${t.op==='+'?'плюс':'минус'} ${b}${t.missing!=='result'?` равно ${spokenNumber(t.result)}`:''}.`,isBuild()?'Собери пропущенное число точками.':'Передвинь детали, сосчитай точки и запиши ответ.'];}
function speak(){
 if(voicePlaying){stopVoice();return;}
 if(!window.RecordedVoice){feedback('Не удалось загрузить озвучку. Проверь интернет и обнови страницу.','hint');render();return;}
 const id=++voiceSession;voicePlaying=true;voiceButton();
 const end=()=>{if(id!==voiceSession)return;voicePlaying=false;voiceButton();};
 const started=window.RecordedVoice.speak(state.mode==='learn'?`${lesson().title}. ${lesson().rule}`:taskVoice(),{onEnd:end,onError:message=>{if(id!==voiceSession)return;end();feedback(message||'Не удалось включить озвучку. Проверь интернет и нажми ещё раз.','hint');render();}});
 if(started===false)end();
}
// Delegated navigation keeps all controls available after a board redraw.
document.addEventListener('click',event=>{
 if(booting)return;const el=event.target.closest('button,a');if(!el||el.disabled)return;userIntent=true;if((el.dataset.exchange||el.dataset.action==='learn-next')&&M.isBusy())return;if(!el.dataset.exchange)M.cancel();
 if(el.dataset.pvOpen){openPlaceValue(el.dataset.pvOpen);return;}
 if(el.dataset.pvAction){if(suppressPvClick){suppressPvClick=false;return;}if(el.dataset.pvAction==='reload'){reloadPlaceValue();return;}A.capture(state,document);if(A.handle(state,el.dataset.pvAction,el.dataset,pvEnv())){pvDirty=true;if(['next','reset'].includes(el.dataset.pvAction))$('#app').dataset.context='';render();}return;}
 if(state.view==='placevalue'&&state.pvConflict&&el.dataset.view===undefined&&el.dataset.lesson===undefined)return;
 if(el.dataset.lesson){chooseLesson(+el.dataset.lesson);return;}
 if(el.dataset.view){save();stopVoice();if(el.dataset.view==='trainer')resumeTraining(true);else if(el.dataset.view==='workshop')openWorkshop();else{state.view=el.dataset.view;state.feedback=null;state.selected=null;}renderFresh();window.scrollTo(0,0);return;}
 if(el.dataset.mode){stopVoice();selectMode(el.dataset.mode);return;}
 if(el.dataset.practice){openPractice(+el.dataset.practice,el.dataset.owner==='worksheet'?'worksheet':activeTaskMode());return;}
 if(el.dataset.exchange){exchangeOnBoard(el.dataset.exchange);return;}
 if(el.dataset.piece){if(suppressClick){suppressClick=false;return;}if(state.solved)return;const from=el.dataset.from,type=el.dataset.piece;if(from==='bank'){movePiece(from,'a',type);return;}if(state.view==='workshop'){mutate(()=>{state.zones.a[type]--;return true;});return;}if(state.selected?.from===from&&state.selected?.type===type){state.selected=null;$$('.selected-piece').forEach(p=>p.classList.remove('selected-piece'));return;}state.selected={from,type};$$('.selected-piece').forEach(p=>p.classList.remove('selected-piece'));el.classList.add('selected-piece');announce('Деталь выбрана. Нажми на область назначения.');return;}
 const action=el.dataset.action;if(!action)return;event.preventDefault();
 if(action==='home'){save();resumeTraining(true);renderFresh();}
 else if(action==='help'){if(state.view==='placevalue'){A.assist(state,'explanation',LP);pvDirty=true;save();}help();}
 else if(action==='close-modal')closeModal();
 else if(action==='speak')speak();
 else if(action==='count-points'&&presentationPolicy(state.view==='trainer'&&state.mode==='learn'?learningFrame():null).showTotal){state.countPoints=!state.countPoints;render();announce(state.countPoints?'Точки пронумерованы по порядку на каждой области.':'Номера точек скрыты.');}
 else if(action==='hint')hint();
 else if(action==='check')checkAnswer();
 else if(action==='check-worksheet')checkWorksheet();
 else if(action==='next-task')nextTask();
 else if(action==='back-worksheet')backToWorksheet();
 else if(action==='continue-route'){save();continueRoute(state.lesson);renderFresh();}
 else if(action==='prev-lesson')chooseLesson(Math.max(1,state.lesson-1));
 else if(action==='reset'){if(state.view==='placevalue'){A.handle(state,'reset',{},pvEnv());pvDirty=true;$('#app').dataset.context='';}else if(state.view==='workshop'){state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};state.undo=[];state.feedback=null;state.solved=false;}else setup();renderFresh();}
 else if(action==='undo'){if(state.undo.length){state.zones=JSON.parse(state.undo.pop());state.selected=null;state.feedback=null;if(state.view==='placevalue')pvDirty=true;render();}}
 else if(action==='combine'){mutate(()=>{K.types.forEach(type=>{state.zones.a[type]+=state.zones.b[type];state.zones.b[type]=0;});return true;});}
 else if(action==='learn-back')advanceExplanation(-1);
 else if(action==='learn-next')advanceExplanation(1);
 else if(action==='random-target'){state.freeTarget=Math.floor(Math.random()*1001);state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};state.undo=[];state.feedback=null;render();}
 else if(action==='check-free'){feedback(K.total(state.zones.a)===state.freeTarget?K.canonical(state.zones.a)?`Получилось! Ты собрал ${state.freeTarget}: ${nice(state.freeTarget)}.`:`Число ${state.freeTarget} собрано! Теперь объедини полные десятки и сотню.`:`Сейчас на поле ${K.total(state.zones.a)}, а нужно ${state.freeTarget}. Добавь или убери детали.`,K.total(state.zones.a)===state.freeTarget?'success':'hint');render();if(K.total(state.zones.a)===state.freeTarget&&K.canonical(state.zones.a))celebrate();}
 else if(action==='reset-progress')modal(`<h2 id="modal-title">Начать сначала?</h2><p>Будут удалены отметки о решённых заданиях на этом устройстве.</p><div class="board-actions"><button class="btn secondary" data-action="close-modal">Оставить прогресс</button><button class="btn primary" data-action="confirm-reset-progress">Начать заново</button></div>`);
 else if(action==='confirm-reset-progress'){pendingModeAwards.clear();pendingReadAwards.clear();resetting=true;progress={solved:{},read:[],worksheet:{},modeSolved:{version:1,play:{},worksheet:{}},modeSessions:{},resetEpoch:Date.now()+':'+Math.random()};if(LP)progress.learning=LP.empty(progress.resetEpoch);storageBlocked=false;state.pvConflict=false;state.pv=null;closeModal();continueRoute(1);renderFresh();}
 else if(action==='download')download();
});
document.addEventListener('click',event=>{if(event.target.closest('[data-piece]'))return;const zone=event.target.closest('[data-zone]');if(zone&&state.selected){movePiece(state.selected.from,zone.dataset.zone,state.selected.type);}});
document.addEventListener('keydown',e=>{if(booting)return;if(e.key==='Escape'){stopVoice();if($('#overlay').innerHTML){closeModal();return;}state.selected=null;render();}if(e.key==='Enter'&&e.target.id==='answer')checkAnswer();if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-zone]')){e.preventDefault();if(state.selected)movePiece(state.selected.from,e.target.dataset.zone,state.selected.type);}if(e.key==='Tab'&&$('.modal')){const fs=[...$('.modal').querySelectorAll('button,a,input')].filter(x=>!x.disabled);if(e.shiftKey&&document.activeElement===fs[0]){e.preventDefault();fs[fs.length-1].focus();}else if(!e.shiftKey&&document.activeElement===fs[fs.length-1]){e.preventDefault();fs[0].focus();}}});
document.addEventListener('input',e=>{userIntent=true;if(state.view==='placevalue'){if(e.target.id==='pv-meaning-answer'){state.pv.meaningAnswer=numericDraft(e.target.value);pvDirty=true;}else if(A.capture(state,document))pvDirty=true;save();return;}if(e.target.id==='answer'||e.target.matches('[data-ws-input]')){e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,4);e.target.removeAttribute('aria-invalid');e.target.closest('.worksheet-item')?.classList.remove('wrong');}if(e.target.id==='free-target'){let n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=R.MAX){state.freeTarget=n;state.feedback=null;}}save();});
document.addEventListener('change',e=>{userIntent=true;if(e.target.matches('[data-pv-task-select]')){openPlaceValue('practice',e.target.value);return;}if(e.target.id==='free-target'){e.target.value=state.freeTarget;}});
// Pointer events support mouse, stylus and touch, with a movement threshold for taps.
let drag=null, suppressClick=false;
document.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-piece]');if(!el||state.solved||e.button!==0)return;M.cancel();drag={id:e.pointerId,from:el.dataset.from,type:el.dataset.piece,x:e.clientX,y:e.clientY,active:false,el};el.setPointerCapture?.(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>7){drag.active=true;const ghost=drag.el.cloneNode(true);ghost.classList.add('drag-ghost');ghost.removeAttribute('data-piece');ghost.removeAttribute('data-from');ghost.setAttribute('aria-hidden','true');document.body.append(ghost);drag.ghost=ghost;}if(drag.active){e.preventDefault();drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';$$('.drop-over').forEach(x=>x.classList.remove('drop-over'));document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]')?.classList.add('drop-over');}},{passive:false});
function finishDrag(e,cancel=false){if(!drag||e.pointerId!==drag.id)return;const d=drag;drag=null;d.ghost?.remove();$$('.drop-over').forEach(x=>x.classList.remove('drop-over'));if(d.active){suppressClick=true;setTimeout(()=>{suppressClick=false;},100);if(!cancel){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-zone]');if(target)movePiece(d.from,target.dataset.zone,d.type);}}}
document.addEventListener('pointerup',e=>finishDrag(e));document.addEventListener('pointercancel',e=>finishDrag(e,true));
$('#overlay').addEventListener('click',e=>{if(e.target.classList.contains('modal-backdrop'))closeModal();});
// Zones are keyboard destinations even after dynamic updates.
const observer=new MutationObserver(()=>{$$('[data-zone]').forEach(z=>{z.tabIndex=0;});});observer.observe($('#app'),{childList:true,subtree:true});
// The generated canonical loader restores all version-checked dependencies
// before this app runs. A stale HTML/new app combination must never write data.
function startTrainer(){resumeTraining(true);if(progress.lastView==='workshop')openWorkshop();else if(progress.lastView==='placevalue'&&learningReady()&&!adoptPv(progress.learning.activity)){storageBlocked=true;memory=true;}render();booting=false;}
if(K&&P&&M&&LP&&A&&window.MathRange)startTrainer();
else{$('#app').innerHTML='<main style="max-width:36em;margin:12vh auto;padding:24px;font:18px/1.6 sans-serif"><h1>Завершим обновление</h1><p>Подключись к интернету и открой тренажёр ещё раз. Сохранённые результаты останутся на устройстве.</p><a href="../">Все игры</a></main>';}
if(typeof window.addEventListener==='function')window.addEventListener('pagehide',()=>{if(!booting)save(true);});
document.addEventListener('visibilitychange',()=>{if(!booting&&document.visibilityState==='hidden'){M.cancel();save(true);}});

// Digit placement uses the same tap/target pattern as the existing objects.
let pvDigitDrag=null,suppressPvClick=false;
document.addEventListener('pointerdown',e=>{const el=e.target.closest('[data-pv-action="digit"]');if(!el||state.view!=='placevalue'||state.solved||state.pvConflict||e.button!==0)return;pvDigitDrag={id:e.pointerId,digit:Number(el.dataset.digit),x:e.clientX,y:e.clientY,active:false};el.setPointerCapture?.(e.pointerId);});
document.addEventListener('pointermove',e=>{if(!pvDigitDrag||pvDigitDrag.id!==e.pointerId)return;if(Math.hypot(e.clientX-pvDigitDrag.x,e.clientY-pvDigitDrag.y)>7)pvDigitDrag.active=true;if(pvDigitDrag.active)e.preventDefault();},{passive:false});
document.addEventListener('pointerup',e=>{if(!pvDigitDrag||pvDigitDrag.id!==e.pointerId)return;const drag=pvDigitDrag;pvDigitDrag=null;if(!drag.active)return;const slot=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-pv-action="place"]');if(slot){state.pv.selectedDigit=drag.digit;userIntent=true;A.handle(state,'place',slot.dataset,pvEnv());pvDirty=true;suppressPvClick=true;render();setTimeout(()=>{suppressPvClick=false;},100);}});
document.addEventListener('pointercancel',()=>{pvDigitDrag=null;});
document.addEventListener('dragstart',e=>{if(e.target.closest('[data-pv-action="digit"]'))e.preventDefault();});
if(typeof window.addEventListener==='function')window.addEventListener('storage',event=>{
 if(event.key!==STORAGE_KEY||event.newValue===lastStoredRaw)return;
 let latest;try{latest=JSON.parse(event.newValue||'{}');if(!record(latest))throw Error('invalid');}catch(_){storageBlocked=true;memory=true;return;}
 if(state.view==='placevalue'&&foreignPvConflict(latest)){blockPvWrite(latest);userIntent=false;render();}
});
