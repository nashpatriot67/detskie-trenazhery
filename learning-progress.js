(function(root){
'use strict';
// Optional observations inside each existing subject's progress object.
// No storage, network, migration, or claims of mastery belong in this module.
var VERSION=1,MAX_HISTORY=240,MAX_ACTIVITY_BYTES=48*1024,MAX_MODULES=8,counter=0;
var own=function(o,k){return Object.prototype.hasOwnProperty.call(o,k);};
var object=function(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);};
var identifier=function(v){return typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,159}$/.test(v)?v:'';};
function generation(v){return typeof v==='string'&&v.length>0&&v.length<=160?v:'initial';}
function integer(v,fallback){return Number.isSafeInteger(v)&&v>=0?v:fallback;}
function stamp(v,fallback){if(typeof v==='string')v=Date.parse(v);return Number.isFinite(v)&&v>=0?v:fallback;}
function now(){return Date.now();}
function id(prefix){
 var unique='';try{if(root.crypto&&typeof root.crypto.randomUUID==='function')unique=root.crypto.randomUUID();}catch(_){}
 return prefix+'-'+(unique||now().toString(36)+'-'+(++counter).toString(36)+'-'+Math.random().toString(36).slice(2,11));
}
function clone(v,maxBytes){
 try{
  var seen=[];
  function visit(x,depth){
   if(depth>40)throw Error('depth');
   if(x===null||typeof x==='boolean'||typeof x==='string')return x;
   if(typeof x==='number')return Number.isFinite(x)?x:null;
   if(typeof x!=='object')return undefined;
   if(seen.indexOf(x)!==-1)throw Error('cycle');seen.push(x);
   var out=Array.isArray(x)?[]:{};
   Object.keys(x).forEach(function(k){if(k==='__proto__'||k==='constructor'||k==='prototype')return;var value=visit(x[k],depth+1);if(value!==undefined)out[k]=value;});
   seen.pop();return out;
  }
  var result=visit(v,0),json=JSON.stringify(result);
  var bytes=0;if(json)for(var i=0;i<json.length;i++){var code=json.charCodeAt(i);if(code<128)bytes++;else if(code<2048)bytes+=2;else if(code>=55296&&code<=56319&&i+1<json.length){bytes+=4;i++;}else bytes+=3;}
  return json&&bytes<=(maxBytes||512*1024)?result:null;
 }catch(_){return null;}
}
function stable(v){
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
 return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+stable(v[k]);}).join(',')+'}';
}
function supported(value){return !object(value)||!own(value,'version')||value.version===VERSION;}
function empty(epoch){return {version:VERSION,generation:generation(epoch),observations:[],activity:null};}
function skills(value){
 var list=Array.isArray(value)?value:typeof value==='string'?[value]:[];
 return list.filter(function(x,i){return identifier(x)&&list.indexOf(x)===i;}).slice(0,8);
}
function assistance(value){
 value=object(value)?value:{};
 return {explanation:value.explanation===true,visual:value.visual===true,afterError:value.afterError===true||value.error===true,workedExample:value.workedExample===true,generic:value.generic===true||value.contentHints>0};
}
function outcome(value){return value==='correct'||value==='independent'||value==='assisted'?'correct':value==='incorrect'||value==='error'?'incorrect':value==='skipped'||value==='skip'?'skipped':'notchecked';}
function classify(event){
 if(!event)return 'notchecked';var final=outcome(event.finalOutcome);
 if(final==='notchecked')return 'notchecked';
 if(final!=='correct')return final;
 var a=event.assistance||{};
 return a.explanation||a.visual||a.workedExample||a.generic?'assisted':'independent';
}
function cleanObservation(value,epoch){
 if(!object(value)||!identifier(value.taskId))return null;
 var skillIds=skills(value.skillIds||value.skillId),eventId=identifier(value.eventId||value.attemptId);
 if(!skillIds.length||!eventId||generation(value.generation) !==epoch)return null;
 var final=outcome(value.finalOutcome||value.outcome||value.status),a=assistance(value.assistance);
 if(value.status==='assisted'&&!a.explanation&&!a.visual&&!a.workedExample)a.generic=true;
 if(final==='incorrect')a.afterError=true;
 var first=outcome(value.firstOutcome);
 if(first==='notchecked'&&a.afterError)first='incorrect';
 if(first==='notchecked'&&final!=='notchecked')first=final;
 if(first==='incorrect')a.afterError=true;
 var result={eventId:eventId,attemptId:identifier(value.attemptId)||eventId,generation:epoch,taskId:value.taskId,skillIds:skillIds,firstOutcome:first,finalOutcome:final,assistance:a,errors:Math.max(a.afterError?1:0,Math.min(1000,integer(value.errors,a.afterError?1:0))),observedAt:stamp(value.observedAt,0),revision:integer(value.revision,0)};
 ['subject','mode','variantId','familyId','evidenceKind'].forEach(function(key){if(identifier(value[key]))result[key]=value[key];});
 ['materialRevision','criteriaRevision'].forEach(function(key){if(Number.isSafeInteger(value[key])&&value[key]>0)result[key]=value[key];});
 if(typeof value.response==='number'&&Number.isFinite(value.response)&&Math.abs(value.response)<=1000)result.response=value.response;
 if(typeof value.response==='boolean')result.response=value.response;
 result.status=classify(result);return result;
}
function compare(a,b){return a.revision-b.revision||a.observedAt-b.observedAt||(stable(a)<stable(b)?-1:stable(a)>stable(b)?1:0);}
function combine(a,b){
 var winner=compare(a,b)>=0?a:b;
 if(a.taskId!==b.taskId||a.generation!==b.generation)return winner;
 var result=clone(winner);result.skillIds=skills(a.skillIds.concat(b.skillIds).sort());
 Object.keys(result.assistance).forEach(function(k){result.assistance[k]=a.assistance[k]||b.assistance[k];});
 if(a.firstOutcome==='incorrect'||b.firstOutcome==='incorrect')result.firstOutcome='incorrect';
 result.errors=Math.max(a.errors,b.errors);result.status=classify(result);return result;
}
function ordered(events){return events.sort(function(a,b){return a.observedAt-b.observedAt||(a.eventId<b.eventId?-1:a.eventId>b.eventId?1:0);});}
function compact(events){
 var map=Object.create(null);events.forEach(function(event){map[event.eventId]=map[event.eventId]?combine(map[event.eventId],event):event;});
 var list=ordered(Object.keys(map).map(function(k){return map[k];}));
 if(list.length<=MAX_HISTORY)return {observations:list,limited:false};
 var selected=Object.create(null),covered=Object.create(null),keep=[];
 list.slice().reverse().forEach(function(event){if(keep.length<MAX_HISTORY&&event.skillIds.some(function(skill){return !covered[skill];})){keep.push(event);selected[event.eventId]=true;event.skillIds.forEach(function(skill){covered[skill]=true;});}});
 list.slice().reverse().forEach(function(event){if(keep.length<MAX_HISTORY&&!selected[event.eventId]){keep.push(event);selected[event.eventId]=true;}});
 return {observations:ordered(keep),limited:true};
}
function cleanActivity(value){
 if(!object(value)||(!object(value.state)&&value.state!==null))return null;
 var state=value.state===null?null:clone(value.state,MAX_ACTIVITY_BYTES);if(state===null&&value.state!==null)return null;
 return {revision:integer(value.revision,0),updatedAt:stamp(value.updatedAt,0),ownerId:identifier(value.ownerId)||'local',state:state};
}
// Named activities share their owner's existing learning record. The original
// place-value activity stays separate, so opening a concept or life quest never
// replaces its board. App code still owns storage and concurrent-writer guards.
function moduleIdentifier(value){return identifier(value)&&value!=='__proto__'&&value!=='constructor'&&value!=='prototype'?value:'';}
function cleanModules(value){
 var result={};if(!object(value))return result;
 // Supported clients write at most eight entries. Bound malformed input before
 // cloning the state payloads, then keep the latest entries deterministically.
 var entries=Object.keys(value).filter(moduleIdentifier).sort().slice(0,64).map(function(key){return {key:key,value:cleanActivity(value[key])};}).filter(function(entry){return entry.value;});
 entries.sort(function(a,b){return b.value.updatedAt-a.value.updatedAt||b.value.revision-a.value.revision||(a.key<b.key?-1:a.key>b.key?1:0);});
 entries.slice(0,MAX_MODULES).sort(function(a,b){return a.key<b.key?-1:a.key>b.key?1:0;}).forEach(function(entry){result[entry.key]=entry.value;});
 return result;
}
function learningMetadata(value){
 // Clone extensions independently of bounded history/activity payloads. Eight
 // valid 48KiB modules must not make unrelated metadata disappear merely by
 // pushing the complete learning object over clone()'s default size budget.
 var metadata={};Object.keys(value).forEach(function(key){if(key!=='observations'&&key!=='activity'&&key!=='modules'&&key!=='__proto__'&&key!=='constructor'&&key!=='prototype')metadata[key]=value[key];});
 return clone(metadata)||{};
}
function clean(value,epoch){
 if(object(value)&&!supported(value))return clone(value)||value;
 if(!object(value)||value.version!==VERSION)return empty(epoch);
 var result=learningMetadata(value),g=generation(value.generation);
 var raw=Array.isArray(value.observations)?value.observations:[];
 // Bound work before normalization as well as retained storage.
 var entries=raw.slice(-2000).map(function(event){return cleanObservation(event,g);}).filter(Boolean),c=compact(entries);
 result.version=VERSION;result.generation=g;result.observations=c.observations;result.activity=cleanActivity(value.activity);
 if(own(value,'modules'))result.modules=cleanModules(value.modules);
 if(value.historyLimited===true||c.limited||raw.length>2000)result.historyLimited=true;else delete result.historyLimited;
 return result;
}
function attempt(taskId,skillIds,options){
 options=options||{};var task=identifier(taskId),list=skills(skillIds);
 if(!task||!list.length)throw new TypeError('A stable task ID and skill IDs are required');
 var result={attemptId:identifier(options.attemptId)||id('attempt'),taskId:task,skillIds:list,firstOutcome:'notchecked',assistance:assistance(),errors:0,startedAt:stamp(options.startedAt,now())};
 if(typeof options.generation==='string')result.generation=generation(options.generation);
 ['subject','mode','variantId','familyId','evidenceKind','materialRevision','criteriaRevision'].forEach(function(k){if(options[k]!==undefined)result[k]=options[k];});
 return result;
}
function help(value,kind){
 if(!object(value))return value;
 value.assistance=assistance(value.assistance);
 if(kind==='error'){value.assistance.afterError=true;value.firstOutcome='incorrect';value.errors=Math.min(1000,integer(value.errors,0)+1);}
 else if(kind==='explanation'||kind==='visual'||kind==='workedExample')value.assistance[kind]=true;
 return value;
}
function record(learning,value){
 if(!supported(learning))return clean(learning);
 var result=clean(learning),event=clone(value)||{};
 if(event.generation!==undefined&&generation(event.generation)!==result.generation)return result;
 event.generation=result.generation;event.eventId=identifier(event.eventId||event.attemptId)||id('observation');
 var previous=result.observations.find(function(item){return item.eventId===event.eventId;});
 event.revision=integer(event.revision,previous?previous.revision+1:1);
 // Several answers can be recorded in one millisecond (for example a checked
 // worksheet). Preserve their actual recording order instead of letting a
 // random attempt ID decide which skill observation is considered latest.
 var latestStamp=result.observations.reduce(function(max,item){return Math.max(max,item.observedAt);},0);
 event.observedAt=stamp(event.observedAt,Math.max(now(),latestStamp+1));
 var normalized=cleanObservation(event,result.generation);if(!normalized)return result;
 if(previous)normalized=combine(previous,normalized);
 var c=compact(result.observations.filter(function(item){return item.eventId!==normalized.eventId;}).concat([normalized]));
 result.observations=c.observations;if(c.limited)result.historyLimited=true;return result;
}
function activityWinner(a,b){
 if(!a)return b;if(!b)return a;
 var order=a.ownerId===b.ownerId?a.revision-b.revision||a.updatedAt-b.updatedAt:a.updatedAt-b.updatedAt;
 if(!order)order=stable(a)<stable(b)?-1:stable(a)>stable(b)?1:0;
 return order>=0?a:b;
}
function merge(left,right,options){
 options=options||{};
 if(!supported(right))return clean(right);
 if(!supported(left))return clean(left);
 var a=clean(left),b=clean(right),g=own(options,'generation')?generation(options.generation):object(right)&&right.version===VERSION?b.generation:a.generation;
 if(a.generation!==g&&b.generation!==g)return empty(g);
 if(a.generation!==g)return b;
 if(b.generation!==g)return a;
 var result=Object.assign({},a,b),c=compact(a.observations.concat(b.observations));
 result.version=VERSION;result.generation=g;result.observations=c.observations;result.activity=activityWinner(a.activity,b.activity);
 if(own(a,'modules')||own(b,'modules')){
  var modules={},am=a.modules||{},bm=b.modules||{};
  Object.keys(am).concat(Object.keys(bm)).forEach(function(key){modules[key]=activityWinner(am[key],bm[key]);});
  result.modules=cleanModules(modules);
 }
 if(a.historyLimited||b.historyLimited||c.limited)result.historyLimited=true;
 return result;
}
function setActivity(learning,state,options){
 if(!supported(learning))return clean(learning);options=options||{};var result=clean(learning),current=result.activity;
 var activity=cleanActivity({revision:integer(options.revision,current?current.revision+1:1),updatedAt:stamp(options.updatedAt,now()),ownerId:identifier(options.ownerId)||current&&current.ownerId||'local',state:state});
 if(activity)result.activity=activity;return result;
}
function getModule(learning,key){
 if(!moduleIdentifier(key)||!supported(learning))return null;
 var result=clean(learning);return result.modules&&own(result.modules,key)?cleanActivity(result.modules[key]):null;
}
function setModule(learning,key,state,options){
 if(!supported(learning))return clean(learning);options=options||{};var result=clean(learning);
 if(!moduleIdentifier(key)||own(options,'generation')&&generation(options.generation)!==result.generation)return result;
 var modules=result.modules||{},current=own(modules,key)?modules[key]:null;
 if(!current&&Object.keys(modules).length>=MAX_MODULES)return result;
 var activity=cleanActivity({revision:integer(options.revision,current?current.revision+1:1),updatedAt:stamp(options.updatedAt,now()),ownerId:identifier(options.ownerId)||current&&current.ownerId||'local',state:state});
 if(activity){modules[key]=activity;result.modules=cleanModules(modules);}return result;
}
function latest(learning,skillId){
 var value=clean(learning);if(!supported(value))return null;
 var list=value.observations.filter(function(event){return event.skillIds.indexOf(skillId)!==-1&&event.finalOutcome!=='notchecked';});
 return list.length?clone(list[list.length-1]):null;
}
function status(learning,skillId){var event=latest(learning,skillId);return event?classify(event):'notchecked';}
root.LearningProgress={VERSION:VERSION,MAX_HISTORY:MAX_HISTORY,MAX_ACTIVITY_BYTES:MAX_ACTIVITY_BYTES,MAX_MODULES:MAX_MODULES,empty:empty,reset:empty,isSupported:supported,clean:clean,attempt:attempt,help:help,record:record,merge:merge,setActivity:setActivity,clearActivity:function(learning,options){return setActivity(learning,null,options);},getModule:getModule,setModule:setModule,latest:latest,status:status,classify:classify};
})(typeof window==='undefined'?globalThis:window);
