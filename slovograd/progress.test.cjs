'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=__dirname+'/';
const plain=value=>JSON.parse(JSON.stringify(value));
const toKey=name=>name.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
let assertions=0,scenarios=0;
function ok(value,message){assert.ok(value,message);assertions++;}
function eq(actual,expected,message){assert.deepEqual(plain(actual),plain(expected),message);assertions++;}
function harness(storage={}){
 const listeners={},classList={add(){},remove(){},toggle(){},contains(){return false;}};
 const makeNode=()=>({innerHTML:'',textContent:'',dataset:{},classList,style:{},focus(){},scrollIntoView(){},addEventListener(){},setAttribute(){},getAttribute(){return null;},setSelectionRange(){}});
 const nodes={'#app':makeNode(),'#overlay':makeNode(),'#live':makeNode(),'.lesson-title':makeNode(),'.lesson-card':makeNode(),'.lesson-screen':makeNode(),'.exercise-card':makeNode()};
 const document={activeElement:null,head:{innerHTML:fs.readFileSync(path+'index.html','utf8').match(/<head>([\s\S]*?)<\/head>/)[1]},querySelector:s=>nodes[s]||null,querySelectorAll:()=>[],addEventListener(name,callback){(listeners[name]??=[]).push(callback);},body:{append(){}},createElement:()=>({click(){},remove(){},style:{},setAttribute(){}})};
 const calls={speak:[],disposed:0,listening:null,recording:null};
 const voice={capabilities:()=>({tts:true,recognition:true,recording:true}),speak(text,options){calls.speak.push({text,options});return true;},stopSpeech(){},listen(options){calls.listening=options;return true;},stopListening(){},async startRecording(options){calls.recording=options;return true;},stopRecording(){},dispose(){calls.disposed++;}};
 let capturedBlob=null;
 const w={RusVoice:voice,scrollTo(){},matchMedia(){return{matches:true};},addEventListener(){}};
 const context=vm.createContext({window:w,document,localStorage:{getItem:key=>storage[key]||null,setItem:(key,value)=>{storage[key]=value;}},console,Blob,URL:Object.assign(class extends URL {},{createObjectURL(blob){capturedBlob=blob;return'blob:test';},revokeObjectURL(){}}),setTimeout(){return 1;},clearTimeout(){},location:{protocol:'https:',href:'https://nashpatriot67.github.io/detskie-trenazhery/slovograd/'},fetch:async name=>({ok:true,text:async()=>fs.readFileSync(path+name,'utf8')})});
 for(const file of ['../learning-progress.js','words.js','sentences.js','creative.js','illustrations.js','core.js','lessons.js']){
  if(!fs.existsSync(path+file))throw new Error('Lesson integration is not ready: missing '+file);
  vm.runInContext(fs.readFileSync(path+file,'utf8'),context,{filename:file});
 }
 vm.runInContext(fs.readFileSync(path+'app.js','utf8'),context,{filename:'app.js'});
 const run=code=>vm.runInContext(code,context);
 function element(dataset,extra={}){const el={dataset,disabled:false,...extra};el.closest=selector=>{if(selector.includes('button')||selector==='a')return el;const m=selector.match(/^\[data-([a-z-]+)\]$/);if(m&&Object.hasOwn(dataset,toKey(m[1])))return el;if(selector==='li')return makeNode();return null;};return el;}
 function click(dataset){const el=element(dataset);for(const handler of listeners.click||[])handler({target:el,preventDefault(){},stopPropagation(){}});}
 function change(control,value){const el=element({control},{value:String(value)});for(const handler of listeners.change||[])handler({target:el});}
 function input(text){const el=element({input:'draft'},{value:text});for(const handler of listeners.input||[])handler({target:el});}
 // Existing lesson regressions use explicit free practice; guided-route and normal-grade tests pass free:false,harder:false.
 function enter(view,{mode,topic='all',category='all',id,read=false,grade=2,free=true,harder=false}={}){
  run(`state.grade=${grade};state.sound=false;state.spellingFree=${free};state.harder=${harder};go(${JSON.stringify(view)});`);
  if(mode)click({mode});
  if(topic!=='all')change('topic',topic);
  if(category!=='all')change('category',category);
  if(id)run(`state.index[source()]=list().findIndex(t=>t.id===${JSON.stringify(id)});if(state.index[source()]<0)throw Error('Missing test fixture');prepare();render();`);
  if(read)ack();
 }
 function ack(){let guard=0;while(run('Boolean(state.lesson)')){if(++guard>10)throw Error('Lesson acknowledgement loop');run('acknowledgeLesson();');}run('render();');}
 const html=()=>nodes['#app'].innerHTML;
 const work=()=>plain(run('({id:current()?.id,index:state.index[source()]||0,draft:state.draft,marks:state.marks,zero:state.zero,assembled:state.assembled,bank:state.bank,choices:state.choices,plan:state.plan,turn:state.turn,chat:state.chat,nonce:state.nonce})'));
 return {context,run,click,change,input,enter,ack,html,work,storage,nodes,calls,plan(i,checked){const target=element({plan:String(i)},{checked});for(const handler of listeners.change||[])handler({target});},getBlob:()=>capturedBlob};
}
function reload(h){return harness(h.storage);}
function snapshot(h){return plain(h.run('({view:state.view,grade:state.grade,mode:state.mode[state.view],topic:state.topic,category:state.category,id:current()?.id,index:state.index[source()],nonce:state.nonce,draft:state.draft,marks:state.marks,zero:state.zero,assembled:state.assembled,bank:state.bank,choices:state.choices,plan:state.plan,brush:state.brush,turn:state.turn,chat:state.chat,lesson:state.lesson?.reason})'));}
function solveWord(h){h.ack();h.run(`if(state.mode.spelling==='construct'){state.assembled=[];for(const letter of current().word){const tile=state.bank.find(t=>t.text===letter&&!state.assembled.includes(t.id));state.assembled.push(tile.id);}}else state.draft=current().word;check();`);}
// Reopening a half-built word restores the same tile identities, including traps.
{
 const h=harness();h.enter('spelling',{free:false,harder:false,grade:1,read:true});h.click({letter:String(h.run('state.bank[0].id'))});h.click({letter:String(h.run('state.bank[1].id'))});const before=snapshot(h);eq(snapshot(reload(h)),before,'Partial constructor survives a new application instance');scenarios++;
}
// Solving and closing without pressing Next resumes the next uncompleted word.
{
 const h=harness();h.enter('spelling',{free:false,harder:false,grade:2,read:true});const id=h.run('current().id');solveWord(h);const next=reload(h);ok(next.run('current().id')!==id,'A solved word is not presented as the starting word again');eq(next.run('Object.keys(progress.spellingCourse.done).length'),1,'The result survives automatic advancement');scenarios++;
}
// The final word of a stage advances to Write, and the next rule follows Dictation.
{
 const h=harness();h.enter('spelling',{free:false,harder:false,grade:1,read:true});h.run(`{const stage=courseStage();for(const t of stage.tasks.slice(0,-1))progress.spellingCourse.done[state.grade+':'+stage.mode+':'+t.id]=true;state.index.spelling=stage.tasks.length-1;prepare();render();}`);solveWord(h);const next=reload(h);eq(next.run('state.mode.spelling'),'write','A completed construct stage resumes writing the same rule');eq(next.run('state.courseCategory'),h.run('state.courseCategory'));
 next.ack();next.run(`{const unit=courseUnit();for(const stage of unit.stages)for(const t of stage.tasks)progress.spellingCourse.done[state.grade+':'+stage.mode+':'+t.id]=true;state.mode.spelling='dictation';state.index.spelling=unit.stages[2].tasks.length-1;prepare();render();}`);solveWord(next);const following=reload(next);ok(following.run('state.courseCategory')!==next.run('state.courseCategory'),'A complete dictation stage resumes the following rule');eq(following.run('state.mode.spelling'),'construct');scenarios++;
}
// Filters, exercise index, selected brush and morpheme work remain together.
{
 const h=harness();h.enter('morphology',{topic:'prefix',read:true});h.change('exercise',3);h.ack();h.click({brush:'prefix'});h.click({mark:'0'});h.click({mark:'1'});const before=snapshot(h);eq(snapshot(reload(h)),before,'A filtered morpheme task restores its work');h.run("go('creative')");h.ack();h.input('Пушистый котёнок уснул.');h.run("go('morphology')");eq(snapshot(h),before,'Returning from another section restores the morpheme scope');scenarios++;
}
// Creative choices, text and self-check boxes are saved before closing a page.
{
 const h=harness();h.enter('creative',{read:true});h.click({choice:'0:1'});h.input('Тихий ветер шевелит листву.');h.plan(0,true);const before=snapshot(h);eq(snapshot(reload(h)),before,'Creative text and the first checked plan item persist without a render');h.run("go('builder');");h.ack();h.run("go('creative');");eq(snapshot(h),before,'Creative scope survives section navigation');scenarios++;
}
// A partially ordered sentence is not shuffled or emptied on a later opening.
{
 const h=harness();h.enter('builder',{read:true});h.click({chunk:String(h.run('state.bank[0]'))});h.click({chunk:String(h.run('state.bank[1]'))});eq(snapshot(reload(h)),snapshot(h),'Builder cards restore in their previous order');scenarios++;
}
// Dialogue turns and text are retained; audio objects are deliberately excluded.
{
 const h=harness();h.enter('dialogues',{read:true});h.input('Я люблю читать интересные книги.');h.click({action:'dialog-send'});h.input('Однажды я увидел');const before=snapshot(h);eq(snapshot(reload(h)),before,'Dialogue turn, conversation and unfinished reply persist');ok(!JSON.stringify(h.run('progress.resume')).includes('blob:'),'No recorded binary/audio URL is stored');scenarios++;
}
// Closing on mandatory remediation cannot bypass it or lose the wrong answer.
{
 const h=harness();h.enter('spelling',{mode:'write',category:'ЖИ–ШИ',id:'sp1',read:true});h.input('машына');h.click({action:'check'});eq(h.run('state.lesson.reason'),'mistake');const before=snapshot(h),next=reload(h);eq(snapshot(next),before,'The wrong draft and required rule are restored together');next.click({action:'next'});eq(snapshot(next),before,'The gate still blocks navigation');next.ack();eq(next.run('state.draft'),'машына','Reading the rule returns to the retained answer');scenarios++;
}
// The same sentence in base/full modes and different grades has separate marks.
{
 const h=harness();h.enter('syntax',{mode:'base',read:true,grade:2,harder:false});h.run(`state.marks=current().roles.map(r=>['subject','predicate'].includes(r)?r:'');check();`);const id=h.run('current().id');eq(h.run('taskCompleted(current())'),true);ok(h.html().includes('✓ 1.'),'The task selector exposes its completed mark');h.click({mode:'full'});h.ack();h.run(`state.index.syntax=list().findIndex(t=>t.id===${JSON.stringify(id)});prepare();render();`);eq(h.run('taskCompleted(current())'),false,'A base answer does not complete full analysis');h.change('grade',1);h.ack();eq(h.run('taskCompleted(current())'),false,'Grade two does not complete grade one');h.change('grade',2);h.ack();h.click({mode:'base'});h.ack();ok(h.run(`progress.completions['2:syntax:base:${id}']===true`),'Original mode mark is retained');scenarios++;
}
// Returning to a mode resumes its own unfinished word, rather than index zero.
{
 const h=harness();h.enter('spelling',{mode:'write',read:true});h.change('exercise',4);h.ack();h.input('незакончено');const before=snapshot(h);h.click({mode:'dictation'});h.ack();h.change('exercise',2);h.ack();h.input('другой черновик');h.click({mode:'write'});h.ack();eq(snapshot(h),before,'Each free spelling mode owns its cursor and draft');scenarios++;
}
// Legacy counts remain visible without marking every new mode as completed.
{
 const saved={grade:2,done:{'morphology:m1':true,'morphology:m2':true,'spelling:sp1':true},creations:[{id:'old',text:'Светит яркое солнце.'}]};const h=harness({'slovograd-v1':JSON.stringify(saved)});h.run("go('morphology')");h.ack();eq(h.run('Object.keys(progress.done).length'),3);eq(h.run('progress.creations.length'),1);eq(h.run('Object.keys(progress.completions).length'),0);ok(h.html().includes('◇'),'Historical results remain identifiable');h.click({action:'confirm-reset'});const next=reload(h);eq(next.run('Object.keys(progress.done).length'),0);ok(next.run('progress.resume.lastStudy===undefined'),'Explicit full reset does not resurrect the prior session');scenarios++;
}
// A completed set stays completed on a new opening; manual repetition keeps marks.
{
 const h=harness();h.enter('builder',{topic:'foundation',read:true});h.run(`for(const t of list())progress.completions[completionKey(t)]=true;state.solved=true;render();`);h.click({action:'next'});ok(h.html().includes('Все задания получились!'),'Finishing a set shows its completion screen');ok(reload(h).html().includes('Все задания получились!'),'A finished set does not loop back to the easiest task');const marks=h.run('Object.keys(progress.completions).length');h.click({action:'repeat-practice'});eq(h.run('state.repeating'),true);eq(h.run('Object.keys(progress.completions).length'),marks,'Manual repetition retains every achievement');scenarios++;
}
// A legacy result-only save resumes a relevant unfinished task without new credits.
{
 const saved={grade:2,done:{'builder:b1':true,'builder:b2':true},creations:[]};const h=harness({'slovograd-v1':JSON.stringify(saved)});eq(h.run('state.view'),'builder','Legacy saves resume the last recognised section');eq(h.run('Object.keys(progress.completions).length'),0,'Migration does not fabricate scoped completion');ok(h.run('!progress.done[key()]'),'The initial position avoids already marked legacy tasks');scenarios++;
}
// Storage failures leave practice usable instead of stopping at startup.
{
 const h=harness();h.run(`localStorage.setItem=()=>{throw Error('quota');};go('builder');`);h.ack();h.click({chunk:String(h.run('state.bank[0]'))});eq(h.run('state.assembled.length'),1);eq(h.run('memory'),true);scenarios++;
}
// Malformed session fields are ignored while valid historical results survive.
{
 const saved={grade:2,done:{'spelling:sp1':true},resume:{version:1,current:{view:'not-a-section',grade:9},contexts:[],sections:null}};const h=harness({'slovograd-v1':JSON.stringify(saved)});eq(h.run('state.view'),'spelling');eq(h.run('Object.keys(progress.done).length'),1);scenarios++;
}
console.log(JSON.stringify({scenarios,assertions,storageKey:'slovograd-v1',exactSessionResume:true,scopedCompletions:true,legacyPreserved:true},null,2));
