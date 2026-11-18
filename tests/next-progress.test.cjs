'use strict';
// Optional named activities are tested without a browser, storage or network.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
let checks=0,storageAccess=0;
const context=vm.createContext({window:{},get localStorage(){storageAccess++;throw Error('The owner app manages storage');},fetch(){throw Error('No network');}});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','learning-progress.js'),'utf8'),context);
const L=context.window.LearningProgress,plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const eq=(a,b,label)=>{assert.deepEqual(plain(a),plain(b),label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const epoch='next-epoch',blank=L.empty(epoch);
const names=['concept-math','concept-russian','life-quests','active-breaks','routine'];
const put=(learning,key,state,options={})=>L.setModule(learning,key,state,{ownerId:'tab-a',updatedAt:100,...options});

// Stage 1 and untouched old achievement records keep the same representation.
eq(blank,{version:1,generation:epoch,observations:[],activity:null});
eq(L.clean(blank),blank);eq(L.merge(blank,undefined),blank);eq(L.getModule(blank,'concept-math'),null);
const oldRecord={solved:{'13:0':true},done:{'spelling:word1':true},session:{version:2,answer:'35'},learning:plain(blank)};
const oldCopy=plain(oldRecord);L.setModule(oldRecord.learning,'concept-math',{version:1});eq(oldRecord,oldCopy);
eq(L.status(blank,'math.terms.difference'),'notchecked','Old marks cannot become independent module evidence');
const pv=L.setActivity(blank,{view:'placevalue',pv:{version:1,index:3},zones:{a:{hundred:2,ten:9,unit:12}},answer:'294'},{ownerId:'pv-tab',updatedAt:90});
const concepts=put(pv,'concept-math',{version:1,taskId:'math.terms.difference.02',answer:'23',attempt:{firstOutcome:'incorrect',assistance:{visual:true}}});
eq(concepts.activity,pv.activity,'Concepts do not replace the existing place-value activity');
eq(L.getModule(concepts,'concept-math').state.answer,'23');eq(L.getModule(concepts,'concept-math').revision,1);eq(pv.modules,undefined,'setModule is pure');
const quests=put(concepts,'life-quests',{version:1,questId:'school.rainy-day',phase:'play',placement:{book:'bag',coat:'hook'},selected:'pencil'},{updatedAt:110});
eq(L.getModule(quests,'concept-math'),L.getModule(concepts,'concept-math'));
eq(L.getModule(quests,'life-quests').state.selected,'pencil');eq(quests.activity,pv.activity);
eq(L.clean(quests),quests,'Cleaned module snapshots are stable');
const got=L.getModule(quests,'life-quests');got.state.placement.book='wrong';eq(L.getModule(quests,'life-quests').state.placement.book,'bag','Readers cannot mutate retained records');

// Different module contexts from concurrent tabs merge rather than overwrite.
const tabA=put(blank,'concept-math',{version:1,taskId:'sum.1',answer:'7'},{updatedAt:200});
const tabB=put(blank,'life-quests',{version:1,questId:'pool.1',phase:'play',selected:['towel','cap']},{ownerId:'tab-b',updatedAt:201});
const together=L.merge(tabA,tabB,{generation:epoch});
eq(L.getModule(together,'concept-math'),L.getModule(tabA,'concept-math'));eq(L.getModule(together,'life-quests'),L.getModule(tabB,'life-quests'));
eq(L.merge(tabB,tabA,{generation:epoch}),together,'Named context union is commutative');
eq(L.merge(together,together),together,'Named context merge is idempotent');
eq(L.merge(together,L.empty(epoch)),together,'A stale app without optional modules does not erase them');
eq(L.merge(L.empty(epoch),together),together);
const normalSave=L.record(together,{attemptId:'old-lesson-new-answer',taskId:'math.lesson13.1',skillIds:['math.exchange.ten'],generation:epoch,outcome:'correct',observedAt:202});
eq(normalSave.modules,together.modules,'Recording a legacy lesson leaves all module snapshots intact');
eq(L.merge(together,normalSave).modules,together.modules);
const pvSave=L.setActivity(blank,{view:'placevalue',answer:'1000'},{updatedAt:205,ownerId:'pv-tab'});
eq(L.merge(together,pvSave).modules,together.modules);eq(L.merge(together,pvSave).activity,pvSave.activity);

// Same module: use per-owner revision; between owners use the timestamp.
const edited=put(tabA,'concept-math',{version:1,taskId:'sum.1',answer:'8'},{updatedAt:210});
eq(L.getModule(edited,'concept-math').revision,2);
eq(L.getModule(L.merge(tabA,edited),'concept-math'),L.getModule(edited,'concept-math'));
eq(L.merge(tabA,edited),L.merge(edited,tabA));
const backwards=put(edited,'concept-math',{version:1,answer:'9'},{updatedAt:150,revision:3});
eq(L.getModule(L.merge(edited,backwards),'concept-math').state.answer,'9','A same-owner clock adjustment does not undo a later revision');
const foreign=put(tabA,'concept-math',{version:1,answer:'10'},{ownerId:'tab-b',revision:1,updatedAt:250});
eq(L.getModule(L.merge(backwards,foreign),'concept-math').state.answer,'10');
eq(L.merge(backwards,foreign),L.merge(foreign,backwards));
const tiedA=put(blank,'concept-math',{version:1,answer:'a'},{ownerId:'owner-a',revision:1,updatedAt:300});
const tiedB=put(blank,'concept-math',{version:1,answer:'b'},{ownerId:'owner-b',revision:1,updatedAt:300});
eq(L.merge(tiedA,tiedB),L.merge(tiedB,tiedA),'Equal clocks still have a deterministic winner');

// A clear is an explicit tombstone, not a missing map key.
const cleared=put(foreign,'concept-math',null,{ownerId:'tab-b',updatedAt:251});
eq(L.getModule(cleared,'concept-math').state,null);eq(L.getModule(cleared,'concept-math').revision,2);
eq(L.getModule(L.merge(foreign,cleared),'concept-math').state,null,'A stale answer cannot resurrect a cleared module');
eq(L.merge(foreign,cleared),L.merge(cleared,foreign));
const clearedWithQuest=L.merge(cleared,tabB);eq(L.getModule(clearedWithQuest,'life-quests'),L.getModule(tabB,'life-quests'));

// Reset authority is global to the existing owner and beats all module clocks.
const reset=L.empty('fresh-epoch');
eq(L.merge(quests,reset),reset);eq(L.merge(reset,quests,{generation:'fresh-epoch'}),reset);
eq(L.merge(quests,reset,{generation:'fresh-epoch'}),reset);
eq(L.getModule(L.merge(quests,reset),'life-quests'),null);
eq(L.setModule(reset,'concept-math',{answer:'stale'},{generation:epoch,updatedAt:9999999}),reset,'An explicitly stale generation cannot write');
const resetWork=L.setModule(reset,'concept-math',{answer:'fresh'},{generation:'fresh-epoch',updatedAt:1,ownerId:'new-tab'});
eq(L.getModule(L.merge(quests,resetWork),'concept-math').state.answer,'fresh');
eq(L.getModule(L.merge(quests,resetWork),'life-quests'),null);

// Opaque future versions are never interpreted or downgraded by new APIs.
const future={version:9,generation:'future',modules:{'concept-math':{format:'new'}},activity:{new:true},extension:['unchanged']};
eq(L.getModule(future,'concept-math'),null);eq(L.setModule(future,'concept-math',{answer:'old-code'}),future);
eq(L.merge(quests,future),future);eq(L.merge(future,quests),future);eq(L.clean(future),future);
const extended={...plain(quests),extension:{preserve:'exact'},settings:{contrast:'high'}};
eq(L.setModule(extended,'routine',{completed:4}).extension,extended.extension);
eq(L.setModule(extended,'routine',{completed:4}).settings,extended.settings);

// Each snapshot is bounded in UTF-8 bytes, independent of other contexts.
const tooLarge={note:'я'.repeat(25000)};
eq(L.setModule(quests,'life-quests',tooLarge),quests);
eq(L.setModule(quests,'life-quests',[]),quests);eq(L.setModule(quests,'life-quests','invalid'),quests);
const cyclic={};cyclic.self=cyclic;eq(L.setModule(quests,'life-quests',cyclic),quests);
for(const key of ['',null,'bad module','__proto__','constructor','prototype']){
 eq(L.setModule(quests,key,{valid:true}),quests);eq(L.getModule(quests,key),null);
}
const malicious=JSON.parse('{"version":1,"generation":"next-epoch","observations":[],"activity":null,"modules":{"__proto__":{"revision":1,"state":{"polluted":true}},"constructor":{"state":{}},"life-quests":{"revision":1,"updatedAt":8,"ownerId":"tab-a","state":{"safe":true,"__proto__":{"polluted":true}}}}}');
eq(Object.prototype.polluted,undefined);eq(Object.keys(L.clean(malicious).modules),['life-quests']);
ok(!Object.hasOwn(L.getModule(L.clean(malicious),'life-quests').state,'__proto__'));
eq(L.clean({...plain(blank),modules:{bad:{state:[]},'life-quests':{state:{okay:true}},large:{state:tooLarge}}}).modules,{'life-quests':{revision:0,updatedAt:0,ownerId:'local',state:{okay:true}}});

// Existing entries are never silently evicted by setModule's capacity check.
let full=blank;
for(let i=0;i<8;i++)full=put(full,'module-'+i,{index:i},{updatedAt:400+i});
eq(Object.keys(full.modules).length,L.MAX_MODULES);eq(L.MAX_MODULES,8);
eq(L.setModule(full,'ninth-module',{answer:'must not evict'}),full);
const updatedFull=put(full,'module-3',{index:33},{updatedAt:500});eq(Object.keys(updatedFull.modules).length,8);eq(L.getModule(updatedFull,'module-3').state.index,33);
const overflowing=plain(full);overflowing.modules.extra={revision:1,updatedAt:1000,ownerId:'tab-x',state:{extra:true}};
eq(Object.keys(L.clean(overflowing).modules).length,8);eq(L.getModule(L.clean(overflowing),'extra').state.extra,true);
eq(L.clean(L.clean(overflowing)),L.clean(overflowing));

// Near-limit module payloads plus observation history must not lose metadata.
let largeRecord={...plain(blank),extension:{preserve:'metadata'},settings:{volume:0}};
for(let i=0;i<8;i++)largeRecord=put(largeRecord,'module-'+i,{text:'x'.repeat(48000)},{updatedAt:600+i});
for(let i=0;i<200;i++)largeRecord=L.record(largeRecord,{taskId:'math.task.'+i,attemptId:'large-observation-'+i,skillIds:Array.from({length:8},(_,j)=>'math.terms.'+j+'.'+'s'.repeat(90)),generation:epoch,outcome:'correct',observedAt:1000+i,variantId:'variant-'+('v'.repeat(140)),familyId:'family-'+('f'.repeat(140))});
ok(JSON.stringify(largeRecord).length>512*1024,'This is a real combined-size regression fixture');
eq(largeRecord.extension,{preserve:'metadata'});eq(largeRecord.settings,{volume:0});eq(Object.keys(largeRecord.modules).length,8);eq(largeRecord.observations.length,200);
eq(L.clean(largeRecord),largeRecord);eq(L.getModule(largeRecord,'module-7').state.text.length,48000);
// A fast batch must retain its true order even when the system clock is equal
// and the final event ID would sort before every older ID.
vm.runInContext('Date.now = function(){ return 1000; };',context);
let fast=L.empty('fast');
for(let i=0;i<8;i++)fast=L.record(fast,{taskId:'fast.task.'+i,attemptId:'z-correct-'+i,skillIds:['math.exchange.split-hundred'],outcome:'correct'});
fast=L.record(fast,{taskId:'fast.task.last',attemptId:'a-final-error',skillIds:['math.exchange.split-hundred'],outcome:'incorrect'});
eq(fast.observations.map(x=>x.observedAt),Array.from({length:9},(_,i)=>1000+i),'Generated timestamps retain recording order');
eq(L.status(fast,'math.exchange.split-hundred'),'incorrect','The most recent difficulty remains the latest observation');
fast=L.record(fast,{taskId:'fast.imported',attemptId:'historical-explicit',skillIds:['math.exchange.split-hundred'],outcome:'correct',observedAt:20});
eq(fast.observations.find(x=>x.eventId==='historical-explicit').observedAt,20,'Explicit historical timestamps are preserved');
eq(storageAccess,0);
console.log(JSON.stringify({success:true,checks,namedModulesMax:L.MAX_MODULES,snapshotBytesMax:L.MAX_ACTIVITY_BYTES,placeValueActivityPreserved:true,oldShapePreserved:true,independentContextsMerged:true,resetGenerationRespected:true,futureVersionOpaque:true,storageAccess},null,2));
