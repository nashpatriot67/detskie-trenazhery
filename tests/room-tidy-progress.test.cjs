'use strict';
// Synthetic records and an isolated domain validator. No browser profile or
// real learner record is read or written by these adapter checks.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),KEY='kubiki-progress-v1',TIDY='life-room-tidy',CLASSIC='life-room-adventure';
let checks=0;
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const eq=(a,b,label)=>{assert.deepEqual(clone(a),clone(b),label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const sample={kind:'RoomTidyAdventure',version:1,state:{stage:'toys',placements:{car:'toybox'}}};
const classic={kind:'RoomAdventurePrototype',version:1,state:{stage:'floor',placements:{},blanket:[false,false],pillow:false,packed:[],zip:false}};
function memory(value){return {text:value===undefined?null:typeof value==='string'?value:JSON.stringify(value),writes:[],gets:0,onGet:null,quota:false};}
function fixture(mem,options={}){
 const listeners={},calls=[];
 const storage={getItem(key){assert.equal(key,KEY);mem.gets++;mem.onGet?.(mem);return mem.text;},setItem(key,value){assert.equal(key,KEY);if(mem.quota)throw Error('quota');mem.text=String(value);mem.writes.push(mem.text);}};
 const window={localStorage:storage,addEventListener(type,listener){(listeners[type]||(listeners[type]=new Set())).add(listener);},removeEventListener(type,listener){listeners[type]?.delete(listener);}};
 if(options.engine!==false&&options.engine!=='real')window.RoomAdventure={create(config){calls.push(clone(config));assert.deepEqual(Object.keys(config),['episode']);assert.equal(config.episode,'tidy');return {restore(snapshot){calls.push(clone(snapshot));return {accepted:snapshot.state.stage==='toys'&&snapshot.state.placements&&Object.keys(snapshot.state.placements).every(id=>id==='car'&&snapshot.state.placements[id]==='toybox')};}};}};
 const context=vm.createContext({window,console});
 if(options.engine==='real')for(const file of ['room-tidy-data.js','room-tidy-logic.js','room-adventure.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 for(const file of ['learning-progress.js','room-progress.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 return {api:window.RoomProgress,LP:window.LearningProgress,calls,window,create:episode=>window.RoomProgress.create(episode===undefined?{}:{episode}),fire(event={key:KEY}){for(const listener of listeners.storage||[])listener(event);}};
}
function seed(){const f=fixture(memory());let learning=f.LP.empty('initial');learning=f.LP.setModule(learning,CLASSIC,{version:1,adventure:classic,sound:true},{ownerId:'classic-tab'});learning=f.LP.setModule(learning,'life-quests',{version:99,opaque:{keep:['unchanged']}},{ownerId:'older-life'});return {resetEpoch:'initial',stars:7,currentLesson:9,custom:{keep:'legacy'},learning};}
function wrapped(snapshot=sample){const value=seed();value.learning.modules[TIDY]={revision:1,updatedAt:1,ownerId:'prior-tidy',state:{version:1,adventure:clone(snapshot),sound:true}};return value;}

{
 const mem=memory(),f=fixture(mem),store=f.create('tidy');
 eq(store.read(),{snapshot:null,sound:false,error:''},'Empty tidy read creates no invented progress');eq(mem.writes.length,0,'Reading never writes');
 ok(store.save(sample,{sound:true}),'Tidy action saves without any LifeQuestData');
 const raw=JSON.parse(mem.text);eq(Object.keys(raw.learning.modules),[TIDY],'Tidy uses its own named module under the original owner');
 eq(raw.learning.modules[TIDY].state,{version:1,adventure:sample,sound:true},'Tidy wrapper remains version1');
 const next=f.create('tidy');eq(next.read().snapshot,sample,'Tidy snapshot resumes exactly');eq(next.read().sound,true,'Sound survives reload');
 ok(f.calls.some(c=>c.episode==='tidy'),'Adapter asks explicitly for the tidy engine');
 eq(f.window.LifeQuestData,undefined,'No LifeQuestData dependency is installed');store.destroy();next.destroy();
}

{
 const old=seed(),mem=memory(old),f=fixture(mem),store=f.create('tidy');store.read();ok(store.save(sample),'Tidy can coexist with existing activities');
 const raw=JSON.parse(mem.text);for(const key of ['resetEpoch','stars','currentLesson','custom'])eq(raw[key],old[key],'Legacy owner field is preserved: '+key);
 eq(raw.learning.modules[CLASSIC],old.learning.modules[CLASSIC],'Classic snapshot remains byte-equivalent as parsed data');
 eq(raw.learning.modules['life-quests'],old.learning.modules['life-quests'],'Unknown life payload remains opaque');
 eq(raw.learning.observations,old.learning.observations,'No learning observations or awards added');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem,{engine:false}),store=f.create();
 eq(store.read().snapshot,classic,'Default create still reads the classic module');ok(store.save(classic),'Default create still saves classic');
 eq(Object.hasOwn(JSON.parse(mem.text).learning.modules,TIDY),false,'Default create does not create tidy progress');store.destroy();
}

for(const invalid of ['{broken','[]','null']){
 const mem=memory(invalid),f=fixture(mem),store=f.create('tidy');ok(store.read().error,'Malformed original owner is reported');
 eq(store.save(sample),false,'Malformed owner cannot be overwritten');eq(mem.text,invalid,'Malformed owner bytes are preserved');eq(mem.writes.length,0,'Malformed owner causes no writes');store.destroy();
}

for(const [label,change] of [
 ['future learning',raw=>{raw.learning.version=99;}],
 ['future tidy wrapper',raw=>{raw.learning.modules[TIDY].state.version=2;}],
 ['future tidy snapshot',raw=>{raw.learning.modules[TIDY].state.adventure.version=2;}],
 ['classic kind in tidy slot',raw=>{raw.learning.modules[TIDY].state.adventure=classic;}],
 ['array state',raw=>{raw.learning.modules[TIDY].state.adventure.state=[];}],
 ['unreachable tidy stage',raw=>{raw.learning.modules[TIDY].state.adventure.state.stage='done';}],
 ['invalid tidy placement',raw=>{raw.learning.modules[TIDY].state.adventure.state.placements.car='laundry';}],
 ['reset generation mismatch',raw=>{raw.resetEpoch='new-reset';}],
 ['unsupported raw module wrapper',raw=>{raw.learning.modules[TIDY].state='opaque-future';}]
]){
 const raw=wrapped();change(raw);const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create('tidy');
 ok(store.read().error,'Read rejects '+label);eq(store.save(sample),false,'Rejected '+label+' blocks stale writes');eq(mem.text,before,'Rejected '+label+' preserves exact previous bytes');eq(mem.writes.length,0,'Rejected '+label+' has no writes');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();const before=mem.text;
 for(const snapshot of [classic,{...clone(sample),version:2},{...clone(sample),state:{stage:'done',placements:{}}},{...clone(sample),state:null}])eq(store.save(snapshot),false,'Save rejects incompatible or unreachable tidy snapshot');
 eq(mem.text,before,'Rejected snapshots cannot overwrite the owner');ok(store.save(sample),'A recoverable invalid action does not block a later valid save');store.destroy();
}

{
 const raw=seed(),f0=fixture(memory());for(let i=0;i<6;i++)raw.learning=f0.LP.setModule(raw.learning,'synthetic-'+i,{version:1,value:i},{ownerId:'old'});
 const mem=memory(raw),before=mem.text,f=fixture(mem),store=f.create('tidy');store.read();eq(store.save(sample),false,'Tidy refuses the ninth module');eq(mem.text,before,'Module cap never evicts classic or other modules');ok(store.warning(),'Cap has a warning');store.destroy();
}

{
 const raw=wrapped(),f0=fixture(memory());for(let i=0;i<5;i++)raw.learning=f0.LP.setModule(raw.learning,'synthetic-'+i,{version:1,value:i},{ownerId:'old'});
 const mem=memory(raw),f=fixture(mem),store=f.create('tidy');store.read();ok(store.save(sample,{sound:false}),'An existing tidy module may update at the eight-module cap');eq(Object.keys(JSON.parse(mem.text).learning.modules).length,8,'Update keeps all eight modules');store.destroy();
}

{
 const mem=memory(seed()),a=fixture(mem),b=fixture(mem),sa=a.create('tidy'),sb=b.create('tidy');sa.read();sb.read();ok(sb.save(sample),'Other tidy tab saves first');const before=mem.text;
 eq(sa.save(sample,{sound:true}),false,'Same-module stale writer is refused');eq(mem.text,before,'Latest tidy result survives a stale writer');ok(sa.warning(),'Same-module conflict is explained');sa.destroy();sb.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();const updated=JSON.parse(mem.text);updated.stars=99;updated.learning.modules[CLASSIC].state.sound=false;mem.text=JSON.stringify(updated);
 ok(store.save(sample),'An unrelated classic-tab update coexists with tidy save');const raw=JSON.parse(mem.text);eq(raw.stars,99,'Latest unrelated award field is retained');eq(raw.learning.modules[CLASSIC],updated.learning.modules[CLASSIC],'Latest classic module is retained');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();const reset=JSON.parse(mem.text);reset.resetEpoch='other-reset';reset.learning=f.LP.empty('other-reset');mem.text=JSON.stringify(reset);const before=mem.text;
 eq(store.save(sample),false,'A reset blocks stale tidy writes');eq(mem.text,before,'The reset remains untouched');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();mem.gets=0;mem.onGet=m=>{if(m.gets===2){const raw=JSON.parse(m.text);raw.concurrent='during-cas';m.text=JSON.stringify(raw);}};
 eq(store.save(sample),false,'CAS catches an interleaved full-record update');eq(JSON.parse(mem.text).concurrent,'during-cas','Interleaved unrelated data is retained');eq(mem.writes.length,0,'CAS rejection writes nothing');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();const before=mem.text;mem.quota=true;
 eq(store.save(sample),false,'Quota failure remains recoverable');eq(mem.text,before,'Quota failure preserves existing owner');mem.quota=false;ok(store.save(sample),'A later save can recover after quota is available');store.destroy();
}

{
 const mem=memory(seed()),f=fixture(mem),store=f.create('tidy');store.read();const before=mem.text,oversized=clone(sample);oversized.state.padding='я'.repeat(60000);
 eq(store.save(oversized),false,'Original activity byte cap applies to tidy');eq(mem.text,before,'Oversized tidy state cannot erase an activity');store.destroy();
}

{
 const mem=memory(wrapped()),f=fixture(mem),store=f.create('tidy');const read=store.read();read.snapshot.state.placements.car='changed';eq(store.read().snapshot,sample,'Read returns a detached tidy snapshot');
 let notices=0;const unsubscribe=store.subscribe(()=>notices++);f.fire({key:'unrelated'});eq(notices,0,'Unrelated storage events are ignored');
 const raw=JSON.parse(mem.text);raw.learning=f.LP.setModule(raw.learning,TIDY,{version:1,adventure:sample,sound:false},{ownerId:'another-tab'});mem.text=JSON.stringify(raw);f.fire();ok(notices>0,'A changed tidy module notifies subscribers');
 const count=notices;unsubscribe();store.destroy();f.fire();eq(notices,count,'Destroy detaches storage events and subscriptions');
}

{
 const mem=memory(seed()),f=fixture(mem,{engine:'real'}),game=f.window.RoomAdventure.create({episode:'tidy'}),store=f.create('tidy');
 const data=f.window.RoomTidyData,item=data.searchItems.find(item=>item.zones.includes('laundry'));
 ok(game.act('drop',{id:item.id,zone:'laundry'}).accepted,'Real tidy engine accepts a meaningful first action');
 const partial=game.snapshot();store.read();ok(store.save(partial,{sound:true}),'Real tidy snapshot saves without LifeQuestData');
 const resumed=f.create('tidy');eq(resumed.read().snapshot,partial,'Real tidy state and undo history resume exactly');
 const invalid=clone(partial);invalid.state.stage='done';const before=mem.text;eq(store.save(invalid),false,'Real domain validator refuses an unreachable completion');eq(mem.text,before,'Invalid real domain state leaves saved bytes unchanged');
 const corrupt=JSON.parse(mem.text);corrupt.learning.modules[TIDY].state.adventure=invalid;mem.text=JSON.stringify(corrupt);const rejected=f.create('tidy');ok(rejected.read().error,'Real restore validator protects an invalid saved state');eq(rejected.save(partial),false,'An invalid prior real snapshot cannot be replaced by this client');
 eq(f.window.LifeQuestData,undefined,'Real tidy resume has no classic pool metadata dependency');store.destroy();resumed.destroy();rejected.destroy();
}

console.log(JSON.stringify({success:true,checks,syntheticOnly:true,owner:KEY,module:TIDY,productionWrites:false}));
