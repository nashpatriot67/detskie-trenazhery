'use strict';
// Run with: node kubiki/progress.test.cjs. Both math trainers keep their own
// achievements, current lesson and unfinished work across a full app restart.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const plain=value=>JSON.parse(JSON.stringify(value));
let checks=0;
function eq(actual,expected,message){assert.deepEqual(plain(actual),plain(expected),message);checks++;}
function ok(actual,message){assert.ok(actual,message);checks++;}
function harness(folder,storage={},denyStorage=false){
 const listeners={},classes=()=>({add(){},remove(){},toggle(){},contains(){return false;}});
 const node=(extra={})=>({value:'',disabled:false,dataset:{},classList:classes(),focus(){},setAttribute(name,value){this[name]=value;},getAttribute(name){return this[name]||null;},removeAttribute(name){delete this[name];},closest(){return {classList:classes()};},matches(selector){return selector==='[data-ws-input]'&&Object.hasOwn(this.dataset,'wsInput');},addEventListener(){},...extra});
 const nodes={'#live':node(),'#overlay':node()};let fields=[];
 const app=node({dataset:{}});let html='';Object.defineProperty(app,'innerHTML',{get(){return html;},set(value){html=value;delete nodes['#answer'];fields=[];for(const match of html.matchAll(/<input\b[^>]*>/g)){const tag=match[0],value=tag.match(/\bvalue="([^"]*)"/)?.[1]||'',disabled=/\bdisabled\b/.test(tag),index=tag.match(/\bdata-ws-input="(\d+)"/)?.[1];if(tag.includes('id="answer"'))nodes['#answer']=node({id:'answer',value,disabled});if(index!==undefined)fields.push(node({dataset:{wsInput:index},value,disabled}));}}});nodes['#app']=app;
 const doc={activeElement:null,visibilityState:'visible',querySelector(selector){if(nodes[selector])return nodes[selector];const index=selector.match(/^\[data-ws-input="(\d+)"\]$/)?.[1];return index===undefined?null:fields.find(el=>el.dataset.wsInput===index)||null;},querySelectorAll(selector){if(selector.startsWith('[data-ws-input]'))return selector.includes(':not(:disabled)')?fields.filter(el=>!el.disabled):fields;return [];},addEventListener(name,fn){(listeners[name]??=[]).push(fn);},body:{append(){}},head:{innerHTML:''}};
 const context=vm.createContext({document:doc,localStorage:{getItem(key){if(denyStorage)throw Error('storage disabled');return storage[key]||null;},setItem(key,value){if(denyStorage)throw Error('storage disabled');storage[key]=value;}},window:{scrollTo(){},matchMedia(){return {matches:true};},addEventListener(){}},MutationObserver:class{observe(){}},setTimeout(){},console,URL,Blob});
 for(const name of ['engine.js','course.js'])vm.runInContext(fs.readFileSync(path.join(root,folder,name),'utf8'),context,{filename:name});context.COURSE=context.window.COURSE;
 vm.runInContext(fs.readFileSync(path.join(root,folder,'app.js'),'utf8'),context,{filename:folder+'/app.js'});
 const run=code=>vm.runInContext(code,context);
 function input(selector,text){const el=doc.querySelector(selector);assert.ok(el,selector);el.value=text;for(const fn of listeners.input||[])fn({target:el});}
 function click(dataset){const el={dataset,closest(selector){return selector==='button,a'?el:null;}};for(const fn of listeners.click||[])fn({target:el,preventDefault(){}});}
 return {run,input,click,storage,doc,html:()=>html};
}
for(const [folder,key]of [['kubiki','kubiki-progress-v1'],['bricks','detalki-progress-v1']]){
 let storage={},h=harness(folder,storage);eq(h.run('({lesson:state.lesson,demo:state.demo,index:state.index})'),{lesson:1,demo:true,index:0},folder+': first use retains introduction');
 h.run("startTask(4,0);state.mode='worksheet';render();");h.input('[data-ws-input="0"]',String(h.run('tasks()[0].answer')));h.run('checkWorksheet();');h.input('[data-ws-input="1"]','73');
 let saved=JSON.parse(storage[key]);eq(saved.session.mode,'worksheet');eq(saved.worksheet['4']['1'],'73','Typed draft is written immediately, before closing');
 h=harness(folder,storage);eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:4,mode:'worksheet'});eq(h.doc.querySelector('[data-ws-input="1"]').value,'73');ok(h.doc.querySelector('[data-ws-input="0"]').disabled,'Completed worksheet input remains marked');
 h.run("startTask(4,4);state.zones={a:K.parts(12),b:K.parts(7),removed:K.empty()};render();mutate(()=>K.move(state.zones,'b','a','unit'));");h.input('#answer','19');const board=plain(h.run('state.zones'));
 h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index,demo:state.demo,mode:state.mode})'),{lesson:4,index:4,demo:false,mode:'play'});eq(h.run('state.zones'),board,'Partial physical board survives full restart');eq(h.doc.querySelector('#answer').value,'19','Typed answer survives full restart');
 h.run("state.zones={a:K.parts(isBuild()?task().answer:task().result),b:K.empty(),removed:!isBuild()&&task().op==='-'?K.parts(task().b):K.empty()};render();");h.input('#answer',String(h.run('task().answer')));h.run('checkAnswer();');ok(h.run("progress.solved['4:4']"));
 h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index,demo:state.demo})'),{lesson:4,index:5,demo:false},'Completed current task advances to the next unfinished task on restart');
 h.run("state.mode='learn';state.step=2;render();");h=harness(folder,storage);eq(h.run('({mode:state.mode,step:state.step})'),{mode:'learn',step:2},'Explanation mode and step survive restart');
 h.run("startTask(35,17);progress.solved['35:17']=true;state.solved=true;render();");h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index})'),{lesson:36,index:0},'The route moves forward into the next lesson');
 h.run("startTask(36,17);progress.solved['36:17']=true;state.solved=true;render();");h=harness(folder,storage);eq(h.run('state.view'),'progress','Reaching the route end never wraps back to easy tasks');
 const legacy={solved:{'1:0':true,'4:0':true,'4:2':true},read:[4],lastLesson:4};storage={[key]:JSON.stringify(legacy)};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index,demo:state.demo})'),{lesson:4,index:1,demo:false},'Legacy progress resumes within lastLesson rather than earlier holes');eq(h.run('allSolved()'),3,'Migration retains previous achievements');
 h.click({practice:'0'});ok(h.html().includes('Это задание уже решено'),'Manual repeat explains completed status');ok(h.html().includes('task-route-item done current'),'The task map distinguishes completed/current');eq(h.run('state.solved'),false,'Manual repeat remains interactive');h.input('#answer','7');h=harness(folder,storage);eq(h.run('state.index'),0,'An unfinished intentional repeat is restored');eq(h.doc.querySelector('#answer').value,'7');eq(h.run('allSolved()'),3,'Opening a repeat never removes achievements');
 h.click({action:'reset'});eq(h.doc.querySelector('#answer').value,'','Reset clears the visible and saved answer');h=harness(folder,storage);eq(h.doc.querySelector('#answer').value,'','Reset survives restart');
 h.run("state.mode='worksheet';render();");h.input('[data-ws-input="5"]','101');h.click({view:'progress'});h.click({view:'trainer'});eq(h.run('state.mode'),'worksheet');eq(h.doc.querySelector('[data-ws-input="5"]').value,'101','Opening My Progress and continuing keeps worksheet drafts');
 storage={[key]:JSON.stringify({...legacy,session:{version:1,lesson:4,mode:'play',index:5,demo:false,zones:{a:{unit:100000},b:{},removed:{}}}})};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index})'),{lesson:4,index:1},'Malformed oversized sessions fall back to valid achievements');
 h=harness(folder,{},true);ok(h.run('memory'),'Unavailable local storage does not crash practice');h.run('startTask(2,3);render();');eq(h.run('state.index'),3);
 const all={};for(let l=1;l<=36;l++)for(let i=0;i<18;i++)all[l+':'+i]=true;h=harness(folder,{[key]:JSON.stringify({solved:all,read:[],lastLesson:36})});eq(h.run('state.view'),'progress','A fully completed legacy course stays complete');eq(h.run('allSolved()'),648);
}
const shared={};harness('kubiki',shared).run('startTask(5,3);render();');harness('bricks',shared).run('startTask(8,7);render();');eq(harness('kubiki',shared).run('({lesson:state.lesson,index:state.index})'),{lesson:5,index:3});eq(harness('bricks',shared).run('({lesson:state.lesson,index:state.index})'),{lesson:8,index:7});
console.log(JSON.stringify({checks,trainers:2,immediateDraftSaving:true,fullRestartResume:true,legacyMigration:true,forwardOnly:true,independentKeys:true}));
