(function(global){
'use strict';
// Pointer and native-button input only. The renderer owns hit areas, animation,
// visibility, and the meaning of item IDs and destination IDs.
function attach(options){
 const root=options.root,scene=options.scene;
 if(!root||!scene)throw new TypeError('RoomInput needs a root and a scene.');
 const noop=()=>{},onSelect=options.onSelect||noop,onMove=options.onMove||noop,onDrop=options.onDrop||noop,onTarget=options.onTarget||noop,onCancel=options.onCancel||noop;
 let drag=null,touch=null,suppressUntil=0,destroyed=false;
 const clock=()=>global.performance?.now?.()??Date.now();
 const item=button=>button.hasAttribute('data-ri-item')?(button.dataset.riItem||button.dataset.riId||''):null;
 const target=button=>button.hasAttribute('data-ri-target')?(button.dataset.riTarget||button.dataset.riZone||''):null;
 function buttonFor(event){
  const button=event.target?.closest?.('button');
  return button&&root.contains(button)&&!button.disabled?button:null;
 }
 function point(event,button){
  const box=scene.getBoundingClientRect();
  const bounds=button?.getBoundingClientRect();
  const x=bounds?bounds.left+bounds.width/2:event.clientX,y=bounds?bounds.top+bounds.height/2:event.clientY;
  return {x:(x-box.left)/(box.width||1)*720,y:(y-box.top)/(box.height||1)*720};
 }
 function release(id){try{scene.releasePointerCapture(id);}catch(_){}}
 function cancel(){
  touch=null;if(!drag)return;
  const current=drag;drag=null;release(current.pointerId);onCancel(current.id);
 }
 function down(event){
  // A real next gesture must work immediately, even on a different control.
  suppressUntil=0;
  if(event.isPrimary===false||(event.button!==undefined&&event.button!==0))return;
  const button=buttonFor(event);touch=null;
  if(!button||drag)return;
  const id=item(button);
  if(id!==null){
   event.preventDefault();
   try{button.focus({preventScroll:true});}catch(_){}
   drag={id,button,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,moved:false};
   try{scene.setPointerCapture(event.pointerId);}catch(_){}
   onSelect(id,point(event),event);
  }else if(event.pointerType==='touch'&&!button.hasAttribute('data-ri-native')){
   // Navigation can remove this root before a delayed compatibility click.
   touch={button,pointerId:event.pointerId,x:event.clientX,y:event.clientY};
  }
 }
 function move(event){
  if(touch&&touch.pointerId===event.pointerId&&Math.hypot(event.clientX-touch.x,event.clientY-touch.y)>5)touch=null;
  if(!drag||drag.pointerId!==event.pointerId)return;
  event.preventDefault();
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5)drag.moved=true;
  if(drag.moved)onMove(drag.id,point(event),event);
 }
 function up(event){
  if(drag&&drag.pointerId===event.pointerId){
   event.preventDefault();
   const current=drag;drag=null;suppressUntil=clock()+700;release(event.pointerId);
   if(Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>5)current.moved=true;
   if(current.moved)onDrop(current.id,point(event),event);
   return;
  }
  const tap=touch;if(!tap||tap.pointerId!==event.pointerId)return;touch=null;
  if(event.pointerType!=='touch'||event.isPrimary===false||buttonFor(event)!==tap.button||Math.hypot(event.clientX-tap.x,event.clientY-tap.y)>5)return;
  // Captured touch gestures can suppress future browser compatibility clicks.
  // Native .click() also reaches ordinary controls owned by the renderer.
  event.preventDefault();suppressUntil=clock()+700;tap.button.click();
 }
 function pointerCancel(event){
  if(touch?.pointerId===event.pointerId)touch=null;
  if(drag?.pointerId===event.pointerId)cancel();
 }
 function guardClick(event){
  // Suppress the whole root: a callback can reveal another button under the
  // finger, and a delayed compatibility click must not activate that button.
  if(event.detail>0&&clock()<suppressUntil){event.preventDefault();event.stopImmediatePropagation();}
 }
 function click(event){
  const button=buttonFor(event);if(!button)return;
  const zone=target(button);if(zone!==null){onTarget(zone,event);return;}
  const id=item(button);if(id!==null)onSelect(id,point(event,event.detail===0?button:null),event);
 }
 const stopDrag=event=>{if(buttonFor(event)&&item(buttonFor(event))!==null)event.preventDefault();};
 root.addEventListener('pointerdown',down);
 root.addEventListener('pointermove',move,{passive:false});
 root.addEventListener('pointerup',up,{passive:false});
 root.addEventListener('pointercancel',pointerCancel);
 scene.addEventListener('lostpointercapture',pointerCancel);
 root.addEventListener('click',guardClick,true);
 root.addEventListener('click',click);
 root.addEventListener('dragstart',stopDrag);
 return Object.freeze({cancel,destroy(){
  if(destroyed)return;destroyed=true;cancel();
  root.removeEventListener('pointerdown',down);root.removeEventListener('pointermove',move);root.removeEventListener('pointerup',up);root.removeEventListener('pointercancel',pointerCancel);
  scene.removeEventListener('lostpointercapture',pointerCancel);root.removeEventListener('click',guardClick,true);root.removeEventListener('click',click);root.removeEventListener('dragstart',stopDrag);
 }});
}
global.RoomInput=Object.freeze({attach});
})(typeof window==='undefined'?globalThis:window);
