(function(root){
'use strict';
// Presentation only: task boundaries come from the existing subject engines.
// No learner record, answer, or curriculum state is owned by this helper.
if(!root.document)return;
const doc=root.document,lastKeys=new Map(),disclosures=new Map(),scrollPositions=new Map();
let queued=false;
function keyboardInset(){
 const viewport=root.visualViewport;
 const editing=doc.activeElement?.matches('input:not([type=checkbox]):not([type=radio]),textarea');
 const inset=viewport&&editing&&Math.abs(viewport.scale-1)<.05?Math.max(0,root.innerHeight-viewport.height-viewport.offsetTop):0;
 doc.documentElement.style.setProperty('--workspace-keyboard-inset',Math.round(inset)+'px');
}
function channel(workspace){return workspace.closest('#practice-root')?'practice':'trainer';}
function activeWorkspace(){
 const overlay=doc.querySelector('#practice-root:not([hidden])');
 const scope=overlay||doc.querySelector('#app')||doc.body;
 const candidates=Array.from(scope.querySelectorAll('.trainer-workspace[data-workspace-key]'));
 return candidates.find(el=>el.getClientRects().length&&!el.closest('[hidden],[inert]'))||null;
}
function workspaceFor(el){
 const own=el.closest('.trainer-workspace[data-workspace-key]');if(own)return own;
 const scope=el.closest('#practice-root,#app');return scope?.querySelector('.trainer-workspace[data-workspace-key]')||null;
}
function presentationKey(el,name){const w=workspaceFor(el);return w?channel(w)+':'+w.dataset.workspaceKey+':'+name:null;}
function remember(map,key,value){if(!key)return;map.delete(key);map.set(key,value);if(map.size>512)map.delete(map.keys().next().value);}
function markOverflow(panel){
 const vertical=panel.scrollHeight>panel.clientHeight+3,horizontal=panel.scrollWidth>panel.clientWidth+3;
 const directions=(vertical?'y':'')+(horizontal?'x':'');
 if(directions)panel.setAttribute('data-workspace-overflow',directions);else panel.removeAttribute('data-workspace-overflow');
 // A panel's trailing padding can overflow without hiding another object.
 // "More things below" refers to actual child content, not that empty tail.
 const bounds=panel.getBoundingClientRect(),children=Array.from(panel.children).filter(el=>el.getClientRects().length);
 const contentBottom=children.length?Math.max(...children.map(el=>el.getBoundingClientRect().bottom)):bounds.bottom;
 const contentRight=children.length?Math.max(...children.map(el=>el.getBoundingClientRect().right)):bounds.right;
 panel.toggleAttribute('data-workspace-more-below',vertical&&contentBottom>bounds.top+panel.clientTop+panel.clientHeight+3);
 panel.toggleAttribute('data-workspace-more-right',horizontal&&contentRight>bounds.left+panel.clientLeft+panel.clientWidth+3);
}
function synchronize(){
 queued=false;keyboardInset();const workspace=activeWorkspace();if(!workspace){if(!doc.querySelector('#practice-root:not([hidden])'))lastKeys.delete('trainer');return;}
 const scope=workspace.closest('#practice-root,#app')||workspace;
 for(const details of scope.querySelectorAll('details[data-workspace-disclosure]')){
  const key=presentationKey(details,details.dataset.workspaceDisclosure);if(disclosures.has(key)&&details.open!==disclosures.get(key))details.open=disclosures.get(key);
 }
 const workspaceTop=workspace.getBoundingClientRect().top;
 const actionHeight=workspace.querySelector('.workspace-actions')?.getBoundingClientRect().height||0;
 for(const panel of workspace.querySelectorAll('[data-workspace-scroll]')){
  if(panel.hasAttribute('data-workspace-fit')){
   const top=panel.getBoundingClientRect().top-workspaceTop+12;
   const available=Math.max(160,root.innerHeight-top-actionHeight-24);
   panel.style.setProperty('--workspace-panel-height',Math.floor(available)+'px');
  }
  const saved=scrollPositions.get(presentationKey(panel,'scroll:'+panel.dataset.workspaceScroll));
  if(saved){panel.scrollTop=saved.top;panel.scrollLeft=saved.left;}
  markOverflow(panel);
 }
 const owner=channel(workspace),key=workspace.dataset.workspaceKey;
 if(lastKeys.get(owner)===key)return;lastKeys.set(owner,key);
 // Rerendering a choice keeps the same key, so selecting/dragging never
 // scrolls the page back up or moves the keyboard focus away from an input.
 const heading=workspace.querySelector('[data-workspace-focus],h2,h3')||workspace;
 if(!heading.matches('button,a,input,select,textarea,[tabindex]'))heading.tabIndex=-1;
 const keyboardInput=doc.activeElement?.matches('input,textarea,select');
 if(!keyboardInput)heading.focus({preventScroll:true});
 const container=workspace.closest('#practice-root:not(.ph-standalone)');
 const top=workspace.getBoundingClientRect().top;
 if(container){
  const offset=(container.querySelector('.ph-header')?.getBoundingClientRect().height||0)+12;
  container.scrollTop+=top-container.getBoundingClientRect().top-offset;
 }else{
  root.scrollTo({top:Math.max(0,root.scrollY+top-12),behavior:'auto'});
 }
 doc.dispatchEvent(new CustomEvent('workspace:ready',{detail:{key,channel:owner}}));
}
function queue(){if(!queued){queued=true;root.requestAnimationFrame(synchronize);}}
function start(){
 new MutationObserver(queue).observe(doc.body,{childList:true,subtree:true});
 doc.addEventListener('toggle',event=>{
  const el=event.target;if(!el.matches?.('details[data-workspace-disclosure]'))return;
  const key=presentationKey(el,el.dataset.workspaceDisclosure);remember(disclosures,key,el.open);
 },true);
 doc.addEventListener('scroll',event=>{
  const el=event.target;if(!el.matches?.('[data-workspace-scroll]'))return;
  remember(scrollPositions,presentationKey(el,'scroll:'+el.dataset.workspaceScroll),{top:el.scrollTop,left:el.scrollLeft});
  markOverflow(el);
 },true);
 doc.addEventListener('practice:closed',queue);
 root.addEventListener('resize',queue,{passive:true});
 root.visualViewport?.addEventListener('resize',queue,{passive:true});
 root.visualViewport?.addEventListener('scroll',queue,{passive:true});
 doc.addEventListener('focusin',queue);
 doc.addEventListener('focusout',queue);
 queue();
}
root.WorkspaceLayout={refresh:queue};
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(typeof window==='undefined'?globalThis:window);
