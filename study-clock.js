(function(root){
'use strict';
const MINIMUM=15*60,KEYS=['kubiki-progress-v1','detalki-progress-v1','slovograd-v1'];
function clean(raw){
 raw=raw&&typeof raw==='object'&&raw.version===1?raw:{};const seen={};
 for(const key of KEYS)if(Array.isArray(raw.seen?.[key]))seen[key]=raw.seen[key].filter(x=>typeof x==='string'&&x.length<=160).slice(-240);
 return {version:1,seconds:Number.isFinite(raw.seconds)?Math.max(0,Math.min(7200,raw.seconds)):0,minimumSeconds:MINIMUM,minuteLimit:15,enabled:raw.enabled!==false,tasks:Number.isInteger(raw.tasks)?Math.max(0,Math.min(1000,raw.tasks)):0,seen,lastPause:Number.isFinite(raw.lastPause)?raw.lastPause:0};
}
function advance(raw,seconds,activity){
 const result=clean(raw),a=activity||{};
 if(a.visible===true&&a.focused===true&&a.studying===true&&Number.isFinite(seconds)&&seconds>0&&seconds<=2)result.seconds=Math.min(7200,result.seconds+seconds);
 return result;
}
function due(raw){const r=clean(raw);return r.enabled&&r.seconds>=MINIMUM;}
function reset(raw,at){const r=clean(raw);r.seconds=0;r.tasks=0;r.lastPause=Number.isFinite(at)?at:Date.now();return r;}
root.StudyClock={MINIMUM,clean,advance,due,reset};
})(typeof window==='undefined'?globalThis:window);
