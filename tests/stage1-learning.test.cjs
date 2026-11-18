'use strict';
// Observations only: disposable VMs, no browser profiles or real learner data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let checks=0,storageAccess=0;
const context=vm.createContext({window:{},get localStorage(){storageAccess++;throw Error('Storage must remain owned by the existing apps');},fetch(){throw Error('No network in the observation helper');}});
vm.runInContext(fs.readFileSync(path.join(root,'learning-progress.js'),'utf8'),context);
const L=context.window.LearningProgress,plain=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const eq=(actual,expected,message)=>{assert.deepEqual(plain(actual),plain(expected),message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const observation=(task,skill,id,time,outcome='correct',extra={})=>({attemptId:id,taskId:task,skillIds:[skill],outcome,observedAt:time,...extra});

// Legacy achievements are deliberately not read as independent understanding.
const old={done:{'spelling:w1':true},solved:{'13:0':true},session:{version:2,answer:'35'}};
const oldBefore=plain(old),blank=L.clean(undefined,'epoch-1');
eq(blank,{version:1,generation:'epoch-1',observations:[],activity:null});
eq(L.status(blank,'math.placevalue.position'),'notchecked');eq(old,oldBefore);
for(const malformed of [null,false,42,'broken',[],{}, {observations:[{outcome:'correct'}]}]){
 eq(L.clean(malformed),L.empty());eq(L.status(malformed,'math.exchange.ten'),'notchecked');
}
ok(L.isSupported(undefined));ok(!L.isSupported({version:2}));

// The attempt identity survives reload; helpers mutate only the passed attempt.
const attempt=L.attempt('math.hundreds.build.01',['math.placevalue.build','math.placevalue.build'],{attemptId:'attempt-build',generation:'epoch-1',startedAt:10,variantId:'v1'});
eq(attempt.skillIds,['math.placevalue.build']);eq(attempt.firstOutcome,'notchecked');eq(attempt.generation,'epoch-1');
for(const kind of ['explanation','visual','workedExample']){
 const a=L.attempt('math.task',['math.skill'],{attemptId:'a-'+kind});eq(L.help(a,kind),a);eq(a.assistance[kind],true);eq(a.assistance.afterError,false);
 const data=L.record(L.empty(),{...a,outcome:'correct',observedAt:20});eq(L.status(data,'math.skill'),'assisted');eq(L.latest(data,'math.skill').firstOutcome,'correct');
}
let correct=L.record(blank,{...attempt,outcome:'correct',observedAt:30,response:346});
eq(L.status(correct,'math.placevalue.build'),'independent');eq(correct.observations.length,1);eq(L.latest(correct,'math.placevalue.build').response,346);eq(blank.observations.length,0,'record is pure');

// First error, later self-correction: preserve both facts without inventing help.
const repair=L.attempt('math.borrow.302-8',['math.exchange.hundred'],{attemptId:'repair',generation:'epoch-1',startedAt:40});
L.help(repair,'error');eq(repair.errors,1);eq(repair.firstOutcome,'incorrect');
let repaired=L.record(blank,{...repair,outcome:'incorrect',observedAt:41});
eq(L.status(repaired,'math.exchange.hundred'),'incorrect');
repaired=L.record(repaired,{...repair,outcome:'correct',observedAt:42});
eq(repaired.observations.length,1,'One attempt is updated, not credited twice');
eq(L.status(repaired,'math.exchange.hundred'),'independent','Self-correction is not falsely labelled as a hint');
eq(L.latest(repaired,'math.exchange.hundred').assistance.afterError,true);eq(L.latest(repaired,'math.exchange.hundred').firstOutcome,'incorrect');eq(L.latest(repaired,'math.exchange.hundred').revision,2);
L.help(repair,'explanation');repaired=L.record(repaired,{...repair,outcome:'correct',observedAt:43});
eq(L.status(repaired,'math.exchange.hundred'),'assisted');eq(L.latest(repaired,'math.exchange.hundred').assistance.explanation,true);

// A skipped task differs from an untested skill; neither means a wrong answer.
let skipped=L.record(blank,observation('math.zero.01','math.placevalue.zero','skip-zero',50,'skipped',{generation:'epoch-1'}));
eq(L.status(skipped,'math.placevalue.zero'),'skipped');eq(L.status(skipped,'math.unseen'),'notchecked');
eq(L.latest(skipped,'math.placevalue.zero').firstOutcome,'skipped');
let withUnfinished=L.record(correct,observation('math.hundreds.build.02','math.placevalue.build','unfinished',60,'notchecked',{generation:'epoch-1'}));
eq(L.status(withUnfinished,'math.placevalue.build'),'independent','Starting another task does not erase a completed observation');

// Merge distinct concurrent observations and preserve their stable identities.
const tabA=L.record(blank,observation('math.task.a','math.skill.a','event-a',100,'correct',{generation:'epoch-1'}));
const tabB=L.record(blank,observation('rus.task.b','rus.skill.b','event-b',101,'correct',{generation:'epoch-1'}));
const merged=L.merge(tabA,tabB,{generation:'epoch-1'});
eq(merged.observations.map(x=>x.eventId),['event-a','event-b']);
eq(L.merge(tabB,tabA,{generation:'epoch-1'}).observations,merged.observations);
eq(L.merge(merged,merged),merged,'Merging is idempotent');
eq(L.merge(tabA,undefined),tabA,'A missing optional field is not a reset');
eq(tabA.observations.length,1);eq(tabB.observations.length,1);

// Same attempt: concurrent assistance and correction must not lose either fact.
const sameA=L.record(blank,observation('math.same','math.same.skill','same-event',110,'incorrect',{generation:'epoch-1',assistance:{visual:true},revision:1}));
const sameB=L.record(blank,observation('math.same','math.same.skill','same-event',111,'correct',{generation:'epoch-1',revision:2}));
const same=L.merge(sameA,sameB,{generation:'epoch-1'});
eq(same.observations.length,1);eq(L.status(same,'math.same.skill'),'assisted');
eq(same.observations[0].firstOutcome,'incorrect');eq(same.observations[0].assistance.afterError,true);eq(same.observations[0].finalOutcome,'correct');
eq(L.merge(sameB,sameA,{generation:'epoch-1'}).observations,same.observations);
eq(L.merge(L.merge(tabA,sameA),sameB).observations,L.merge(tabA,L.merge(sameA,sameB)).observations,'Observation union is associative in one generation');
const collisionA=L.record(blank,observation('math.first','math.first.skill','collision',120,'correct',{generation:'epoch-1'}));
const collisionB=L.record(blank,observation('math.other','math.other.skill','collision',121,'correct',{generation:'epoch-1'}));
const collision=L.merge(collisionA,collisionB);
eq(collision.observations.length,1);eq(collision.observations[0].skillIds,['math.other.skill'],'An invalid identity collision cannot credit both tasks');

// Reset authority beats timestamps, revisions and old open-tab data.
const reset=L.empty('epoch-2');
eq(L.merge(merged,reset),reset);eq(L.merge(reset,merged,{generation:'epoch-2'}),reset);eq(L.merge(merged,reset,{generation:'epoch-2'}),reset);
eq(L.record(reset,{...attempt,outcome:'correct',observedAt:999999}),reset,'An old attempt cannot cross the reset generation');
let afterReset=L.record(reset,observation('math.new','math.skill.a','new-after-reset',130,'correct',{generation:'epoch-2'}));
eq(afterReset.observations.length,1);eq(afterReset.observations[0].generation,'epoch-2');
eq(L.merge(merged,afterReset,{generation:'epoch-2'}),afterReset);

// Opaque future versions and unrelated supported extensions are not downgraded.
const future={version:7,generation:'future',observations:[{newShape:true}],activity:{newSession:true},extra:{keep:['exact',7]}};
eq(L.clean(future),future);eq(L.record(future,{...attempt,outcome:'correct'}),future);eq(L.merge(blank,future),future);eq(L.merge(future,blank),future);eq(L.status(future,'math.skill.a'),'notchecked');
const extended={...plain(blank),extension:{unknown:'preserve'},settings:[1,2]};
eq(L.clean(extended).extension,{unknown:'preserve'});eq(L.record(extended,{...attempt,outcome:'correct'}).settings,[1,2]);eq(extended.observations,[]);

// New activity snapshots retain 1000, unnormalised groups, drafts and undo.
const model={section:'arithmetic',taskId:'math.borrow.302-8',zones:{a:{hundred:2,ten:9,unit:12},b:{hundred:0,ten:0,unit:0},removed:{hundred:0,ten:0,unit:0}},answer:'1000',undo:[{hundred:3,ten:0,unit:2},{hundred:2,ten:10,unit:2}],boundary:{hundred:10,ten:0,unit:0},attempt:plain(attempt)};
const activity=L.setActivity(blank,model,{ownerId:'tab-a',updatedAt:200});
eq(activity.activity.state,model);eq(activity.activity.revision,1);eq(activity.activity.ownerId,'tab-a');eq(L.clean(activity),activity);eq(blank.activity,null);
const activity2=L.setActivity(activity,{...model,answer:'294'},{ownerId:'tab-a',updatedAt:201});
eq(activity2.activity.revision,2);eq(L.merge(activity,activity2).activity,activity2.activity);eq(L.merge(activity2,activity).activity,activity2.activity);
const backwardsClock=L.setActivity(activity2,{...model,answer:'295'},{ownerId:'tab-a',updatedAt:100,revision:3});
eq(L.merge(activity2,backwardsClock).activity,backwardsClock.activity,'One owner revision survives a wall-clock change');
const otherOwner=L.setActivity(activity,{...model,answer:'299'},{ownerId:'tab-b',updatedAt:250,revision:1});
eq(L.merge(backwardsClock,otherOwner).activity,otherOwner.activity,'Different owners use update time, not another tab counter');
const cleared=L.clearActivity(otherOwner,{ownerId:'tab-b',updatedAt:251});
eq(cleared.activity.state,null);eq(L.merge(otherOwner,cleared).activity,cleared.activity,'A clear tombstone cannot resurrect a stale activity');
eq(L.merge(cleared,otherOwner).activity,cleared.activity);
const tooLarge={text:'я'.repeat(25000)};
eq(L.setActivity(activity,tooLarge),activity,'The 48KiB limit counts UTF-8, not only JS characters');
const cycle={};cycle.self=cycle;eq(L.setActivity(activity,cycle),activity);
eq(L.setActivity(activity,[]),activity);eq(L.setActivity(future,model),future);
eq(L.merge(activity,L.empty('epoch-2')).activity,null,'Old activity is removed by reset, not restored by a high revision');

// Bound history without dropping a rare skill merely because a common one repeats.
let history=L.record(L.empty(),observation('math.rare','math.rare.skill','rare-event',1));
for(let i=0;i<300;i++)history=L.record(history,observation('math.common.'+i,'math.common.skill','common-'+i,1000+i));
eq(history.observations.length,L.MAX_HISTORY);eq(L.status(history,'math.rare.skill'),'independent');eq(L.latest(history,'math.common.skill').eventId,'common-299');eq(history.historyLimited,true);
eq(L.clean(history),history,'Repeated cleaning is stable after compaction');
ok(JSON.stringify(history).length<512*1024,'Typical bounded history stays small');

// Invalid events cannot invent progress or store raw speech/text/history.
const bad=L.record(blank,{taskId:'bad task',skillIds:['math.skill'],outcome:'correct'});eq(bad,blank);
const noSkill=L.record(blank,{taskId:'math.valid',eventId:'valid-event',skillIds:[],outcome:'correct'});eq(noSkill,blank);
const privateData=L.record(L.empty(),observation('rus.typed','rus.spelling','private-check',300,'correct',{answer:'personal free text',chat:['private'],audio:'blob:secret',response:'free speech',notes:'private'}));
const stored=JSON.stringify(privateData);ok(!/personal|private text|free speech|blob:secret|notes|chat|audio/.test(stored),'Only the observation whitelist is stored');
eq(L.latest(privateData,'rus.spelling').response,undefined);
const raw=JSON.parse('{"version":1,"generation":"initial","observations":[],"__proto__":{"polluted":true},"activity":null}');
const sanitized=L.clean(raw);eq(Object.prototype.polluted,undefined);ok(!Object.hasOwn(sanitized,'__proto__'));
eq(L.classify({finalOutcome:'unexpected'}),'notchecked');
const latestCopy=L.latest(correct,'math.placevalue.build');latestCopy.assistance.visual=true;eq(L.status(correct,'math.placevalue.build'),'independent','Returned event is a copy');
eq(storageAccess,0,'The helper never reads storage itself');

console.log(JSON.stringify({success:true,checks,oldAchievementsUntouched:true,storageAccess,independentAndAssistedDistinct:true,selfCorrectionRetainsFirstError:true,generationReset:true,mergedConcurrentObservations:true,activity1000Preserved:true,futureVersionPreserved:true,historyLimit:L.MAX_HISTORY},null,2));
