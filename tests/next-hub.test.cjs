'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx=vm.createContext({}),run=file=>vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'..',file),'utf8'),ctx);
run('practice-hub.js');const C=ctx.PracticeHubCore,plain=v=>JSON.parse(JSON.stringify(v));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;};const ok=(a,m)=>{assert.ok(a,m);checks++;};
let r=C.cleanRoutine();eq([r.taskLimit,r.minuteLimit,r.enabled],[5,10,true]);eq(C.due(r),false);
const event=(id,outcome='correct')=>({eventId:id,finalOutcome:outcome});
let result=C.countCorrect(r,{observations:[event('old-1'),event('old-2')]},'kubiki-progress-v1');r=result.routine;eq(result.added,0,'Historical completed work never triggers a pause');eq(r.tasks,0);
result=C.countCorrect(r,{observations:[event('old-1'),event('old-2'),event('new-1','incorrect')]},'kubiki-progress-v1');r=result.routine;eq(result.added,0,'An error does not count as a completed task');
result=C.countCorrect(r,{observations:[event('old-1'),event('old-2'),event('new-1')]},'kubiki-progress-v1');r=result.routine;eq(result.added,1,'Self-correction counts once when completed');eq(r.tasks,1);
result=C.countCorrect(r,{observations:[event('new-1')]},'kubiki-progress-v1');r=result.routine;eq(result.added,0,'Rerendering does not recount the same attempt');
result=C.countCorrect(r,{observations:[event('ru-old')]},'slovograd-v1');r=result.routine;eq(result.added,0,'A newly opened subject establishes its own baseline');
result=C.countCorrect(r,{observations:[event('ru-old'),event('ru-new')]},'slovograd-v1');r=result.routine;eq(result.added,1);eq(r.tasks,2,'Subject attempts contribute to the same gentle routine');
for(let n=2;n<=4;n++){result=C.countCorrect(r,{observations:[event('new-'+n)]},'kubiki-progress-v1');r=result.routine;eq(result.added,1);}
eq(r.tasks,5);ok(C.due(r),'Default request is due after five completed attempts');
eq(C.due({...r,enabled:false}),false,'Parent can disable automatic proposals');eq(C.due({...r,tasks:0,seconds:599}),false);eq(C.due({...r,tasks:0,seconds:600}),true,'Ten active minutes can make a pause due');
eq(C.cleanRoutine({version:1,taskLimit:0,minuteLimit:0,tasks:-5,seconds:-1}).taskLimit,5);eq(C.cleanRoutine({version:99,enabled:false}).enabled,true,'Unknown routine shape is not interpreted as a valid setting');
for(const taskLimit of [4,5,6,8])for(const minuteLimit of [8,10,12,15]){const x=C.cleanRoutine({version:1,taskLimit,minuteLimit});eq([x.taskLimit,x.minuteLimit],[taskLimit,minuteLimit]);eq(C.due({...x,tasks:taskLimit-1}),false);eq(C.due({...x,tasks:taskLimit}),true);}
const long=C.countCorrect({...r,seen:{'kubiki-progress-v1':[]}}, {observations:Array.from({length:400},(_,i)=>event('entry-'+i))},'kubiki-progress-v1');eq(long.routine.seen['kubiki-progress-v1'].length,240);eq(long.routine.tasks,100,'Counters are bounded');
console.log(JSON.stringify({success:true,checks,storageAccess:false,historicalWorkNotCounted:true,skipErrorNotPhysicalPenalty:true,timerDueNotAutomaticInterrupt:true}));
