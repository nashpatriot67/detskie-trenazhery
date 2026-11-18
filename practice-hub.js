(function(root){
'use strict';
// Named activity snapshots extend each trainer's existing progress owner.
// The subject engines keep their own correctness rules. No account or service
// is introduced, and no visitor records are sent over the network.
const KEYS=['kubiki-progress-v1','detalki-progress-v1','slovograd-v1'],ROUTINE_KEY=KEYS[0];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>JSON.parse(JSON.stringify(v));
function cleanRoutine(v){
 v=object(v)&&v.version===1?v:{};
 const seen={};for(const key of KEYS)if(Array.isArray(v.seen?.[key]))seen[key]=v.seen[key].filter(x=>typeof x==='string'&&x.length<=160).slice(-240);
 return {version:1,tasks:Number.isInteger(v.tasks)?Math.max(0,Math.min(100,v.tasks)):0,seconds:Number.isFinite(v.seconds)?Math.max(0,Math.min(7200,v.seconds)):0,taskLimit:[4,5,6,8].includes(v.taskLimit)?v.taskLimit:5,minuteLimit:[8,10,12,15].includes(v.minuteLimit)?v.minuteLimit:10,enabled:v.enabled!==false,seen,lastPause:Number.isFinite(v.lastPause)?v.lastPause:0};
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
function due(r){r=cleanRoutine(r);return r.enabled&&(r.tasks>=r.taskLimit||r.seconds>=r.minuteLimit*60);}
root.PracticeHubCore={cleanRoutine,countCorrect,due};
if(!root.document)return;
const doc=root.document,LP=root.LearningProgress;
let options=null,current=null,host=null,returnTo=null,lastFocus=null,oldOverflow='',scheduled=false,lastInteraction=Date.now(),suppressClick=false,drag=null,scanQueued=false,writing=false;
const writer='practice-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),memory={};
const voiceAvailability=new Map();
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=copy,signature=v=>JSON.stringify(v||null);
const titles={concepts:'Понятия и вопросы',quests:'Квесты самостоятельности',breaks:'Двигательная пауза'};
const labels={concepts:'Понятия и вопросы',quests:'Дела и приключения',breaks:'Разминка'};
const glyphs={concepts:'<path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4Z"/><path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3Z"/>',quests:'<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 12h8M9 16h6"/>',breaks:'<circle cx="12" cy="4" r="2"/><path d="m4 9 8-2 8 2M12 7v7m0 0-5 7m5-7 5 7"/>'};
const icon=kind=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+glyphs[kind]+'</svg>';
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
 if(kind==='concepts')return {engine:root.ConceptTrainer,id:options.subject==='russian'?'concept-russian':'concept-math',key:options.storageKey};
 if(kind==='quests')return {engine:root.LifeQuests,id:'life-quests',key:ROUTINE_KEY};
 return {engine:root.ActiveBreaks,id:'active-breaks',key:ROUTINE_KEY};
}
function environment(){return {esc,LP,generation:current.generation,learning:current.learning,observe:event=>current.pending.push(clone(event)),announce,speak};}
function announce(text){if(current)current.announcement=text;const live=doc.querySelector('#practice-live');if(live)live.textContent=text;}
function stopSpeech(){try{root.RecordedVoice?.stop();root.RussianVoice?.stop?.();root.speechSynthesis?.cancel();}catch(_){}}
function voiceNotice(text){if(!current)return;current.voiceMessage=text;let note=host?.querySelector('.ph-voice-note');if(!note&&host){note=doc.createElement('p');note.className='ph-voice-note';note.setAttribute('role','status');host.querySelector('.ph-tabs')?.after(note);}if(note)note.textContent=text;announce(text);}
function speak(text){
 stopSpeech();const content=String(text||'').replace(/<[^>]*>/g,' ').trim();if(!content)return;
 // Existing recorded-voice playback remains authoritative. New educational
 // text stays readable when no matching recording is available offline.
 if(root.RecordedVoice){const started=root.RecordedVoice.speak(content,{onError:()=>voiceNotice('Для этого задания запись пока недоступна. Инструкция полностью есть на экране.')});if(started!==false)return;}
 voiceNotice('Для этого задания запись пока недоступна. Инструкция полностью есть на экране.');
}
function rememberLauncher(opened){
 if(!options)return;updateNamed(options.storageKey,'launcher',{version:1,open:opened,kind:current?.kind||'concepts'});
}
function capture(){if(current&&!current.conflict&&current.engine.capture)current.engine.capture(current.state,host.querySelector('#practice-content'));}
function recoveryDraft(){return {state:clone(current.state),generation:current.generation,seen:clone(current.seen)};}
function showStorageWarning(){
 if(!current?.warning||!host)return;
 let note=host.querySelector('.ph-storage-note');if(!note){note=doc.createElement('div');note.className='ph-storage-note';note.setAttribute('role','status');host.querySelector('.ph-tabs')?.after(note);}
 note.innerHTML=esc(current.warning)+(current.conflict?'<button data-ph-action="reload">Открыть актуальное</button>':'');
}
function activityContent(){
 const html=current.engine.render(current.state,environment());
 const speakButton=/<button\b(?=[^>]*\bdata-(?:ct|lq|ab)-action="speak")[^>]*>[\s\S]*?<\/button>/g;
 if(!speakButton.test(html))return html;
 let text='';try{current.engine.handle(clone(current.state),'speak',{},Object.assign({},environment(),{observe(){},announce(){},speak(value){text=String(value||'');}}));}catch(_){}
 if(!voiceAvailability.has(text))voiceAvailability.set(text,!!(text&&root.RecordedVoice?.has?.(text)));
 // Offer playback only for a real existing recording. A button that can only
 // say "not recorded" would be a misleading first step for the child.
 return voiceAvailability.get(text)?html:html.replace(speakButton,'');
}
function saveCurrent(captureFirst=true){
 if(!current||current.conflict)return false;
 if(captureFirst)capture();const entry=record(current.key);
 if(entry.error){current.warning=entry.error;memory[current.key+':'+current.id]=recoveryDraft();return false;}
 if(entry.generation!==current.generation){current.conflict=true;current.warning='В другой вкладке начали заново. Открой актуальное состояние.';return false;}
 const latest=LP.getModule(entry.learning,current.id);
 if(signature(latest)!==signature(current.seen)&&latest?.ownerId!==writer){current.conflict=true;current.warning='Эту работу продолжили в другой вкладке. Сначала открой актуальное состояние.';return false;}
 let next=LP.merge(current.learning,entry.learning,{generation:entry.generation});
 for(const event of current.pending)next=LP.record(next,event);
 next=LP.setModule(next,current.id,current.state,{ownerId:writer,generation:entry.generation});
 const candidate=LP.getModule(next,current.id);
 if(!candidate||signature(candidate.state)!==signature(current.state)){current.warning='Сохранение этой работы недоступно. Прежние результаты остаются на месте.';return false;}
 if(!commit(current.key,entry,next)){
  const changed=record(current.key);if(!changed.error&&changed.text!==entry.text){current.conflict=true;current.warning='Сохранение изменилось в другой вкладке. Открой актуальное состояние.';}
  else current.warning='Не получилось сохранить на устройстве. Не закрывай страницу, чтобы продолжить эту работу.';
  memory[current.key+':'+current.id]=recoveryDraft();return false;
 }
 current.learning=next;current.seen=candidate;current.pending=[];current.warning='';delete memory[current.key+':'+current.id];return true;
}
function render(){
 if(!host||!current)return;
 const focused=doc.activeElement,hadFocus=host.contains(focused),focusSelector=focused&&hadFocus&&focused.dataset?Object.keys(focused.dataset).filter(k=>/^(ct|lq|ab|ph)/.test(k)).map(k=>'[data-'+k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase())+'="'+CSS.escape(focused.dataset[k])+'"]').join(''):'';
 const entry=record(ROUTINE_KEY),routine=cleanRoutine(!entry.error?LP.getModule(entry.learning,'routine')?.state:null);
 host.innerHTML='<div class="ph-shell"><header class="ph-header"><button class="ph-back" data-ph-action="close" aria-label="Вернуться к прежнему заданию">← К уроку</button><div><span class="ph-eyebrow">МАЛЕНЬКИЕ ШАГИ · БОЛЬШИЕ УМЕНИЯ</span><h1 id="practice-title">'+titles[current.kind]+'</h1></div><button class="ph-settings-button" data-ph-action="settings" aria-label="Настроить перерывы">⚙</button></header><nav class="ph-tabs" aria-label="Выбрать занятие">'+Object.keys(titles).map(kind=>'<button data-practice-open="'+kind+'" aria-pressed="'+(kind===current.kind)+'">'+icon(kind)+'<span>'+labels[kind]+'</span></button>').join('')+'</nav>'+(current.settings?'<section class="ph-settings"><h2>Когда предлагать разминку</h2><p>Только после законченного задания. Её всегда можно заменить или пропустить.</p><label>После заданий <select data-ph-setting="taskLimit">'+[4,5,6,8].map(n=>'<option '+(n===routine.taskLimit?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Или минут занятий <select data-ph-setting="minuteLimit">'+[8,10,12,15].map(n=>'<option '+(n===routine.minuteLimit?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label><input type="checkbox" data-ph-setting="enabled" '+(routine.enabled?'checked':'')+'> Предлагать перерывы</label></section>':'')+(current.warning?'<div class="ph-storage-note" role="status">'+esc(current.warning)+(current.conflict?'<button data-ph-action="reload">Открыть актуальное</button>':'')+'</div>':'')+'<main id="practice-content"><fieldset class="ph-fieldset" '+(current.conflict?'disabled':'')+'>'+activityContent()+'</fieldset></main><p class="ph-save-note">'+(current.warning?'Работа на этой странице':'Сохраняем на этом устройстве')+' · можно остановиться и продолжить позже</p><div id="practice-live" class="ph-sr-only" aria-live="polite"></div></div>';
 const live=host.querySelector('#practice-live');if(live)live.textContent=current.announcement||'';
 if(current.voiceMessage)voiceNotice(current.voiceMessage);
 let restoredFocus=false;if(focusSelector)try{const target=host.querySelector(focusSelector);if(target&&!target.disabled){target.focus({preventScroll:true});restoredFocus=doc.activeElement===target;}}catch(_){}
 if(hadFocus&&!restoredFocus){const target=current.conflict?host.querySelector('[data-ph-action="reload"]'):host.querySelector('#practice-content h2,#practice-content h3,#practice-content button');if(target){if(!target.matches('button,input,select,a'))target.tabIndex=-1;target.focus({preventScroll:true});}}
}
function lockUnderlying(value){const app=doc.getElementById('app');if(app){app.inert=value;if(value)app.setAttribute('aria-hidden','true');else app.removeAttribute('aria-hidden');}}
function open(kind,settings={}){
 if(!options||!titles[kind])return;
 if(current){saveCurrent();if(current.conflict&&!settings.force){render();return;}}
 options.beforeOpen?.();stopSpeech();const d=moduleDetails(kind);if(!d.engine)return;
 const entry=record(d.key),snapshot=entry.error?null:LP.getModule(entry.learning,d.id),recovery=memory[d.key+':'+d.id];
 const useRecovery=recovery&&recovery.generation===entry.generation&&signature(recovery.seen)===signature(snapshot);
 if(recovery&&!useRecovery)delete memory[d.key+':'+d.id];
 const savedState=useRecovery?recovery.state:snapshot?.state;
 const args={subject:options.subject,grade:2,learning:entry.learning,generation:entry.generation,LP};
 let restored=savedState?d.engine.restore(savedState,args):null;
 const unsupported=!!savedState&&!restored;
 current={kind,key:d.key,id:d.id,engine:d.engine,state:restored||d.engine.create(args),learning:entry.learning,generation:entry.generation,seen:snapshot,pending:[],conflict:unsupported,settings:false,warning:entry.error||(unsupported?'Сохранённая работа использует другой формат. Обнови приложение; прежняя запись не изменена.':'')};
 if(kind==='breaks'&&!unsupported&&(current.state.completed||current.state.skipped||current.state.phase==='done'))d.engine.handle(current.state,'replace',{},environment());
 if(!host){host=doc.createElement('section');host.id='practice-root';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-labelledby','practice-title');doc.body.appendChild(host);bindHost();}
 if(host.hidden){lastFocus=doc.activeElement;oldOverflow=doc.body.style.overflow;}
 else if(!doc.body.classList.contains('practice-open')){lastFocus=doc.activeElement;oldOverflow=doc.body.style.overflow;}
 host.hidden=false;doc.body.classList.add('practice-open');doc.body.style.overflow='hidden';lockUnderlying(true);rememberLauncher(true);render();
 if(!current.warning)saveCurrent();
 host.querySelector('.ph-back')?.focus({preventScroll:true});
}
function close(){
 if(!current)return;saveCurrent();if(current.kind==='breaks')resetRoutine();stopSpeech();rememberLauncher(false);current=null;returnTo=null;host.hidden=true;lockUnderlying(false);doc.body.classList.remove('practice-open');doc.body.style.overflow=oldOverflow;lastFocus?.focus?.({preventScroll:true});
}
function resetRoutine(){const entry=record(ROUTINE_KEY);if(entry.error)return;const routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state);routine.tasks=0;routine.seconds=0;routine.lastPause=Date.now();updateNamed(ROUTINE_KEY,'routine',routine);injectLauncher();}
function finishBreak(){
 const previous=returnTo;resetRoutine();returnTo=null;
 if(previous)open(previous,{force:true});else close();
}
function action(action,data){
 if(!current||current.conflict)return;
 capture();current.announcement='';if(action!=='speak')current.voiceMessage='';const before=current.state.solved;current.engine.handle(current.state,action,data||{},environment());
 // The handler may have advanced to a different task. Never capture the old
 // input DOM into its new state before the next render.
 saveCurrent(false);render();
 if(current.kind==='breaks'&&current.state.returnRequested){finishBreak();return;}
 if(!before&&current.state.solved&&current.kind!=='breaks')scanLearning(true);
}
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
  if(el.dataset.practiceOpen){event.preventDefault();open(el.dataset.practiceOpen);return;}
  const ph=el.dataset.phAction;
  if(ph){event.preventDefault();if(ph==='close')close();else if(ph==='settings'){current.settings=!current.settings;render();}else if(ph==='reload'){const kind=current.kind;delete memory[current.key+':'+current.id];current=null;open(kind,{force:true});}return;}
  for(const prefix of ['ct','lq','ab'])if(el.dataset[prefix+'Action']){event.preventDefault();action(el.dataset[prefix+'Action'],el.dataset);return;}
 });
 host.addEventListener('input',event=>{event.stopPropagation();lastInteraction=Date.now();captureInput();});
 host.addEventListener('change',event=>{
  event.stopPropagation();lastInteraction=Date.now();const key=event.target.dataset.phSetting;
  if(key){const entry=record(ROUTINE_KEY);if(entry.error)return;const routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state);routine[key]=key==='enabled'?event.target.checked:Number(event.target.value);updateNamed(ROUTINE_KEY,'routine',cleanRoutine(routine));return;}
  captureInput();
 });
 host.addEventListener('keydown',event=>{
  event.stopPropagation();lastInteraction=Date.now();if(event.key==='Escape'){event.preventDefault();close();return;}
  if(event.key==='Enter'&&event.target.matches('[data-ct-input]')&&host.querySelector('[data-ct-action="check"]')){event.preventDefault();action('check',{});return;}
  if(event.key==='Tab'){
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
 if(!options)return;const app=doc.getElementById('app');if(!app||app.querySelector('.practice-launcher'))return;
 const bar=doc.createElement('nav');bar.className='practice-launcher';bar.setAttribute('aria-label','Другие занятия');bar.innerHTML=Object.keys(titles).map(kind=>'<button data-practice-open="'+kind+'">'+icon(kind)+'<span>'+labels[kind]+'</span></button>').join('');
 const top=app.querySelector('.topbar');if(top)top.after(bar);else(app.querySelector('.main,main')||app).prepend(bar);
}
function requestBreak(){
 if(scheduled||current?.kind==='breaks')return;const entry=record(ROUTINE_KEY);if(entry.error||!due(LP.getModule(entry.learning,'routine')?.state))return;
 scheduled=true;setTimeout(()=>{scheduled=false;if(current?.kind==='breaks')return;if(current?!current.state.solved:!options.atBoundary?.())return;if(doc.hidden||doc.querySelector('#overlay .modal'))return;returnTo=current?.kind||null;open('breaks');},0);
}
function scanLearning(boundary){
 if(!options||writing)return;const entry=record(ROUTINE_KEY);if(entry.error)return;
 let routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state),changed=false,added=0;
 for(const key of KEYS){const owner=key===ROUTINE_KEY?entry:record(key);if(owner.error)continue;const result=countCorrect(routine,owner.learning,key);routine=result.routine;changed=changed||result.changed;added+=result.added;}
 if(changed)updateNamed(ROUTINE_KEY,'routine',routine);
 if(added>0&&boundary)requestBreak();
}
function queueScan(){if(scanQueued)return;scanQueued=true;queueMicrotask(()=>{scanQueued=false;injectLauncher();scanLearning(true);});}
function mount(config){
 if(options||!LP||!LP.getModule)return;options=config;injectLauncher();scanLearning(false);
 doc.addEventListener('click',event=>{const button=event.target.closest('[data-practice-open]');if(button&&!host?.contains(button)){event.preventDefault();event.stopPropagation();lastInteraction=Date.now();returnTo=null;open(button.dataset.practiceOpen);}},true);
 for(const name of ['pointerdown','keydown'])doc.addEventListener(name,()=>{lastInteraction=Date.now();},{passive:true});
 const app=doc.getElementById('app');if(app)new MutationObserver(queueScan).observe(app,{childList:true,subtree:true});
 root.addEventListener('storage',event=>{
  if(!KEYS.includes(event.key))return;
  if(current&&event.key===current.key){const entry=record(current.key),latest=entry.error?null:LP.getModule(entry.learning,current.id);if(entry.error||entry.generation!==current.generation||signature(latest)!==signature(current.seen)&&latest?.ownerId!==writer){current.conflict=true;current.warning=entry.error||'Эту работу изменили в другой вкладке. Сначала открой актуальное состояние.';render();}}
  scanLearning(false);
 });
 root.addEventListener('pagehide',()=>{if(current)saveCurrent();});
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden&&current){capture();if(current.kind==='breaks')current.state.running=false;saveCurrent(false);}else if(current?.kind==='breaks')render();});
 setInterval(()=>{
  if(doc.hidden||Date.now()-lastInteraction>120000)return;
  if(current?.kind==='breaks'&&current.state.running){
   current.engine.handle(current.state,'tick',{seconds:1,visible:true},environment());
  const routine=current.engine.current(current.state),remaining=Math.max(0,Math.ceil(routine.seconds-current.state.elapsed)),timer=host.querySelector('[data-ab-timer]');
   if(timer){timer.textContent=Math.floor(remaining/60)+':'+String(remaining%60).padStart(2,'0');timer.setAttribute('aria-label','Осталось '+remaining+' секунд');}
   if(!current.state.running){saveCurrent(false);render();}else if(current.state.elapsed%5===0)saveCurrent(false);
   return;
  }
 },1000);
 setInterval(()=>{
  if(doc.hidden||Date.now()-lastInteraction>120000||current?.kind==='breaks')return;
  const entry=record(ROUTINE_KEY);if(entry.error)return;const routine=cleanRoutine(LP.getModule(entry.learning,'routine')?.state);routine.seconds=Math.min(7200,routine.seconds+15);updateNamed(ROUTINE_KEY,'routine',routine);
  // A timer can make a pause due, but cannot interrupt unfinished work.
 },15000);
 let requested='';try{requested=new URL(root.location.href).searchParams.get('activity')||'';}catch(_){}
 const launcher=record(options.storageKey),last=!launcher.error?LP.getModule(launcher.learning,'launcher')?.state:null;
 if(titles[requested]){open(requested);try{const url=new URL(root.location.href);url.searchParams.delete('activity');root.history.replaceState(root.history.state,'',url.href);}catch(_){}}else if(last?.version===1&&last.open&&titles[last.kind])open(last.kind);
}
root.PracticeHub={mount,open,close,snapshot:()=>current?clone({kind:current.kind,ownerKey:current.key,moduleId:current.id,state:current.state,conflict:current.conflict,storageWarning:current.warning}):null};
})(typeof window==='undefined'?globalThis:window);
