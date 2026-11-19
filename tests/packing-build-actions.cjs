'use strict';
// Drive the same Life actions as the child. Authored stage answers are used
// only as test inputs; stage order and global success are asserted separately.
const assert=require('node:assert/strict');
function driver(L,F,act){
 function selection(s,q){return F.selection(q,s.packingFlow);}
 function fillStage(s,q,optional=false){
  const stage=F.current(q,s.packingFlow);if(!stage)return false;
  const wanted=(stage.required||[]).concat(optional?stage.optional||[]:[]);
  for(const g of stage.alternatives||[])for(const id of g.items.slice(0,g.min))wanted.push(id);
  for(const id of [...new Set(wanted)])if(!selection(s,q).includes(id))assert.notEqual(act(s,'toggle',{item:id}),false,'Current-stage item is interactive: '+q.id+'/'+stage.id+'/'+id);
  act(s,'packing-check');assert.notEqual(s.feedback?.type,'error','Authored stage can be checked: '+q.id+'/'+stage.id+' '+JSON.stringify(s.issues));
  assert.equal(F.stateFor(q,s.packingFlow,stage.id).checked,true,'Life handler confirms only this stage');
  return true;
 }
 function fillSchool(s,q,optional=false){
  let turns=0;
  while(F.current(q,s.packingFlow)){
   assert.ok(turns++<=q.packingStages.length,'Stage route cannot loop');
   const before=s.packingFlow.index;fillStage(s,q,optional);act(s,'packing-next');assert.ok(s.packingFlow.index>before,'A checked stage advances');assert.equal(s.solved,false,'A stage does not award the whole quest');
  }
  assert.equal(s.packingFlow.index,q.packingStages.length,'Only the final review follows all lessons');
  assert.equal(F.completed(q,s.packingFlow),true);
 }
 function owningIndex(q,id){return q.packingStages.findIndex(stage=>(stage.allowed||[]).includes(id));}
 function visibleIndex(q,id){return q.packingStages.findIndex(stage=>(stage.itemIds||[]).includes(id));}
 return {selection,fillStage,fillSchool,owningIndex,visibleIndex};
}
module.exports={driver};
