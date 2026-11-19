(function(root){
'use strict';
// Small mandatory concept checks reuse ConceptTrainer. This wrapper stores
// curriculum gates beside existing progress; it does not replace lesson marks.
const ID=/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),copy=v=>JSON.parse(JSON.stringify(v));
const C=()=>root.ConceptTrainer;
function bounded(value,limit){try{const text=JSON.stringify(value);if(text.length>limit)return null;return JSON.parse(text);}catch(_){return null;}}
function config(value){
 if(!object(value)||!ID.test(value.id)||typeof value.topicId!=='string'||!Array.isArray(value.taskIds))return null;
 const tasks=[...new Set(value.taskIds)].filter(id=>typeof id==='string'&&ID.test(id));
 if(!tasks.length||tasks.length>6||tasks.length!==value.taskIds.length||!C()||tasks.some(id=>!C().TASKS.some(t=>t.id===id&&t.topic===value.topicId)))return null;
 const context=bounded(value.context||{},16000);if(!context)return null;
 const requiredGrade=Math.max(value.grade===1?1:2,...tasks.map(id=>C().TASKS.find(t=>t.id===id).grade===1?1:2));
 return {id:value.id,grade:requiredGrade,topicId:value.topicId,taskIds:tasks,title:String(value.title||'Проверим понятия').slice(0,160),revision:Number.isInteger(value.revision)&&value.revision>0?value.revision:1,context};
}
function create(options){options=options||{};return {version:1,generation:options.generation||'initial',subject:options.subject==='russian'?'russian':'math',grade:options.grade===1?1:2,gates:{},drafts:{},active:null,pendingCycles:{},solved:false};}
function flags(a){a=a||{};return (a.explanation?1:0)|(a.visual?2:0)|(a.afterError?4:0)|(a.workedExample?8:0)|(a.generic?16:0);}
function unpackFlags(n){return {explanation:!!(n&1),visual:!!(n&2),afterError:!!(n&4),workedExample:!!(n&8),generic:!!(n&16)};}
function packRun(run,cfg){
 const a=run.attempt;
 return {p:run.phase,i:run.index,a:run.answer,x:copy(run.placements||{}),s:run.selected,ok:run.solved===true,skip:run.skipped===true,read:run.read?.[cfg.topicId]===true,
  d:cfg.taskIds.map(id=>{const d=run.done?.[id]||{};return ({correct:1,incorrect:2,skipped:3}[d.outcome]||0)|(d.assisted?8:0)|(d.afterError?16:0);}),
  at:a?[a.attemptId,a.firstOutcome,a.errors,flags(a.assistance),a.startedAt]:null,
  f:run.feedback?{text:String(run.feedback.text||'').slice(0,400),type:run.feedback.type}:null};
}
function restoreRun(p,cfg,state,env){
 if(!object(p))return null;
 if(Array.isArray(p.queue))return C().restore(p,env);
 if(!Number.isInteger(p.i)||p.i<0||p.i>=cfg.taskIds.length)return null;
 const task=C().TASKS.find(t=>t.id===cfg.taskIds[p.i]);if(!task)return null;
 const run=C().create({subject:state.subject,grade:state.grade,generation:state.generation});
 run.topicId=cfg.topicId;run.queue=cfg.taskIds.slice();run.index=p.i;run.phase=['intro','task','summary'].includes(p.p)?p.p:'task';run.answer=typeof p.a==='string'?p.a.slice(0,40):'';run.placements=object(p.x)?copy(p.x):{};run.selected=typeof p.s==='string'?p.s:'';run.solved=p.ok===true;run.skipped=p.skip===true;run.feedback=object(p.f)?copy(p.f):null;
 if(p.read)run.read[cfg.topicId]=true;
 cfg.taskIds.forEach((id,i)=>{const d=Number(p.d?.[i])||0;if(d&3)run.done[id]={outcome:['notchecked','correct','incorrect','skipped'][d&3],assisted:!!(d&8),afterError:!!(d&16)};});
 if(Array.isArray(p.at)){const a=env.LP.attempt(task.id,task.skillIds,{attemptId:p.at[0],generation:state.generation,startedAt:p.at[4],subject:state.subject,mode:'concept',evidenceKind:task.kind});a.firstOutcome=['notchecked','correct','incorrect'].includes(p.at[1])?p.at[1]:'notchecked';a.errors=Number.isInteger(p.at[2])?Math.max(0,Math.min(1000,p.at[2])):0;a.assistance=unpackFlags(Number(p.at[3])||0);run.attempt=a;}
 return C().restore(run,env);
}
function snapshot(state){
 const result=copy(state);
 if(state.active)result.active={config:copy(state.active.config),run:packRun(state.active.run,state.active.config)};
 // Each unfinished lesson keeps its stable identifiers and complete attempt.
 // Only repeated strings are shared within this one snapshot: pool indexes
 // never depend on a curriculum/bank order and cannot change task identity.
 const strings=[],indexes=new Map(),intern=text=>{if(!indexes.has(text)){indexes.set(text,strings.length);strings.push(text);}return indexes.get(text);};
 for(const [id,draft]of Object.entries(result.drafts)){
  const cfg=draft.config,run=draft.run;
  if(run.f)run.f=Object.assign({},run.f,{text:intern(run.f.text)});
  result.drafts[id]={c:[cfg.grade,intern(cfg.topicId),cfg.taskIds.map(intern),intern(cfg.title),cfg.revision],r:run};
 }
 result.draftFormat='strings-v1';result.draftStrings=strings;
 return result;
}
function unpackDraft(id,draft,raw){
 if(raw.draftFormat===undefined)return draft;
 if(!object(draft)||!Array.isArray(draft.c)||draft.c.length!==5||!object(draft.r))return null;
 const strings=raw.draftStrings,read=i=>Number.isInteger(i)&&i>=0&&i<strings.length&&typeof strings[i]==='string'?strings[i]:null,c=draft.c;
 if(!Array.isArray(c[2]))return null;
 const topicId=read(c[1]),taskIds=c[2].map(read),title=read(c[3]);if(topicId===null||title===null||taskIds.some(id=>id===null))return null;
 const run=copy(draft.r);if(run.f){const text=read(run.f.text);if(text===null)return null;run.f=Object.assign({},run.f,{text});}
 return {config:{id,grade:c[0],topicId,taskIds,title,revision:c[4],context:{}},run};
}
function restore(raw,options){
 options=options||{};if(!object(raw)||raw.version!==1||raw.generation!==options.generation||!C()||!options.LP)return null;
 if(raw.draftFormat!==undefined&&(raw.draftFormat!=='strings-v1'||!Array.isArray(raw.draftStrings)))return null;
 const state=create(options);state.subject=raw.subject==='russian'?'russian':'math';state.grade=raw.grade===1?1:2;
 if(object(raw.gates))for(const [id,g] of Object.entries(raw.gates).slice(-200))if(ID.test(id)&&object(g)&&g.status==='completed'&&Number.isInteger(g.revision))state.gates[id]={status:'completed',revision:g.revision,assisted:g.assisted===true,afterError:g.afterError===true,checkedAt:Number.isFinite(g.checkedAt)?g.checkedAt:0};
 if(object(raw.drafts))for(const [id,encoded]of Object.entries(raw.drafts).slice(-120)){const draft=unpackDraft(id,encoded,raw),cfg=config(draft?.config);if(!cfg||cfg.id!==id)continue;const run=restoreRun(draft.run,cfg,state,options);if(run)state.drafts[id]={config:Object.assign({},cfg,{context:{}}),run:packRun(run,cfg)};}
 if(raw.active){const cfg=config(raw.active.config);if(!cfg)return null;const run=restoreRun(raw.active.run,cfg,state,options);if(!run)return null;state.active={config:cfg,run};state.solved=run.solved;}
 if(object(raw.pendingCycles))for(const [id,v]of Object.entries(raw.pendingCycles))if(['kubiki','bricks','slovograd','life'].includes(id)&&object(v)){const saved=bounded(v,16000);if(saved)state.pendingCycles[id]=saved;}
 return state;
}
function stash(state){if(!state.active)return;const {config:cfg,run}=state.active;state.drafts[cfg.id]={config:Object.assign({},copy(cfg),{context:{}}),run:packRun(run,cfg)};}
function satisfied(state,value){const cfg=config(value),done=cfg&&state.gates[cfg.id];return !!(done&&done.status==='completed'&&done.revision>=cfg.revision);}
function requireGate(state,value,env){
 const cfg=config(value);if(!cfg)return false;if(satisfied(state,cfg))return false;
 if(state.active?.config.id===cfg.id){state.active.config=cfg;return true;}
 stash(state);const cached=state.drafts[cfg.id];let run=cached&&restoreRun(cached.run,cfg,state,env);
 if(!run){run=C().create({subject:state.subject,grade:state.grade,generation:state.generation});if(!C().handle(run,'topic',{topic:cfg.topicId},env))return false;run.queue=cfg.taskIds.slice();run.index=0;run.attempt=null;run=C().restore(run,env);}
 if(!run)return false;state.active={config:cfg,run};state.solved=run.solved;return true;
}
function completed(state){const a=state.active;return !!a&&a.config.taskIds.every(id=>a.run.done?.[id]?.outcome==='correct');}
function finish(state){
 if(!completed(state))return null;const {config:cfg,run}=state.active;
 state.gates[cfg.id]={status:'completed',revision:cfg.revision,checkedAt:Date.now(),assisted:cfg.taskIds.some(id=>run.done[id].assisted),afterError:cfg.taskIds.some(id=>run.done[id].afterError)};
 const context=copy(cfg.context);delete state.drafts[cfg.id];state.active=null;state.solved=false;return context;
}
function current(state){return state.active?C().current(state.active.run):null;}
function handle(state,action,data,env){
 if(!state.active||['grade','topic','menu','repeat','skip','resume'].includes(action))return false;
 const changed=C().handle(state.active.run,action,data||{},env);state.solved=state.active.run.solved;stash(state);return changed;
}
function capture(state,container){return state.active?C().capture(state.active.run,container):false;}
function render(state,env){
 if(!state.active)return '<section class="journey-empty"><h2>Проверка понятий завершена</h2><p>Продолжим задания этой темы.</p></section>';
 const a=state.active;
 return '<section class="journey-concepts"><div class="journey-label"><span>ТЕОРИЯ → ПОНЯТИЯ → ПРАКТИКА</span><strong>'+env.esc(a.config.title)+'</strong><p>Короткая проверка: '+(a.run.index+1)+' из '+a.config.taskIds.length+'. После верного ответа продолжим по порядку.</p></div>'+C().render(a.run,env)+'</section>';
}
root.LearningJourney={create,restore,snapshot,config,satisfied,requireGate,completed,finish,current,handle,capture,render,stash};
})(typeof window==='undefined'?globalThis:window);
