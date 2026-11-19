'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;};
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(missing){
 let storageAccess=0,observerCallback=null;
 const elements={app:{innerHTML:''},'life-today':{hidden:false},'life-stage':{}};
 const listeners={},opens=[],mounts=[];
 const doc={getElementById:id=>elements[id]||null,querySelector(){return null;},addEventListener(name,fn){listeners[name]=fn;}};
 const hub={mount(config){mounts.push(config);},snapshot(){return null;},open(...args){opens.push(args);}};
 const window={document:doc,LearningProgress:{},LifeQuests:{},PracticeHub:hub,MutationObserver:function(fn){observerCallback=fn;this.observe=()=>{};}};
 const context=vm.createContext({window,get localStorage(){storageAccess++;throw Error('Entry must not create another storage owner');}});
 vm.runInContext(read('life-quest-data.js'),context);
 if(missing)delete window[missing];
 vm.runInContext(read('life/app.js'),context);
 return {window,elements,listeners,opens,mounts,get storageAccess(){return storageAccess;},observer:()=>observerCallback};
}
const ready=fixture();eq(ready.mounts.length,1,'Separate entry mounts the existing host once');
const config=ready.mounts[0];eq(config.subject,'life');eq(config.trainerId,'life');eq(config.standalone,true);eq(config.initial,'quests');eq(config.container,'#life-stage');eq(config.storageKey,'kubiki-progress-v1','Existing life snapshots keep their canonical owner');eq(ready.storageAccess,0,'Entry does not read or write learner storage');
ok(ready.elements.app.innerHTML.includes('href="../"'),'Home navigation stays available in standalone shell');ok(ready.elements.app.innerHTML.includes('id="life-stage"'));ok(ready.elements.app.innerHTML.includes('С чего сегодня начнём?'));ok(!ready.elements.app.innerHTML.includes('К уроку'),'Life shell does not introduce an academic return control');
eq(plain(ready.window.LifeTrainer.missions),['life.places.after-play','life.school.math-russian','life.plan.room']);
for(const id of ready.window.LifeTrainer.missions){ok(ready.window.LifeQuestData.quests.some(q=>q.id===id),'Every quick mission refers to an actual existing quest');let prevented=false;ready.listeners.click({target:{closest:()=>({dataset:{lifeStart:id},disabled:false})},preventDefault(){prevented=true;}});eq(prevented,true);eq(plain(ready.opens.at(-1)),['quests',{questId:id}],'Quick mission reuses the existing quest engine');}
const count=ready.opens.length;ready.listeners.click({target:{closest:()=>({dataset:{lifeStart:'not-a-quest'},disabled:false})},preventDefault(){throw Error('Invalid quest should be ignored');}});eq(ready.opens.length,count);
ready.window.PracticeHub.snapshot=()=>({kind:'quests',state:{view:'quest',solved:false,phase:'play'}});ready.observer()();eq(ready.elements['life-today'].hidden,true,'Quick choices hide during a task');eq(config.atBoundary(),false);eq(config.isStudyActive(),true);
ready.window.PracticeHub.snapshot=()=>({kind:'quests',state:{view:'quest',solved:true,phase:'real'}});eq(config.atBoundary(),false,'A real-life plan is not a safe automatic academic boundary');eq(config.isStudyActive(),false,'Time away from the screen for the real action must not count as screen study');
ready.window.PracticeHub.snapshot=()=>({kind:'quests',state:{view:'quest',solved:true,phase:'small-real'}});eq(config.atBoundary(),false);eq(config.isStudyActive(),false,'Tiny real actions do not count as screen activity');
ready.window.PracticeHub.snapshot=()=>({kind:'quests',state:{view:'quest',solved:true,phase:'play'}});eq(config.atBoundary(),true);
ready.window.PracticeHub.snapshot=()=>({kind:'quests',state:{view:'menu',solved:false,phase:'intro'}});ready.observer()();eq(ready.elements['life-today'].hidden,false);
for(const missing of ['LearningProgress','LifeQuestData','LifeQuests','PracticeHub']){const f=fixture(missing);eq(f.mounts.length,0);ok(f.elements.app.innerHTML.includes('Завершим обновление'));ok(f.elements.app.innerHTML.includes('href="../"'));eq(f.storageAccess,0);}
const manifest=JSON.parse(read('life/manifest.webmanifest'));eq(manifest.id,'/detskie-trenazhery/life/');eq(manifest.start_url,'./');eq(manifest.scope,'./');eq(manifest.display,'standalone');ok(manifest.name.startsWith('Дела и приключения'));
for(const entry of manifest.icons){const file=path.resolve(root,'life',entry.src);ok(fs.existsSync(file),'Manifest icon exists');const png=fs.readFileSync(file),expected=Number(entry.sizes.split('x')[0]);eq(png.subarray(1,4).toString(),'PNG');eq(png.readUInt32BE(16),expected);eq(png.readUInt32BE(20),expected);}
const apple=fs.readFileSync(path.join(root,'icons/life-180.png'));eq(apple.readUInt32BE(16),180);
const index=read('life/index.html');ok(index.includes('name="viewport"'));ok(index.includes('href="manifest.webmanifest"'));ok(index.includes('id="app"'));ok(index.includes('id="live"'));ok(index.includes('id="overlay"'));ok(!index.includes('http://')||index.includes('http://www.w3.org/2000/svg'),'No network-bound UI asset is needed');
const home=read('index.html');ok(home.includes('href="./life/"'));ok(!home.includes('kubiki/?activity=quests'),'Homepage no longer opens life activities inside mathematics');for(const folder of ['kubiki','bricks','slovograd'])ok(home.includes('href="./'+folder+'/"'),'Previous trainer link remains');
console.log(JSON.stringify({success:true,checks,standaloneEntry:true,existingOwnerPreserved:true,noStorageAccess:true,realActionDoesNotCountAsStudy:true,homeAndManifest:true}));
