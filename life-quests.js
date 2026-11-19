(function(root){
'use strict';
// Pure, shared life-skill activities. The host owns storage, input delegation
// and observation merging. A virtual solution never verifies a real-life act.
const VERSION=1,MAX_UNDO=20;
const categories={all:'Все приключения',places:'Вещи по местам',sorting:'Сортируем',school:'В школу',sports:'На тренировку',music:'На музыку',outings:'Прогулки и поездки',planning:'Планы на день',home:'Дом и забота'};
const clone=v=>JSON.parse(JSON.stringify(v));
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const escDefault=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const data=()=>root.LifeQuestData||{items:{},zones:{},quests:[]};
const quests=()=>Array.isArray(data().quests)?data().quests:[];
const quest=id=>quests().find(q=>q.id===id)||null;
const item=id=>data().items[id]||{id,label:id,icon:'□'};
const zone=id=>data().zones[id]||{id,label:id,icon:'□'};
const ids=q=>Array.isArray(q.itemIds)?q.itemIds:[];
const zoneIds=q=>Array.isArray(q.zoneIds)?q.zoneIds:[];
const steps=q=>Array.isArray(q.steps)?q.steps:[];
function generation(options){return typeof options.generation==='string'?options.generation:'initial';}
function schedule(){return root.LifeSchoolSchedule||null;}
function schoolChoice(value,options){const S=schedule();if(!S)return null;const recommended=S.recommended(options?.date),day=S.day(value?.dayId)||S.day(recommended.dayId),variants=S.variantsFor(day.id);return {dayId:day.id,variantId:variants.some(v=>v.id===value?.variantId)?value.variantId:'base'};}
function create(options){options=options||{};return {school:schoolChoice(null,options),version:VERSION,generation:generation(options),view:'menu',category:'all',questId:null,packingFlow:null,phase:'intro',selected:null,placements:{},chosen:[],order:[],ruleId:null,feedback:null,issues:[],solved:false,attempt:null,undo:[],done:{},drafts:{},real:{},sequence:0,adultOpen:false,guide:null,guideSeen:{},motion:null,motionSeq:0,mission:{day:'',questId:'',history:[]}};}
function current(state){return quest(state.questId);}
function packingEngine(q){return q&&q.mode==='pack'&&Array.isArray(q.packingStages)&&q.packingStages.length&&root.SchoolPackingFlow?root.SchoolPackingFlow:null;}
function packingCurrent(state,q){const F=packingEngine(q);return F&&state.packingFlow?F.current(q,state.packingFlow):null;}
function syncPacking(state,q){const F=packingEngine(q);if(F&&state.packingFlow)state.chosen=F.chosen(q,state.packingFlow);}
function startAttempt(q,env){const LP=env&&env.LP;const skills=['life.'+(q.skill||q.category||q.mode)];return LP?LP.attempt(q.id,skills,{generation:generation(env||{}),subject:'life',mode:q.mode,evidenceKind:'virtual-life-task',materialRevision:1,criteriaRevision:1}):{attemptId:'life-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),taskId:q.id,skillIds:skills,generation:generation(env||{}),firstOutcome:'notchecked',assistance:{},errors:0};}
function attemptClean(raw,q,env){
 const a=object(raw)?clone(raw):startAttempt(q,env);
 if(a.taskId!==undefined&&a.taskId!==q.id||a.generation!==undefined&&a.generation!==generation(env||{}))return startAttempt(q,env);
 a.taskId=q.id;a.generation=generation(env||{});
 a.attemptId=typeof a.attemptId==='string'&&a.attemptId.length<160?a.attemptId:startAttempt(q,env).attemptId;
 a.skillIds=Array.isArray(a.skillIds)?a.skillIds.filter(v=>typeof v==='string').slice(0,8):['life.'+(q.skill||q.category||q.mode)];
 a.assistance=object(a.assistance)?a.assistance:{};
 for(const k of ['visual','explanation','afterError','workedExample'])a.assistance[k]=a.assistance[k]===true;
 a.errors=Number.isInteger(a.errors)?Math.min(1000,Math.max(0,a.errors)):0;
 a.firstOutcome=['correct','incorrect','skipped','notchecked'].includes(a.firstOutcome)?a.firstOutcome:'notchecked';return a;
}
function model(state){const result={placements:clone(state.placements),chosen:state.chosen.slice(),order:state.order.slice(),ruleId:state.ruleId},F=packingEngine(current(state));if(F&&state.packingFlow)result.packingFlow=F.snapshot(state.packingFlow,current(state));return result;}
function cleanModel(raw,q,options){
 raw=object(raw)?raw:{};options=options||{};const result={placements:{},chosen:[],order:[],ruleId:null},ii=ids(q),zz=zoneIds(q),ss=steps(q).map(s=>s.id);
 if(object(raw.placements))for(const id of ii)if(zz.includes(raw.placements[id]))result.placements[id]=raw.placements[id];
 result.chosen=Array.isArray(raw.chosen)?[...new Set(raw.chosen.filter(id=>ii.includes(id)))]:[];
 result.order=Array.isArray(raw.order)?[...new Set(raw.order.filter(id=>ss.includes(id)))]:[];
 if(Array.isArray(q.ruleChoices)&&q.ruleChoices.some(r=>r.id===raw.ruleId))result.ruleId=raw.ruleId;
 const F=packingEngine(q);if(F){result.packingFlow=F.restore(raw.packingFlow,q,{chosen:result.chosen,solved:options.solved===true})||F.create(q,{chosen:result.chosen,solved:options.solved===true});result.chosen=F.chosen(q,result.packingFlow);}
 return result;
}
function shortAttempt(a){return {attemptId:a.attemptId,firstOutcome:a.firstOutcome,errors:a.errors,assistance:Object.fromEntries(Object.entries(a.assistance||{}).filter(([,v])=>v===true))};}
function taskSnapshot(state){return {...model(state),phase:state.phase,solved:state.solved,attempt:shortAttempt(state.attempt),issues:clone(state.issues),sequence:state.sequence,guide:state.phase==='guide'?cleanGuide(state.guide):null};}
function byteSize(value){const text=JSON.stringify(value);let bytes=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<text.length){bytes+=4;i++;}else bytes+=3;}return bytes;}
function compact(state){
 // Keep every unfinished answer. Compress repeatable metadata rather than
 // evicting a draft merely because the child opened another adventure.
 for(const id of Object.keys(state.drafts)){
  const draft=state.drafts[id],q=quest(id);if(draft.solved||!q){delete state.drafts[id];continue;}
  draft.attempt=shortAttempt(draft.attempt);const F=packingEngine(q);if(F&&draft.packingFlow?.version===F.VERSION)draft.packingFlow=F.snapshot(draft.packingFlow,q);delete draft.selected;delete draft.feedback;
  if(q.mode==='sort'||q.mode==='rule'){delete draft.chosen;delete draft.order;}
  if(q.mode==='pack'){delete draft.placements;delete draft.order;delete draft.ruleId;}
  if(q.mode==='sequence'){delete draft.placements;delete draft.chosen;delete draft.ruleId;}
 }
 // Storage compaction is lossless in snapshot(); keep undo, issue details and
 // solved layouts even when the live catalogue exceeds its stored byte size.
 return state;
}
function saveDraft(state){const q=current(state);if(q&&!state.solved)state.drafts[q.id]=taskSnapshot(state);else if(q)delete state.drafts[q.id];compact(state);}
function cleanGuide(v){return object(v)?{step:Number.isInteger(v.step)?Math.max(0,Math.min(2,v.step)):0,selected:v.selected===true,done:v.done===true,play:Number.isInteger(v.play)?Math.max(0,Math.min(1000,v.play)):0}:null;}
function loadQuest(state,q,env,replay){
 if(current(state)&&state.view==='quest')saveDraft(state);
 if(q.schedule)state.school=schoolChoice({dayId:q.schedule.dayId,variantId:q.schedule.variantId},env);
 const draft=!replay&&state.drafts[q.id];state.view='quest';state.questId=q.id;state.packingFlow=null;state.selected=null;state.undo=[];state.adultOpen=false;state.guide=null;state.motion=null;
 if(draft){Object.assign(state,cleanModel(draft,q,{solved:draft.solved===true}));state.phase=['intro','play','real','guide','small-real'].includes(draft.phase)?draft.phase:'play';state.solved=draft.solved===true;state.attempt=attemptClean(draft.attempt,q,env);state.issues=cleanIssues(draft.issues,q);state.guide=cleanGuide(draft.guide);state.feedback=cleanFeedback(draft.feedback)||(state.issues.length?{type:'error',text:'Продолжим с сохранённого места. Здесь остались пункты для проверки.'}:null);}
 else if(!replay&&state.done[q.id]&&state.done[q.id].model){const past=state.done[q.id];Object.assign(state,cleanModel(past.model,q,{solved:true}));state.phase='play';state.solved=true;state.attempt=startAttempt(q,env);state.attempt.assistance.visual=past.helped;state.attempt.assistance.afterError=past.afterError;state.attempt.firstOutcome=past.afterError?'incorrect':'correct';state.feedback={type:'success',text:'Ты уже справился с этой игровой ситуацией. Можно посмотреть свой план или попробовать заново.'};state.issues=[];}
 else{Object.assign(state,cleanModel({},q));state.phase='intro';state.solved=false;state.attempt=startAttempt(q,env);state.feedback=null;state.issues=[];}
 if(state.phase==='real'&&!state.solved)state.phase='play';if(state.phase==='guide'&&!state.guide)state.phase='play';state.sequence++;saveDraft(state);
}
function cleanFeedback(value){return object(value)&&typeof value.text==='string'?{type:['success','error','hint'].includes(value.type)?value.type:'hint',text:value.text.slice(0,900)}:null;}
function cleanIssues(value,q){
 return Array.isArray(value)?value.filter(v=>object(v)&&typeof v.code==='string').slice(0,24).map(v=>{
  const stage=Array.isArray(q.packingStages)&&q.packingStages.find(s=>s.id===v.stageId),belongs=Array.isArray(q.packingStages)&&q.packingStages.find(s=>s.id===v.belongsTo);
  return {code:v.code.slice(0,40),item:ids(q).includes(v.item)?v.item:undefined,step:steps(q).some(s=>s.id===v.step)?v.step:undefined,before:steps(q).some(s=>s.id===v.before)?v.before:undefined,stageId:stage?stage.id:undefined,belongsTo:belongs?belongs.id:undefined,targetTitle:(belongs||stage)?.title};
 }):[];
}
// The live engine remains v1. A versioned, lossless storage envelope prevents
// older clients from treating a compressed future snapshot as an empty menu.
const STORAGE_VERSION=3,STORAGE_ENCODING='life-dictionary-v1',FORBIDDEN=new Set(['__proto__','constructor','prototype']);
function snapshot(state){
 const strings=[],lookup=new Map(),source=clone(state);let nodes=0;
 // A staged model already stores each selected item and its physical order
 // inside the flow. Omit only this derivable duplicate, never an answer.
 const packRecord=(record,q,completedModel)=>{const F=packingEngine(q);if(!object(record)||!F||!record.packingFlow)return;const flow=F.restore(record.packingFlow,q,{chosen:record.chosen,solved:record.solved===true});if(!flow||Array.isArray(record.chosen)&&JSON.stringify(F.chosen(q,flow))!==JSON.stringify(record.chosen))return;const answer=F.chosen(q,flow),rebuilt=completedModel&&F.completed(q,flow)?F.create(q,{chosen:answer,solved:true}):null;const exact=rebuilt&&rebuilt.index===flow.index&&JSON.stringify(F.chosen(q,rebuilt))===JSON.stringify(answer)&&q.packingStages.every(stage=>{const a=F.stateFor(q,flow,stage.id),b=F.stateFor(q,rebuilt,stage.id);return a.checked===b.checked&&JSON.stringify(a.selected)===JSON.stringify(b.selected);});if(exact){record.chosen=answer;delete record.packingFlow;}else{record.packingFlow=F.snapshot(flow,q);delete record.chosen;}if(object(record.placements)&&!Object.keys(record.placements).length)delete record.placements;if(Array.isArray(record.order)&&!record.order.length)delete record.order;if(record.ruleId===null)delete record.ruleId;};
 const active=source.questId&&quest(source.questId);if(active){packRecord(source,active);for(const model of source.undo||[])packRecord(model,active);}
 for(const q of quests()){packRecord(source.drafts?.[q.id],q);packRecord(source.done?.[q.id]?.model,q,true);}
 const ref=text=>{if(!lookup.has(text)){lookup.set(text,strings.length);strings.push(text);}return lookup.get(text);};
 function encode(value,depth){
  if(++nodes>30000||depth>30)throw Error('Life snapshot exceeds structural bounds');
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='string')return ref(value);
  if(typeof value==='number')return [0,Number.isFinite(value)?value:null];
  if(Array.isArray(value))return [1,...value.map(v=>encode(v,depth+1))];
  const result=[2];for(const key of Object.keys(value)){if(FORBIDDEN.has(key))continue;result.push(ref(key),encode(value[key],depth+1));}return result;
 }
 return {version:STORAGE_VERSION,encoding:STORAGE_ENCODING,generation:source.generation,strings,value:encode(source,0)};
}
function decodeSnapshot(raw){
 if(!object(raw)||![2,STORAGE_VERSION].includes(raw.version)||raw.encoding!==STORAGE_ENCODING||!Array.isArray(raw.strings)||raw.strings.length>4096)return null;
 try{
  if(byteSize(raw)>48*1024)return null;const pool=raw.strings;if(pool.some(s=>typeof s!=='string'||byteSize(s)>8192))return null;
  let nodes=0,budget=0;const charge=n=>{budget+=n;if(budget>256*1024)throw Error('expanded');};
  const text=i=>{if(!Number.isInteger(i)||i<0||i>=pool.length)throw Error('reference');const s=pool[i];charge(byteSize(s));return s;};
  function decode(value,depth){
   if(++nodes>30000||depth>30)throw Error('structure');
   if(value===null||typeof value==='boolean'){charge(5);return value;}
   if(typeof value==='number')return text(value);
   if(!Array.isArray(value)||!value.length)throw Error('tag');charge(2+value.length);
   if(value[0]===0){if(value.length!==2||typeof value[1]!=='number'||!Number.isFinite(value[1]))throw Error('number');charge(String(value[1]).length);return value[1];}
   if(value[0]===1)return value.slice(1).map(v=>decode(v,depth+1));
   if(value[0]!==2||value.length%2!==1)throw Error('object');const result={};
   for(let i=1;i<value.length;i+=2){const key=text(value[i]);if(FORBIDDEN.has(key)||Object.prototype.hasOwnProperty.call(result,key))throw Error('key');result[key]=decode(value[i+1],depth+1);}return result;
  }
  const decoded=decode(raw.value,0);if(!object(decoded)||decoded.version!==VERSION||decoded.generation!==raw.generation||byteSize(decoded)>256*1024)return null;return decoded;
 }catch(_){return null;}
}
function compatiblePackingRecord(raw,q){
 if(!object(raw)||raw.packingFlow===undefined||raw.packingFlow===null)return true;const F=packingEngine(q);
 return !!F&&!!F.restore(raw.packingFlow,q,{chosen:raw.chosen,solved:raw.solved===true});
}
function restore(raw,options){
 options=options||{};const encoded=[2,STORAGE_VERSION].includes(raw?.version);if(encoded){raw=decodeSnapshot(raw);if(!raw)return null;}else if(raw?.encoding)return null;if(!object(raw)||raw.version!==VERSION||raw.generation!==generation(options))return null;
 let length;try{length=byteSize(raw);}catch(_){return null;}if(length>(encoded?256:48)*1024)return null;
 const active=raw.view==='quest'?quest(raw.questId):null;if(active&&(!compatiblePackingRecord(raw,active)||(Array.isArray(raw.undo)&&raw.undo.some(v=>!compatiblePackingRecord(v,active)))))return null;
 for(const q of quests()){if(!compatiblePackingRecord(raw.drafts?.[q.id],q)||!compatiblePackingRecord(raw.done?.[q.id]?.model,q))return null;}
 const state=create(options);state.school=schoolChoice(raw.school,options);state.motionSeq=Number.isInteger(raw.motionSeq)?Math.max(0,Math.min(100000,raw.motionSeq)):0;if(object(raw.guideSeen))for(const q of quests())if(raw.guideSeen[q.id]===true)state.guideSeen[q.id]=true;if(object(raw.mission)){const m=raw.mission;state.mission.day=validDay(m.day)?m.day:'';state.mission.questId=quest(m.questId)?m.questId:'';state.mission.history=(Array.isArray(m.history)?m.history:[]).filter(v=>object(v)&&validDay(v.day)&&quest(v.questId)).slice(-14).map(v=>({day:v.day,questId:v.questId,source:'child'}));}state.view=raw.view==='quest'?'quest':'menu';state.category=typeof raw.category==='string'&&raw.category.length<50?raw.category:'all';state.sequence=Number.isInteger(raw.sequence)?Math.max(0,Math.min(100000,raw.sequence)):0;
 if(object(raw.done))for(const q of quests()){const value=raw.done[q.id];if(object(value)){state.done[q.id]={count:Number.isInteger(value.count)?Math.max(1,Math.min(999,value.count)):1,helped:value.helped===true,afterError:value.afterError===true,sequence:Number.isInteger(value.sequence)?value.sequence:0};if(object(value.model)){state.done[q.id].model=cleanModel(value.model,q,{solved:true});const F=packingEngine(q);if(F&&state.done[q.id].model.packingFlow)state.done[q.id].model.packingFlow=F.snapshot(state.done[q.id].model.packingFlow,q);}}}
 if(object(raw.real))for(const q of quests()){const value=raw.real[q.id];if(!object(value))continue;const n=Array.isArray(q.realSteps)?q.realSteps.length:0;state.real[q.id]={checks:Array.from({length:n},(_,i)=>value.checks&&value.checks[i]===true),selfReported:value.selfReported===true,adultReported:value.adultReported===true,microDay:validDay(value.microDay)?value.microDay:''};if(!state.real[q.id].checks.every(Boolean)){state.real[q.id].selfReported=false;state.real[q.id].adultReported=false;}if(!state.real[q.id].selfReported)state.real[q.id].adultReported=false;}
 if(object(raw.drafts))for(const q of quests()){const d=raw.drafts[q.id];if(!object(d))continue;state.drafts[q.id]={...cleanModel(d,q,{solved:d.solved===true}),phase:['intro','play','real','guide','small-real'].includes(d.phase)?d.phase:'play',selected:null,solved:d.solved===true,attempt:attemptClean(d.attempt,q,options),feedback:cleanFeedback(d.feedback),guide:cleanGuide(d.guide),issues:cleanIssues(d.issues,q),sequence:Number.isInteger(d.sequence)?d.sequence:0};}
 const q=state.view==='quest'?quest(raw.questId):null;if(q){state.questId=q.id;Object.assign(state,cleanModel(raw,q,{solved:raw.solved===true}));state.phase=['intro','play','real','guide','small-real'].includes(raw.phase)?raw.phase:'play';state.solved=raw.solved===true;state.attempt=attemptClean(raw.attempt,q,options);state.guide=cleanGuide(raw.guide);state.feedback=cleanFeedback(raw.feedback);state.issues=cleanIssues(raw.issues,q);state.undo=Array.isArray(raw.undo)?raw.undo.slice(-MAX_UNDO).filter(object).map(v=>cleanModel(v,q)):[];if(state.phase==='real'&&!state.solved)state.phase='play';if(state.phase==='guide'&&!state.guide)state.phase='play';saveDraft(state);}else{state.view='menu';state.questId=null;}
 return compact(state);
}
function history(state,previous){state.undo.push(previous===undefined?model(state):previous);if(state.undo.length>MAX_UNDO)state.undo.shift();}
function helped(state,env,kind){if(env&&env.LP)env.LP.help(state.attempt,kind);else{state.attempt.assistance[kind==='error'?'afterError':kind]=true;if(kind==='error'){state.attempt.errors++;state.attempt.firstOutcome='incorrect';}}}
function announce(env,text){if(env&&typeof env.announce==='function')env.announce(text);}
function feedback(state,env,text,type){state.feedback={text,type:type||'hint'};announce(env,text);}
function rule(q,state){return Array.isArray(q.ruleChoices)?q.ruleChoices.find(r=>r.id===state.ruleId):null;}
function expected(q,state){const selected=rule(q,state);return selected&&selected.accepted||q.accepted||{};}
function evaluate(state){
 const q=current(state);if(!q)return {correct:false,issues:[{code:'choose-quest'}]};const issues=[];
 if(q.mode==='sort'||q.mode==='rule'){
  if(q.mode==='rule'&&!rule(q,state))issues.push({code:'choose-rule'});
  const accepted=expected(q,state);for(const id of ids(q)){if(!state.placements[id])issues.push({code:'unplaced',item:id});else if(!Array.isArray(accepted[id])||!accepted[id].includes(state.placements[id]))issues.push({code:'wrong-zone',item:id});}
 }else if(q.mode==='pack'){
  for(const id of q.required||[])if(!state.chosen.includes(id))issues.push({code:'missing',item:id});
  const alternatives=(q.alternatives||[]).flatMap(g=>g.items||[]);
  for(const id of state.chosen)if(!(q.required||[]).includes(id)&&!(q.optional||[]).includes(id)&&!alternatives.includes(id))issues.push({code:'extra',item:id});
  for(const g of q.alternatives||[]){const count=g.items.filter(id=>state.chosen.includes(id)).length;if(count<g.min)issues.push({code:'alternative-missing',item:g.items[0]});if(count>g.max)issues.push({code:'alternative-extra',item:g.items[g.max]});}
   const F=packingEngine(q);if(F&&state.packingFlow&&!F.completed(q,state.packingFlow))issues.push({code:'packing-stages'});
 }else if(q.mode==='sequence'){
  for(const s of steps(q))if(!state.order.includes(s.id))issues.push({code:'missing-step',step:s.id});
  for(const pair of q.before||[]){if(state.order.includes(pair[0])&&state.order.includes(pair[1])&&state.order.indexOf(pair[0])>state.order.indexOf(pair[1]))issues.push({code:'order',step:pair[1],before:pair[0]});}
 }else issues.push({code:'unsupported'});
 return {correct:issues.length===0,issues};
}
function issueText(issue,q,state){const id=issue.item,label=id?item(id).label:'';const activeStage=packingCurrent(state,q),why=id&&(activeStage?.why?.[id]||q.why&&q.why[id]);switch(issue.code){case 'packing-stages':return 'Сначала проверь общие вещи и каждый урок по порядку. После этого сверим весь день.';case 'stage-incomplete':return 'Сначала проверь этот этап, потом перейдём дальше.';case 'needed-later':case 'belongs-later':case 'future-item':case 'wrong-stage':return label+': '+(why|| (issue.targetTitle?'эта вещь относится к этапу «'+issue.targetTitle+'». Сейчас готовимся к другому занятию.':'сверься с условием именно этого этапа.'));case 'earlier-stage':return label+': эта вещь относится к предыдущему этапу'+(issue.targetTitle?' «'+issue.targetTitle+'»':'')+'. При необходимости вернись туда.';case 'previous-unconfirmed':case 'reuse-not-ready':return (label?label+': ':'')+'Сначала проверь предыдущий этап'+(issue.targetTitle?' «'+issue.targetTitle+'»':'')+'. Затем используем те же вещи ещё раз.';case 'already-packed':case 'duplicate':return label+': эта вещь уже приготовлена. Вторую такую же брать не нужно.';case 'choose-rule':return 'Сначала выбери правило, по которому будешь сортировать.';case 'unplaced':return 'Найди место: '+label+'.';case 'wrong-zone':return label+': '+(why||'Сравни предмет с правилом и описанием места.');case 'missing':return label+': '+(why||'Эта вещь нужна по условию. Найди её среди предметов.');case 'extra':return label+': '+(why||'Для этой ситуации вещь не нужна. Верни её на полку.');case 'alternative-missing':{const g=(q.alternatives||[]).find(g=>g.items.includes(id));return 'Выбери подходящий вариант: '+(g?g.label:label)+'.';}case 'alternative-extra':return 'По условию достаточно меньшего количества вариантов. Проверь памятку.';case 'missing-step':return 'Добавь в план: '+(steps(q).find(s=>s.id===issue.step)||{}).label+'.';case 'order':return 'Подумай, что должно быть раньше: «'+(steps(q).find(s=>s.id===issue.before)||{}).label+'» или «'+(steps(q).find(s=>s.id===issue.step)||{}).label+'».';default:return 'Проверь условие и свой план.';}}
function observe(state,env,outcome){const q=current(state);if(!env||typeof env.observe!=='function'||!q)return;if(state.attempt.firstOutcome==='notchecked')state.attempt.firstOutcome=outcome;env.observe({...clone(state.attempt),outcome,subject:'life',mode:q.mode,familyId:'life.'+(q.category||q.mode),variantId:q.id,evidenceKind:'virtual-life-task',materialRevision:1,criteriaRevision:1});}
function packingStepCheck(state,q,env){
 const F=packingEngine(q);if(!F||!state.packingFlow||!F.current(q,state.packingFlow))return false;
 const previous=model(state),result=F.check(q,state.packingFlow);syncPacking(state,q);if(JSON.stringify(previous)!==JSON.stringify(model(state)))history(state,previous);state.issues=result.issues||[];
 if(result.correct)feedback(state,env,'Этот этап готов. Можно перейти к следующему.','success');
 else{helped(state,env,'error');observe(state,env,'incorrect');feedback(state,env,'Проверим вещи только для этого этапа. Ты можешь исправить свой выбор.','error');}
 return true;
}
function packingMove(state,q,action,payload,env){
 const F=packingEngine(q);if(!F||!state.packingFlow)return false;const previous=model(state);
 const changed=action==='packing-next'?F.next(q,state.packingFlow):action==='packing-back'?F.back(q,state.packingFlow):F.goto(q,state.packingFlow,Number(payload.index));
 if(!changed)return false;history(state,previous);syncPacking(state,q);state.issues=[];state.feedback=null;state.selected=null;return true;
}
function validDay(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);}
function localDay(env){if(env&&validDay(env.day))return env.day;const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function realState(state,q){if(!state.real[q.id])state.real[q.id]={checks:(q.realSteps||[]).map(()=>false),selfReported:false,adultReported:false,microDay:''};return state.real[q.id];}
function setMotion(state,kind,detail){state.motion=Object.assign({kind,seq:++state.motionSeq},detail||{});}
function describeMotion(state,q,before){if(q.mode==='sort'||q.mode==='rule'){const id=ids(q).find(id=>before.placements[id]!==state.placements[id]);if(id)setMotion(state,'item',{item:id,from:before.placements[id]||'floor',to:state.placements[id]||'floor'});}else if(q.mode==='pack'){const id=ids(q).find(id=>before.chosen.includes(id)!==state.chosen.includes(id));if(id)setMotion(state,'item',{item:id,from:before.chosen.includes(id)?'bag':'floor',to:state.chosen.includes(id)?'bag':'floor'});}else if(q.mode==='sequence'&&JSON.stringify(before.order)!==JSON.stringify(state.order)){const step=state.order.find(id=>!before.order.includes(id))||before.order.find(id=>!state.order.includes(id))||state.order.find((id,i)=>before.order[i]!==id)||'';setMotion(state,'plan',{step,planned:state.order.includes(step)});}}
function handle(state,action,payload,env){
 payload=payload||{};env=env||{};let q=current(state),changed=true;const before=q?model(state):null;state.motion=null;
 if(['school-day','school-variant','school-next','school-start'].includes(action)){
  const S=schedule();if(!S)return false;const selected=schoolChoice(state.school,env);if(action==='school-day'){if(!S.day(payload.day))return false;state.school=schoolChoice({dayId:payload.day,variantId:selected.variantId},env);}
  else if(action==='school-variant'){if(!S.variantsFor(selected.dayId).some(v=>v.id===payload.variant))return false;state.school=schoolChoice({dayId:selected.dayId,variantId:payload.variant},env);}
  else if(action==='school-next')state.school=schoolChoice(null,env);
  else{const next=quest(S.questId(selected.dayId,selected.variantId));if(!next)return false;loadQuest(state,next,env,false);}
 }
 else if(action==='mission'||action==='mission-real'){const next=quest(payload.quest||payload.id);if(!next)return false;loadQuest(state,next,env,false);state.mission.day=localDay(env);state.mission.questId=next.id;if(action==='mission-real'){state.phase='small-real';state.feedback=null;realState(state,next);}}
 else if(action==='category'){if(q&&state.view==='quest')saveDraft(state);state.category=String(payload.category||'all');state.view='menu';state.questId=null;state.solved=false;}
 else if(action==='open'){const next=quest(payload.quest||payload.id);if(!next)return false;loadQuest(state,next,env,false);}
 else if(action==='menu'){if(q)saveDraft(state);state.view='menu';state.questId=null;state.solved=false;state.feedback=null;state.selected=null;state.adultOpen=false;}
 else if(!q||state.view!=='quest')return false;
 else if(action==='begin'){state.phase='play';state.feedback=null;}
 else if(action==='show-how'){if(state.solved)return false;helped(state,env,'explanation');state.phase='guide';state.guide={step:0,selected:false,done:false,play:1};state.feedback=null;setMotion(state,'demo',{play:1});}
 else if(action==='guide-replay'){if(state.phase!=='guide')return false;state.guide.play++;setMotion(state,'demo',{play:state.guide.play});}
 else if(action==='guide-next'){if(state.phase!=='guide')return false;state.guide.step=Math.min(1,state.guide.step+1);state.feedback=null;}
 else if(action==='guide-select'){if(state.phase!=='guide'||state.guide.step!==1)return false;state.guide.selected=true;state.feedback=null;}
 else if(action==='guide-place'){if(state.phase!=='guide'||state.guide.step!==1)return false;if(!state.guide.selected){feedback(state,env,'Сначала выбери учебную карточку.');}else if(payload.zone!=='demo-target'){feedback(state,env,'Посмотри на цель примера: карточку-памятку кладём в подписанное место.');}else{state.guide.done=true;state.guide.step=2;state.guideSeen[q.id]=true;setMotion(state,'demo',{play:++state.guide.play});feedback(state,env,'Ты попробовал на учебном примере. Теперь можно начать свою задачу.','success');}}
 else if(action==='guide-finish'){if(state.phase!=='guide')return false;state.phase='play';state.guideSeen[q.id]=state.guideSeen[q.id]||state.guide.done;state.guide=null;state.feedback={type:'hint',text:q.firstMove||'Начни с одного предмета.'};}
 else if(action==='scene-play'){if(state.phase!=='play'||q.mode!=='sequence')return false;setMotion(state,'preview',{order:state.order.slice()});}
 else if(action==='real-small'){state.phase='small-real';state.feedback=null;realState(state,q);}
 else if(action==='small-done'){if(state.phase!=='small-real')return false;const day=localDay(env),r=realState(state,q);r.microDay=day;state.mission.day=day;state.mission.questId=q.id;if(!state.mission.history.some(v=>v.day===day&&v.questId===q.id))state.mission.history.push({day,questId:q.id,source:'child'});state.mission.history=state.mission.history.slice(-14);feedback(state,env,'Маленький шаг отмечен тобой. На сегодня можно остановиться или продолжить по желанию.','success');setMotion(state,'micro',{});}
 else if(action==='small-game'){if(state.phase!=='small-real')return false;state.phase=state.solved?'real':'play';state.feedback=null;}
 else if(action==='small-later'||action==='real-later'){if(!['small-real','real'].includes(state.phase))return false;saveDraft(state);state.view='menu';state.questId=null;state.feedback=null;state.selected=null;}
 else if(action==='replay'){loadQuest(state,q,env,true);}
 else if(action==='hint'){helped(state,env,'visual');feedback(state,env,packingCurrent(state,q)?.instruction||q.hint||'Посмотри на условие. Можно переносить вещи по одной и исправлять свой выбор.');}
 else if(action==='speak'){if(typeof env.speak==='function')env.speak(q.instruction||q.title);return true;}
 else if(action==='real'){if(!state.solved)return false;state.phase='real';state.selected=null;state.feedback=null;realState(state,q);}
 else if(action==='back'){state.phase='play';state.adultOpen=false;state.feedback=null;}
 else if(action==='real-toggle'){if(state.phase!=='real'||!state.solved)return false;const n=Number(payload.index),r=realState(state,q);if(!Number.isInteger(n)||n<0||n>=r.checks.length)return false;r.checks[n]=!r.checks[n];r.selfReported=false;r.adultReported=false;state.adultOpen=false;}
 else if(action==='real-report'){const r=realState(state,q);if(!r.checks.length||!r.checks.every(Boolean))return false;r.selfReported=true;r.adultReported=false;feedback(state,env,'Ты отметил выполнение сам. Можно показать результат взрослому.','success');}
 else if(action==='adult-open'){const r=realState(state,q);if(!r.selfReported)return false;state.adultOpen=!state.adultOpen;state.feedback=null;}
 else if(action==='adult-confirm'){const r=realState(state,q);if(!state.adultOpen||!r.selfReported||!r.checks.every(Boolean))return false;r.adultReported=true;state.adultOpen=false;feedback(state,env,'Добавлена отдельная отметка взрослого.','success');}
 else if(state.phase!=='play'||state.solved)return false;
 else if(['packing-next','packing-back','packing-goto'].includes(action)){if(!packingMove(state,q,action,payload,env))return false;}
 else if(action==='packing-check'||action==='check'&&packingCurrent(state,q)){if(!packingStepCheck(state,q,env))return false;}
 else if(action==='packing-reset'){const F=packingEngine(q);if(!F||!state.packingFlow)return false;const selected=F.selection(q,state.packingFlow);if(!selected.length)return false;history(state);for(const id of selected)F.drop(q,state.packingFlow,id,'bank');syncPacking(state,q);state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='reset'){const a=state.attempt;Object.assign(state,cleanModel({},q));state.attempt=a;state.feedback=null;state.issues=[];state.selected=null;state.undo=[];}
 else if(action==='undo'){if(!state.undo.length)return false;Object.assign(state,cleanModel(state.undo.pop(),q));state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='rule'){const r=(q.ruleChoices||[]).find(x=>x.id===payload.rule);if(!r)return false;history(state);state.ruleId=r.id;state.placements={};state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='select'){const id=payload.item;if(!ids(q).includes(id))return false;state.selected=state.selected===id?null:id;state.feedback=null;announce(env,state.selected?item(id).label+' выбрано. Теперь выбери место.':'Выбор снят.');}
 else if(action==='toggle'){const id=payload.item;if(q.mode!=='pack'||!ids(q).includes(id))return false;const F=packingEngine(q);if(F&&state.packingFlow){const previous=model(state);if(!F.toggle(q,state.packingFlow,id))return false;history(state,previous);syncPacking(state,q);}else{history(state);state.chosen=state.chosen.includes(id)?state.chosen.filter(x=>x!==id):state.chosen.concat(id);}state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='place'||action==='drop'){
  const id=action==='drop'?payload.item:state.selected,to=payload.zone;
  if(q.mode==='sequence'){
   if(!steps(q).some(s=>s.id===id))return false;const before=String(to||'').replace(/^step:/,'');if(to!=='end'&&to!=='bank'&&!steps(q).some(s=>s.id===before))return false;history(state);state.order=state.order.filter(x=>x!==id);if(to!=='bank'){const i=state.order.indexOf(before);state.order.splice(i<0?state.order.length:i,0,id);}state.selected=null;
  }else if(q.mode==='pack'){
   if(!ids(q).includes(id)||!['bag','bank'].includes(to))return false;const F=packingEngine(q);if(F&&state.packingFlow){const previous=model(state);if(!F.drop(q,state.packingFlow,id,to))return false;history(state,previous);syncPacking(state,q);}else{history(state);state.chosen=state.chosen.filter(x=>x!==id);if(to==='bag')state.chosen.push(id);}state.selected=null;
  }else{if(!ids(q).includes(id)||(!zoneIds(q).includes(to)&&to!=='bank'))return false;if(q.mode==='rule'&&!rule(q,state)){feedback(state,env,'Сначала выбери правило сортировки.');return true;}history(state);if(to==='bank')delete state.placements[id];else state.placements[id]=to;state.selected=null;}
  state.feedback=null;state.issues=[];
 }
 else if(action==='remove'){const id=payload.item;if(!ids(q).includes(id))return false;history(state);delete state.placements[id];state.selected=null;state.feedback=null;state.issues=[];}
 else if(action==='step'){const id=payload.step;if(q.mode!=='sequence'||!steps(q).some(s=>s.id===id)||state.order.includes(id))return false;history(state);state.order.push(id);state.feedback=null;state.issues=[];}
 else if(action==='unstep'){const id=payload.step;if(q.mode!=='sequence'||!state.order.includes(id))return false;history(state);state.order=state.order.filter(x=>x!==id);state.feedback=null;state.issues=[];}
 else if(action==='up'||action==='down'){const id=payload.step,i=state.order.indexOf(id),j=i+(action==='up'?-1:1);if(q.mode!=='sequence'||i<0||j<0||j>=state.order.length)return false;history(state);[state.order[i],state.order[j]]=[state.order[j],state.order[i]];state.feedback=null;state.issues=[];}
 else if(action==='check'||action==='packing-review-check'){
  if(action==='packing-review-check'&&(!packingEngine(q)||packingCurrent(state,q)))return false;
  const result=evaluate(state);state.issues=result.issues;
  if(result.correct){state.solved=true;setMotion(state,'complete',{});state.selected=null;const a=state.attempt.assistance||{},old=state.done[q.id]||{};state.done[q.id]={count:Math.min(999,(old.count||0)+1),helped:!!(a.visual||a.explanation||a.workedExample),afterError:!!a.afterError,sequence:++state.sequence,model:model(state)};observe(state,env,'correct');feedback(state,env,'В игре получилось! '+(q.success||'Все вещи и шаги подходят к условию. Можно попробовать это в жизни.'),'success');}
  else{helped(state,env,'error');observe(state,env,'incorrect');feedback(state,env,result.issues.length===1?'Осталось проверить один момент. Ты можешь исправить свой выбор.':'Есть несколько мест для проверки. Сохраним то, что уже получилось, и поправим остальное.','error');}
 }
 else changed=false;
 if(changed&&state.view==='quest'){const active=current(state);if(active&&before&&active.id===q?.id)describeMotion(state,active,before);saveDraft(state);}return changed;
}
function shapeSvg(it){const shape=it.shape,fill=it.illustration&&/^#[0-9a-fA-F]{6}$/.test(it.illustration.fill)?it.illustration.fill:{red:'#df705e',blue:'#6aa6cf',green:'#75a98a',yellow:'#e5bc58',purple:'#aa95c5',orange:'#de9b56',white:'#f7f4e7'}[it.color]||'#7da5ac';const drawing=shape==='circle'?'<circle cx="32" cy="32" r="22"/>':shape==='triangle'?'<path d="M32 8 59 56H5Z"/>':shape==='rectangle'?'<rect x="6" y="15" width="52" height="34" rx="5"/>':shape==='star'?'<path d="m32 5 8 17 19 2-14 13 4 20-17-10-17 10 4-20L5 24l19-2Z"/>':'<rect x="10" y="10" width="44" height="44" rx="6"/>';const scale=it.size==='small'?'transform="translate(12 12) scale(.625)"':'';return '<svg viewBox="0 0 64 64" aria-hidden="true"><g '+scale+' fill="'+fill+'" stroke="#304c4c" stroke-opacity=".22" stroke-width="2">'+drawing+'</g></svg>';}
function visual(it,e){if(root.ObjectArt?.has(it.id))return root.ObjectArt.markup(it.id,{decorative:true});return ['circle','triangle','square','rectangle','star'].includes(it.shape)&&it.illustration&&it.illustration.type==='shape'?shapeSvg(it):'<span aria-hidden="true">'+e(it.icon||'□')+'</span>';}
function button(action,text,attrs,cls,disabled){return '<button type="button" class="lq-btn '+(cls||'')+'" data-lq-action="'+action+'" '+(attrs||'')+(disabled?' disabled':'')+'>'+text+'</button>';}
function itemCard(id,state,e,mode,placed){const it=item(id),selected=state.selected===id,issue=state.issues.some(v=>v.item===id);const action=mode==='pack'?'toggle':placed?'remove':'select';const material=it.illustration&&it.illustration.type==='shape'?({wood:'дерево',plastic:'пластик'}[it.material]||''):'';return '<button type="button" class="lq-item '+(selected?'is-selected ':'')+(issue?'has-issue ':'')+(placed?'is-placed':'')+'" data-lq-action="'+action+'" data-item="'+e(id)+'" data-practice-drag="'+e(id)+'" aria-pressed="'+selected+'" '+(state.solved?'disabled':'')+' aria-label="'+e(it.label+(material?', '+material:'')+(mode==='pack'?(state.chosen.includes(id)?': вернуть на полку':': приготовить'):placed?': вернуть на полку':': выбрать'))+'"><span class="lq-item-art">'+visual(it,e)+'</span><span class="lq-item-label">'+e(it.label)+'</span>'+(material?'<small class="lq-item-material">'+e(material)+'</small>':'')+(mode==='pack'&&state.chosen.includes(id)?'<span class="lq-check" aria-hidden="true">✓</span>':'')+'</button>';}
const missionIds=['life.places.after-play','life.school.math-russian','life.plan.bedtime'];
function missionCards(state,e){
 const labels=['После игры','Перед школой','Спокойный вечер'],S=schedule(),selected=schoolChoice(state.school),schoolId=S&&selected?S.questId(selected.dayId,selected.variantId):null,activeMissionIds=missionIds.map((id,i)=>i===1&&schoolId?schoolId:id);if(schoolId)labels[1]='Перед школой: '+S.day(selected.dayId).label;
 return '<section class="lq-daily"><div class="lq-daily-head"><div><span class="lq-eyebrow">ОДИН ПОНЯТНЫЙ ШАГ</span><h3>С чего начнём сегодня?</h3><p>Выбери подходящее дело. Можно сначала потренироваться, а потом попробовать маленький шаг в жизни.</p></div>'+helperSvg('wave')+'</div><div class="lq-mission-grid">'+activeMissionIds.map((id,i)=>{const q=quest(id);if(!q)return '';const count=state.mission.history.filter(v=>v.questId===id).length;return '<article><span class="lq-mission-icon" aria-hidden="true">'+['🧸','🎒','🌙'][i]+'</span><h4>'+e(labels[i])+'</h4><p>'+e(q.microReal)+'</p><div>'+button('mission','Потренироваться','data-quest="'+id+'"','primary')+button('mission-real','Один шаг в жизни','data-quest="'+id+'"','quiet')+'</div>'+(count?'<small>Есть твои отметки маленьких шагов</small>':'<small>Начать можно с малого</small>')+'</article>';}).join('')+'</div></section>';
}
function helperSvg(kind){return '<svg class="lq-helper" viewBox="0 0 170 180" aria-hidden="true"><ellipse cx="87" cy="168" rx="52" ry="8" fill="#dce9df"/><g fill="#90c3ac" stroke="#4f8e78" stroke-width="3"><path d="M49 75Q31 35 45 18Q62 12 69 63M99 63Q105 12 122 18Q137 36 119 75"/><path d="M49 102Q38 158 62 163H112Q137 157 120 103Z"/><ellipse cx="85" cy="88" rx="49" ry="43"/><path d="M52 119Q29 105 22 123"/><path class="lq-helper-arm" d="M117 118Q145 105 142 88" fill="none"/></g><ellipse cx="84" cy="137" rx="24" ry="22" fill="#e4f1e6"/><g stroke="#315c4e" stroke-width="3.5" fill="none" stroke-linecap="round"><path d="M66 84h1M102 84h1M71 102q14 11 28 0"/></g><path d="m80 93 5 4 5-4" fill="#315c4e"/></svg>';}
function prepareSurface(q){return q.prepare===true||Array.isArray(q.bagGroups)&&q.bagGroups.length>0;}
function floorPoint(i,q){return prepareSurface(q)?{x:231+(i%4)*46,y:119+Math.floor(i/4)*33}:{x:195+(i%8)*72,y:281+Math.floor(i/8)*(ids(q).length>16?26:34)};}
function sceneState(state,q){
 q=q||current(state);if(!q)return null;
 const F=packingEngine(q),staged=!!(F&&state.packingFlow&&!state.solved&&F.current(q,state.packingFlow)),visible=staged?F.visibleItems(q,state.packingFlow):ids(q),picked=staged?F.selection(q,state.packingFlow):state.chosen;
 const sorting=q.category==='sorting',wide=sorting&&zoneIds(q).length<3;
 const zs=zoneIds(q).map((id,i)=>({id,x:199+(i%3)*(wide?283:187),y:(sorting?79:54)+Math.floor(i/3)*105,width:wide?263:166,height:sorting?153:96,cols:wide?5:4}));
 const positions=visible.map((id,i)=>{
  let place=q.mode==='pack'?(picked.includes(id)?'bag':'floor'):state.placements[id]||'floor';
  let {x,y}=floorPoint(i,q);
  if(q.mode==='pack'&&place==='bag'){
   const n=picked.indexOf(id);
   if(prepareSurface(q)){x=454+(n%6)*47;y=139+Math.floor(n/6)*37;}
   else{x=497+(n%4)*47;y=147+Math.floor(n/4)*38;}
  }else if(place!=='floor'){
   const z=zs.find(z=>z.id===place),n=visible.filter(v=>state.placements[v]===place).indexOf(id);
   if(z){const spacing=z.width/z.cols;x=z.x+spacing*(n%z.cols+.5);y=z.y+(sorting?48:31)+Math.floor(n/z.cols)*(sorting?41:27);}
  }
  return {id,place,x,y};
 });
 return {sourceIds:visible.slice(),type:q.scene||'room',mode:q.mode,height:Math.max(338,...positions.map(p=>p.y+18)),zones:zs,items:positions,planned:state.order.slice(),complete:state.solved===true};
}
function sceneSymbol(id,x,y,e,attrs,size){
 const it=item(id),shadow=`<ellipse cx="2" cy="3" rx="${size*.32}" ry="${size*.091}" fill="url(#lq-contact)"/>`;
 let art;
 if(root.ObjectArt?.has(id))art=`<svg x="${-size/2}" y="${-size*.83}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${root.ObjectArt.inner(id)}</svg>`;
 else if(it.illustration?.type==='shape')art=shapeSvg(it).replace('<svg ',`<svg x="${-size/2}" y="${-size*.83}" width="${size}" height="${size}" `);
 else art=`<text text-anchor="middle" font-size="${size*.69}" font-family="sans-serif">${e(it.icon||'□')}</text>`;
 return `<g ${attrs||''} transform="translate(${x} ${y})">${shadow}${art}</g>`;
}
const scenePalettes={
 room:['#faf0d8','#b0bca2','#b88157','#794b34','#bad1a7','#73968b','#325b53'],
 sorting:['#f8eed6','#b8b398','#bd8d67','#795141','#c4cfa9','#83a3a5','#365c65'],
 school:['#f4efdd','#a2b5b1','#b78b63','#744f37','#a4cbbf','#6b9f9a','#274e54'],
 sport:['#f1f2dd','#9fafb1','#a78361','#634637','#b4d6cb','#619fa3','#2c5460'],
 music:['#f6ead1','#baa9a1','#b68c70','#765347','#d7bdaf','#9d8194','#66495d'],
 outings:['#faf0d6','#afb89f','#be9567','#78523a','#d4c28b','#a4a168','#526349'],
 bed:['#f1dcc7','#a298ac','#ac8064','#674f4e','#d9bba6','#ba8990','#674752'],
 pet:['#fef0db','#c0b69f','#b68b68','#805441','#dfcaa2','#ac916b','#6a543a'],
 desk:['#f6efd4','#a5b9a3','#b28864','#734c38','#c5d3a0','#869e79','#3f604b'],
 wet:['#eef2db','#a7baba','#ba9c7c','#786356','#bed1c5','#82a8ab','#496c79']
};
function sceneStyle(q){
 const bagStyles={school:'school',sports:'sport',music:'music',outings:'outings'};
 if(q.id.includes('pool'))return 'wet';
 if(q.scene==='bag')return Object.hasOwn(bagStyles,q.category)?bagStyles[q.category]:'school';
 return Object.hasOwn(scenePalettes,q.scene)?q.scene:'room';
}
function sceneDefs(style,h){
 const [lit,wall,oak,grain,trim,cloth,shade]=scenePalettes[style];
 const linear=(id,stops,x2='0%',y2='100%')=>`<linearGradient id="lq-${id}" x2="${x2}" y2="${y2}">${stops.map(([at,c,o])=>`<stop offset="${at}" stop-color="${c}"${o===undefined?'':` stop-opacity="${o}"`}/>`).join('')}</linearGradient>`;
 const radial=(id,c1,c2)=>`<radialGradient id="lq-${id}"><stop stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>`;
 return `<defs>
  <clipPath id="lq-frame"><rect x="1" y="1" width="798" height="${h-2}" rx="20"/></clipPath>
  ${linear('wall',[[0,lit],[.56,wall],[1,shade]],'100%','85%')}
  ${linear('floor',[[0,shade],[.28,grain],[.72,oak],[1,lit]])}
  ${linear('oak',[[0,lit],[.19,'#e1ba83'],[.55,oak],[1,grain]],'58%','100%')}
  ${linear('oak-edge',[[0,oak],[.32,grain],[1,'#4a3530']])}
  ${linear('fabric',[[0,trim],[.3,cloth],[.72,shade],[1,'#273435']],'83%','100%')}
  ${linear('linen',[[0,'#fff9e4'],[.23,lit],[.66,trim],[1,cloth]],'75%','100%')}
  ${linear('ceramic',[[0,'#f9fbf2'],[.34,'#96ced0'],[.75,'#4c8d9a'],[1,'#28505c']],'85%','100%')}
  ${linear('paper',[[0,'#fff9e5'],[.59,'#eee3bd'],[1,'#ccb080']],'82%','100%')}
  ${linear('window',[[0,style==='bed'?'#36627b':'#67aec2'],[.54,style==='bed'?'#8693a8':'#bce2e1'],[1,'#f4eaca']])}
  ${linear('glass',[[0,'#fff9df',.64],[.65,'#fff9df',.3],[1,'#fff9df',0]],'100%','100%')}
  ${linear('trim',[[0,lit],[.35,trim],[1,shade]])}
  ${linear('fur',[[0,'#f3d9ac'],[.36,'#dbac79'],[.74,'#a97450'],[1,'#80543d']],'76%','100%')}
  ${radial('contact','#342a27','#342a27')}${radial('sun','#fff1c2','#fff1c2')}
  <linearGradient id="lq-vignette" x2="100%" y2="0%"><stop stop-color="#292d25" stop-opacity=".1"/><stop offset=".27" stop-color="#292d25" stop-opacity="0"/><stop offset=".72" stop-color="#292d25" stop-opacity="0"/><stop offset="1" stop-color="#292d25" stop-opacity=".15"/></linearGradient>
  <pattern id="lq-weave" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M.5 1.5h3M1.5 0v4" stroke="#fff8db" stroke-opacity=".15" stroke-width=".6"/></pattern>
  <pattern id="lq-cane" width="8" height="7" patternUnits="userSpaceOnUse" patternTransform="skewX(12)"><path d="M0 1h8m-8 4h8" stroke="#4c3b31" stroke-opacity=".28" stroke-width="1.6"/><path d="M1 1v4m4 0v4" stroke="#fff4cc" stroke-opacity=".45" stroke-width="1.4"/></pattern>
 </defs>`;
}
function sceneBackdrop(style,h,pet=style==='pet'){
 const seam=style==='bed'?225:218;
 const planks=Array.from({length:12},(_,i)=>`M${i*78-45} ${seam}l${(i-5)*35} ${h-seam}`);
 const moon=style==='bed';
 const window=`<g transform="translate(30 31)">
  <path d="M-5 0h123v124H-5Z" fill="#5c5545" opacity=".3" transform="translate(7 8)"/>
  <rect width="120" height="117" rx="7" fill="url(#lq-oak-edge)"/>
  <rect x="7" y="6" width="106" height="102" rx="3" fill="url(#lq-window)"/>
  ${moon?'<path d="M43 17a14 14 0 1 0 15 19A15 15 0 0 1 43 17Z" fill="#fff1c1"/><path d="M32 30h1m40 8h1m20 11h1m-20-28h1" stroke="#fff1d1" stroke-width="2" stroke-linecap="round"/>':'<circle cx="33" cy="31" r="13" fill="#fff1b1"/><path d="M11 58q18-17 35-3 11-9 26 0v8H11Z" fill="#fff9e7" opacity=".54"/>'}
  <path d="M7 85q21-20 52-8 25-20 54-12v43H7Z" fill="${moon?'#5b6c78':'#6d9386'}" opacity=".8"/><path d="M7 96q26-20 58-10 23-15 48-6v28H7Z" fill="${moon?'#415762':'#537e71'}"/>
  <path d="M61 7v101M8 57h104" stroke="#fff5db" stroke-width="5"/><path d="M10 11h100l-23 17H12Z" fill="#fff" opacity=".19"/>
  <path d="M-8 110h136l-3 12H-5Z" fill="url(#lq-oak)"/><path d="M-4 121h128v6H-4Z" fill="url(#lq-oak-edge)"/>
 </g>`;
 return `<g aria-hidden="true">
  <path d="M0 0h800v${seam+10}H0Z" fill="url(#lq-wall)"/>
  <path d="M140 38 483 ${seam+5}H170L40 125Z" fill="url(#lq-glass)" opacity="${moon?.24:.54}"/>
  <path d="M0 ${seam}h800v${h-seam}H0Z" fill="url(#lq-floor)"/>
  <path d="${planks.join('')}M0 ${seam+27}h800M0 ${seam+62}h800M0 ${seam+103}h800" fill="none" stroke="#432b23" stroke-opacity=".17" stroke-width="1.2"/>
  <path d="M0 ${seam-11}h800v12H0Z" fill="url(#lq-oak)"/><path d="M0 ${seam+1}h800" stroke="#4c3b31" stroke-opacity=".42" stroke-width="2"/>
  <path d="M177 ${seam}h254l222 ${h}H240Z" fill="url(#lq-glass)" opacity=".52"/>
  ${window}
  ${pet?sceneCat(76,198,.64):scenePlant(113,178,moon?.78:1)}
  <path d="M0 0h800v${h}H0Z" fill="url(#lq-vignette)"/>
 </g>`;
}
function scenePlant(x,y,scale){
 return `<g transform="translate(${x} ${y}) scale(${scale})">
  <ellipse cx="2" cy="35" rx="39" ry="8" fill="url(#lq-contact)"/>
  <path d="M-11 6q-8-32-31-33 12 21 30 33m14-3q16-29 38-19-17 15-38 19m-7 0q1-37-22-50-1 28 22 50m4 1q5-34 29-43-2 25-29 43m-3-4q-8-22-25-23" fill="#456b50" stroke="#547960" stroke-width="1"/>
  <path d="M-2 11-16-26m12 36L15-21m-20 30L-30-17m27 27L23-10" fill="none" stroke="#9eaf72" stroke-opacity=".7"/>
  <path d="M-23 3h44l-7 27q-15 8-29 0Z" fill="url(#lq-ceramic)"/><ellipse cx="-1" cy="4" rx="22" ry="7" fill="#86a5a4"/><ellipse cx="-1" cy="4" rx="18" ry="4" fill="#4c483b"/>
  <path d="M-17 12l4 14m4-15 1 18m7-18v19m8-19-1 18m7-17-3 15" stroke="#e5f0d4" stroke-opacity=".29" fill="none"/>
 </g>`;
}
function sceneCat(x,y,scale){
 return `<g transform="translate(${x} ${y}) scale(${scale})" class="lq-scene-cat">
  <ellipse cx="21" cy="55" rx="79" ry="15" fill="url(#lq-contact)"/>
  <path d="M49 36q26 17 47 4 12-8 3-16-4-3-8 1" fill="none" stroke="#a27656" stroke-width="12" stroke-linecap="round"/>
  <path d="M-30 41q1-37 40-45 31-7 52 14 19 19 3 36-16 14-72 9-26-3-23-14Z" fill="url(#lq-fur)"/>
  <path d="M44 0q-13 7-13 29m25-21q-12 8-11 24m23-12q-10 4-10 12" fill="none" stroke="#926245" stroke-opacity=".64" stroke-width="4" stroke-linecap="round"/>
  <path d="M-45 26q-11-22-11-46l24 15q10-3 21 1L8-16Q12 7 4 24 0 36-20 39q-15-1-25-13Z" fill="url(#lq-fur)" stroke="#946249" stroke-width="1.3"/>
  <path d="M-50-13l14 12-11 6ZM2-10-8 0 4 6Z" fill="#d3a59a"/>
  <path d="M-32 1l5 8m6-9-1 8m12-6-6 8m-30 8 7 3m37-3-7 3" fill="none" stroke="#9e6b49" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M-44 25q4-8 19-5 14-3 23 3-8 14-23 14-14-1-19-12" fill="#eed6ad"/>
  <path d="M-39 20q4 3 10 0m12 0q5 3 10-1m-23 10q5 5 8 1 4 4 8-1" fill="none" stroke="#604936" stroke-width="1.6" stroke-linecap="round"/>
  <path d="m-27 24 5 4 5-4q-4-3-10 0" fill="#a77069"/><path d="M-35 28l-20-4m20 8-20 2m42-6L8 24m-21 8 21 1" stroke="#fff4db" stroke-opacity=".78" fill="none"/>
  <path d="M-19 45q10-8 34-8 11 0 15 6-2 7-13 8l-32 2q-9-1-4-8Z" fill="#d4a87b"/><path d="M14 45l2 5m6-6 3 4" stroke="#926d56" stroke-opacity=".52"/>
 </g>`;
}
function sceneRug(x,y,w,h){
 const form=`M${x+32} ${y}h${w-64}q17 0 24 12l13 ${h-26}q8 14-9 14H${x+10}q-17 0-9-14l13-${h-26}Q${x+21} ${y} ${x+32} ${y}Z`;
 return `<g><ellipse cx="${x+w/2}" cy="${y+h*.67}" rx="${w*.54}" ry="${h*.55}" fill="url(#lq-contact)"/><path d="${form}" fill="url(#lq-fabric)"/><path d="${form}" fill="url(#lq-weave)"/><path d="M${x+30} ${y+8}h${w-60}M${x+15} ${y+h-8}h${w-30}" stroke="#e6dfbc" stroke-opacity=".42" stroke-width="1.2" stroke-dasharray="3 3"/></g>`;
}
function sceneLabel(x,y,label,e){
 const width=Math.min(238,Math.max(60,label.length*6.5+25));
 return `<g class="lq-scene-label"><rect x="${x-width/2}" y="${y-16}" width="${width}" height="24" rx="6" fill="url(#lq-paper)"/><path d="M${x-width/2+9} ${y+5}h${width-18}" stroke="#836a51" stroke-opacity=".24"/><text x="${x}" y="${y}" text-anchor="middle" fill="#463c33">${e(label)}</text></g>`;
}
function zoneFurniture(z,index,sorting,e){
 const {id,x,y,width:w,height:h}=z,fill=index%2?'url(#lq-fabric)':'url(#lq-oak)';
 const basket=['laundry','toybox','craft-box','sports-box','pet-toys','adult-care'].includes(id);
 const cabinet=['wardrobe','fridge','pantry','bathroom','clothes-shelf'].includes(id);
 const shelf=['bookshelf','shoe-rack','drying-rack','stationery','desk','music-place'].includes(id);
 const tray=`<path d="M0 6l11-9h${w-22}l11 9v${h-16}l-10 7H10L0 ${h-10}Z" fill="${fill}"/><rect x="9" y="10" width="${w-18}" height="${h-23}" rx="9" fill="url(#lq-linen)"/><path d="M11 ${h-16}h${w-22}l8 9H3Z" fill="#fff2c2" opacity=".38"/><path d="M10 6h${w-20}" stroke="#fff5df" stroke-opacity=".5" stroke-width="2"/>`;
 const cabinetArt=`<path d="M0 6l13-10h${w-25}l12 10v${h-7}H0Z" fill="url(#lq-oak-edge)"/><rect x="6" y="6" width="${w-12}" height="${h-11}" rx="5" fill="url(#lq-linen)"/><path d="M${w/2} 7v${h-14}m-9-48v11m18-11v11" stroke="#6a5846" stroke-opacity=".56" stroke-width="2" stroke-linecap="round"/>`;
 const shelfArt=`<rect width="${w}" height="${h}" rx="5" fill="url(#lq-oak-edge)"/><rect x="8" y="8" width="${w-16}" height="${h-15}" rx="4" fill="url(#lq-linen)"/><path d="M8 40h${w-16}M8 68h${w-16}m-${w-16} 21h${w-16}" stroke="#694f3d" stroke-opacity=".57" stroke-width="2"/><path d="M9 8h${w-18}" stroke="#ffebc5" stroke-opacity=".75" stroke-width="2"/>`;
 const basketForm=`M2 11Q${w/2} -6 ${w-2} 11l-10 ${h-24}q-${(w-24)/2} 17-${w-24} 0Z`;
 const basketArt=`<path d="${basketForm}" fill="url(#lq-oak)"/><path d="${basketForm}" fill="url(#lq-cane)"/><path d="M8 12Q${w/2} 2 ${w-8} 12v${h-31}Q${w/2} ${h-5} 8 ${h-19}Z" fill="url(#lq-linen)" opacity=".87"/><path d="M3 12Q${w/2} 0 ${w-3} 12" stroke="#5a4432" stroke-opacity=".54" stroke-width="3" fill="none"/>`;
 return `<g transform="translate(${x} ${y})" data-scene-zone="${e(id)}"><ellipse cx="${w/2+5}" cy="${h-1}" rx="${w*.56}" ry="10" fill="url(#lq-contact)"/>${sorting?tray:cabinet?cabinetArt:shelf?shelfArt:basket?basketArt:tray}${sceneLabel(w/2,-5,zone(id).label,e)}</g>`;
}
function sceneBackpack(x,y,scale,style){
 const duffel=style==='sport'||style==='wet'||style==='music';
 const body=duffel?'M10 68q6-36 49-36h117q36 3 45 32l6 78q0 23-29 30H29Q4 168 5 143Z':'M13 76q3-41 34-47 32-12 124-4 43 5 51 48l8 75q0 25-25 28H35Q7 172 8 151Z';
 return `<g transform="translate(${x} ${y}) scale(${scale})" class="lq-scene-bag">
  <ellipse cx="125" cy="178" rx="150" ry="25" fill="url(#lq-contact)"/>
  <path d="M81 38V22Q86 7 120 7t39 15v15" fill="none" stroke="#314645" stroke-width="12"/><path d="M84 24Q89 11 120 11t36 13" fill="none" stroke="#bdc5aa" stroke-opacity=".61" stroke-width="3"/>
  <path d="M30 49Q-4 69 1 123m200-74q36 17 37 74" fill="none" stroke="#283a39" stroke-width="12" stroke-opacity=".76"/>
  <path d="${body}" fill="url(#lq-fabric)"/><path d="${body}" fill="url(#lq-weave)"/>
  <path d="M20 66q5-27 35-30h129q25 3 30 30-37-14-95-12-63-2-99 12Z" fill="#24363a" stroke="#8fada5" stroke-width="1.3"/>
  <path class="lq-bag-zip" d="M22 65q27-15 98-15t91 15" fill="none" stroke="#ead9a9" stroke-width="2" stroke-dasharray="3 2"/>
  <path d="M207 62l5 17" stroke="#e3b779" stroke-width="4" stroke-linecap="round"/>
  <path d="M25 151q10-18 91-18 63 1 89 14l-6 19H35Z" fill="url(#lq-linen)" opacity=".76"/>
  <path d="M30 148q15-10 84-10t86 10m-172 12q29 11 92 9t86-10" stroke="#e7ddc0" stroke-opacity=".57" stroke-width="1.4" stroke-dasharray="2 2" fill="none"/>
  <path d="M16 98l2 41m201-41 3 40" stroke="#c2d7bc" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
 </g>`;
}
function sceneDesk(x,y,w,h){
 return `<g transform="translate(${x} ${y})"><ellipse cx="${w/2}" cy="${h}" rx="${w*.52}" ry="15" fill="url(#lq-contact)"/><path d="M25 23h16l-5 ${h-28}H23Zm${w-79} 0h15l2 ${h-28}h-14Z" fill="url(#lq-oak-edge)"/><path d="M19 0h${w-38}l19 18H0Z" fill="url(#lq-oak)"/><path d="M0 18h${w}v12H0Z" fill="url(#lq-oak-edge)"/><path d="M13 16h${w-26}M26 8h${w*.69}" stroke="#fff4d4" stroke-opacity=".45" stroke-width="1.3"/></g>`;
}
function sceneShelf(x,y,w,h){
 return `<g transform="translate(${x} ${y})"><ellipse cx="${w/2}" cy="${h+1}" rx="${w*.57}" ry="12" fill="url(#lq-contact)"/><path d="M0 5l12-8h${w-23}l11 8v${h-5}H0Z" fill="url(#lq-oak-edge)"/><rect x="10" y="13" width="${w-20}" height="${h-24}" rx="3" fill="url(#lq-linen)"/><path d="M9 ${h*.38}h${w-18}M9 ${h*.73}h${w-18}" stroke="url(#lq-oak-edge)" stroke-width="7"/><path d="M10 8h${w-20}M11 ${h-9}h${w-22}" stroke="#f8e3ab" stroke-opacity=".62" stroke-width="2"/></g>`;
}
function scenePacking(q,style,e){
 const bench=sceneDesk(181,261,562,63);
 if(!prepareSurface(q))return sceneRug(170,245,591,78)+bench+sceneBackpack(463,71,1,style)+sceneLabel(578,89,'Сумка',e);
 return `<g>${bench}${sceneShelf(198,76,182,187)}${sceneLabel(288,65,'На полке',e)}
  <g transform="translate(419 104)"><ellipse cx="151" cy="158" rx="160" ry="12" fill="url(#lq-contact)"/><path d="M18 0h275l20 147H0Z" fill="url(#lq-fabric)"/><path d="M24 9h264l17 130H9Z" fill="url(#lq-linen)"/><path d="M22 133h269" stroke="#365b59" stroke-opacity=".33" stroke-width="2"/><path d="M0 147h313v10H0Z" fill="url(#lq-fabric)"/></g>${sceneLabel(575,92,'Готовлю нужные вещи',e)}
 </g>`;
}
function sceneBasket(x,y,w,h){
 const body=`M0 6h${w}l-11 ${h-12}q-${(w-22)/2} 12-${w-22} 0Z`;
 return `<g transform="translate(${x} ${y})"><ellipse cx="${w/2}" cy="${h}" rx="${w*.63}" ry="10" fill="url(#lq-contact)"/><path d="${body}" fill="url(#lq-oak)"/><path d="${body}" fill="url(#lq-cane)"/><ellipse cx="${w/2}" cy="6" rx="${w/2}" ry="10" fill="url(#lq-oak-edge)"/><ellipse cx="${w/2}" cy="5" rx="${w/2-6}" ry="5" fill="#503d33"/><path d="M12 ${h-9}q${w/2-12} 8 ${w-24} 0" fill="none" stroke="#fae0ab" stroke-opacity=".48" stroke-width="2"/></g>`;
}
function sceneBed(has,bedtime){
 return `<g transform="translate(${bedtime?335:204} 162) scale(${bedtime?.84:1})">
  <ellipse cx="236" cy="131" rx="252" ry="33" fill="url(#lq-contact)"/>
  <path d="M22 36V-24q49-22 115-6l17 64Z" fill="url(#lq-oak)"/><path d="M35 26v-48q38-16 89-4" stroke="#fae7bd" stroke-opacity=".49" stroke-width="3" fill="none"/>
  <path d="M33 101v29m387-26v26" stroke="url(#lq-oak-edge)" stroke-width="12" stroke-linecap="round"/>
  <path d="M19 51h429v58q-36 12-420 8-14-5-13-18Z" fill="url(#lq-oak-edge)"/>
  <path d="M27 31q8-10 29-10h335q29 0 48 12l19 46q4 15-25 20H36q-24 0-22-16Z" fill="url(#lq-linen)"/>
  <g ${bedtime?'':'data-plan-layer="sheet"'}><path d="${has('sheet')?'M27 47H426l16 36H19Z':'M27 47q59-21 103 0t99 0 111 4l86-4 16 36H19Z'}" fill="#fff3d8" opacity=".88"/><path d="M29 74h405" stroke="#d6b89c" stroke-opacity=".5"/></g>
  <g data-plan-layer="${bedtime?'rest':'blanket'}"><path d="${has(bedtime?'rest':'blanket')?'M160 28H410q19 3 25 14l24 50q2 14-20 16H153Z':'M160 35q41-19 96-4t88 2q70-19 91 9l24 50q2 14-20 16H153Z'}" fill="url(#lq-fabric)"/><path d="M168 39q125-9 251 5M161 83q143 9 280 0" fill="none" stroke="#f1e6cf" stroke-opacity=".43" stroke-width="1.3" stroke-dasharray="3 3"/><path d="M165 29l-7 71m16-67-7 60" stroke="#ead1b9" stroke-opacity=".53" stroke-width="1.5"/></g>
  <g ${bedtime?'':'data-plan-layer="pillow"'}><path transform="rotate(${has('pillow')||bedtime?0:-9} 91 49)" d="M45 37q14-14 75-9 12 0 14 13l7 24q-45 13-100-3Z" fill="url(#lq-paper)" stroke="#bd9c74" stroke-width="1.4"/><path d="M50 41q30-12 71-7" stroke="#fff3d3" fill="none" stroke-width="2"/></g>
 </g>`;
}
function sceneTowel(x,y,w,h){
 return `<g transform="translate(${x} ${y})"><path d="M0 0q${w*.3} 5 ${w*.68} 0H${w}l4 ${h-4}q-${w*.3} 12-${w+2} 0Z" fill="url(#lq-ceramic)"/><path d="M3 1h${w-4}l4 ${h-8}H4Z" fill="url(#lq-weave)"/><path d="M4 ${h-9}h${w-2}M4 ${h-5}h${w-2}" stroke="#fcf1d8" stroke-opacity=".63"/><path d="M${w*.3} 4l-2 ${h-16}m${w*.38} -${h-16}l3 ${h-16}" fill="none" stroke="#305f67" stroke-opacity=".38" stroke-width="2"/></g>`;
}
function sceneBowl(x,y,filled){
 return `<g transform="translate(${x} ${y})"><ellipse cy="16" rx="52" ry="12" fill="url(#lq-contact)"/><path d="M-37 1h74l-7 22q-30 13-60 0Z" fill="url(#lq-ceramic)"/><ellipse rx="38" ry="13" fill="url(#lq-linen)"/><ellipse cy="1" rx="30" ry="8" fill="${filled?'#82bdce':'#72928e'}"/>${filled?'<path d="M-22 0q19-6 40-1m-23 5h16" fill="none" stroke="#d8f2e6" stroke-opacity=".85" stroke-linecap="round"/>':''}<path d="M-27 18q21 8 47 2" fill="none" stroke="#e6f3e5" stroke-opacity=".52"/></g>`;
}
function planScene(state,q,e){
 const has=id=>state.order.includes(id);
 const layer=(id,art)=>`<g data-plan-layer="${id}">${art}</g>`;
 const label=(x,y,value)=>sceneLabel(x,y,value,e);
 const pic=(x,y,id,size=46)=>sceneSymbol(id,x,y,e,'',size);
 const shelf=sceneShelf(228,85,157,153);
 const clipboard=(x,y)=>`<g transform="translate(${x} ${y})"><path d="M2 4h82v109H2Z" fill="url(#lq-contact)"/><rect width="80" height="107" rx="5" fill="url(#lq-oak)"/><rect x="6" y="10" width="68" height="90" rx="3" fill="url(#lq-paper)"/><rect x="22" y="5" width="35" height="10" rx="3" fill="url(#lq-ceramic)"/><path d="M17 35h47m-47 15h47m-47 15h36m-36 15h39" stroke="#82725c" stroke-opacity=".56" stroke-width="2"/></g>`;
 const rack=`<path d="M257 95h300v146m-300-146v146" fill="none" stroke="url(#lq-oak-edge)" stroke-width="8" stroke-linecap="round"/><path d="M258 93h299" stroke="#fbe9b7" stroke-opacity=".64" stroke-width="2"/>`;
 let art='';
 switch(q.id){
 case 'life.plan.tuesday-after-pool':
  art=shelf+sceneDesk(404,260,346,61)+sceneBackpack(430,139,.72,'wet')+
   layer('open',`<path d="M449 190q${has('open')?'55-23 125':'21-4 48'} 0" fill="none" stroke="#263e40" stroke-width="7" stroke-linecap="round"/>`)+
   layer('separate',sceneTowel(has('separate')?627:476,has('separate')?120:220,64,has('separate')?67:26)+label(has('separate')?658:508,has('separate')?211:270,has('separate')?'Мокрое отдельно':'Полотенце'))+
   layer('agree',has('agree')?label(662,89,'Со взрослым'):'')+layer('prepare',pic(has('prepare')?290:389,has('prepare')?143:282,'reading-book'))+layer('check',has('check')?label(514,308,'Пустая сумка сохнет'):'');
  break;
 case 'life.plan.thursday-evening':
  art=clipboard(247,78)+sceneDesk(344,242,425,77)+sceneBackpack(430,143,.57,'school')+
   layer('schedule',has('schedule')?label(288,115,'Пятница'):'<text x="287" y="144" text-anchor="middle" fill="#775e47" font-size="31">?</text>')+
   layer('books',pic(has('books')?487:370,has('books')?224:274,'reading-book'))+
   layer('art',pic(has('art')?614:402,has('art')?244:276,'paints',57))+
   layer('sport',pic(has('sport')?692:447,has('sport')?244:280,'sport-uniform',59)+pic(has('sport')?746:492,has('sport')?260:292,'sport-shoes',50))+
   layer('wet',sceneTowel(has('wet')?247:444,has('wet')?223:135,58,has('wet')?51:27)+label(has('wet')?277:471,has('wet')?294:125,has('wet')?'Взрослому':'Мокрое'))+
   layer('check',has('check')?label(582,93,'Сверяю с расписанием'):'');
  break;
 case 'life.plan.pet-clean':
  art=shelf+sceneRug(403,228,318,74)+sceneBowl(582,231,true)+
   layer('ask',has('ask')?pic(476,145,'pet-cloth',43)+label(564,108,'Со взрослым'):'')+
   layer('clear',pic(has('clear')?283:454,has('clear')?144:274,'math-book'))+
   layer('crumbs',has('crumbs')?label(482,311,'Крошки убраны'):'<path d="m485 270 7 2 1 6-8-2Zm17 9 5-5 5 4-6 7Zm13-15 6 4-5 4-5-3Z" fill="#d3a46e" stroke="#866047" stroke-width="1.3"/>')+
   layer('water',has('water')?label(648,311,'Вода вытерта'):'<path d="M619 272q16-17 44-7t-2 19q-32 8-42-12Z" fill="url(#lq-ceramic)"/><path d="M629 272q14-9 29-4" stroke="#e8f6ef" stroke-opacity=".64" fill="none"/>')+
   layer('check',has('check')?label(571,162,'Показываю взрослому'):'')+layer('hands',has('hands')?pic(731,119,'soap',52):'');
  break;
 case 'life.plan.bed':
  art=sceneRug(189,267,545,66)+sceneBed(has,false)+sceneBasket(679,245,84,50)+layer('clear',pic(has('clear')?720:520,has('clear')?256:197,'teddy',65));
  break;
 case 'life.plan.pet':
  art=sceneRug(316,213,332,86)+layer('place',`<path d="M347 235q80-46 186-13l24 45q-101 31-212-1Z" fill="${has('place')?'url(#lq-fabric)':'url(#lq-oak)'}"/><path d="M349 235q82-39 181-9l14 28q-99 20-186 0Z" fill="url(#lq-linen)"/><path d="M365 236q70-29 155-8" stroke="#f4e5bf" stroke-dasharray="3 2" fill="none"/>`)+sceneCat(447,206,.95)+
   layer('ask',has('ask')?label(330,97,'Со взрослым'):'')+layer('water',has('water')?sceneBowl(614,263,true):'')+
   layer('toy',has('toy')?pic(281,271,'pet-toy',53):'')+layer('check',has('check')?label(591,119,'Проверяем вместе'):'')+
   layer('space',has('space')?'<path d="M278 320h371" stroke="#fff0c2" stroke-dasharray="5 6" stroke-width="2" stroke-linecap="round"/>':'');
  break;
 case 'life.plan.desk':
  art=sceneRug(218,267,490,65)+sceneDesk(213,173,440,132)+sceneBasket(678,252,95,52)+
   layer('clear',pic(has('clear')?702:293,has('clear')?272:176,'teddy',59)+pic(has('clear')?743:405,has('clear')?273:177,'toy-car',53))+
   layer('choose',has('choose')?label(431,95,'Знаю своё задание'):'')+
   layer('wipe',has('wipe')?'<path d="M230 188h396" stroke="#fff9dc" stroke-opacity=".68" stroke-width="2"/>':'')+
   layer('materials',has('materials')?pic(374,173,'math-book',58)+pic(444,174,'math-notebook',49):'')+
   layer('tools',has('tools')?pic(535,174,'pencil',47)+pic(578,173,'blue-pen',47):'')+
   layer('start',has('start')?'<g><path d="M381 254v49m106-49v49" stroke="url(#lq-oak-edge)" stroke-width="10" stroke-linecap="round"/><path d="M360 252v-31q76-27 149 0v31Z" fill="url(#lq-fabric)"/><path d="M369 253h127l11 20H357Z" fill="url(#lq-linen)"/></g>':'');
  break;
 case 'life.plan.school-evening':
  art=shelf+sceneDesk(406,224,323,96)+sceneBackpack(has('place')?544:534,has('place')?153:144,.75,'school')+
   layer('schedule',label(273,119,has('schedule')?'Завтра':'?'))+
   layer('list',has('list')?`<g transform="translate(423 113) scale(.83)">${clipboard(0,0)}</g>`:'')+
   layer('pack',pic(has('pack')?576:341,has('pack')?202:191,'reading-book',59))+
   layer('pencil',pic(has('pencil')?629:347,has('pencil')?222:131,'pencil-case',57))+
   layer('check',has('check')?label(466,216,'Сверяю со списком'):'')+
   layer('place',has('place')?'<path d="M540 294h181" stroke="#fff0be" stroke-width="3" stroke-opacity=".7" stroke-linecap="round"/>':'');
  break;
 case 'life.plan.pool-return':
  art=rack+sceneRug(212,261,487,67)+sceneBasket(550,233,105,62)+sceneBackpack(219,181,.58,'wet')+
   layer('hang',sceneTowel(has('hang')?365:295,has('hang')?96:250,92,has('hang')?106:23))+
   layer('open',has('open')?'<path d="M232 221q61-22 104-1" stroke="#253b42" fill="none" stroke-width="8" stroke-linecap="round"/>':'')+
   layer('separate',has('separate')?label(429,241,'Мокрое отдельно'):'')+
   layer('wash',pic(has('wash')?599:341,has('wash')?252:285,'dirty-shirt',58))+
   layer('bag',has('bag')?label(288,314,'Сумка сохнет'):'');
  break;
 case 'life.plan.bedtime':
  art=sceneRug(219,263,513,66)+sceneBed(has,true)+sceneBasket(226,237,92,53)+sceneDesk(674,258,102,69)+
   layer('toys',pic(has('toys')?269:352,has('toys')?251:286,'teddy',53))+
   layer('tomorrow',has('tomorrow')?pic(280,158,'clean-shirt',58)+label(280,183,'На завтра'):'')+
   layer('teeth',has('teeth')?pic(719,132,'toothbrush',60):'')+
   layer('pajamas',has('pajamas')?pic(719,209,'pajamas',61):'')+
   layer('story',has('story')?pic(719,269,'storybook',58):'');
  break;
 case 'life.plan.room':
  art=shelf+sceneRug(234,254,501,68)+sceneBasket(433,231,100,57)+sceneBasket(550,226,105,61)+
   '<g><path d="M663 104l13-8h83l12 8v151H663Z" fill="url(#lq-oak-edge)"/><rect x="669" y="107" width="95" height="140" rx="5" fill="url(#lq-linen)"/><path d="M717 109v135m-8-71v13m16-13v13" stroke="#64796a" stroke-width="2.5" stroke-linecap="round"/></g>'+label(715,273,'Чистое')+
   layer('toys',pic(has('toys')?481:379,has('toys')?245:280,'teddy',54))+
   layer('books',pic(has('books')?272:429,has('books')?141:292,'reading-book',57))+
   layer('clothes',pic(has('clothes')?600:516,has('clothes')?247:302,'dirty-shirt',56)+pic(has('clothes')?715:692,has('clothes')?190:300,'clean-shirt',56))+
   layer('look',has('look')?'<rect x="210" y="69" width="451" height="243" rx="13" fill="none" stroke="#fff1c5" stroke-dasharray="5 8" stroke-width="2"/>':'')+
   layer('floor',has('floor')?'<path d="M262 311h310" stroke="#f6e6ad" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round"/>':'')+
   layer('finish',has('finish')?label(495,96,'Смотрю, что получилось'):'');
  break;
 default:
  art=clipboard(249,92)+sceneDesk(420,249,230,74)+sceneBackpack(447,143,.76,'outings')+
   layer('list',has('list')?label(288,227,'Читаю памятку'):'')+
   layer('check',has('check')?'<path d="m267 164 11 11 19-23" fill="none" stroke="#47775f" stroke-width="5" stroke-linecap="round"/>':'')+
   layer('close',`<path d="M466 192q${has('close')?'77-24 151':'26-8 51'} 0" stroke="#e6d3a5" stroke-width="3" stroke-dasharray="3 2" fill="none"/>`)+
   layer('shoes',pic(has('shoes')?658:391,292,'sneakers',64))+
   layer('meet',has('meet')?'<path d="M698 107h63v174h-63Z" fill="url(#lq-oak-edge)"/><rect x="705" y="116" width="48" height="165" rx="4" fill="url(#lq-oak)"/><circle cx="744" cy="210" r="4" fill="url(#lq-paper)"/>'+label(730,308,'К взрослому'):'');
 }
 return `<g class="lq-plan-illustration">${art}</g>`;
}
function sceneItemSize(q,place){
 if(place==='floor')return prepareSurface(q)?46:53;
 return q.mode==='pack'?47:q.category==='sorting'?53:42;
}
function renderScene(state,q,e){
 const scene=sceneState(state,q),motion=state.motion,h=scene.height,style=sceneStyle(q),sequence=q.mode==='sequence';
 const furniture=q.mode==='pack'?scenePacking(q,style,e):sequence?planScene(state,q,e):
  sceneRug(176,235,576,h-244)+scene.zones.map((z,i)=>zoneFurniture(z,i,q.category==='sorting',e)).join('');
 const placed=sequence?'':scene.items.map(v=>sceneSymbol(v.id,v.x,v.y,e,`data-scene-item="${e(v.id)}"`,sceneItemSize(q,v.place))).join('');
 const ghost=motion?.kind==='item'?`<g data-lq-flight style="opacity:0">${sceneSymbol(motion.item,0,0,e,'',sceneItemSize(q,motion.to))}</g>`:'';
 const caption=sequence?'Рисунок помогает представить твой план. Настоящие дела — отдельно.':'Предметы на рисунке повторяют твоё размещение. Их можно переставить.';
 const description=sequence?'Иллюстрация твоего плана':q.mode==='pack'?'Приготовленные вещи и вещи на полке':'Твои предметы и места для них';
 return `<figure class="lq-scene" data-scene-type="${e(scene.type)}" data-scene-style="${style}"><svg viewBox="0 0 800 ${h}" role="img" aria-label="${e(description)}">${sceneDefs(style,h)}<g clip-path="url(#lq-frame)">${sceneBackdrop(style,h,style==='pet'&&q.id!=='life.plan.pet')}${furniture}${placed}${ghost}</g></svg><figcaption>${caption}</figcaption>${sequence&&state.order.length?button('scene-play','Посмотреть мой план в движении','','quiet'):''}</figure>`;
}
function helpPreview(state,q,e){return '<details class="lq-help-preview" data-workspace-disclosure="life-help"><summary>Как действовать?</summary><p>'+e(q.firstMove||'Выбери один предмет или шаг.')+'</p>'+button('show-how','Покажи на примере','','quiet')+'</details>';}
function scenePreview(state,q,e){return '<details class="lq-scene-preview" data-workspace-disclosure="life-scene"><summary>Посмотреть вещи в комнате <span aria-hidden="true">↗</span></summary>'+renderScene(state,q,e)+'</details>';}
function guideCard(x,y,scale){
 return `<g transform="translate(${x} ${y}) scale(${scale})"><ellipse cy="51" rx="47" ry="10" fill="url(#lq-contact)"/><rect x="-39" y="-46" width="80" height="95" rx="10" fill="url(#lq-oak-edge)"/><rect x="-41" y="-48" width="80" height="94" rx="9" fill="url(#lq-paper)"/><path d="M-29-36h55m-55 70h55" stroke="#ba9b69" stroke-opacity=".56"/><path d="M-22-23h44m-44 19h33m-33 19h40" stroke="#817050" stroke-width="4" stroke-linecap="round"/><path d="M22-32v13l-4-4-4 4v-13Z" fill="#68998b"/></g>`;
}
function guideScene(state,q,e){
 const {done}=state.guide||{};
 return `<svg class="lq-guide-scene" viewBox="0 0 720 280" role="img" aria-label="Отдельный учебный пример: карточка-памятка и её место">
  ${sceneDefs('school',338)}<g transform="scale(.9 .828)" clip-path="url(#lq-frame)">${sceneBackdrop('school',338)}</g>
  ${sceneDesk(130,221,500,50)}<g transform="translate(471 114)"><ellipse cx="68" cy="105" rx="81" ry="13" fill="url(#lq-contact)"/><path d="M1 38h136l-7 64q-57 13-121 0Z" fill="url(#lq-fabric)"/><path d="M1 38h136l-7 64q-57 13-121 0Z" fill="url(#lq-weave)"/><ellipse cx="69" cy="38" rx="67" ry="14" fill="#2f4b49" stroke="#a9c7ad" stroke-width="2.5"/><path d="M10 42q64 19 116 0" stroke="#d5d7ba" stroke-opacity=".68" fill="none"/></g>
  ${sceneLabel(539,195,'Место памятки',e)}
  <g data-guide-source style="opacity:${done?'0':'1'}">${guideCard(182,173,1)}</g>
  ${done?`<g data-guide-target>${guideCard(540,125,.76)}</g>`:''}
  <path d="M242 151q86-75 204-33m-18-14 19 14-20 5" fill="none" stroke="#fff4c4" stroke-width="2.5" stroke-dasharray="5 5" stroke-linecap="round"/>
  <g data-guide-flight style="opacity:0">${guideCard(0,0,1)}</g>
 </svg>`;
}
function renderGuide(state,q,e){
 const g=state.guide||{step:0,selected:false,done:false},step=g.step;
 const words=step===0?['Сначала посмотрим','У карточки-памятки есть подписанное место. Я выбираю одну карточку и переношу её туда.']:step===1?['Теперь попробуем вместе','Выбери учебную карточку. Затем нажми на её подписанное место.']:['Теперь твоя задача','Учебный пример готов. Твои настоящие предметы в игре пока остаются на своих местах.'];
 return '<section class="lq-guide"><div class="lq-guide-heading"><div><span class="lq-eyebrow">СМОТРЮ → ПРОБУЮ С ПОДСКАЗКОЙ → ДЕЛАЮ САМ</span><h3>'+words[0]+'</h3><p>'+words[1]+'</p></div>'+helperSvg('wave')+'</div>'+guideScene(state,q,e)+'<p class="lq-demo-label">Это отдельный учебный пример. Он не решает твою игровую задачу.</p>'+(step===1?'<div class="lq-guide-interaction">'+button('guide-select','Карточка-памятка','aria-pressed="'+g.selected+'"',g.selected?'active':'')+button('guide-place','Её подписанное место','data-zone="demo-target"','primary')+'</div>':'')+renderFeedback(state,q,e)+'<div class="lq-controls">'+(step===0?button('guide-next','Попробовать вместе','','primary')+button('guide-replay','Показать ещё раз','','quiet'):step===2?button('guide-finish','Теперь попробую свою задачу','','primary'):'')+(step===2?'':button('guide-finish','Вернуться к своей задаче','','quiet'))+'</div></section>';
}
function renderSmallReal(state,q,e,env){const r=realState(state,q),today=localDay(env),done=r.microDay===today;return '<section class="lq-small-real"><div class="lq-small-real-head">'+helperSvg('wave')+'<div><span class="lq-eyebrow">ОДНО ДЕЛО БЕЗ СПЕШКИ</span><h3>Попробуй маленький шаг в жизни</h3><p>Можно отложить экран и сделать только это. Полную уборку сейчас выполнять не нужно.</p></div></div><div class="lq-one-action"><span aria-hidden="true">1</span><p>'+e(q.microReal||q.realSteps?.[0]||'Выбери одну знакомую вещь и её место.')+'</p></div>'+(q.adultNote?'<p class="lq-adult-note">'+e(q.adultNote)+'</p>':'')+(done?'<div class="lq-micro-result" role="status"><strong>Маленький шаг отмечен тобой</strong><p>Заметь, что стало удобнее. Можно остановиться или выбрать продолжение.</p></div>':'<p class="lq-small">Нажми после самого действия. Эта отметка хранится отдельно от полного плана.</p>')+renderFeedback(state,q,e)+'<div class="lq-controls">'+button('small-done',done?'На сегодня отмечено':'Я сделал этот маленький шаг','','primary',done)+button('small-game',state.solved?'Посмотреть полный план':'Вернуться к игровому примеру','','quiet')+button('small-later','На сегодня достаточно','','quiet')+'</div></section>';}
function flightFrames(from,to,startScale=1,endScale=1){
 const dx=to.x-from.x,dy=to.y-from.y,direction=Math.sign(dx);
 const arc=Math.min(50,Math.max(26,Math.abs(dx)*.16));
 const frame=(t,angle)=>{
  const x=Math.round((from.x+dx*t)*100)/100,y=Math.round((from.y+dy*t-4*t*(1-t)*arc)*100)/100;
  const size=Math.round((startScale+(endScale-startScale)*t+Math.sin(t*Math.PI)*.12)*100)/100;
  const scale=size===1?'':` scale(${size})`,rotation=angle?` rotate(${angle*direction}deg)`:'';
  return {transform:`translate(${x}px,${y}px)${scale}${rotation}`,opacity:1};
 };
 return [frame(0,0),{...frame(.14,-6),offset:.19},{...frame(.53,-3),offset:.49},{...frame(.88,3),offset:.78},
  {transform:`translate(${to.x}px,${to.y-3}px) scale(${endScale})`,opacity:1,offset:.92},frame(1,0)];
}
let lastMotionKey='',activeAnimations=[],activeContainer=null,lastSceneNode=null,animationCleanups=[];
function afterRender(container,state,previous){
 if(!container||!state)return {animated:false};
 const q=current(state),motion=state.motion,sceneNode=container.querySelector('.lq-scene,.lq-guide-scene,.lq-small-real');
 const key=q&&motion?q.id+':'+motion.seq+':'+motion.kind:'';if(key&&key===lastMotionKey&&container===activeContainer&&sceneNode===lastSceneNode)return {animated:false};
 for(const a of activeAnimations)try{a.cancel();}catch(_){}for(const cleanup of animationCleanups)cleanup();activeAnimations=[];animationCleanups=[];activeContainer=container;lastSceneNode=sceneNode;lastMotionKey=key;
 if(!q||!motion)return {animated:false};
 const reduced=typeof root.matchMedia==='function'&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const animate=(el,frames,options)=>{if(!el||typeof el.animate!=='function'||reduced)return null;const a=el.animate(frames,options);activeAnimations.push(a);return a;};
 if(reduced){if(motion.kind==='demo'&&state.phase==='guide'&&state.guide.step===0){const flight=container.querySelector('[data-guide-flight]');if(flight){flight.style.opacity='1';flight.style.transform='translate(540px,125px) scale(.76)';}}return {animated:false,reduced:true,kind:motion.kind};}
 if(motion.kind==='demo'&&state.phase==='guide'){
  const flight=container.querySelector('[data-guide-flight]'),source=container.querySelector('[data-guide-source]'),target=container.querySelector('[data-guide-target]');if(!flight)return {animated:false};if(source)source.style.opacity='0';if(target)target.style.opacity='0';flight.style.opacity='1';
  const a=animate(flight,flightFrames({x:182,y:173},{x:540,y:125},1,.76),{duration:1800,easing:'cubic-bezier(.27,.06,.29,1)',fill:'forwards'});const settle=()=>{if(target){flight.style.opacity='0';target.style.opacity='1';}else{flight.style.opacity='1';flight.style.transform='translate(540px,125px) scale(.76)';}};animationCleanups.push(settle);if(a&&a.finished)a.finished.then(settle,settle);else settle();return {animated:!!a,kind:'demo',duration:1800};
 }
 if(motion.kind==='item'){
  // The actual chosen card responds even while the optional room is closed.
  // Animate only that object's art; labels, layout and focus never move.
  const card=[...container.querySelectorAll('.lq-item[data-item]')].find(el=>el.getAttribute('data-item')===motion.item);
  animate(card?.querySelector('.lq-item-art'),[{transform:'translateY(-6px) scale(1.05)',opacity:.68},{transform:'translateY(2px) scale(.98)',opacity:1,offset:.76},{transform:'translateY(0) scale(1)',opacity:1}],{duration:320,easing:'ease-out'});
  const m=sceneState(state,q),position=m.items.find(v=>v.id===motion.item),ghost=container.querySelector('[data-lq-flight]'),target=[...container.querySelectorAll('[data-scene-item]')].find(el=>el.getAttribute('data-scene-item')===motion.item);if(!ghost||!position)return {animated:!!card,kind:'item',duration:320};
  const previousPosition=previous?.questId===q.id&&sceneState(previous,q).items.find(v=>v.id===motion.item);
  const n=m.sourceIds.indexOf(motion.item),zone=m.zones.find(v=>v.id===motion.from);
  const fallback=motion.from==='bag'?{x:560,y:154}:zone?{x:zone.x+zone.width/2,y:zone.y+36}:floorPoint(n,q);
  const startScale=sceneItemSize(q,motion.from)/sceneItemSize(q,position.place);
  if(target)target.style.opacity='0';ghost.style.opacity='1';const a=animate(ghost,flightFrames(previousPosition||fallback,position,startScale),{duration:720,easing:'cubic-bezier(.24,.05,.2,1)',fill:'forwards'});
  const settle=()=>{ghost.style.opacity='0';if(target)target.style.opacity='1';};animationCleanups.push(settle);if(a&&a.finished)a.finished.then(settle,settle);else settle();return {animated:!!a,kind:'item',duration:720};
 }
 if(motion.kind==='plan'||motion.kind==='preview'){
  const ids=motion.kind==='preview'?state.order:[motion.step],starts={
   'life.plan.tuesday-after-pool':{separate:[-151,100],prepare:[99,139]},
   'life.plan.thursday-evening':{books:[-117,50],art:[-212,32],sport:[-248,34],wet:[197,-88]},
   'life.plan.pet-clean':{clear:[171,130],hands:[0,30]},
   'life.plan.bed':{clear:[-200,-59]},
   'life.plan.desk':{clear:[-375,-96],materials:[0,54],tools:[0,48]},
   'life.plan.room':{toys:[-102,35],books:[157,151],clothes:[-12,80]},
   'life.plan.school-evening':{pack:[-235,-11],pencil:[-282,-91]},
   'life.plan.pool-return':{hang:[-70,154],wash:[-258,33]},
   'life.plan.bedtime':{toys:[83,35],tomorrow:[0,35],story:[0,30]},
   'life.plan.pet':{water:[0,-32],toy:[58,-25]},
   'life.plan.trip-check':{shoes:[-267,0]}
  };
  const layers=[...container.querySelectorAll('[data-plan-layer]')],rows=[...container.querySelectorAll('.lq-plan li')];
  ids.forEach((id,i)=>{
   const row=rows.find(el=>el.getAttribute('data-practice-drop')==='step:'+id),layer=layers.find(el=>el.getAttribute('data-plan-layer')===id);
   const offset=state.order.includes(id)&&starts[q.id]?.[id];
   const frames=offset?flightFrames({x:offset[0],y:offset[1]},{x:0,y:0}):[{opacity:.24,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}];
   animate(row,[{backgroundColor:'#f1d99b'},{backgroundColor:'#f3f8f1'}],{duration:900,delay:i*1000,easing:'ease-out'});
   animate(layer,frames,{duration:850,delay:i*1000,easing:'cubic-bezier(.25,.05,.25,1)',fill:'backwards'});
  });
  return {animated:true,kind:motion.kind,steps:ids.length};
 }
 if(motion.kind==='complete'||motion.kind==='micro'){
  animate(container.querySelector('.lq-micro-result,.lq-scene>svg,.lq-helper'),[{filter:'brightness(1)'},{filter:'brightness(1.09)',offset:.45},{filter:'brightness(1)'}],{duration:680,easing:'ease-in-out'});
  animate(container.querySelector('.lq-bag-zip'),[{strokeDashoffset:24},{strokeDashoffset:0}],{duration:580,easing:'ease-out'});
  return {animated:true,kind:motion.kind};
 }
 return {animated:false,kind:motion.kind};
}

function renderSchoolPicker(state,e,env){
 const S=schedule();if(!S)return '';const selected=schoolChoice(state.school),d=S.day(selected.dayId),q=quest(S.questId(d.id,selected.variantId)),variants=S.variantsFor(d.id),recommended=S.recommended(env?.date);if(!q)return '';
 const lessons=q.schedule?.lessons||d.lessons||[],labels=q.schedule?.selectedLessons||q.schedule?.subjects||d.subjects||[];
 const lessonLabels=labels.length?labels:lessons.map(x=>typeof x==='string'?x:x.title);
 const dayWords=d.accusative||d.label.toLowerCase();
 return '<section class="lq-school-picker" id="life-school-picker" aria-labelledby="life-school-title"><header><div><span class="lq-eyebrow">ТВОЁ РАСПИСАНИЕ · 2 А КЛАСС</span><h3 id="life-school-title" tabindex="-1">Соберёмся к нужному дню</h3><p>Сначала выбери день. Посмотри уроки и условия, потом приготовь нужные вещи.</p></div><span class="lq-school-icon" aria-hidden="true">🎒</span></header>'+(recommended.weekend?'<p class="lq-weekend-note">Сегодня выходной. Можно спокойно подготовиться к понедельнику или выбрать другой учебный день.</p>':'')+'<div class="lq-weekdays" role="group" aria-label="К какому дню собираемся">'+S.days.map(day=>button('school-day',e(day.label),'data-day="'+e(day.id)+'" aria-pressed="'+(d.id===day.id)+'"',d.id===day.id?'active':'')).join('')+'</div><div class="lq-school-content"><section class="lq-school-lessons"><h4>Уроки: '+e(d.label)+'</h4><ol>'+lessonLabels.map(text=>'<li>'+e(text)+'</li>').join('')+'</ol>'+(d.pool?'<p class="lq-pool-note">🏊 «Золотая рыбка» — занятие в бассейне.</p>':'')+'<p class="lq-school-source">Дни и уроки — по твоему расписанию. Список вещей — по условиям этой игры.</p></section><section class="lq-school-choice"><h4>Какая сегодня ситуация?</h4><div class="lq-school-variants" role="group" aria-label="Условия сборов">'+variants.map(v=>button('school-variant',e(v.label),'data-variant="'+e(v.id)+'" aria-pressed="'+(selected.variantId===v.id)+'"',selected.variantId===v.id?'active':'')).join('')+'</div>'+(packingEngine(q)?renderPackingOverview(q,e):renderConditions(q,e,true))+'<div class="lq-controls">'+button('school-start','Собраться на '+e(dayWords),'','primary')+button('school-next','Ближайший учебный день','','quiet')+'</div></section></div></section>';
}
function renderConditions(q,e,compact){
 const conditions=Array.isArray(q.conditions)?q.conditions.filter(x=>typeof x==='string'&&x.trim()):[];
 if(!q.schedule&&!conditions.length)return '';
 const title=q.schedule?'Собираемся: '+(q.schedule.dayLabel||q.title):'Условия этой задачи';
 const provided=Array.isArray(q.schedule?.provided)?q.schedule.provided:[],lessons=q.schedule?.selectedLessons||q.schedule?.subjects||[];
 return '<section class="lq-packing-conditions'+(compact?' is-compact':'')+'" aria-label="Условия задания"><strong>'+e(title)+'</strong>'+(!compact&&lessons.length?'<p class="lq-condition-lessons"><b>Уроки:</b> '+e(lessons.join(' · '))+'</p>':'')+(conditions.length?'<ul>'+conditions.map(c=>'<li>'+e(c)+'</li>').join('')+'</ul>':'')+(provided.length?'<p class="lq-provided"><b>Уже готово:</b> '+e((q.schedule.providedText||provided.map(id=>item(id).label).join(', ')).replace(/^Уже (?:приготовлено|готово):\s*/i,'').replace(/[.。]+$/,''))+'. Эти вещи повторно не выбираем.</p>':'')+'</section>';
}
function renderPackingOverview(q,e){
 return '<section class="lq-packing-overview"><strong>Собираемся по одному занятию</strong><p>Сначала общие вещи, затем каждый урок по расписанию. На экране будут вещи и условия только текущего этапа.</p><p>Уже приготовленное сохраним. Одну вещь для двух уроков не нужно брать дважды.</p></section>';
}
function packingProgress(state,q,e){
 const F=packingEngine(q),flow=state.packingFlow,stages=q.packingStages,index=flow.index;
 const buttons=stages.map((stage,i)=>{const run=F.stateFor(q,flow,stage.id),status=i===index?'current':run.checked?'complete':'pending';return '<li data-packing-status="'+status+'">'+button('packing-goto','<span aria-hidden="true">'+(run.checked?'✓':i+1)+'</span><span>'+e(stage.title)+'</span>','data-index="'+i+'"'+(i===index?' aria-current="step"':''),'',i>index)+'</li>';}).join('');
 return '<nav class="lq-packing-progress" aria-label="Этапы сборов"><p>Шаг '+(Math.min(index,stages.length)+1)+' из '+(stages.length+1)+' · '+e(q.schedule?.dayLabel||'Сборы по занятиям')+'</p><details class="lq-packing-roadmap" data-workspace-disclosure="life-roadmap"><summary>Посмотреть этапы дня</summary><ol>'+buttons+'<li data-packing-status="'+(index===stages.length?'current':'pending')+'"><span><span aria-hidden="true">'+(stages.length+1)+'</span> Проверка всего дня</span></li></ol></details></nav>';
}
function packingNames(list,e){return list.map(id=>e(item(id).label)).join(', ');}
function packingEarlier(state,q,e){
 const F=packingEngine(q),flow=state.packingFlow,earlier=q.packingStages.slice(0,flow.index),ready=[...new Set(earlier.flatMap(stage=>{const run=F.stateFor(q,flow,stage.id);return run.checked?run.selected:[];}))];
 const later=q.packingStages.slice(flow.index+1).reduce((n,stage)=>n+F.stateFor(q,flow,stage.id).selected.length,0),pending=later?'<p class="lq-packing-pending">На следующих этапах сохранено выбранных вещей: '+later+'. Проверим их по порядку, когда дойдём до соответствующего занятия.</p>':'';
 if(!ready.length)return pending;
 return '<details class="lq-packing-ready" data-workspace-disclosure="life-ready"><summary>Проверено раньше: '+ready.length+' вещей</summary><p>'+packingNames(ready,e)+'</p><p>Они остаются приготовленными. Чтобы изменить их, вернись к нужному этапу.</p></details>'+pending;
}
function renderPackingIntro(state,q,e){
 return renderPackingOverview(q,e)+'<ol class="lq-mini-steps"><li>Начни с общих обязательных вещей.</li><li>Собирай вещи для одного урока и проверяй этот этап.</li><li>В конце сверь весь день и разложи вещи по сумкам.</li></ol><div class="lq-controls">'+button('begin','Начать с общих вещей','','primary')+button('show-how','Покажи, как выбирать','','quiet')+'</div>';
}
function renderPackingReview(state,q,e){
 const F=packingEngine(q),flow=state.packingFlow,complete=F.completed(q,flow);
 return '<section class="lq-packing-review" data-packing-stage="review">'+packingProgress(state,q,e)+'<header><span class="lq-eyebrow">ПОСЛЕДНИЙ ШАГ</span><h3>Проверим весь день</h3><p>Мы прошли общие вещи и все занятия. Сверим, всё ли осталось приготовлено.</p></header><div class="lq-packing-review-list">'+q.packingStages.map((stage,i)=>{const run=F.stateFor(q,flow,stage.id);return '<article data-packing-review-step="'+e(stage.id)+'"><h4>'+e(stage.title)+' <span>'+(run.checked?'✓':'Нужно проверить')+'</span></h4>'+(run.selected.length?'<p>'+packingNames(run.selected,e)+'</p>':'<p>Новых вещей на этом этапе не добавляли.</p>')+(stage.provided?.length?'<p class="lq-muted">Было готово заранее: '+packingNames(stage.provided,e)+'.</p>':'')+(stage.reused?.length?'<p class="lq-muted">Используем ещё раз те же вещи: '+packingNames(stage.reused,e)+'.</p>':'')+button('packing-goto','Изменить этот этап','data-index="'+i+'"','quiet')+'</article>';}).join('')+'</div>'+renderFeedback(state,q,e)+'<div class="lq-controls lq-step-controls">'+button('packing-review-check','Проверить весь день','','primary',!complete)+button('packing-back','← К последнему этапу','','quiet')+'</div></section>';
}
function renderPackingStep(state,q,e){
 const F=packingEngine(q),flow=state.packingFlow,stage=F.current(q,flow);if(!stage)return renderPackingReview(state,q,e);
 const run=F.stateFor(q,flow,stage.id),selected=run.selected,visible=F.visibleItems(q,flow),bank=visible.filter(id=>!selected.includes(id)),local=Object.assign({},state,{chosen:selected}),hasChoices=visible.length>0,nextLabel=flow.index+1===q.packingStages.length?'К проверке всего дня':'Следующий этап →';
 const conditions='<section class="lq-packing-conditions" aria-label="Условия текущего этапа"><strong>Сейчас готовим только это</strong>'+(stage.conditions?.length?'<ul>'+stage.conditions.map(text=>'<li>'+e(text)+'</li>').join('')+'</ul>':'')+(stage.provided?.length?'<p><b>Уже было готово:</b> '+packingNames(stage.provided,e)+'. Повторно не выбираем.</p>':'')+(stage.reused?.length?'<p><b>Уже готовили:</b> '+packingNames(stage.reused,e)+'. Второй комплект не нужен.</p>':'')+'</section>';
 const heading='<header class="lq-packing-step-heading workspace-task"><span class="lq-eyebrow">'+(stage.kind==='common'?'НУЖНО В ЛЮБОЙ УЧЕБНЫЙ ДЕНЬ':stage.kind==='lesson'?'ГОТОВИМСЯ К ОДНОМУ УРОКУ':'ЕЩЁ ОДИН НЕБОЛЬШОЙ ШАГ')+'</span><h3 data-workspace-focus tabindex="-1">'+e(stage.title)+'</h3><p>'+e(stage.instruction||'Выбери вещи по условию этого этапа.')+'</p></header>';
 const work=hasChoices?'<div class="lq-pack-layout lq-workbench"><section class="lq-bank" data-practice-drop="bank"><div class="lq-area-title"><h4>Выбери для этого этапа</h4><span>'+bank.length+' карточек</span></div><div class="lq-items" data-workspace-fit data-workspace-scroll="life-bank" tabindex="0" aria-label="Карточки для выбора">'+bank.map(id=>itemCard(id,local,e,'pack',false)).join('')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё вещи ниже ↓</p></section><section class="lq-bag" data-practice-drop="bag" aria-label="Выбранные вещи для этого этапа"><div class="lq-area-title"><h4>Приготовлю сейчас</h4><span>'+selected.length+' вещей</span></div><div class="lq-items" data-workspace-fit data-workspace-scroll="life-selection" tabindex="0" aria-label="Приготовленные вещи">'+selected.map(id=>itemCard(id,local,e,'pack',true)).join('')+(selected.length?'':'<p class="lq-empty">Нажми на нужные вещи слева. Чтобы вернуть вещь, нажми на неё здесь.</p>')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё выбранные вещи ниже ↓</p></section></div>':'<div class="lq-packing-no-items"><span aria-hidden="true">↪</span><p>Новые вещи не нужны. Прочитай пояснение и подтверди этот этап.</p></div>';
 const actions='<div class="lq-controls lq-step-controls workspace-actions">'+button('packing-check',hasChoices?'Проверить этот этап':'Понятно, этап готов',run.checked?'hidden':'','primary',run.checked)+button('packing-next',nextLabel,run.checked?'':'hidden','primary',!run.checked)+button('packing-back','← Назад','','quiet',flow.index===0)+button('undo','Отменить','','quiet',!state.undo.length)+button('hint','Подсказка','','quiet')+(hasChoices?button('packing-reset','Очистить','','quiet',!selected.length):'')+'</div>';
 return '<section class="lq-packing-step" data-packing-stage="'+e(stage.id)+'">'+packingProgress(state,q,e)+'<div class="lq-task-brief">'+heading+conditions+'</div>'+packingEarlier(state,q,e)+work+renderFeedback(state,Object.assign({},q,{why:Object.assign({},q.why,stage.why||{})}),e)+actions+(hasChoices?scenePreview(state,q,e):'')+'</section>';
}
function renderBagPlan(state,q,e){
 if(!state.solved||!Array.isArray(q.bagGroups)||!q.bagGroups.length)return '';
 const groups=q.bagGroups.map(g=>({id:g.id,label:g.label,items:(g.itemIds||[]).filter(id=>state.chosen.includes(id))})).filter(g=>g.items.length);
 if(!groups.length)return '';
 return '<section class="lq-bag-plan"><h3>Теперь удобно разложим приготовленное</h3><p>В игре вещи выбраны. Этот план поможет разложить настоящие вещи по местам перед выходом.</p><div>'+groups.map(g=>'<article><strong>'+e(g.label)+'</strong><ul>'+g.items.map(id=>'<li><span class="lq-plan-item-art" aria-hidden="true">'+visual(item(id),e)+'</span><span>'+e(item(id).label)+'</span></li>').join('')+'</ul></article>').join('')+'</div></section>';
}
function renderMenu(state,e,env){
 const all=quests(),shown=all.filter(q=>state.category==='all'||q.category===state.category),cats=[...new Set(all.map(q=>q.category))];const last=Object.entries(state.drafts).filter(([,d])=>!d.solved).sort((a,b)=>b[1].sequence-a[1].sequence)[0];
 return renderSchoolPicker(state,e,env)+missionCards(state,e)+'<header class="lq-heading"><span class="lq-eyebrow">ПРОБУЕМ · ПЛАНИРУЕМ · ДЕЛАЕМ</span><h2>Приключения для жизни</h2><p>Наводи порядок, собирайся в путь и придумывай удобный план. Здесь можно пробовать и исправлять.</p></header>'+(last&&quest(last[0])?'<div class="lq-resume"><div><strong>Продолжим начатое?</strong><span>'+e(quest(last[0]).title)+'</span></div>'+button('open','Продолжить','data-quest="'+e(last[0])+'"','primary')+'</div>':'')+'<div class="lq-menu-summary"><span>'+Object.keys(state.done).length+' из '+all.length+' приключений попробовали в игре</span><span>Каждое можно повторить по-своему</span></div><div class="lq-categories" role="group" aria-label="Темы приключений">'+['all',...cats].map(id=>button('category',e(categories[id]||id),'data-category="'+e(id)+'" aria-pressed="'+(state.category===id)+'"',state.category===id?'active':'')).join('')+'</div><div class="lq-quest-grid">'+shown.map(q=>{const completed=state.done[q.id],real=state.real[q.id];return '<article class="lq-quest-card"><span class="lq-quest-icon" aria-hidden="true">'+e(q.icon||({places:'🧺',sorting:'🔶',school:'🎒',sports:'🏊',planning:'🗓️',home:'🏡'}[q.category])||'🧭')+'</span><span class="lq-card-tag">'+e(categories[q.category]||'Жизненные задачи')+' · '+e(q.mode==='sequence'?'Составь план':q.mode==='pack'?'Собери нужное':q.mode==='rule'?'Придумай правило':'Найди место')+'</span><h3>'+e(q.title)+'</h3><p>'+e(q.story||q.instruction)+'</p><div class="lq-card-status">'+(completed?'<span>✓ В игре получилось'+(completed.helped?' с подсказкой':completed.afterError?' после исправления':'')+'</span>':'<span>Можно попробовать</span>')+(real&&real.adultReported?'<small>Есть отметка взрослого о действии</small>':real&&real.selfReported?'<small>Действие отмечено ребёнком</small>':'')+'</div>'+button('open',completed?'Открыть ещё раз':'Начать','data-quest="'+e(q.id)+'"','primary')+'</article>';}).join('')+'</div>';
}
function renderIntro(state,q,e){if(packingEngine(q)&&state.packingFlow)return renderPackingIntro(state,q,e);const actions=q.mode==='sequence'?['Выбирай шаги по порядку.','Меняй местами, если передумал.','Проверь план и попробуй в жизни.']:q.mode==='pack'?['Прочитай, куда и зачем собираемся.','Приготовь нужные вещи по условию.','Проверь, всё ли подходит.']:['Выбери предмет.','Нажми на его место или перетащи.','Проверь и исправь, если нужно.'];return '<div class="lq-story"><span class="lq-story-icon" aria-hidden="true">'+e(q.icon||'🧭')+'</span><p>'+e(q.story||'')+'</p></div><div class="lq-goal"><strong>Твоя задача</strong><p>'+e(q.instruction)+'</p></div><ol class="lq-mini-steps">'+actions.map(s=>'<li>'+e(s)+'</li>').join('')+'</ol>'+(q.adultNote?'<p class="lq-adult-note">'+e(q.adultNote)+'</p>':'')+'<div class="lq-controls">'+button('begin','Начнём','', 'primary')+button('show-how','Покажи, как действовать','','quiet')+button('speak','Послушать задание','','quiet')+'</div>';
}
function renderSort(state,q,e){
 const todo=ids(q).filter(id=>!state.placements[id]),selected=state.selected&&item(state.selected);const rules=q.mode==='rule'?'<section class="lq-rule-picker"><h3>Как будем сортировать?</h3><p>Выбери правило, затем раздели предметы на две группы.</p><div>'+q.ruleChoices.map(r=>button('rule',e(r.label),'data-rule="'+e(r.id)+'" aria-pressed="'+(state.ruleId===r.id)+'"',state.ruleId===r.id?'active':'',state.solved)).join('')+'</div>'+(rule(q,state)?'<p class="lq-chosen-rule">'+e(rule(q,state).instruction||rule(q,state).label)+'</p>':'')+'</section>':'';
 return rules+'<div class="lq-work-tip" aria-live="polite">'+(selected?'Выбрано: <strong>'+e(selected.label)+'</strong>. Теперь нажми на подходящее место.':q.mode==='rule'&&!state.ruleId?'Начни с выбора правила.':'Нажми на вещь и на её место. Можно перетащить.')+'</div><div class="lq-sort-layout lq-workbench"><section class="lq-bank" data-practice-drop="bank" aria-label="Предметы на полке"><div class="lq-area-title"><h3>На полке</h3><span>'+todo.length+' осталось</span></div><div class="lq-items" data-workspace-fit data-workspace-scroll="life-bank" tabindex="0" aria-label="Карточки для размещения">'+todo.map(id=>itemCard(id,state,e,q.mode,false)).join('')+(todo.length?'':'<p class="lq-empty">Все предметы нашли место. Проверь свой выбор.</p>')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё вещи ниже ↓</p></section><div class="lq-zone-panel"><div class="lq-zones" data-workspace-fit data-workspace-scroll="life-zones" tabindex="0" aria-label="Места для вещей">'+zoneIds(q).map(id=>{const z=zone(id),placed=ids(q).filter(x=>state.placements[x]===id);return '<section class="lq-zone '+(selected?'can-place':'')+'" data-practice-drop="'+e(id)+'"><div class="lq-zone-heading">'+button('place','<span aria-hidden="true">'+e(z.icon||'□')+'</span><strong>'+e(z.label)+'</strong>','data-zone="'+e(id)+'"','lq-zone-target',state.solved||!state.selected)+'</div><p>'+e(z.description||'')+'</p><div class="lq-items">'+placed.map(x=>itemCard(x,state,e,q.mode,true)).join('')+(placed.length?'':'<p class="lq-empty">'+(selected?'Нажми на название места':'Место для предметов')+'</p>')+'</div></section>';}).join('')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё места ниже ↓</p></div></div><p class="lq-small">Нажми на вещь в зоне, чтобы вернуть её на полку.</p>';
}
function renderPack(state,q,e){const bank=ids(q).filter(id=>!state.chosen.includes(id));return '<div class="lq-work-tip">Нажми на нужную вещь. Ещё раз — вернуть на полку.</div><div class="lq-pack-layout lq-workbench"><section class="lq-bank" data-practice-drop="bank"><div class="lq-area-title"><h3>Что есть на полке</h3><span>'+bank.length+' вещей</span></div><div class="lq-items" data-workspace-fit data-workspace-scroll="life-bank" tabindex="0" aria-label="Карточки для выбора">'+bank.map(id=>itemCard(id,state,e,'pack',false)).join('')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё вещи ниже ↓</p></section><section class="lq-bag" data-practice-drop="bag" aria-label="Выбранные вещи"><div class="lq-area-title"><h3><span aria-hidden="true">📋</span> Я приготовлю</h3><span>'+state.chosen.length+' вещей</span></div><div class="lq-items" data-workspace-fit data-workspace-scroll="life-selection" tabindex="0" aria-label="Приготовленные вещи">'+state.chosen.map(id=>itemCard(id,state,e,'pack',true)).join('')+(state.chosen.length?'':'<p class="lq-empty">Выбери нужные вещи на полке.<br>Можно передумать и вернуть вещь.</p>')+'</div><p class="lq-scroll-cue" aria-hidden="true">Ещё выбранные вещи ниже ↓</p></section></div>';
}
function renderSequence(state,q,e){const available=steps(q).filter(s=>!state.order.includes(s.id));return '<div class="lq-work-tip">Нажимай на шаги в удобном порядке. Стрелки помогут поменять план. Некоторые шаги можно делать в разной последовательности.</div><div class="lq-plan-layout lq-workbench"><div class="lq-step-panel"><section class="lq-step-bank" data-practice-drop="bank" data-workspace-fit data-workspace-scroll="life-steps" tabindex="0" aria-label="Шаги для выбора"><h3>Шаги для плана</h3>'+available.map(s=>button('step','<span aria-hidden="true">'+e(s.icon||'＋')+'</span><span>'+e(s.label)+'</span>','data-step="'+e(s.id)+'" data-practice-drag="'+e(s.id)+'"','lq-step-choice',state.solved)).join('')+(available.length?'':'<p class="lq-empty">Все шаги уже в плане</p>')+'</section><p class="lq-scroll-cue" aria-hidden="true">Ещё шаги ниже ↓</p></div><div class="lq-step-panel"><section class="lq-plan" data-practice-drop="end" data-workspace-fit data-workspace-scroll="life-plan" tabindex="0" aria-label="Мой план"><h3>Мой план</h3><ol>'+state.order.map((id,i)=>{const s=steps(q).find(x=>x.id===id);return '<li data-practice-drop="step:'+e(id)+'"><span class="lq-step-number">'+(i+1)+'</span><span class="lq-plan-label" data-practice-drag="'+e(id)+'">'+e(s.label)+'</span><div class="lq-step-tools">'+button('up','↑','data-step="'+e(id)+'" aria-label="Поднять шаг: '+e(s.label)+'"','',state.solved||i===0)+button('down','↓','data-step="'+e(id)+'" aria-label="Опустить шаг: '+e(s.label)+'"','',state.solved||i===state.order.length-1)+button('unstep','×','data-step="'+e(id)+'" aria-label="Убрать шаг из плана: '+e(s.label)+'"','',state.solved)+'</div></li>';}).join('')+'</ol>'+(state.order.length?'':'<p class="lq-empty">Выбери первый шаг слева</p>')+'</section><p class="lq-scroll-cue" aria-hidden="true">Дальше твой план ↓</p></div></div>';
}
function renderFeedback(state,q,e){if(!state.feedback)return '';return '<div class="lq-feedback '+state.feedback.type+'" role="status"><strong>'+e(state.feedback.text)+'</strong>'+(state.issues.length?'<ul>'+state.issues.slice(0,6).map(issue=>'<li>'+e(issueText(issue,q,state))+'</li>').join('')+'</ul>':'')+(state.issues.length>6?'<p>Начни с этих пунктов. Остальное проверим после исправления.</p>':'')+'</div>';}
function renderReal(state,q,e){const r=realState(state,q),ss=q.realSteps||[],checked=r.checks.filter(Boolean).length;return renderBagPlan(state,q,e)+'<div class="lq-real-intro"><span aria-hidden="true">🌿</span><div><h3>Попробуем в жизни?</h3><p>Это по желанию. Оставь экран и выполни небольшой план. Возвращайся, когда будет удобно.</p></div></div>'+(q.adultNote?'<p class="lq-adult-note">'+e(q.adultNote)+'</p>':'')+'<p class="lq-real-progress">Отмечено '+checked+' из '+ss.length+' шагов. Можно продолжить позже.</p><ol class="lq-real-checklist">'+ss.map((text,i)=>'<li>'+button('real-toggle','<span class="lq-checkbox" aria-hidden="true">'+(r.checks[i]?'✓':'')+'</span><span>'+e(text)+'</span>','data-index="'+i+'" aria-pressed="'+r.checks[i]+'"','')+'</li>').join('')+'</ol><div class="lq-report-state"><strong>'+(r.adultReported?'Взрослый отметил, что посмотрел результат':r.selfReported?'Выполнение отмечено ребёнком':'Реальное действие ещё не отмечено')+'</strong><p>'+(r.adultReported?'Эта отметка хранится отдельно от твоего результата в игре.':r.selfReported?'Можно показать то, что получилось, взрослому.':'Галочки помогут следить за планом. Поставь их после самих действий.')+'</p></div><div class="lq-controls">'+button('real-report',r.selfReported?'Я отметил выполнение':'Я сделал по плану','','primary',!ss.length||!r.checks.every(Boolean)||r.selfReported)+button('back','К результату игры','','quiet')+button('real-later','Продолжить в другой раз','','quiet')+'</div>'+(r.selfReported?'<div class="lq-parent-area">'+button('adult-open','Для взрослого: отметить результат','','quiet')+(state.adultOpen?'<div class="lq-parent-confirm"><p>Эту отметку добавляет взрослый после того, как сам посмотрел на результат. Приложение не наблюдает за выполнением.</p>'+button('adult-confirm','Я взрослый, посмотрел результат','','primary')+'</div>':'')+'</div>':'')+renderFeedback(state,q,e);}
function render(state,env){
 env=env||{};const e=env.esc||escDefault,q=current(state);
 if(state.view==='menu'||!q)return '<div class="lq" data-life-view="menu">'+renderMenu(state,e,env)+'</div>';
 const total=q.mode==='sequence'?steps(q).length:ids(q).length,placed=q.mode==='pack'?state.chosen.length:q.mode==='sequence'?state.order.length:Object.keys(state.placements).length;
 let content='';
 if(state.phase==='intro')content=renderIntro(state,q,e);
 else if(state.phase==='guide')content=renderGuide(state,q,e);
 else if(state.phase==='small-real')content=renderSmallReal(state,q,e,env);
 else if(state.phase==='real')content=renderReal(state,q,e);
 else if(packingEngine(q)&&state.packingFlow&&!state.solved)content=renderPackingStep(state,q,e);
 else{
  content='<div class="lq-condition workspace-task"><strong>Наша ситуация</strong><p>'+e(q.story||'')+'</p>'+(q.mode==='pack'?'':'<p class="lq-instruction">'+e(q.instruction)+'</p>')+'</div>';
  content+=(q.mode==='sort'||q.mode==='rule'?renderSort(state,q,e):q.mode==='pack'?renderPack(state,q,e):renderSequence(state,q,e))+renderFeedback(state,q,e);
  if(state.solved){
   const a=state.attempt.assistance||{},message=a.visual||a.explanation||a.workedExample?'Ты воспользовался помощью и довёл игровую задачу до конца. Другую ситуацию можно попробовать самостоятельно.':a.afterError?'Ты заметил и исправил ошибку. В следующем приключении попробуем новый случай.':'Ты справился с этой игровой ситуацией. Маленький шаг можно попробовать и в жизни.';
   content+=renderBagPlan(state,q,e)+'<div class="lq-finish"><p>'+e(message)+'</p><div class="lq-controls">'+((q.realSteps||[]).length?button('real-small','Попробовать в жизни: один шаг','','primary')+button('real','Весь план для жизни','','quiet'):'')+button('menu','Другие приключения','','quiet')+button('replay','Попробовать ещё раз','','quiet')+'</div></div>';
  }else content+='<div class="lq-controls workspace-actions">'+button('check','Проверить','','primary')+button('hint','Подсказка','','quiet')+button('undo','Отменить действие','','quiet',!state.undo.length)+button('reset','Начать заново','','quiet')+'</div>';
  content+=(!state.solved?helpPreview(state,q,e):'')+scenePreview(state,q,e);
 }
 const stageId=packingEngine(q)&&state.packingFlow?packingCurrent(state,q)?.id||'review':'activity',workspaceKey='life:'+q.id+':'+state.phase+':'+stageId+':'+(state.solved?'result':'task');
 return '<div class="lq trainer-workspace" data-workspace-key="'+e(workspaceKey)+'" data-life-view="'+e(state.phase)+'" data-life-quest="'+e(q.id)+'"><div class="lq-quest-top">'+button('menu','← Все приключения','','quiet')+'<span>'+e(categories[q.category]||'Жизненные задачи')+'</span></div><header class="lq-heading lq-quest-heading"><h2'+(packingEngine(q)&&state.packingFlow&&state.phase==='play'&&!state.solved?'':' data-workspace-focus tabindex="-1"')+'>'+e(q.title)+'</h2>'+(state.phase==='play'?'<p class="lq-progress">'+(state.solved?'✓ В игре получилось':packingEngine(q)&&state.packingFlow?'Идём по занятиям · проверяем один этап за раз':q.mode==='pack'?'Выбрано вещей: '+placed:'Размещено: '+placed+' из '+total)+'</p>':'')+'</header>'+(!packingEngine(q)||state.solved||['real','small-real'].includes(state.phase)?renderConditions(q,e,false):'')+content+'</div>';
}

function capture(){return false;}
root.LifeQuests={VERSION,STORAGE_VERSION,create,restore,snapshot,render,handle,capture,current,evaluate,issueText,quests,model,byteSize,afterRender,sceneState};
})(typeof window==='undefined'?globalThis:window);
