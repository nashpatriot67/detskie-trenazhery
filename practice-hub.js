(function(root){
'use strict';
// Named activity snapshots extend each trainer's existing progress owner.
// The subject engines keep their own correctness rules. No account or service
// is introduced, and no visitor records are sent over the network.
const KEYS=['kubiki-progress-v1','detalki-progress-v1','slovograd-v1'],ROUTINE_KEY=KEYS[0];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>JSON.parse(JSON.stringify(v));
function cleanRoutine(v){
 if(root.StudyClock)return root.StudyClock.clean(v);
 v=object(v)&&v.version===1?v:{};
 const seen={};for(const key of KEYS)if(Array.isArray(v.seen?.[key]))seen[key]=v.seen[key].filter(x=>typeof x==='string'&&x.length<=160).slice(-240);
 return {version:1,tasks:Number.isInteger(v.tasks)?Math.max(0,Math.min(100,v.tasks)):0,seconds:Number.isFinite(v.seconds)?Math.max(0,Math.min(7200,v.seconds)):0,minimumSeconds:900,minuteLimit:15,enabled:v.enabled!==false,seen,lastPause:Number.isFinite(v.lastPause)?v.lastPause:0};
}
function countCorrect(routine,learning,key){
 const next=cleanRoutine(routine),events=Array.isArray(learning?.observations)?learning.observations.filter(x=>x.finalOutcome==='correct'):[];
 const current=events.map(x=>x.eventId),old=next.seen[key];
 // Opening a trainer for the first time never turns historical awards into a
 // request to move. Only new completed attempts count towards a pause.
 if(!old){next.seen[key]=current.slice(-240);return {routine:next,added:0,changed:true};}
 const added=events.filter(x=>!old.includes(x.eventId)).length;
 next.seen[key]=[...new Set(old.concat(current))].slice(-240);next.tasks=Math.min(100,next.tasks+added);
 return {routine:next,added,changed:added>0||JSON.stringify(old)!==JSON.stringify(next.seen[key])};
}
function due(r){r=cleanRoutine(r);return r.enabled&&r.seconds>=900;}
root.PracticeHubCore={cleanRoutine,countCorrect,due};
if(!root.document)return;
const doc=root.document,LP=root.LearningProgress;
let options=null,current=null,host=null,returnTo=null,lastFocus=null,oldOverflow='',scheduled=false,lastInteraction=Date.now(),suppressClick=false,drag=null,scanQueued=false,writing=false;
let coach=null,autoTimer=null,activePending=0,lastClockAt=0,lastCoachSave=0;
const writer='practice-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),memory={};
const voiceAvailability=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=copy,signature=v=>JSON.stringify(v||null);
const titles={concepts:'Теория и понятия',assessment:'Самостоятельная контрольная',quests:'Дела и приключения',breaks:'Двигательная пауза'};
const labels={assessment:'Контрольная',breaks:'Разминка'};
const glyphs={concepts:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4Z"/><path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3Z"/>',quests:'<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 12h8M9 16h6"/>',breaks:'<circle cx="12" cy="4" r="2"/><path d="m4 9 8-2 8 2M12 7v7m0 0-5 7m5-7 5 7"/>'};
const icon=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(glyphs[kind]||glyphs.concepts)+'</svg>';
function record(key){
 try{
  const text=localStorage.getItem(key),raw=JSON.parse(text||'{}');if(!object(raw))throw Error('invalid');
  const generation=typeof raw.resetEpoch==='string'?raw.resetEpoch:'initial';
  if(!LP||!LP.isSupported(raw.learning))throw Error('future');
  const learning=LP.clean(raw.learning,generation);if(learning.generation!==generation)throw Error('generation');
  return {raw,text,generation,learning,error:''};
 }catch(e){return {raw:null,text:null,generation:'initial',learning:LP?LP.empty('initial'):null,error:e.message==='future'?'Сохранение создано более новой версией. Обнови приложение.':'Не удалось прочитать сохранение. Ответы останутся на этой странице; прежняя запись не изменится.'};}
}
function sync(key,learning,raw){if(options&&key===options.storageKey&&options.syncLearning)options.syncLearning(learning,raw);}
function commit(key,entry,learning){
 if(!entry.raw||entry.error)return false;
 try{
  // Recheck after preparing the candidate. A concurrent update is never
  // overwritten with a candidate based on an older raw object.
  if(localStorage.getItem(key)!==entry.text)return false;
  const text=JSON.stringify(Object.assign({},entry.raw,{learning}));writing=true;localStorage.setItem(key,text);writing=false;sync(key,learning,text);return true;
 }catch(_){writing=false;return false;}
}
function updateNamed(key,id,state){
 const entry=record(key);if(entry.error)return false;
 const existing=LP.getModule(entry.learning,id)?.state;
 // An older client may read a newer module snapshot. Keep it opaque just as
 // the existing progress helper keeps unknown learning versions opaque.
 if(existing!==undefined&&existing!==null&&object(state)&&existing.version!==state.version)return false;
 const next=LP.setModule(entry.learning,id,state,{ownerId:writer,generation:entry.generation});
 const candidate=LP.getModule(next,id);if(!candidate||signature(candidate.state)!==signature(state))return false;
 return commit(key,entry,next);
}
function moduleDetails(kind){
 if(kind==='concepts')return {engine:root.LearningJourney,id:'journey',key:options.storageKey};
 if(kind==='assessment')return {engine:options.assessment,id:'assessment',key:options.storageKey};
 if(kind==='quests')return {engine:root.LifeQuests,id:'life-quests',key:ROUTINE_KEY};
 return {engine:root.ActiveBreaks,id:'active-breaks',key:ROUTINE_KEY};
}
function environment(){return Object.assign({},current.kind==='assessment'?options.assessmentEnv:{},{esc,LP,generation:current.generation,learning:current.learning,observe:event=>current.pending.push(clone(event)),announce,speak});}
function announce(text){if(current)current.announcement=text;const live=doc.querySelector('#practice-live');if(live)live.textContent=text;}
function stopSpeech(){try{root.RecordedVoice?.stop();root.RussianVoice?.stop?.();root.speechSynthesis?.cancel();}catch(_){}}
function voiceNotice(text){if(!current)return;current.voiceMessage=text;let note=host?.querySelector('.ph-voice-note');if(!note&&host){note=doc.createElement('p');note.className='ph-voice-note';note.setAttribute('role','status');(host.querySelector('.ph-header')||host.querySelector('#practice-clock-slot'))?.after(note);}if(note)note.textContent=text;announce(text);}
function speak(text){
 stopSpeech();const content=String(text||'').replace(/<[^>]*>/g,' ').trim();if(!content)return;
 // Existing recorded-voice playback remains authoritative. New educational
 // text stays readable when no matching recording is available offline.
 if(root.RecordedVoice){const started=root.RecordedVoice.speak(content,{onError:()=>voiceNotice('Для этого задания запись пока недоступна. Инструкция полностью есть на экране.')});if(started!==false)return;}
 voiceNotice('Для этого задания запись пока недоступна. Инструкция полностью есть на экране.');
}
function rememberLauncher(opened){
 if(!options||current?.preview)return;updateNamed(options.storageKey,'launcher',{version:1,trainerId:options.trainerId,open:opened,kind:current?.kind||'assessment',returnTo:returnTo||null});
}
function capture(){if(current&&!current.conflict&&current.engine.capture)current.engine.capture(current.state,host.querySelector('#practice-content'));}
function recoveryDraft(){const state=current.engine.snapshot?current.engine.snapshot(current.state):current.state;return {state:clone(state),generation:current.generation,seen:clone(current.seen),pending:clone(current.pending)};}
function showStorageWarning(){
 if(!current?.warning||!host)return;
 let note=host.querySelector('.ph-storage-note');if(!note){note=doc.createElement('div');note.className='ph-storage-note';note.setAttribute('role','status');(host.querySelector('.ph-header')||host.querySelector('#practice-clock-slot'))?.after(note);}
 note.innerHTML=esc(current.warning)+(current.conflict?'<button data-ph-action="reload">Открыть актуальное</button>':'');
}
function activityContent(){
 const html=current.engine.render(current.state,environment());
 const speakButton=/<button\b(?=[^>]*\bdata-(?:ct|lq|ab|mc|rc)-action="speak")[^>]*>[\s\S]*?<\/button>/g;
 if(!speakButton.test(html))return html;
 let text='';try{current.engine.handle(clone(current.state),'speak',{},Object.assign({},environment(),{observe(){},announce(){},speak(value){text=String(value||'');}}));}catch(_){}
 if(!voiceAvailability.has(text))voiceAvailability.set(text,!!(text&&root.RecordedVoice?.has?.(text)));
 // Offer playback only for a real existing recording. A button that can only
 // say "not recorded" would be a misleading first step for the child.
 return voiceAvailability.get(text)?html:html.replace(speakButton,'');
}
function saveCurrent(captureFirst=true){
 if(!current||current.conflict)return false;
 if(current.preview)return true;
 if(captureFirst)capture();const entry=record(current.key);
 if(entry.error){current.warning=entry.error;memory[current.key+':'+current.id]=recoveryDraft();return false;}
 if(entry.generation!==current.generation){current.conflict=true;current.warning='В другой вкладке начали заново. Открой актуальное состояние.';return false;}
 const latest=LP.getModule(entry.learning,current.id);
 if(signature(latest)!==signature(current.seen)&&latest?.ownerId!==writer){current.conflict=true;current.warning='Эту работу продолжили в другой вкладке. Сначала открой актуальное состояние.';return false;}
 let next=LP.merge(current.learning,entry.learning,{generation:entry.generation});
 for(const event of current.pending)next=LP.record(next,event);
 const storedState=current.engine.snapshot?current.engine.snapshot(current.state):current.state;
 next=LP.setModule(next,current.id,storedState,{ownerId:writer,generation:entry.generation});
 const candidate=LP.getModule(next,current.id);
 if(!candidate||signature(candidate.state)!==signature(storedState)){current.warning='Сохранение этой работы недоступно. Прежние результаты остаются на месте.';return false;}
 if(!commit(current.key,entry,next)){
  const changed=record(current.key);if(!changed.error&&changed.text!==entry.text){current.conflict=true;current.warning='Сохранение изменилось в другой вкладке. Открой актуальное состояние.';}
  else current.warning='Не получилось сохранить на устройстве. Не закрывай страницу, чтобы продолжить эту работу.';
  memory[current.key+':'+current.id]=recoveryDraft();return false;
 }
 current.learning=next;current.seen=candidate;current.pending=[];current.warning='';delete memory[current.key+':'+current.id];return true;
}
function render(){
 if(!host||!current)return;
 const focused=doc.activeElement,hadFocus=host.contains(focused),focusSelector=focused&&hadFocus&&focused.dataset?Object.keys(focused.dataset).filter(k=>/^(ct|lq|ab|ph|mc|rc)/.test(k)).map(k=>'[data-'+k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())+'="'+CSS.escape(focused.dataset[k])+'"]').join(''):'';
 const entry=record(ROUTINE_KEY),routine=cleanRoutine(!entry.error?LP.getModule(entry.learning,'routine')?.state:null);
 const standalone=options.standalone===true,gate=current.kind==='concepts',heading=gate?current.state.active?.config.title||titles.concepts:titles[current.kind];
 const back=current.kind==='breaks'&&standalone?'К приключениям':gate?'К урокам':'К уроку';
 const header=standalone&&current.kind==='quests'?'':'<header class="ph-header"><button class="ph-back" data-ph-action="close">← '+back+'</button><div><span class="ph-eyebrow">'+(gate?'ПОНЯТЬ → ПРОВЕРИТЬ → ПРИМЕНИТЬ':'УЧИМСЯ В СВОЁМ ТЕМПЕ')+'</span><h1 id="practice-title">'+esc(heading)+'</h1></div><button class="ph-settings-button" data-ph-action="settings" aria-label="Настройки разминок">⚙</button></header>';
 const settings=current.settings?'<section class="ph-settings"><h2>Разминка после 15 минут занятий</h2><p>Считаем время в активной вкладке. Фон, скрытая страница и настоящие дела в комнате не считаются экранным занятием. В конце учебного цикла предложим паузу перед следующим, если прошло не меньше 15 минут.</p><label><input type="checkbox" data-ph-setting="enabled" '+(routine.enabled?'checked':'')+'> Предлагать разминки</label></section>':'';
 host.innerHTML='<div class="ph-shell">'+header+settings+(current.warning?'<div class="ph-storage-note" role="status">'+esc(current.warning)+(current.conflict?'<button data-ph-action="reload">Открыть актуальное</button>':'')+'</div>':'')+'<div id="practice-clock-slot"></div><div id="practice-content"><fieldset class="ph-fieldset" '+(current.conflict?'disabled':'')+'>'+activityContent()+'</fieldset></div><p class="ph-save-note">'+(current.preview?'Предпросмотр · учебный прогресс не меняется':current.warning?'Работа на этой странице':'Сохраняем на этом устройстве')+' · можно остановиться и продолжить позже</p><div id="practice-live" class="ph-sr-only" aria-live="polite"></div></div>';
 const live=host.querySelector('#practice-live');if(live)live.textContent=current.announcement||'';
 if(current.voiceMessage)voiceNotice(current.voiceMessage);
 if(current.engine.afterRender)current.engine.afterRender(host.querySelector('#practice-content'),current.state,current.previous);
 current.previous=null;showBreakOffer();scheduleAdvance();
 let restoredFocus=false;if(focusSelector)try{const target=host.querySelector(focusSelector);if(target&&!target.disabled){target.focus({preventScroll:true});restoredFocus=doc.activeElement===target;}}catch(_){}
 if(hadFocus&&!restoredFocus){const target=current.conflict?host.querySelector('[data-ph-action="reload"]'):host.querySelector('#practice-content h2,#practice-content h3,#practice-content button');if(target){if(!target.matches('button,input,select,a'))target.tabIndex=-1;target.focus({preventScroll:true});}}
}
function lockUnderlying(value){if(options?.standalone)return;const app=doc.getElementById('app');if(app){app.inert=value;if(value)app.setAttribute('aria-hidden','true');else app.removeAttribute('aria-hidden');}}
function stopCoach(){if(coach){coach.stop();coach=null;}}
function clearAdvance(){if(autoTimer){clearTimeout(autoTimer);autoTimer=null;}}
function emitClosed(){doc.dispatchEvent(new CustomEvent('practice:closed'));options.onActivityClose?.();}
function open(kind,settings={}){
 if(!options||!titles[kind])return false;
 if(kind==='quests'&&options.subject!=='life')return false;
 if(kind==='breaks'&&!settings.preview&&!due(readRoutine()))return false;
 if(current){if(settings.preview){capture();memory[current.key+':'+current.id]=recoveryDraft();}else saveCurrent();if(current.conflict&&!settings.force){render();return false;}}
 clearAdvance();stopCoach();if(!settings.preview)options.beforeOpen?.();else root.PlaceValueMotion?.cancel?.();stopSpeech();const d=moduleDetails(kind);if(!d.engine)return false;
 const entry=record(d.key),snapshot=entry.error?null:LP.getModule(entry.learning,d.id),recovery=memory[d.key+':'+d.id];
 const useRecovery=recovery&&recovery.generation===entry.generation&&signature(recovery.seen)===signature(snapshot);
 if(recovery&&!useRecovery)delete memory[d.key+':'+d.id];
 const savedState=settings.state||(settings.preview?null:useRecovery?recovery.state:snapshot?.state);
 const args=Object.assign({subject:options.subject,grade:2},kind==='assessment'?options.getAssessmentOptions?.():{},settings.options||{},{learning:entry.learning,generation:entry.generation,LP});
 const restored=savedState?d.engine.restore(savedState,args):null,unsupported=!!savedState&&!restored;
 current={kind,key:d.key,id:d.id,engine:d.engine,state:restored||d.engine.create(args),learning:entry.learning,generation:entry.generation,seen:snapshot,pending:useRecovery&&Array.isArray(recovery.pending)?clone(recovery.pending):[],conflict:unsupported||!!settings.problem,settings:false,preview:settings.preview===true,warning:settings.problem||entry.error||(unsupported?'Сохранённая работа использует другой формат. Обнови приложение; прежняя запись не изменена.':'')};
 if(kind==='breaks'&&!unsupported&&(current.state.completed||current.state.skipped||current.state.phase==='done'))d.engine.handle(current.state,'replace',{},environment());
 if(kind==='concepts'&&!current.state.active&&!current.conflict){current=null;return false;}
 if(!host){host=doc.createElement('section');host.id='practice-root';host.setAttribute('aria-labelledby','practice-title');
  if(options.standalone){host.className='ph-standalone';host.setAttribute('role','region');(doc.querySelector(options.container||'#life-stage')||doc.body).appendChild(host);}
  else{host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');doc.body.appendChild(host);}bindHost();}
 if(!options.standalone){if(host.hidden||!doc.body.classList.contains('practice-open')){lastFocus=doc.activeElement;oldOverflow=doc.body.style.overflow;}doc.body.classList.add('practice-open');doc.body.style.overflow='hidden';lockUnderlying(true);}
 host.hidden=false;rememberLauncher(true);render();if(!current.warning)saveCurrent(false);host.querySelector('.ph-back')?.focus({preventScroll:true});return true;
}
function dismiss(settings={}){
 if(!current)return;clearAdvance();if(settings.save!==false)saveCurrent();stopCoach();stopSpeech();rememberLauncher(false);current=null;host.hidden=true;lockUnderlying(false);
 if(!options.standalone){doc.body.classList.remove('practice-open');doc.body.style.overflow=oldOverflow;lastFocus?.focus?.({preventScroll:true});}
 if(settings.notify!==false)emitClosed();
}
function close(){
 if(!current)return;if(current.kind==='breaks'){finishBreak();return;}
 if(options.standalone){action('menu',{});return;}
 const context=current.kind==='concepts'?current.state.active?.config.context:null;dismiss();if(context)options.onConceptGateCancel?.(context);
}
function readRoutine(){const entry=record(ROUTINE_KEY);return cleanRoutine(!entry.error?LP.getModule(entry.learning,'routine')?.state:null);}
function flushClock(){
 if(activePending<=0)return;const entry=record(ROUTINE_KEY);if(entry.error)return;
 const routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state);routine.seconds=Math.min(7200,routine.seconds+activePending);
 if(updateNamed(ROUTINE_KEY,'routine',routine))activePending=0;
}
function resetRoutine(){activePending=0;const routine=readRoutine();routine.tasks=0;routine.seconds=0;routine.lastPause=Date.now();updateNamed(ROUTINE_KEY,'routine',routine);showBreakOffer();}
function loadJourney(){
 const entry=record(options.storageKey),wrapper=entry.error?null:LP.getModule(entry.learning,'journey'),J=root.LearningJourney;
 const args={subject:options.subject,grade:2,generation:entry.generation,learning:entry.learning,LP};
 const recovery=memory[options.storageKey+':journey'];
 const recovered=recovery&&recovery.generation===entry.generation&&signature(recovery.seen)===signature(wrapper);
 const saved=recovered?recovery.state:wrapper?.state;
 const state=saved?J?.restore(saved,args):J?.create(args);return {entry,wrapper,state,args};
}
function requireConcepts(value){
 if(!options||options.subject==='life'||!root.LearningJourney)return true;
 const j=loadJourney(),J=root.LearningJourney,cfg=J.config(value);
 if(!cfg||!j.state){open('concepts',{problem:j.entry.error||'Не удалось открыть проверку правила. Обнови приложение. Прежнее сохранение оставим на месте.'});return true;}
 if(J.satisfied(j.state,cfg))return false;
 j.state.grade=cfg.grade===1?1:2;
 if(!J.requireGate(j.state,cfg,{LP,generation:j.entry.generation,learning:j.entry.learning,esc,observe(){}}))return true;
 open('concepts',{state:J.snapshot(j.state),options:{grade:j.state.grade}});return true;
}
function finishGate(){
 if(current?.kind!=='concepts'||!root.LearningJourney.completed(current.state))return false;
 const context=root.LearningJourney.finish(current.state);if(!saveCurrent(false)){render();return false;}
 dismiss({save:false});if(context)options.onConceptGateComplete?.(context);return true;
}
function cycleBoundary(value){
 flushClock();if(!options||!root.LearningJourney||!due(readRoutine()))return false;
 const j=loadJourney();if(!j.state||j.entry.error)return false;
 j.state.pendingCycles[options.trainerId]=copy(value.context||{});
 if(!updateNamed(options.storageKey,'journey',root.LearningJourney.snapshot(j.state)))return false;
 returnTo=null;return open('breaks');
}
function takeCycle(){
 if(!options?.onCycleContinue||!root.LearningJourney)return null;const j=loadJourney();if(!j.state)return null;
 const value=j.state.pendingCycles[options.trainerId];if(!value)return null;delete j.state.pendingCycles[options.trainerId];
 return updateNamed(options.storageKey,'journey',root.LearningJourney.snapshot(j.state))?value:null;
}
function finishBreak(){
 if(current?.kind!=='breaks')return;const preview=current.preview,previous=returnTo;saveCurrent(false);if(!preview)resetRoutine();returnTo=null;
 const cycle=preview?null:takeCycle();dismiss({save:false,notify:false});
 if(cycle){options.onCycleContinue?.(cycle);emitClosed();return;}
 if(previous&&previous!=='breaks')open(previous,{force:true});else if(options.standalone)open('quests',{force:true});else emitClosed();
}
function scheduleAdvance(){
 clearAdvance();if(!current||current.conflict||doc.hidden)return;
 const gate=current.kind==='concepts',run=gate?current.state.active?.run:current.state;
 const automatic=gate||current.kind==='assessment'&&(current.engine.automatic===true||current.state.automatic===true);
 if(!automatic||!run?.solved||run.skipped||gate&&run.phase!=='task')return;
 const target=current,attempt=run.attempt?.attemptId,index=run.index;
 autoTimer=setTimeout(()=>{autoTimer=null;if(current!==target||doc.hidden||current.conflict)return;const active=gate?current.state.active?.run:current.state;if(!active?.solved||active.attempt?.attemptId!==attempt||active.index!==index)return;
  if(gate&&root.LearningJourney.completed(current.state)){finishGate();return;}action('next',{});
 },2600);
}
function beginCoach(actionName){
 if(current?.kind!=='breaks'||current.conflict||!root.AudioCoach)return;
 const target=current;if(!coach)coach=root.AudioCoach.create({
  onFrame(frame){if(current!==target||current.conflict)return;target.engine.updateFrame?.(host.querySelector('#practice-content'),target.state,frame);
   if(Date.now()-lastCoachSave>1000){lastCoachSave=Date.now();if(!saveCurrent(false)){coach?.pause();target.engine.handle(target.state,'pause',{},environment());render();}}},
  onPhase(frame){if(current===target)target.engine.updateFrame?.(host.querySelector('#practice-content'),target.state,frame);},
  onEnd(){if(current!==target)return;target.engine.handle(target.state,'coach-end',{},environment());saveCurrent(false);render();},
  onError(error){if(current!==target)return;target.engine.handle(target.state,'audio-error',error,environment());saveCurrent(false);render();}
 });
 const plan=target.engine.plan(target.state),silent=actionName==='silent-start'||target.state.audioMode==='silent';
 if(actionName==='resume'&&coach.snapshot().status==='paused')coach.resume();
 else coach.start(plan,{index:target.state.coachIndex||0,time:target.state.coachTime||0,silent});
}
function action(actionName,data){
 if(!current||current.conflict)return;
 capture();current.previous=copy(current.state);current.announcement='';if(actionName!=='speak')current.voiceMessage='';
 if(current.kind==='breaks'&&['pause','replace','skip','finish','return','back','repeat-demo','choose','sound-toggle','step','next-step','prev-step'].includes(actionName)){if(actionName==='pause')coach?.pause();else stopCoach();}
 const before=current.state.solved;current.engine.handle(current.state,actionName,data||{},environment());const saved=saveCurrent(false);if(!saved&&current.kind==='breaks')current.engine.handle(current.state,'pause',{},environment());render();
 if(saved&&current.kind==='breaks'&&['start','resume','silent-start'].includes(actionName))beginCoach(actionName);
 if(current.kind==='breaks'&&current.state.returnRequested){finishBreak();return;}
 if(current.kind==='assessment'&&current.state.returnRequested){close();return;}
 if(current.kind==='concepts'&&actionName==='next'&&root.LearningJourney.completed(current.state)){finishGate();return;}
 if(!before&&current.state.solved&&current.kind!=='breaks')scanLearning(true);
}
function startQuest(id){if(options?.subject!=='life')return false;if(!current||current.kind!=='quests')open('quests');if(!current)return false;action('open',{quest:id});return true;}
function captureInput(){
 if(!current||current.conflict)return;capture();
 if(!saveCurrent(false)){
  // A blur/change may precede a click on Back. Update the warning in place so
  // that a render does not remove the button between pointerdown and click.
  showStorageWarning();if(current.conflict){const fields=host.querySelector('.ph-fieldset');if(fields)fields.disabled=true;}
 }
}
function bindHost(){
 host.addEventListener('click',event=>{
  event.stopPropagation();lastInteraction=Date.now();if(suppressClick){suppressClick=false;if(event.target.closest('[data-practice-drag],[data-practice-drop]'))return;}
  const el=event.target.closest('button,a');if(!el||el.disabled)return;
  if(el.dataset.practiceOpen){event.preventDefault();if(el.dataset.practiceOpen==='breaks')returnTo=current?.kind||null;open(el.dataset.practiceOpen);return;}
  const ph=el.dataset.phAction;
  if(ph){event.preventDefault();if(ph==='close')close();else if(ph==='settings'){current.settings=!current.settings;render();}else if(ph==='reload'){const kind=current.kind;delete memory[current.key+':'+current.id];dismiss({save:false,notify:false});if(!open(kind,{force:true}))emitClosed();}return;}
  for(const prefix of ['ct','lq','ab','mc','rc'])if(el.dataset[prefix+'Action']){event.preventDefault();action(el.dataset[prefix+'Action'],el.dataset);return;}
 });
 host.addEventListener('input',event=>{event.stopPropagation();lastInteraction=Date.now();captureInput();});
 host.addEventListener('change',event=>{
  event.stopPropagation();lastInteraction=Date.now();const key=event.target.dataset.phSetting;
  if(key){const entry=record(ROUTINE_KEY);if(entry.error)return;const routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state);routine[key]=key==='enabled'?event.target.checked:Number(event.target.value);updateNamed(ROUTINE_KEY,'routine',cleanRoutine(routine));return;}
  captureInput();
 });
 host.addEventListener('keydown',event=>{
  event.stopPropagation();lastInteraction=Date.now();if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Enter'&&event.target.matches('[data-ct-input],[data-mc-input],[data-rc-input],[data-mc-field]')&&host.querySelector('[data-ct-action="check"],[data-mc-action="check"],[data-rc-action="check"]')){event.preventDefault();action('check',{});return;}
  if(event.key==='Tab'&&!options.standalone){
   const controls=[...host.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
   if(!controls.length)return;const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first.focus();}
  }
 });
 host.addEventListener('pointerdown',event=>{
  const el=event.target.closest('[data-practice-drag]');if(!el||el.disabled||current?.conflict||event.button!==0)return;
  drag={pointerId:event.pointerId,item:el.dataset.practiceDrag,x:event.clientX,y:event.clientY,active:false,el};el.setPointerCapture?.(event.pointerId);
 });
 host.addEventListener('pointermove',event=>{
  if(!drag||drag.pointerId!==event.pointerId)return;
  if(!drag.active&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){drag.active=true;drag.ghost=drag.el.cloneNode(true);drag.ghost.classList.add('ph-drag-ghost');drag.ghost.removeAttribute('data-practice-drag');drag.ghost.setAttribute('aria-hidden','true');doc.body.appendChild(drag.ghost);}
  if(drag.active){event.preventDefault();drag.ghost.style.left=event.clientX+'px';drag.ghost.style.top=event.clientY+'px';host.querySelectorAll('.ph-drop-over').forEach(x=>x.classList.remove('ph-drop-over'));doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-practice-drop]')?.classList.add('ph-drop-over');}
 },{passive:false});
 function endDrag(event,cancel){if(!drag||drag.pointerId!==event.pointerId)return;const d=drag;drag=null;d.ghost?.remove();host.querySelectorAll('.ph-drop-over').forEach(x=>x.classList.remove('ph-drop-over'));if(d.active){suppressClick=true;setTimeout(()=>{suppressClick=false;},100);const zone=doc.elementFromPoint(event.clientX,event.clientY)?.closest('[data-practice-drop]');if(zone&&!cancel)action('drop',{item:d.item,zone:zone.dataset.practiceDrop});}}
 host.addEventListener('pointerup',e=>endDrag(e,false));host.addEventListener('pointercancel',e=>endDrag(e,true));
 host.addEventListener('dragstart',e=>{if(e.target.closest('[data-practice-drag]'))e.preventDefault();});
}
function injectLauncher(){
 if(!options||options.standalone)return;const app=doc.getElementById('app');if(!app)return;
 let bar=app.querySelector('.practice-launcher');if(!bar&&options.assessment){bar=doc.createElement('nav');bar.className='practice-launcher';bar.setAttribute('aria-label','Самостоятельная проверка');bar.innerHTML='<button data-practice-open="assessment">'+icon('assessment')+'<span>Контрольная · все темы вперемешку</span></button>';const top=app.querySelector('.topbar');if(top)top.after(bar);else(app.querySelector('.main,main')||app).prepend(bar);}
 showBreakOffer();
}
function studying(){if(current?.kind==='quests'&&['real','small-real'].includes(current.state.phase))return false;return !options?.isStudyActive||options.isStudyActive()!==false;}
function showBreakOffer(){
 if(!options)return;const visible=current?.kind!=='breaks'&&studying()&&due(readRoutine());
 const target=current?host?.querySelector('#practice-clock-slot'):doc.querySelector('.practice-launcher');
 doc.querySelectorAll('.practice-break-offer').forEach(el=>{if(!visible||el.parentNode!==target)el.remove();});
 if(!visible||!target||target.querySelector('.practice-break-offer'))return;
 const box=doc.createElement('aside');box.className='practice-break-offer';box.setAttribute('role','status');box.innerHTML='<div><strong>15 минут позади — можно размяться</strong><p>Задание сохраним. Показ и голос начнутся только после «Старт».</p></div><button data-practice-open="breaks">К разминке</button>';target.appendChild(box);
}
function requestBreak(){
 if(scheduled||current?.kind==='breaks'||!studying())return;flushClock();if(!due(readRoutine()))return;
 scheduled=true;setTimeout(()=>{scheduled=false;if(current?.kind==='breaks'||!studying())return;if(current?!current.state.solved:!options.atBoundary?.())return;if(doc.hidden||doc.querySelector('#overlay .modal'))return;returnTo=current?.kind||null;open('breaks');},0);
}
function scanLearning(boundary){
 if(!options||writing)return;const entry=record(ROUTINE_KEY);if(entry.error)return;
 let routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state),changed=false,added=0;
 for(const key of KEYS){const owner=key===ROUTINE_KEY?entry:record(key);if(owner.error)continue;const result=countCorrect(routine,owner.learning,key);routine=result.routine;changed=changed||result.changed;added+=result.added;}
 if(changed)updateNamed(ROUTINE_KEY,'routine',routine);
 if(added>0&&boundary)requestBreak();
}
function queueScan(){if(scanQueued)return;scanQueued=true;queueMicrotask(()=>{scanQueued=false;injectLauncher();scanLearning(true);});}
function pauseCoach(){
 if(current?.kind!=='breaks')return;coach?.pause();current.engine.handle(current.state,'pause',{},environment());saveCurrent(false);render();
}
function clockTick(){
 const now=performance.now();if(!lastClockAt){lastClockAt=now;return;}const seconds=(now-lastClockAt)/1000;lastClockAt=now;
 if(doc.hidden||!doc.hasFocus()||!studying()||current?.kind==='breaks'||seconds<=0||seconds>2)return;
 activePending+=seconds;if(activePending>=5||readRoutine().seconds+activePending>=900){flushClock();showBreakOffer();}
}
function mount(config){
 if(options||!LP||!LP.getModule)return;options=config;options.trainerId=options.trainerId||({math:options.storageKey==='detalki-progress-v1'?'bricks':'kubiki',russian:'slovograd',life:'life'}[options.subject]);
 injectLauncher();scanLearning(false);lastClockAt=performance.now();
 doc.addEventListener('click',event=>{const button=event.target.closest('[data-practice-open]');if(button&&!host?.contains(button)){event.preventDefault();event.stopPropagation();lastInteraction=Date.now();returnTo=current?.kind||null;open(button.dataset.practiceOpen);}},true);
 for(const name of ['pointerdown','keydown'])doc.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true});
 const app=doc.getElementById('app');if(app)new MutationObserver(queueScan).observe(app,{childList:true,subtree:true});
 root.addEventListener('storage',event=>{
  if(!KEYS.includes(event.key))return;
  if(current&&event.key===current.key){const entry=record(current.key),latest=entry.error?null:LP.getModule(entry.learning,current.id);if(entry.error||entry.generation!==current.generation||signature(latest)!==signature(current.seen)&&latest?.ownerId!==writer){current.conflict=true;clearAdvance();coach?.pause();if(current.kind==='breaks')current.engine.handle(current.state,'pause',{},environment());current.warning=entry.error||'Эту работу изменили в другой вкладке. Сначала открой актуальное состояние.';render();}}
  scanLearning(false);showBreakOffer();
 });
 root.addEventListener('pagehide',()=>{flushClock();clearAdvance();if(current){if(current.kind==='breaks')pauseCoach();saveCurrent();}stopCoach();});
 root.addEventListener('blur',()=>{flushClock();clearAdvance();pauseCoach();});
 root.addEventListener('focus',()=>{lastClockAt=performance.now();if(current)render();});
 doc.addEventListener('visibilitychange',()=>{lastClockAt=performance.now();if(doc.hidden){flushClock();clearAdvance();if(current){pauseCoach();saveCurrent();}}else if(current)render();});
 setInterval(clockTick,1000);
 const launcher=record(options.storageKey),last=!launcher.error?LP.getModule(launcher.learning,'launcher')?.state:null;
 const owned=last?.version===1&&last.open&&(!last.trainerId||last.trainerId===options.trainerId);
 const journey=!options.standalone&&root.LearningJourney?loadJourney():null;
 if(journey?.state?.active&&owned&&last.kind==='concepts'){open('concepts');}
 else if(owned&&last.kind==='breaks'&&due(readRoutine())){returnTo=last.returnTo||null;open('breaks');}
 else if(options.standalone)open(options.initial||'quests');
 else if(owned&&last.kind==='assessment')open('assessment');
 try{const url=new URL(root.location.href);if(url.searchParams.get('activity')==='quests'&&options.subject!=='life'){root.location.replace(new URL('../life/',url).href);return;}if(url.searchParams.has('activity')){url.searchParams.delete('activity');root.history.replaceState(root.history.state,'',url.href);}}catch(_){}
}
root.PracticeHub={mount,open,close,requireConcepts,cycleBoundary,startQuest,isOpen:()=>!!current&&!host?.hidden,previewCoach(){returnTo=current?.kind||null;return open('breaks',{preview:true});},snapshot:()=>current?clone({kind:current.kind,ownerKey:current.key,moduleId:current.id,state:current.state,conflict:current.conflict,storageWarning:current.warning}):null};
})(typeof window==='undefined'?globalThis:window);
