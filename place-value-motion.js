(function(root){
'use strict';
var active=null;
function cells(piece,value){
 var r=piece.getBoundingClientRect(),dots=piece.querySelectorAll('.stud'),out=[];
 if(dots.length===value){for(var i=0;i<dots.length;i++){var d=dots[i].getBoundingClientRect();out.push({x:d.left,y:d.top,w:d.width,h:d.height,round:true});}return out;}
 var cols=value===100?10:1,rows=value/cols;
 for(var y=0;y<rows;y++)for(var x=0;x<cols;x++)out.push({x:r.left+x*r.width/cols,y:r.top+y*r.height/rows,w:r.width/cols,h:r.height/rows,round:false});
 return out;
}
function capture(container,K){
 if(!container||!container.querySelectorAll)return null;
 var result={};
 Object.keys(K.values).forEach(function(type){result[type]=Array.prototype.map.call(container.querySelectorAll('.piece.'+type),function(piece){return cells(piece,K.values[type]);});});
 return result;
}
function cancel(){if(active)active.finish(true);}
function animate(container,snapshot,before,after,K,options){
 cancel();options=options||{};
 if(!container||!snapshot||!container.ownerDocument)return Promise.resolve(false);
 var doc=container.ownerDocument,win=doc.defaultView||root;
 if(options.reducedMotion||(win.matchMedia&&win.matchMedia('(prefers-reduced-motion: reduce)').matches))return Promise.resolve(false);
 var from=[],to=[],targets=[];
 Object.keys(K.values).forEach(function(type){
  var consumed=Math.max(0,(before[type]||0)-(after[type]||0)),created=Math.max(0,(after[type]||0)-(before[type]||0));
  (snapshot[type]||[]).slice(0,consumed).forEach(function(part){from=from.concat(part);});
  var pieces=container.querySelectorAll('.piece.'+type);
  for(var i=before[type]||0;i<(before[type]||0)+created;i++)if(pieces[i]){targets.push({node:pieces[i],visibility:pieces[i].style.visibility});to=to.concat(cells(pieces[i],K.values[type]));}
 });
 if(!from.length||from.length!==to.length||from.length>100||from.concat(to).some(function(r){return !(r.w>0&&r.h>0);})||!doc.body)return Promise.resolve(false);
 var overlay=doc.createElement('div');overlay.className='pv-exchange-overlay';overlay.setAttribute('aria-hidden','true');
 overlay.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:80;overflow:visible';
 var animations=[],resolve,done=false,timer;
 var promise=new Promise(function(r){resolve=r;});
 function finish(wasCancelled){
  if(done)return;done=true;if(timer)win.clearTimeout(timer);
  animations.forEach(function(a){try{a.cancel();}catch(_){}});
  targets.forEach(function(t){t.node.style.visibility=t.visibility;});
  container.classList.remove('pv-exchanging');
  if(overlay.parentNode)overlay.parentNode.removeChild(overlay);
  if(active&&active.promise===promise)active=null;resolve(!wasCancelled);
 }
 active={promise:promise,finish:finish};
 targets.forEach(function(t){t.node.style.visibility='hidden';});
 container.classList.add('pv-exchanging');
 doc.body.appendChild(overlay);
 try{
  for(var i=0;i<from.length;i++){
   var a=from[i],b=to[i],ghost=doc.createElement('i');ghost.className='pv-exchange-unit';
   ghost.style.cssText='position:absolute;box-sizing:border-box;left:'+a.x+'px;top:'+a.y+'px;width:'+a.w+'px;height:'+a.h+'px;background:#88c6e6;border:1px solid #579bc0;border-radius:'+(a.round?'50%':'2px')+';transform-origin:0 0;box-shadow:inset 0 1px 0 #d7effb';
   overlay.appendChild(ghost);
   if(typeof ghost.animate!=='function'){finish(false);return promise;}
   var animation=ghost.animate([{transform:'translate(0,0) scale(1,1)'},{transform:'translate('+(b.x-a.x)+'px,'+(b.y-a.y)+'px) scale('+(b.w/a.w)+','+(b.h/a.h)+')'}],{duration:380,easing:'ease-in-out',fill:'forwards'});
   animations.push(animation);
  }
  timer=win.setTimeout(function(){finish(false);},430);
  Promise.all(animations.map(function(a){return a.finished&&typeof a.finished.then==='function'?a.finished.catch(function(){}):new Promise(function(r){win.setTimeout(r,390);});})).then(function(){finish(false);});
 }catch(_){finish(true);}
 return promise;
}
root.PlaceValueMotion={capture:capture,animate:animate,cancel:cancel,isBusy:function(){return !!active;},idle:function(){return active?active.promise:Promise.resolve();}};
})(typeof window==='undefined'?globalThis:window);
