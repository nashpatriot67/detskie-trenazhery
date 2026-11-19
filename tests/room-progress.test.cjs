'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='kubiki-progress-v1',MODULE='life-room-adventure';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),label);checks++;};const ok=(a,label)=>{assert.ok(a,label);checks++;};
const clone=v=>JSON.parse(JSON.stringify(v));
const sample={kind:'RoomAdventurePrototype',version:1,state:{stage:'floor',placements:{'toy-car':'toybox'},blanket:[false,false],pillow:false,packed:[],zip:false}};
function memory(value){return {text:value===undefined?null:typeof value==='string'?value:JSON.stringify(value),writes:[],gets:0,onGet:null,quota:false};}
function fixture(mem){
 const listeners={};const storage={getItem(key){assert.equal(key,KEY);mem.gets++;if(mem.onGet)mem.onGet(mem);return mem.text;},setItem(key,value){assert.equal(key,KEY);if(mem.quota)throw Error('QuotaExceededError');mem.text=String(value);mem.writes.push(mem.text);}};
 const window={localStorage:storage,addEventListener(type,cb){(listeners[type]||(listeners[type]=new Set())).add(cb);},removeEventListener(type,cb){listeners[type]?.delete(cb);},crypto:{randomUUID:()=>Math.random().toString(36).slice(2)}};
 const context=vm.createContext({window,localStorage:storage,console});
 vm.runInContext(fs.readFileSync(path.join(root,'learning-progress.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'life-quest-data.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'room-adventure.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'room-progress.js'),'utf8'),context);
 return {api:window.RoomProgress,LP:window.LearningProgress,create:()=>window.RoomProgress.create(),fire(event){for(const cb of listeners.storage||[])cb(event||{key:KEY,newValue:mem.text});},listeners};
}
function seed(){const f=fixture(memory());let learning=f.LP.empty('initial');const a=f.LP.attempt('synthetic.old',['math.synthetic'],{generation:'initial'});a.finalOutcome='correct';learning=f.LP.record(learning,a);learning=f.LP.setModule(learning,'life-quests',{version:3,encoding:'opaque-old-life',payload:['keep']},{ownerId:'prior-tab'});return {version:1,stars:27,currentLesson:11,resetEpoch:'initial',custom:{keep:'legacy'},learning};}

{const mem=memory(),f=fixture(mem),store=f.create();eq(store.read().snapshot,null,'Empty storage has no invented room result');eq(mem.writes.length,0,'Reading never writes');ok(store.save(sample,{sound:true}),'First meaningful action saves');const raw=JSON.parse(mem.text);eq(Object.keys(raw.learning.modules),[MODULE],'Room uses its named module in existing owner');eq(raw.learning.modules[MODULE].state,{version:1,adventure:sample,sound:true},'Wrapper retains room state and sound');const next=f.create();eq(next.read().snapshot,sample,'Fresh adapter resumes exact room state');eq(next.read().sound,true,'Sound setting survives reload');store.destroy();next.destroy();}

{const old=seed(),mem=memory(old),f=fixture(mem),store=f.create();store.read();ok(store.save(sample,{sound:false}),'Existing record accepts additive room module');const raw=JSON.parse(mem.text);for(const key of ['stars','currentLesson','resetEpoch','custom'])eq(raw[key],old[key],'Legacy field preserved: '+key);eq(raw.learning.observations,old.learning.observations,'Existing observations preserved');eq(raw.learning.modules['life-quests'],old.learning.modules['life-quests'],'Existing life snapshot remains opaque and unchanged');eq(raw.learning.activity,old.learning.activity,'Existing mathematical activity unchanged');store.destroy();}

for(const invalid of ['{broken','[]','null']){const mem=memory(invalid),f=fixture(mem),store=f.create();ok(store.read().error,'Malformed owner reports read error');eq(store.save(sample,{sound:false}),false,'Malformed owner cannot be overwritten');eq(mem.text,invalid,'Malformed owner preserved byte for byte');eq(mem.writes.length,0,'Malformed owner causes no writes');store.destroy();}

{const raw=seed();raw.learning.version=99;const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create();ok(store.read().error,'Unknown future learning version reports error');eq(store.save(sample,{sound:false}),false,'Unknown future learning cannot be overwritten');eq(mem.text,before,'Unknown learning preserved');store.destroy();}

{const raw=seed();raw.learning.modules[MODULE]={revision:1,updatedAt:1,ownerId:'future',state:{version:99,adventure:{unread:'future'}}};const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create();ok(store.read().error,'Unknown room wrapper reports error');eq(store.save(sample,{sound:false}),false,'Future room wrapper cannot be overwritten');eq(mem.text,before,'Future room payload preserved');store.destroy();}

const badInnerSnapshots=[
 ['future inner version',Object.assign(clone(sample),{version:2})],
 ['wrong inner kind',Object.assign(clone(sample),{kind:'UnrelatedProgress'})],
 ['null inner state',Object.assign(clone(sample),{state:null})],
 ['array inner state',Object.assign(clone(sample),{state:[]})],
 ['incomplete domain state',Object.assign(clone(sample),{state:{stage:'floor'}})],
 ['impossible stage',Object.assign(clone(sample),{state:Object.assign(clone(sample.state),{stage:'done'})})],
 ['future action before floor completed',Object.assign(clone(sample),{state:Object.assign(clone(sample.state),{pillow:true})})],
 ['invalid item placement',Object.assign(clone(sample),{state:Object.assign(clone(sample.state),{placements:{'toy-car':'laundry'}})})]
];
for(const [label,adventure] of badInnerSnapshots){const raw=seed();raw.learning.modules[MODULE]={revision:1,updatedAt:1,ownerId:'unread-domain',state:{version:1,adventure,sound:false}};const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create();const read=store.read();ok(read.error,'Inner/domain read guard rejects '+label);eq(read.snapshot,null,'Rejected '+label+' is not offered for resume');eq(store.save(sample,{sound:false}),false,'Rejected '+label+' cannot be overwritten by current client');eq(mem.text,before,'Rejected '+label+' remains byte for byte unchanged');eq(mem.writes.length,0,'Rejected '+label+' produces no mutation');store.destroy();}

{const raw=seed();raw.resetEpoch='new-reset';const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create();ok(store.read().error,'Generation mismatch reports error');eq(store.save(sample,{sound:false}),false,'Mismatched generation cannot be overwritten');eq(mem.text,before,'Mismatched owner preserved');store.destroy();}

{const raw=seed(),f0=fixture(memory());raw.learning.modules={};for(let i=0;i<8;i++)raw.learning=f0.LP.setModule(raw.learning,'synthetic-'+i,{version:1,value:i},{ownerId:'old'});const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create();store.read();eq(store.save(sample,{sound:false}),false,'Module cap refuses a ninth module');ok(store.warning(),'Module cap gives recoverable warning');eq(mem.text,before,'Module cap never evicts an old activity');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();const updated=JSON.parse(mem.text);updated.custom.newUnrelatedValue=42;updated.stars=99;mem.text=JSON.stringify(updated);ok(store.save(sample,{sound:false}),'Unrelated latest raw fields can coexist with room update');const raw=JSON.parse(mem.text);eq(raw.custom.newUnrelatedValue,42,'Latest unrelated field merged');eq(raw.stars,99,'Latest unrelated award preserved');store.destroy();}

{const mem=memory(seed()),a=fixture(mem),b=fixture(mem),sa=a.create(),sb=b.create();sa.read();sb.read();ok(sb.save(sample,{sound:false}),'Other tab saves first');const before=mem.text;eq(sa.save(sample,{sound:true}),false,'Stale same-module writer is blocked');ok(sa.warning(),'Same-module conflict is explained');eq(mem.text,before,'Conflict preserves latest other-tab room state');sa.destroy();sb.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();const reset=JSON.parse(mem.text);reset.resetEpoch='another-reset';reset.learning=f.LP.empty('another-reset');mem.text=JSON.stringify(reset);const before=mem.text;eq(store.save(sample,{sound:false}),false,'Reset after opening blocks stale room writes');eq(mem.text,before,'Reset generation remains untouched');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();mem.gets=0;let interleaved=false;mem.onGet=m=>{if(m.gets===2){const raw=JSON.parse(m.text);raw.concurrent='arrived-during-CAS';m.text=JSON.stringify(raw);interleaved=true;}};eq(store.save(sample,{sound:false}),false,'CAS rejects an interleaved full-record change');ok(interleaved,'Synthetic concurrent mutation actually happened');eq(JSON.parse(mem.text).concurrent,'arrived-during-CAS','Interleaved update survives');eq(mem.writes.length,0,'CAS failure has no storage write');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();const before=mem.text;mem.quota=true;eq(store.save(sample,{sound:false}),false,'Quota failure is recoverable');ok(store.warning(),'Quota failure has visible warning');eq(mem.text,before,'Quota failure preserves previous record');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();const before=mem.text,oversized=clone(sample);oversized.state.padding='я'.repeat(60000);eq(store.save(oversized,{sound:false}),false,'Oversized room snapshot is refused by existing LP limit');ok(store.warning(),'Oversized snapshot provides a warning');eq(mem.text,before,'Oversized snapshot cannot erase another activity');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();ok(store.save(sample,{sound:false}),'Detached-read fixture saved');const read=store.read();read.snapshot.state.placements.teddy='toybox';eq(store.read().snapshot,sample,'Mutating returned state cannot mutate the stored room snapshot');const before=mem.text;eq(store.save({kind:'UnrelatedProgress',version:1},{sound:false}),false,'An unrelated progress payload cannot be saved as room state');eq(mem.text,before,'Rejected payload leaves original bytes intact');store.destroy();}

{const mem=memory(seed()),f=fixture(mem),store=f.create();store.read();let notifications=0;const unsubscribe=store.subscribe(()=>notifications++);f.fire({key:'unrelated',newValue:'anything'});eq(notifications,0,'Unrelated storage events ignored');const raw=JSON.parse(mem.text);raw.learning=f.LP.setModule(raw.learning,MODULE,{version:1,adventure:sample,sound:true},{ownerId:'another-tab'});mem.text=JSON.stringify(raw);f.fire();ok(notifications>0,'Room storage change notifies subscriber');const n=notifications;if(typeof unsubscribe==='function')unsubscribe();store.destroy();f.fire();eq(notifications,n,'Destroy detaches storage listener');}

console.log(JSON.stringify({success:true,checks,syntheticOnly:true,owner:KEY,module:MODULE,productionWrites:false}));
