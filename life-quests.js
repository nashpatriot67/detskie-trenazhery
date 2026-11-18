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
function create(options){options=options||{};return {version:VERSION,generation:generation(options),view:'menu',category:'all',questId:null,phase:'intro',selected:null,placements:{},chosen:[],order:[],ruleId:null,feedback:null,issues:[],solved:false,attempt:null,undo:[],done:{},drafts:{},real:{},sequence:0,adultOpen:false};}
function current(state){return quest(state.questId);}
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
function model(state){return {placements:clone(state.placements),chosen:state.chosen.slice(),order:state.order.slice(),ruleId:state.ruleId};}
function cleanModel(raw,q){
 raw=object(raw)?raw:{};const result={placements:{},chosen:[],order:[],ruleId:null},ii=ids(q),zz=zoneIds(q),ss=steps(q).map(s=>s.id);
 if(object(raw.placements))for(const id of ii)if(zz.includes(raw.placements[id]))result.placements[id]=raw.placements[id];
 result.chosen=Array.isArray(raw.chosen)?[...new Set(raw.chosen.filter(id=>ii.includes(id)))]:[];
 result.order=Array.isArray(raw.order)?[...new Set(raw.order.filter(id=>ss.includes(id)))]:[];
 if(Array.isArray(q.ruleChoices)&&q.ruleChoices.some(r=>r.id===raw.ruleId))result.ruleId=raw.ruleId;
 return result;
}
function shortAttempt(a){return {attemptId:a.attemptId,firstOutcome:a.firstOutcome,errors:a.errors,assistance:Object.fromEntries(Object.entries(a.assistance||{}).filter(([,v])=>v===true))};}
function taskSnapshot(state){return {...model(state),phase:state.phase,solved:state.solved,attempt:shortAttempt(state.attempt),issues:clone(state.issues),sequence:state.sequence};}
function byteSize(value){const text=JSON.stringify(value);let bytes=0;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c<128)bytes++;else if(c<2048)bytes+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<text.length){bytes+=4;i++;}else bytes+=3;}return bytes;}
function compact(state){
 // Keep every unfinished answer. Compress repeatable metadata rather than
 // evicting a draft merely because the child opened another adventure.
 for(const id of Object.keys(state.drafts)){
  const draft=state.drafts[id],q=quest(id);if(draft.solved||!q){delete state.drafts[id];continue;}
  draft.attempt=shortAttempt(draft.attempt);delete draft.selected;delete draft.feedback;
  if(q.mode==='sort'||q.mode==='rule'){delete draft.chosen;delete draft.order;}
  if(q.mode==='pack'){delete draft.placements;delete draft.order;delete draft.ruleId;}
  if(q.mode==='sequence'){delete draft.placements;delete draft.chosen;delete draft.ruleId;}
 }
 const order=Object.keys(state.drafts).filter(id=>id!==state.questId).sort((a,b)=>state.drafts[b].sequence-state.drafts[a].sequence);
 while(state.undo.length&&byteSize(state)>44*1024)state.undo.shift();
 if(byteSize(state)>44*1024){for(const id of order.slice().reverse()){state.drafts[id].issues=[];if(byteSize(state)<=44*1024)break;}}
 // A historical solved layout can be practised again; a pending answer must
 // never be deleted to make room. The done marker and real plan remain.
 if(byteSize(state)>44*1024){const completed=Object.keys(state.done).filter(id=>id!==state.questId).sort((a,b)=>state.done[a].sequence-state.done[b].sequence);for(const id of completed){delete state.done[id].model;if(byteSize(state)<=44*1024)break;}}
 return state;
}
function saveDraft(state){const q=current(state);if(q&&!state.solved)state.drafts[q.id]=taskSnapshot(state);else if(q)delete state.drafts[q.id];compact(state);}
function loadQuest(state,q,env,replay){
 if(current(state)&&state.view==='quest')saveDraft(state);
 const draft=!replay&&state.drafts[q.id];state.view='quest';state.questId=q.id;state.selected=null;state.undo=[];state.adultOpen=false;
 if(draft){Object.assign(state,cleanModel(draft,q));state.phase=['intro','play','real'].includes(draft.phase)?draft.phase:'play';state.solved=draft.solved===true;state.attempt=attemptClean(draft.attempt,q,env);state.issues=cleanIssues(draft.issues,q);state.feedback=cleanFeedback(draft.feedback)||(state.issues.length?{type:'error',text:'Продолжим с сохранённого места. Здесь остались пункты для проверки.'}:null);}
 else if(!replay&&state.done[q.id]&&state.done[q.id].model){const past=state.done[q.id];Object.assign(state,cleanModel(past.model,q));state.phase='play';state.solved=true;state.attempt=startAttempt(q,env);state.attempt.assistance.visual=past.helped;state.attempt.assistance.afterError=past.afterError;state.attempt.firstOutcome=past.afterError?'incorrect':'correct';state.feedback={type:'success',text:'Ты уже справился с этой игровой ситуацией. Можно посмотреть свой план или попробовать заново.'};state.issues=[];}
 else{Object.assign(state,cleanModel({},q));state.phase='intro';state.solved=false;state.attempt=startAttempt(q,env);state.feedback=null;state.issues=[];}
 if(state.phase==='real'&&!state.solved)state.phase='play';state.sequence++;saveDraft(state);
}
function cleanFeedback(value){return object(value)&&typeof value.text==='string'?{type:['success','error','hint'].includes(value.type)?value.type:'hint',text:value.text.slice(0,900)}:null;}
function cleanIssues(value,q){return Array.isArray(value)?value.filter(v=>object(v)&&typeof v.code==='string').slice(0,24).map(v=>({code:v.code.slice(0,40),item:ids(q).includes(v.item)?v.item:undefined,step:steps(q).some(s=>s.id===v.step)?v.step:undefined,before:steps(q).some(s=>s.id===v.before)?v.before:undefined})):[];}
function restore(raw,options){
 options=options||{};if(!object(raw)||raw.version!==VERSION||raw.generation!==generation(options))return null;
 let length;try{length=byteSize(raw);}catch(_){return null;}if(length>48*1024)return null;
 const state=create(options);state.view=raw.view==='quest'?'quest':'menu';state.category=typeof raw.category==='string'&&raw.category.length<50?raw.category:'all';state.sequence=Number.isInteger(raw.sequence)?Math.max(0,Math.min(100000,raw.sequence)):0;
 if(object(raw.done))for(const q of quests()){const value=raw.done[q.id];if(object(value)){state.done[q.id]={count:Number.isInteger(value.count)?Math.max(1,Math.min(999,value.count)):1,helped:value.helped===true,afterError:value.afterError===true,sequence:Number.isInteger(value.sequence)?value.sequence:0};if(object(value.model))state.done[q.id].model=cleanModel(value.model,q);}}
 if(object(raw.real))for(const q of quests()){const value=raw.real[q.id];if(!object(value))continue;const n=Array.isArray(q.realSteps)?q.realSteps.length:0;state.real[q.id]={checks:Array.from({length:n},(_,i)=>value.checks&&value.checks[i]===true),selfReported:value.selfReported===true,adultReported:value.adultReported===true};if(!state.real[q.id].checks.every(Boolean)){state.real[q.id].selfReported=false;state.real[q.id].adultReported=false;}if(!state.real[q.id].selfReported)state.real[q.id].adultReported=false;}
 if(object(raw.drafts))for(const q of quests()){const d=raw.drafts[q.id];if(!object(d))continue;state.drafts[q.id]={...cleanModel(d,q),phase:['intro','play','real'].includes(d.phase)?d.phase:'play',selected:null,solved:d.solved===true,attempt:attemptClean(d.attempt,q,options),feedback:cleanFeedback(d.feedback),issues:cleanIssues(d.issues,q),sequence:Number.isInteger(d.sequence)?d.sequence:0};}
 const q=state.view==='quest'?quest(raw.questId):null;if(q){state.questId=q.id;Object.assign(state,cleanModel(raw,q));state.phase=['intro','play','real'].includes(raw.phase)?raw.phase:'play';state.solved=raw.solved===true;state.attempt=attemptClean(raw.attempt,q,options);state.feedback=cleanFeedback(raw.feedback);state.issues=cleanIssues(raw.issues,q);state.undo=Array.isArray(raw.undo)?raw.undo.slice(-MAX_UNDO).filter(object).map(v=>cleanModel(v,q)):[];if(state.phase==='real'&&!state.solved)state.phase='play';saveDraft(state);}else{state.view='menu';state.questId=null;}
 return compact(state);
}
function history(state){state.undo.push(model(state));if(state.undo.length>MAX_UNDO)state.undo.shift();}
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
 }else if(q.mode==='sequence'){
  for(const s of steps(q))if(!state.order.includes(s.id))issues.push({code:'missing-step',step:s.id});
  for(const pair of q.before||[]){if(state.order.includes(pair[0])&&state.order.includes(pair[1])&&state.order.indexOf(pair[0])>state.order.indexOf(pair[1]))issues.push({code:'order',step:pair[1],before:pair[0]});}
 }else issues.push({code:'unsupported'});
 return {correct:issues.length===0,issues};
}
function issueText(issue,q,state){const id=issue.item,label=id?item(id).label:'';const why=id&&q.why&&q.why[id];switch(issue.code){case 'choose-rule':return 'Сначала выбери правило, по которому будешь сортировать.';case 'unplaced':return 'Найди место: '+label+'.';case 'wrong-zone':return label+': '+(why||'Сравни предмет с правилом и описанием места.');case 'missing':return label+': '+(why||'Эта вещь нужна по условию. Найди её среди предметов.');case 'extra':return label+': '+(why||'Для этой ситуации вещь не нужна. Верни её на полку.');case 'alternative-missing':{const g=(q.alternatives||[]).find(g=>g.items.includes(id));return 'Выбери подходящий вариант: '+(g?g.label:label)+'.';}case 'alternative-extra':return 'По условию достаточно меньшего количества вариантов. Проверь памятку.';case 'missing-step':return 'Добавь в план: '+(steps(q).find(s=>s.id===issue.step)||{}).label+'.';case 'order':return 'Подумай, что должно быть раньше: «'+(steps(q).find(s=>s.id===issue.before)||{}).label+'» или «'+(steps(q).find(s=>s.id===issue.step)||{}).label+'».';default:return 'Проверь условие и свой план.';}}
function observe(state,env,outcome){const q=current(state);if(!env||typeof env.observe!=='function'||!q)return;if(state.attempt.firstOutcome==='notchecked')state.attempt.firstOutcome=outcome;env.observe({...clone(state.attempt),outcome,subject:'life',mode:q.mode,familyId:'life.'+(q.category||q.mode),variantId:q.id,evidenceKind:'virtual-life-task',materialRevision:1,criteriaRevision:1});}
function realState(state,q){if(!state.real[q.id])state.real[q.id]={checks:(q.realSteps||[]).map(()=>false),selfReported:false,adultReported:false};return state.real[q.id];}
function handle(state,action,payload,env){
 payload=payload||{};env=env||{};let q=current(state),changed=true;
 if(action==='category'){if(q&&state.view==='quest')saveDraft(state);state.category=String(payload.category||'all');state.view='menu';state.questId=null;state.solved=false;}
 else if(action==='open'){const next=quest(payload.quest||payload.id);if(!next)return false;loadQuest(state,next,env,false);}
 else if(action==='menu'){if(q)saveDraft(state);state.view='menu';state.questId=null;state.solved=false;state.feedback=null;state.selected=null;state.adultOpen=false;}
 else if(!q||state.view!=='quest')return false;
 else if(action==='begin'){state.phase='play';state.feedback=null;}
 else if(action==='replay'){loadQuest(state,q,env,true);}
 else if(action==='hint'){helped(state,env,'visual');feedback(state,env,q.hint||'Посмотри на условие. Можно переносить вещи по одной и исправлять свой выбор.');}
 else if(action==='speak'){if(typeof env.speak==='function')env.speak(q.instruction||q.title);return true;}
 else if(action==='real'){if(!state.solved)return false;state.phase='real';state.selected=null;state.feedback=null;realState(state,q);}
 else if(action==='back'){state.phase='play';state.adultOpen=false;state.feedback=null;}
 else if(action==='real-toggle'){if(state.phase!=='real'||!state.solved)return false;const n=Number(payload.index),r=realState(state,q);if(!Number.isInteger(n)||n<0||n>=r.checks.length)return false;r.checks[n]=!r.checks[n];r.selfReported=false;r.adultReported=false;state.adultOpen=false;}
 else if(action==='real-report'){const r=realState(state,q);if(!r.checks.length||!r.checks.every(Boolean))return false;r.selfReported=true;r.adultReported=false;feedback(state,env,'Ты отметил выполнение сам. Можно показать результат взрослому.','success');}
 else if(action==='adult-open'){const r=realState(state,q);if(!r.selfReported)return false;state.adultOpen=!state.adultOpen;state.feedback=null;}
 else if(action==='adult-confirm'){const r=realState(state,q);if(!state.adultOpen||!r.selfReported||!r.checks.every(Boolean))return false;r.adultReported=true;state.adultOpen=false;feedback(state,env,'Добавлена отдельная отметка взрослого.','success');}
 else if(state.phase!=='play'||state.solved)return false;
 else if(action==='reset'){const a=state.attempt;Object.assign(state,cleanModel({},q));state.attempt=a;state.feedback=null;state.issues=[];state.selected=null;state.undo=[];}
 else if(action==='undo'){if(!state.undo.length)return false;Object.assign(state,state.undo.pop());state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='rule'){const r=(q.ruleChoices||[]).find(x=>x.id===payload.rule);if(!r)return false;history(state);state.ruleId=r.id;state.placements={};state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='select'){const id=payload.item;if(!ids(q).includes(id))return false;state.selected=state.selected===id?null:id;state.feedback=null;announce(env,state.selected?item(id).label+' выбрано. Теперь выбери место.':'Выбор снят.');}
 else if(action==='toggle'){const id=payload.item;if(q.mode!=='pack'||!ids(q).includes(id))return false;history(state);state.chosen=state.chosen.includes(id)?state.chosen.filter(x=>x!==id):state.chosen.concat(id);state.feedback=null;state.issues=[];state.selected=null;}
 else if(action==='place'||action==='drop'){
  const id=action==='drop'?payload.item:state.selected,to=payload.zone;
  if(q.mode==='sequence'){
   if(!steps(q).some(s=>s.id===id))return false;const before=String(to||'').replace(/^step:/,'');if(to!=='end'&&to!=='bank'&&!steps(q).some(s=>s.id===before))return false;history(state);state.order=state.order.filter(x=>x!==id);if(to!=='bank'){const i=state.order.indexOf(before);state.order.splice(i<0?state.order.length:i,0,id);}state.selected=null;
  }else if(q.mode==='pack'){
   if(!ids(q).includes(id)||!['bag','bank'].includes(to))return false;history(state);state.chosen=state.chosen.filter(x=>x!==id);if(to==='bag')state.chosen.push(id);state.selected=null;
  }else{if(!ids(q).includes(id)||(!zoneIds(q).includes(to)&&to!=='bank'))return false;if(q.mode==='rule'&&!rule(q,state)){feedback(state,env,'Сначала выбери правило сортировки.');return true;}history(state);if(to==='bank')delete state.placements[id];else state.placements[id]=to;state.selected=null;}
  state.feedback=null;state.issues=[];
 }
 else if(action==='remove'){const id=payload.item;if(!ids(q).includes(id))return false;history(state);delete state.placements[id];state.selected=null;state.feedback=null;state.issues=[];}
 else if(action==='step'){const id=payload.step;if(q.mode!=='sequence'||!steps(q).some(s=>s.id===id)||state.order.includes(id))return false;history(state);state.order.push(id);state.feedback=null;state.issues=[];}
 else if(action==='unstep'){const id=payload.step;if(q.mode!=='sequence'||!state.order.includes(id))return false;history(state);state.order=state.order.filter(x=>x!==id);state.feedback=null;state.issues=[];}
 else if(action==='up'||action==='down'){const id=payload.step,i=state.order.indexOf(id),j=i+(action==='up'?-1:1);if(q.mode!=='sequence'||i<0||j<0||j>=state.order.length)return false;history(state);[state.order[i],state.order[j]]=[state.order[j],state.order[i]];state.feedback=null;state.issues=[];}
 else if(action==='check'){
  const result=evaluate(state);state.issues=result.issues;
  if(result.correct){state.solved=true;state.selected=null;const a=state.attempt.assistance||{},old=state.done[q.id]||{};state.done[q.id]={count:Math.min(999,(old.count||0)+1),helped:!!(a.visual||a.explanation||a.workedExample),afterError:!!a.afterError,sequence:++state.sequence,model:model(state)};observe(state,env,'correct');feedback(state,env,'В игре получилось! '+(q.success||'Все вещи и шаги подходят к условию. Можно попробовать это в жизни.'),'success');}
  else{helped(state,env,'error');observe(state,env,'incorrect');feedback(state,env,result.issues.length===1?'Осталось проверить один момент. Ты можешь исправить свой выбор.':'Есть несколько мест для проверки. Сохраним то, что уже получилось, и поправим остальное.','error');}
 }
 else changed=false;
 if(changed&&state.view==='quest')saveDraft(state);return changed;
}
function shapeSvg(it){const shape=it.shape,fill=it.illustration&&/^#[0-9a-fA-F]{6}$/.test(it.illustration.fill)?it.illustration.fill:{red:'#df705e',blue:'#6aa6cf',green:'#75a98a',yellow:'#e5bc58',purple:'#aa95c5',orange:'#de9b56',white:'#f7f4e7'}[it.color]||'#7da5ac';const drawing=shape==='circle'?'<circle cx="32" cy="32" r="22"/>':shape==='triangle'?'<path d="M32 8 59 56H5Z"/>':shape==='rectangle'?'<rect x="6" y="15" width="52" height="34" rx="5"/>':shape==='star'?'<path d="m32 5 8 17 19 2-14 13 4 20-17-10-17 10 4-20L5 24l19-2Z"/>':'<rect x="10" y="10" width="44" height="44" rx="6"/>';const scale=it.size==='small'?'transform="translate(12 12) scale(.625)"':'';return '<svg viewBox="0 0 64 64" aria-hidden="true"><g '+scale+' fill="'+fill+'" stroke="#304c4c" stroke-opacity=".22" stroke-width="2">'+drawing+'</g></svg>';}
function visual(it,e){return ['circle','triangle','square','rectangle','star'].includes(it.shape)&&it.illustration&&it.illustration.type==='shape'?shapeSvg(it):'<span aria-hidden="true">'+e(it.icon||'□')+'</span>';}
function button(action,text,attrs,cls,disabled){return '<button type="button" class="lq-btn '+(cls||'')+'" data-lq-action="'+action+'" '+(attrs||'')+(disabled?' disabled':'')+'>'+text+'</button>';}
function itemCard(id,state,e,mode,placed){const it=item(id),selected=state.selected===id,issue=state.issues.some(v=>v.item===id);const action=mode==='pack'?'toggle':placed?'remove':'select';const material=it.illustration&&it.illustration.type==='shape'?({wood:'дерево',plastic:'пластик'}[it.material]||''):'';return '<button type="button" class="lq-item '+(selected?'is-selected ':'')+(issue?'has-issue ':'')+(placed?'is-placed':'')+'" data-lq-action="'+action+'" data-item="'+e(id)+'" data-practice-drag="'+e(id)+'" aria-pressed="'+selected+'" '+(state.solved?'disabled':'')+' aria-label="'+e(it.label+(material?', '+material:'')+(mode==='pack'?(state.chosen.includes(id)?': убрать из сумки':': положить в сумку'):placed?': вернуть на полку':': выбрать'))+'"><span class="lq-item-art">'+visual(it,e)+'</span><span class="lq-item-label">'+e(it.label)+'</span>'+(material?'<small class="lq-item-material">'+e(material)+'</small>':'')+(mode==='pack'&&state.chosen.includes(id)?'<span class="lq-check" aria-hidden="true">✓</span>':'')+'</button>';}
function renderMenu(state,e){
 const all=quests(),shown=all.filter(q=>state.category==='all'||q.category===state.category),cats=[...new Set(all.map(q=>q.category))];const last=Object.entries(state.drafts).filter(([,d])=>!d.solved).sort((a,b)=>b[1].sequence-a[1].sequence)[0];
 return '<header class="lq-heading"><span class="lq-eyebrow">ПРОБУЕМ · ПЛАНИРУЕМ · ДЕЛАЕМ</span><h2>Приключения для жизни</h2><p>Наводи порядок, собирайся в путь и придумывай удобный план. Здесь можно пробовать и исправлять.</p></header>'+(last&&quest(last[0])?'<div class="lq-resume"><div><strong>Продолжим начатое?</strong><span>'+e(quest(last[0]).title)+'</span></div>'+button('open','Продолжить','data-quest="'+e(last[0])+'"','primary')+'</div>':'')+'<div class="lq-menu-summary"><span>'+Object.keys(state.done).length+' из '+all.length+' приключений попробовали в игре</span><span>Каждое можно повторить по-своему</span></div><div class="lq-categories" role="group" aria-label="Темы приключений">'+['all',...cats].map(id=>button('category',e(categories[id]||id),'data-category="'+e(id)+'" aria-pressed="'+(state.category===id)+'"',state.category===id?'active':'')).join('')+'</div><div class="lq-quest-grid">'+shown.map(q=>{const completed=state.done[q.id],real=state.real[q.id];return '<article class="lq-quest-card"><span class="lq-quest-icon" aria-hidden="true">'+e(q.icon||({places:'🧺',sorting:'🔶',school:'🎒',sports:'🏊',planning:'🗓️',home:'🏡'}[q.category])||'🧭')+'</span><span class="lq-card-tag">'+e(categories[q.category]||'Жизненные задачи')+' · '+e(q.mode==='sequence'?'Составь план':q.mode==='pack'?'Собери нужное':q.mode==='rule'?'Придумай правило':'Найди место')+'</span><h3>'+e(q.title)+'</h3><p>'+e(q.story||q.instruction)+'</p><div class="lq-card-status">'+(completed?'<span>✓ В игре получилось'+(completed.helped?' с подсказкой':completed.afterError?' после исправления':'')+'</span>':'<span>Можно попробовать</span>')+(real&&real.adultReported?'<small>Есть отметка взрослого о действии</small>':real&&real.selfReported?'<small>Действие отмечено ребёнком</small>':'')+'</div>'+button('open',completed?'Открыть ещё раз':'Начать','data-quest="'+e(q.id)+'"','primary')+'</article>';}).join('')+'</div>';
}
function renderIntro(state,q,e){const actions=q.mode==='sequence'?['Выбирай шаги по порядку.','Меняй местами, если передумал.','Проверь план и попробуй в жизни.']:q.mode==='pack'?['Прочитай, куда и зачем собираемся.','Клади нужные вещи в сумку.','Проверь, всё ли подходит.']:['Выбери предмет.','Нажми на его место или перетащи.','Проверь и исправь, если нужно.'];return '<div class="lq-story"><span class="lq-story-icon" aria-hidden="true">'+e(q.icon||'🧭')+'</span><p>'+e(q.story||'')+'</p></div><div class="lq-goal"><strong>Твоя задача</strong><p>'+e(q.instruction)+'</p></div><ol class="lq-mini-steps">'+actions.map(s=>'<li>'+e(s)+'</li>').join('')+'</ol>'+(q.adultNote?'<p class="lq-adult-note">'+e(q.adultNote)+'</p>':'')+'<div class="lq-controls">'+button('begin','Начнём','', 'primary')+button('speak','Послушать задание','','quiet')+'</div>';
}
function renderSort(state,q,e){
 const todo=ids(q).filter(id=>!state.placements[id]),selected=state.selected&&item(state.selected);const rules=q.mode==='rule'?'<section class="lq-rule-picker"><h3>Как будем сортировать?</h3><p>Выбери правило, затем раздели предметы на две группы.</p><div>'+q.ruleChoices.map(r=>button('rule',e(r.label),'data-rule="'+e(r.id)+'" aria-pressed="'+(state.ruleId===r.id)+'"',state.ruleId===r.id?'active':'',state.solved)).join('')+'</div>'+(rule(q,state)?'<p class="lq-chosen-rule">'+e(rule(q,state).instruction||rule(q,state).label)+'</p>':'')+'</section>':'';
 return rules+'<div class="lq-work-tip" aria-live="polite">'+(selected?'Выбрано: <strong>'+e(selected.label)+'</strong>. Теперь нажми на подходящее место.':q.mode==='rule'&&!state.ruleId?'Начни с выбора правила.':'Нажми на вещь и на её место. Можно перетащить.')+'</div><section class="lq-bank" data-practice-drop="bank" aria-label="Предметы на полке"><div class="lq-area-title"><h3>На полке</h3><span>'+todo.length+' осталось разместить</span></div><div class="lq-items">'+todo.map(id=>itemCard(id,state,e,q.mode,false)).join('')+(todo.length?'':'<p class="lq-empty">Все предметы нашли место. Проверь свой выбор.</p>')+'</div></section><div class="lq-zones">'+zoneIds(q).map(id=>{const z=zone(id),placed=ids(q).filter(x=>state.placements[x]===id);return '<section class="lq-zone '+(selected?'can-place':'')+'" data-practice-drop="'+e(id)+'"><div class="lq-zone-heading">'+button('place','<span aria-hidden="true">'+e(z.icon||'□')+'</span><strong>'+e(z.label)+'</strong>','data-zone="'+e(id)+'"','lq-zone-target',state.solved||!state.selected)+'</div><p>'+e(z.description||'')+'</p><div class="lq-items">'+placed.map(x=>itemCard(x,state,e,q.mode,true)).join('')+(placed.length?'':'<p class="lq-empty">'+(selected?'Нажми на название места':'Сюда можно положить предмет')+'</p>')+'</div></section>';}).join('')+'</div><p class="lq-small">Чтобы вернуть предмет, нажми на него в зоне или перетащи обратно на полку.</p>';
}
function renderPack(state,q,e){const bank=ids(q).filter(id=>!state.chosen.includes(id));return '<div class="lq-work-tip">Выбирай нужные вещи. Нажми на вещь, чтобы положить её в сумку или вернуть обратно.</div><div class="lq-pack-layout"><section class="lq-bank" data-practice-drop="bank"><div class="lq-area-title"><h3>Что есть на полке</h3><span>'+bank.length+' вещей</span></div><div class="lq-items">'+bank.map(id=>itemCard(id,state,e,'pack',false)).join('')+'</div></section><section class="lq-bag" data-practice-drop="bag" aria-label="Сумка"><div class="lq-area-title"><h3><span aria-hidden="true">🎒</span> Моя сумка</h3><span>'+state.chosen.length+' вещей</span></div><div class="lq-items">'+state.chosen.map(id=>itemCard(id,state,e,'pack',true)).join('')+(state.chosen.length?'':'<p class="lq-empty">Выбери вещи на полке.<br>Лишнее всегда можно вернуть.</p>')+'</div></section></div>';
}
function renderSequence(state,q,e){const available=steps(q).filter(s=>!state.order.includes(s.id));return '<div class="lq-work-tip">Нажимай на шаги в удобном порядке. Стрелки помогут поменять план. Некоторые шаги можно делать в разной последовательности.</div><div class="lq-plan-layout"><section class="lq-step-bank" data-practice-drop="bank"><h3>Шаги для плана</h3>'+available.map(s=>button('step','<span aria-hidden="true">'+e(s.icon||'＋')+'</span><span>'+e(s.label)+'</span>','data-step="'+e(s.id)+'" data-practice-drag="'+e(s.id)+'"','lq-step-choice',state.solved)).join('')+(available.length?'':'<p class="lq-empty">Все шаги уже в плане</p>')+'</section><section class="lq-plan" data-practice-drop="end"><h3>Мой план</h3><ol>'+state.order.map((id,i)=>{const s=steps(q).find(x=>x.id===id);return '<li data-practice-drop="step:'+e(id)+'"><span class="lq-step-number">'+(i+1)+'</span><span class="lq-plan-label" data-practice-drag="'+e(id)+'">'+e(s.label)+'</span><div class="lq-step-tools">'+button('up','↑','data-step="'+e(id)+'" aria-label="Поднять шаг: '+e(s.label)+'"','',state.solved||i===0)+button('down','↓','data-step="'+e(id)+'" aria-label="Опустить шаг: '+e(s.label)+'"','',state.solved||i===state.order.length-1)+button('unstep','×','data-step="'+e(id)+'" aria-label="Убрать шаг из плана: '+e(s.label)+'"','',state.solved)+'</div></li>';}).join('')+'</ol>'+(state.order.length?'':'<p class="lq-empty">Выбери первый шаг слева</p>')+'</section></div>';
}
function renderFeedback(state,q,e){if(!state.feedback)return '';return '<div class="lq-feedback '+state.feedback.type+'" role="status"><strong>'+e(state.feedback.text)+'</strong>'+(state.issues.length?'<ul>'+state.issues.slice(0,6).map(issue=>'<li>'+e(issueText(issue,q,state))+'</li>').join('')+'</ul>':'')+(state.issues.length>6?'<p>Начни с этих пунктов. Остальное проверим после исправления.</p>':'')+'</div>';}
function renderReal(state,q,e){const r=realState(state,q),ss=q.realSteps||[];return '<div class="lq-real-intro"><span aria-hidden="true">🌿</span><div><h3>Попробуем в жизни?</h3><p>Это по желанию. Оставь экран и выполни небольшой план. Возвращайся, когда будет удобно.</p></div></div>'+(q.adultNote?'<p class="lq-adult-note">'+e(q.adultNote)+'</p>':'')+'<ol class="lq-real-checklist">'+ss.map((text,i)=>'<li>'+button('real-toggle','<span class="lq-checkbox" aria-hidden="true">'+(r.checks[i]?'✓':'')+'</span><span>'+e(text)+'</span>','data-index="'+i+'" aria-pressed="'+r.checks[i]+'"','')+'</li>').join('')+'</ol><div class="lq-report-state"><strong>'+(r.adultReported?'Взрослый отметил, что посмотрел результат':r.selfReported?'Выполнение отмечено ребёнком':'Реальное действие ещё не отмечено')+'</strong><p>'+(r.adultReported?'Эта отметка хранится отдельно от твоего результата в игре.':r.selfReported?'Можно показать то, что получилось, взрослому.':'Галочки помогут следить за планом. Поставь их после самих действий.')+'</p></div><div class="lq-controls">'+button('real-report',r.selfReported?'Я отметил выполнение':'Я сделал по плану','','primary',!ss.length||!r.checks.every(Boolean)||r.selfReported)+button('back','К результату игры','','quiet')+'</div>'+(r.selfReported?'<div class="lq-parent-area">'+button('adult-open','Для взрослого: отметить результат','','quiet')+(state.adultOpen?'<div class="lq-parent-confirm"><p>Эту отметку добавляет взрослый после того, как сам посмотрел на результат. Приложение не наблюдает за выполнением.</p>'+button('adult-confirm','Я взрослый, посмотрел результат','','primary')+'</div>':'')+'</div>':'')+renderFeedback(state,q,e);}
function render(state,env){
 env=env||{};const e=env.esc||escDefault,q=current(state);
 if(state.view==='menu'||!q)return '<div class="lq" data-life-view="menu">'+renderMenu(state,e)+'</div>';
 const total=q.mode==='sequence'?steps(q).length:ids(q).length,placed=q.mode==='pack'?state.chosen.length:q.mode==='sequence'?state.order.length:Object.keys(state.placements).length;
 let content=state.phase==='intro'?renderIntro(state,q,e):state.phase==='real'?renderReal(state,q,e):'<div class="lq-condition"><strong>Наша ситуация</strong><p>'+e(q.story||'')+'</p><p class="lq-instruction">'+e(q.instruction)+'</p></div>'+(q.mode==='sort'||q.mode==='rule'?renderSort(state,q,e):q.mode==='pack'?renderPack(state,q,e):renderSequence(state,q,e))+renderFeedback(state,q,e)+(state.solved?'<div class="lq-finish"><p>'+e(state.attempt.assistance&&state.attempt.assistance.visual?'Ты воспользовался подсказкой и довёл задачу до конца. Другую ситуацию можно попробовать самостоятельно.':state.attempt.assistance&&state.attempt.assistance.afterError?'Ты заметил и исправил ошибку. В следующем приключении попробуем новый случай.':'Ты справился с этой игровой ситуацией. Навык можно попробовать и в жизни.')+'</p><div class="lq-controls">'+((q.realSteps||[]).length?button('real','Попробовать в жизни','','primary'):'')+button('menu','Другие приключения','','quiet')+button('replay','Попробовать ещё раз','','quiet')+'</div></div>':'<div class="lq-controls">'+button('check','Проверить','','primary')+button('hint','Подсказка','','quiet')+button('undo','Отменить действие','','quiet',!state.undo.length)+button('reset','Начать раскладку заново','','quiet')+'</div>');
 return '<div class="lq" data-life-view="'+e(state.phase)+'" data-life-quest="'+e(q.id)+'"><div class="lq-quest-top">'+button('menu','← Все приключения','','quiet')+'<span>'+e(categories[q.category]||'Жизненные задачи')+'</span></div><header class="lq-heading"><h2>'+e(q.title)+'</h2>'+(state.phase==='play'?'<p class="lq-progress">'+(state.solved?'✓ В игре получилось':q.mode==='pack'?'Выбрано вещей: '+placed:'Размещено: '+placed+' из '+total)+'</p>':'')+'</header>'+content+'</div>';
}
function capture(){return false;}
root.LifeQuests={VERSION,create,restore,render,handle,capture,current,evaluate,issueText,quests,model,byteSize};
})(typeof window==='undefined'?globalThis:window);
