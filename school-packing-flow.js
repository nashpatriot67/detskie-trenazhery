(function(root){
'use strict';
// Per-lesson preparation extends the existing Life quest. It has no storage,
// awards or assessment history: those remain with LifeQuests and its attempt.
const VERSION=1,own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>JSON.parse(JSON.stringify(v)),unique=a=>[...new Set(a)];
const list=v=>Array.isArray(v)?v:[];
const stages=q=>list(q&&q.packingStages);
const allowed=s=>unique(list(s.required).concat(list(s.optional),list(s.alternatives).flatMap(g=>list(g.items))));
const supplied=q=>list(q&&q.alreadyProvided).concat(list(q&&q.schedule&&q.schedule.provided));
function supports(q){return !!q&&q.mode==='pack'&&stages(q).length>0&&stages(q).length<=16;}
function ownership(q){const result={};stages(q).forEach((s,index)=>allowed(s).forEach(id=>{if(!own(result,id))result[id]=index;}));return result;}
function validatePlan(q){
 const errors=[];if(!supports(q))return {success:false,errors:['missing-stages']};
 const ss=stages(q),ids=ss.map(s=>s&&s.id),bank=list(q.itemIds),seen=new Set();
 if(typeof q.id!=='string'||!q.id||q.id.length>160||ids.some(id=>typeof id!=='string'||!id||id.length>160||['__proto__','constructor','prototype'].includes(id))||new Set(ids).size!==ids.length)errors.push('invalid-stage-ids');
 ss.forEach(s=>{
  for(const id of allowed(s)){if(!bank.includes(id))errors.push('unknown-stage-item:'+id);if(seen.has(id))errors.push('duplicate-owner:'+id);seen.add(id);}
  if(list(s.itemIds).some(id=>!bank.includes(id))||allowed(s).some(id=>!list(s.itemIds).includes(id)))errors.push('unknown-stage-bank');
  if(allowed(s).some(id=>supplied(q).includes(id)||list(s.reused).includes(id)))errors.push('provided-or-reused-selectable');
  for(const g of list(s.alternatives))if(!g||!list(g.items).length||!Number.isInteger(g.min)||!Number.isInteger(g.max)||g.min<1||g.max<g.min||g.max>g.items.length)errors.push('invalid-alternative');
 });
 const whole=unique(list(q.required).concat(list(q.optional),list(q.alternatives).flatMap(g=>list(g.items))));
 if(whole.some(id=>!seen.has(id))||[...seen].some(id=>!whole.includes(id)))errors.push('stage-partition');
 return {success:errors.length===0,errors};
}
function current(q,flow){return supports(q)&&flow&&Number.isInteger(flow.index)?stages(q)[flow.index]||null:null;}
function stateFor(q,flow,id){const s=id?stages(q).find(s=>s.id===id):current(q,flow);return s&&object(flow&&flow.steps)&&own(flow.steps,s.id)?flow.steps[s.id]:{selected:[],checked:false};}
function selection(q,flow){return stateFor(q,flow).selected.slice();}
function selectedUnion(q,flow){return unique(stages(q).flatMap(s=>list(stateFor(q,flow,s.id).selected)));}
function chosen(q,flow){const set=new Set(selectedUnion(q,flow));return unique(list(flow&&flow.order).filter(id=>set.has(id)).concat([...set]));}
function wholeAnswer(q,answer){
 const issues=[],all=unique(list(q.required).concat(list(q.optional),list(q.alternatives).flatMap(g=>list(g.items))));
 for(const id of list(q.required))if(!answer.includes(id))issues.push({code:'missing',item:id});
 for(const id of answer)if(!all.includes(id))issues.push({code:'extra',item:id});
 for(const g of list(q.alternatives)){const n=list(g.items).filter(id=>answer.includes(id)).length;if(n<g.min)issues.push({code:'alternative-missing',item:g.items[0]});if(n>g.max)issues.push({code:'alternative-extra',item:g.items[g.max]});}
 return issues;
}
function stageIssues(q,flow,index,prerequisites){
 const ss=stages(q),s=ss[index];if(!s)return [{code:'choose-stage',stageId:''}];
 const issues=[],selected=stateFor(q,flow,s.id).selected,eligible=allowed(s),owners=ownership(q);
 if(prerequisites)for(let i=0;i<index;i++){if(!stateFor(q,flow,ss[i].id).checked||stageIssues(q,flow,i,false).length){issues.push({code:'previous-unconfirmed',stageId:s.id,belongsTo:ss[i].id,targetTitle:ss[i].title});break;}}
 for(const id of list(s.required))if(!selected.includes(id))issues.push({code:'missing',item:id,stageId:s.id});
 for(const id of selected)if(!eligible.includes(id)){
  const at=owners[id];
  if(Number.isInteger(at)&&at>index)issues.push({code:'needed-later',item:id,stageId:s.id,belongsTo:ss[at].id,targetTitle:ss[at].title});
  else if(Number.isInteger(at)&&at<index)issues.push({code:'earlier-stage',item:id,stageId:s.id,belongsTo:ss[at].id,targetTitle:ss[at].title});
  else issues.push({code:'extra',item:id,stageId:s.id});
 }
 for(const g of list(s.alternatives)){const count=list(g.items).filter(id=>selected.includes(id)).length;if(count<g.min)issues.push({code:'alternative-missing',item:g.items[0],stageId:s.id});if(count>g.max)issues.push({code:'alternative-extra',item:g.items[g.max],stageId:s.id});}
 for(const id of list(s.reused)){
  if(supplied(q).includes(id))continue;
  const at=owners[id],prior=Number.isInteger(at)&&at<index?stateFor(q,flow,ss[at].id):null;
  if(!prior||!prior.checked||!prior.selected.includes(id))issues.push({code:'reuse-not-ready',item:id,stageId:s.id,belongsTo:Number.isInteger(at)?ss[at].id:undefined,targetTitle:Number.isInteger(at)?ss[at].title:undefined});
 }
 return issues;
}
function ready(q,flow){return supports(q)&&!!flow&&stages(q).every((s,i)=>stateFor(q,flow,s.id).checked&&stageIssues(q,flow,i,false).length===0);}
function firstUnconfirmed(q,flow){for(let i=0;i<stages(q).length;i++)if(!stateFor(q,flow,stages(q)[i].id).checked||stageIssues(q,flow,i,false).length)return i;return stages(q).length;}
function create(q,options){
 options=options||{};if(!validatePlan(q).success)return null;
 const flow={version:VERSION,questId:q.id,index:0,steps:{},order:[]},owners=ownership(q),ss=stages(q);
 const answer=unique(list(options.chosen).filter(id=>list(q.itemIds).includes(id)));
 for(const id of answer){const s=ss[own(owners,id)?owners[id]:0];if(!flow.steps[s.id])flow.steps[s.id]={selected:[],checked:false};flow.steps[s.id].selected.push(id);flow.order.push(id);}
 if(options.solved===true&&wholeAnswer(q,answer).length===0){for(const s of ss){if(!flow.steps[s.id])flow.steps[s.id]={selected:[],checked:false};flow.steps[s.id].checked=true;}if(ready(q,flow))flow.index=ss.length;else for(const step of Object.values(flow.steps))step.checked=false;}
 return flow;
}
function snapshot(flow){
 if(!object(flow)||flow.version!==VERSION)return null;
 const packed={v:VERSION,q:flow.questId,i:flow.index,s:{}};
 for(const [id,s]of Object.entries(flow.steps||{}))if(list(s.selected).length||s.checked)packed.s[id]=s.checked?[list(s.selected).slice(),1]:[list(s.selected).slice()];
 const implicit=unique(Object.values(flow.steps||{}).flatMap(s=>list(s.selected)));
 if(list(flow.order).length&&JSON.stringify(flow.order)!==JSON.stringify(implicit))packed.o=flow.order.slice();return packed;
}
function restore(raw,q,options){
 options=options||{};if(raw===null||raw===undefined)return create(q,options);if(!validatePlan(q).success||!object(raw))return null;
 const packed=own(raw,'v');if((packed?raw.v:raw.version)!==VERSION||(packed?raw.q:raw.questId)!==q.id)return null;
 const source=packed?raw.s:raw.steps,index=packed?raw.i:raw.index;if(!object(source)||!Number.isInteger(index)||index<0||index>stages(q).length)return null;
 const flow={version:VERSION,questId:q.id,index,steps:{},order:[]},known=stages(q).map(s=>s.id),used=new Set();
 for(const [id,value]of Object.entries(source)){
  if(!known.includes(id))return null;
  const selected=packed?Array.isArray(value)&&value[0]:object(value)&&value.selected,checked=packed?Array.isArray(value)&&value[1]===1:object(value)&&value.checked===true;
  if(!Array.isArray(selected)||selected.length>list(q.itemIds).length||new Set(selected).size!==selected.length||selected.some(id=>!list(q.itemIds).includes(id)||used.has(id)))return null;
  if(packed&&(!Array.isArray(value)||value.length<1||value.length>2||value.length===2&&value[1]!==1))return null;
  selected.forEach(id=>used.add(id));if(selected.length||checked)flow.steps[id]={selected:selected.slice(),checked};
 }
 const order=packed?raw.o:raw.order;if(order!==undefined&&!Array.isArray(order))return null;
 const defaultOrder=packed?[...used]:list(options.chosen).concat([...used]);
 flow.order=unique((order===undefined?defaultOrder:list(order).concat([...used])).filter(id=>used.has(id)));
 let unconfirmed=false;stages(q).forEach((s,i)=>{const entry=flow.steps[s.id];if(!entry||!entry.checked||unconfirmed||stageIssues(q,flow,i,false).length){if(entry)entry.checked=false;unconfirmed=true;}});
 flow.index=Math.min(flow.index,firstUnconfirmed(q,flow));return flow;
}
function invalidate(q,flow,index){
 if(!supports(q)||!flow)return false;index=Number.isInteger(index)?index:flow.index;
 if(index<0||index>=stages(q).length)return false;
 for(const s of stages(q).slice(index))if(flow.steps[s.id])flow.steps[s.id].checked=false;return true;
}
function visibleItems(q,flow){
 const s=current(q,flow);if(!s)return [];
 const others=new Set(stages(q).filter(t=>t.id!==s.id).flatMap(t=>stateFor(q,flow,t.id).selected));
 return unique(list(s.itemIds).concat(selection(q,flow))).filter(id=>list(q.itemIds).includes(id)&&!others.has(id));
}
function setSelected(q,flow,id,value){
 const s=current(q,flow);if(!s||!list(q.itemIds).includes(id))return false;
 const existing=stateFor(q,flow),has=existing.selected.includes(id);if(has===value)return false;
 if(value&&!visibleItems(q,flow).includes(id))return false;
 if(!flow.steps[s.id])flow.steps[s.id]={selected:[],checked:false};
 flow.steps[s.id].selected=value?existing.selected.concat(id):existing.selected.filter(x=>x!==id);
 if(value&&!flow.order.includes(id))flow.order.push(id);else if(!value)flow.order=flow.order.filter(x=>x!==id);
 invalidate(q,flow,flow.index);return true;
}
function toggle(q,flow,id){return setSelected(q,flow,id,!selection(q,flow).includes(id));}
function drop(q,flow,id,to){if(to!=='bag'&&to!=='bank')return false;return setSelected(q,flow,id,to==='bag');}
function check(q,flow){
 const s=current(q,flow);if(!s)return {correct:false,issues:[{code:'review',stageId:''}],changed:false};
 const issues=stageIssues(q,flow,flow.index,true),before=stateFor(q,flow).checked;
 if(!flow.steps[s.id])flow.steps[s.id]={selected:[],checked:false};
 if(issues.length)invalidate(q,flow,flow.index);else flow.steps[s.id].checked=true;
 return {correct:issues.length===0,issues,changed:before!==flow.steps[s.id].checked};
}
function next(q,flow){const s=current(q,flow);if(!s||!stateFor(q,flow).checked||stageIssues(q,flow,flow.index,true).length)return false;flow.index++;return true;}
function goto(q,flow,index){if(!supports(q)||!flow||!Number.isInteger(index)||index<0||index>firstUnconfirmed(q,flow)||index===flow.index)return false;flow.index=index;return true;}
function back(q,flow){return !!flow&&goto(q,flow,flow.index-1);}
function completed(q,flow){return !!flow&&flow.index===stages(q).length&&ready(q,flow)&&wholeAnswer(q,chosen(q,flow)).length===0;}
function evaluate(q,flow){
 if(!supports(q)||!flow)return {correct:false,issues:[{code:'missing-flow',stageId:''}]};
 const issues=[];stages(q).forEach((s,i)=>{if(!stateFor(q,flow,s.id).checked)issues.push({code:'stage-unconfirmed',stageId:s.id,targetTitle:s.title});else issues.push(...stageIssues(q,flow,i,false));});
 issues.push(...wholeAnswer(q,chosen(q,flow)));if(flow.index!==stages(q).length)issues.push({code:'review-not-reached',stageId:current(q,flow)?.id||''});return {correct:issues.length===0,issues};
}
root.SchoolPackingFlow={VERSION,supports,validatePlan,create,restore,snapshot,current,stateFor,selection,chosen,visibleItems,toggle,drop,check,next,back,goto,invalidate,completed,evaluate,ready};
})(typeof window==='undefined'?globalThis:window);
