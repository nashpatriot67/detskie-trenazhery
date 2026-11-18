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
 const app=node({dataset:{},prepend(){}});let html='';Object.defineProperty(app,'innerHTML',{get(){return html;},set(value){html=value;delete nodes['#answer'];fields=[];for(const match of html.matchAll(/<input\b[^>]*>/g)){const tag=match[0],value=tag.match(/\bvalue="([^"]*)"/)?.[1]||'',disabled=/\bdisabled\b/.test(tag),index=tag.match(/\bdata-ws-input="(\d+)"/)?.[1];if(tag.includes('id="answer"'))nodes['#answer']=node({id:'answer',value,disabled});if(index!==undefined)fields.push(node({dataset:{wsInput:index},value,disabled}));}}});nodes['#app']=app;
 const doc={createElement(){return node();},activeElement:null,visibilityState:'visible',querySelector(selector){if(nodes[selector])return nodes[selector];const index=selector.match(/^\[data-ws-input="(\d+)"\]$/)?.[1];return index===undefined?null:fields.find(el=>el.dataset.wsInput===index)||null;},querySelectorAll(selector){if(selector.startsWith('[data-ws-input]'))return selector.includes(':not(:disabled)')?fields.filter(el=>!el.disabled):fields;return [];},addEventListener(name,fn){(listeners[name]??=[]).push(fn);},body:{append(){}},head:{innerHTML:''}};
 const context=vm.createContext({document:doc,localStorage:{getItem(key){if(denyStorage)throw Error('storage disabled');return storage[key]||null;},setItem(key,value){if(denyStorage)throw Error('storage disabled');storage[key]=value;}},window:{scrollTo(){},matchMedia(){return {matches:true};},addEventListener(){}},MutationObserver:class{observe(){}},setTimeout(){},console,URL,Blob});
 vm.runInContext(fs.readFileSync(path.join(root,'math-range.js'),'utf8'),context,{filename:'math-range.js'});
 for(const name of ['engine.js','course.js'])vm.runInContext(fs.readFileSync(path.join(root,folder,name),'utf8'),context,{filename:name});context.COURSE=context.window.COURSE;
 for(const shared of ['learning-progress.js','place-value.js','place-value-motion.js','place-value-activities.js'])vm.runInContext(fs.readFileSync(path.join(root,shared),'utf8'),context,{filename:shared});
 vm.runInContext(fs.readFileSync(path.join(root,folder,'app.js'),'utf8'),context,{filename:folder+'/app.js'});
 const run=code=>vm.runInContext(code,context);
 function input(selector,text){const el=doc.querySelector(selector);assert.ok(el,selector);el.value=text;for(const fn of listeners.input||[])fn({target:el});}
 function click(dataset){const el={dataset,closest(selector){return selector==='button,a'?el:null;}};for(const fn of listeners.click||[])fn({target:el,preventDefault(){}});}
 return {run,input,click,storage,doc,html:()=>html};
}

function finishLearn(h){let guard=0;while(h.run("state.mode==='learn'")){if(++guard>20)throw Error('Explanation loop');h.click({action:'learn-next'});}}
function solveBoard(h){h.run("state.zones={a:K.parts(isBuild()?task().answer:task().result),b:K.empty(),removed:!isBuild()&&task().op==='-'?K.parts(task().b):K.empty()};render();");h.input('#answer',String(h.run('task().answer')));h.click({action:'check'});}
function fillNotebook(h){for(let i=0;i<16;i++){const field=h.doc.querySelector('[data-ws-input="'+i+'"]');if(field&&!field.disabled)h.input('[data-ws-input="'+i+'"]',String(h.run('tasks()['+i+'].answer')));}h.click({action:'check-worksheet'});}
function marksFor(id){return Object.fromEntries(Array.from({length:18},(_,i)=>[id+':'+i,true]));}
for(const [folder,key]of [['kubiki','kubiki-progress-v1'],['bricks','detalki-progress-v1']]){
 let storage={},h=harness(folder,storage);
 eq(h.run('({lesson:state.lesson,mode:state.mode,step:state.step})'),{lesson:1,mode:'learn',step:0},folder+': a new lesson begins with explanation');
 h.click({action:'learn-next'});h=harness(folder,storage);eq(h.run('({mode:state.mode,step:state.step})'),{mode:'learn',step:1},'Explanation mode and step survive restart');
 finishLearn(h);eq(h.run('({mode:state.mode,index:state.index,demo:state.demo})'),{mode:'play',index:0,demo:false});
 ok(h.run('progress.read.includes(1)'),'Finishing explanation records only its own stage');
 // A complete course exercises every stage transition and every source task.
 let routeTasks=0;
 for(let lessonId=1;lessonId<=36;lessonId++){
  if(lessonId>1){eq(h.run('({lesson:state.lesson,mode:state.mode,step:state.step})'),{lesson:lessonId,mode:'learn',step:0},'A completed notebook opens explanation of the next lesson');finishLearn(h);}
  for(let i=0;i<18;i++){
   eq(h.run('({lesson:state.lesson,mode:state.mode,index:state.index})'),{lesson:lessonId,mode:'play',index:i});solveBoard(h);routeTasks++;
   if(i<17)h.click({action:'next-task'});
  }
  eq(h.run('({lesson:state.lesson,mode:state.mode,board:state.worksheetTask})'),{lesson:lessonId,mode:'worksheet',board:false},'The last correct game answer opens the same notebook immediately');
  eq(h.run("modeCount(state.lesson,'play')"),18);eq(h.run("modeCount(state.lesson,'worksheet')"),0,'Game does not complete notebook answers');
  ok(!h.doc.querySelector('[data-ws-input="0"]').disabled,'Notebook remains independently answerable after game');
  if(lessonId===1){h=harness(folder,storage);eq(h.run('state.mode'),'worksheet','Restart at the game boundary stays in notebook');}
  fillNotebook(h);eq(h.run("modeCount(state.lesson,'worksheet')"),16);eq(h.run('lessonComplete(state.lesson)'),false,'Both notebook assemblies are required');
  for(let i=16;i<18;i++){
   h.click({practice:String(i),owner:'worksheet'});eq(h.run('({mode:state.mode,board:state.worksheetTask})'),{mode:'worksheet',board:true});solveBoard(h);routeTasks++;
  }
  ok(h.run('lessonComplete('+lessonId+')'),'Lesson complete requires all three stages');if(lessonId===1){h=harness(folder,storage);eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:2,mode:'learn'},'Restart after notebook end retains next explanation');}
 }
 eq(routeTasks,720);eq(h.run('state.view'),'progress','Only the completed final notebook ends the course');eq(h.run('allSolved()'),648,'Historical unique-task counter is retained rather than doubled');
 eq(h.run("Object.keys(progress.modeSolved.play).length"),648);eq(h.run("Object.keys(progress.modeSolved.worksheet).length"),648);
 h=harness(folder,storage);eq(h.run('state.view'),'progress','A fully completed course never wraps to the first easy lesson');
 // Partial notebook drafts, completed answers and owner survive full restart.
 storage={};h=harness(folder,storage);h.click({mode:'worksheet'});h.input('[data-ws-input="0"]',String(h.run('tasks()[0].answer')));h.click({action:'check-worksheet'});h.input('[data-ws-input="1"]','73');
 let saved=JSON.parse(storage[key]);eq(saved.session.mode,'worksheet');eq(saved.worksheet['1']['1'],'73','Input writes immediately before closing');
 h=harness(folder,storage);eq(h.run('state.mode'),'worksheet');eq(h.doc.querySelector('[data-ws-input="1"]').value,'73');ok(h.doc.querySelector('[data-ws-input="0"]').disabled,'Completed notebook input remains marked');eq(h.run("modeCount(1,'play')"),0,'Notebook does not complete a game task');
 h.click({practice:'16',owner:'worksheet'});h.run('mutate(()=>K.move(state.zones,"bank","a","unit"));');h.input('#answer','19');const board=plain(h.run('state.zones'));
 h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index,mode:state.mode,board:state.worksheetTask})'),{lesson:1,index:16,mode:'worksheet',board:true});eq(h.run('state.zones'),board,'Partial notebook board survives full restart');eq(h.doc.querySelector('#answer').value,'19');
 h.click({mode:'play'});h=harness(folder,storage);eq(h.run('state.mode'),'play');h.click({mode:'worksheet'});eq(h.run('state.zones'),board,'Mode switch restores unfinished notebook assembly');eq(h.doc.querySelector('#answer').value,'19');
 // Helper boards for ordinary notebook tasks also credit the notebook owner.
 h.click({action:'back-worksheet'});h.click({practice:'2',owner:'worksheet'});solveBoard(h);ok(h.run("modeDone('worksheet',1,2)"));eq(h.run("modeDone('play',1,2)"),false);h.click({action:'next-task'});eq(h.run('({mode:state.mode,board:state.worksheetTask})'),{mode:'learn',board:false},'Automatic route cannot skip missing explanation after free practice');
 // An incorrect final answer cannot unlock the notebook or the next topic.
 let wrongHarness=harness(folder,{});wrongHarness.run("progress.read.push(1);for(let i=0;i<17;i++)markModeDone('play',1,i);startTask(1,17);render();");wrongHarness.input('#answer',String(wrongHarness.run('task().answer+1')));wrongHarness.click({action:'check'});eq(wrongHarness.run('({lesson:state.lesson,mode:state.mode,index:state.index})'),{lesson:1,mode:'play',index:17});eq(wrongHarness.run("modeCount(1,'worksheet')"),0,'Wrong answer never completes a later stage');
 // Restored stale tabs may close after the active document: their passive saves must not roll back its position or results.
 const multiStorage={},active=harness(folder,multiStorage),stale=harness(folder,multiStorage);active.run("progress.read.push(1);startTask(1,3);markModeDone('play',1,2);render();");active.input('#answer','17');const latest=multiStorage[key];stale.run('save(true);');eq(multiStorage[key],latest,'A stale passive close cannot overwrite a newer tab');eq(harness(folder,multiStorage).run('({mode:state.mode,index:state.index,answer:state.answer})'),{mode:'play',index:3,answer:'17'});ok(harness(folder,multiStorage).run("modeDone('play',1,2)"),'Passive close never loses newer achievements');
 // Deliberately using an older tab may move the cursor, but achievements are merged rather than overwritten.
 const activeStore={},newer=harness(folder,activeStore),older=harness(folder,activeStore);newer.run("markRead(1);markModeDone('play',1,0);startTask(1,1);render();");older.run("markModeDone('worksheet',1,2);startTask(1,2,false,'worksheet');render();");let combined=harness(folder,activeStore);ok(combined.run("modeDone('play',1,0)"));ok(combined.run("modeDone('worksheet',1,2)"));ok(combined.run('progress.read.includes(1)'));eq(combined.run('allSolved()'),2,'Independent active tabs retain both earned results');
 // A reset has a new epoch: an old tab's new answer must not resurrect its old achievements.
 const resetStore={},oldTab=harness(folder,resetStore);oldTab.run("markRead(1);markModeDone('play',1,0);startTask(1,1);render();");const resettingTab=harness(folder,resetStore);resettingTab.click({action:'confirm-reset-progress'});oldTab.run("markModeDone('worksheet',1,3);render();");combined=harness(folder,resetStore);eq(combined.run("modeDone('play',1,0)"),false,'Remote reset discards old-tab achievements');ok(combined.run("modeDone('worksheet',1,3)"),'A genuinely new answer after reset is retained');eq(combined.run('progress.read.includes(1)'),false,'Old read marks do not reappear after reset');eq(combined.run('allSolved()'),1);
 // Previous achievements are preserved as play history, never fake notebook credit.
 const legacy={solved:{'1:0':true,'4:0':true,'4:2':true},read:[4],lastLesson:4};storage={[key]:JSON.stringify(legacy)};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,mode:state.mode,index:state.index})'),{lesson:4,mode:'play',index:1},'Legacy migration respects lastLesson instead of earlier holes');eq(h.run('allSolved()'),3);eq(h.run("modeCount(4,'worksheet')"),0);
 h.click({practice:'0',owner:'play'});ok(h.html().includes('Это задание уже решено в этом режиме'));ok(h.html().includes('task-route-item done current'));ok(h.run('state.repeating'));h.input('#answer','7');h=harness(folder,storage);eq(h.run('state.index'),0,'Unfinished intentional repetition is restored');eq(h.doc.querySelector('#answer').value,'7');eq(h.run('allSolved()'),3);
 solveBoard(h);eq(h.run('({lesson:state.lesson,index:state.index,repeating:state.repeating})'),{lesson:4,index:0,repeating:true},'Correct repetition is not interrupted');h.click({action:'next-task'});eq(h.run('state.index'),1,'Explicit continue returns to unfinished route');
 h.click({action:'reset'});eq(h.doc.querySelector('#answer').value,'');h=harness(folder,storage);eq(h.doc.querySelector('#answer').value,'','Reset clears visible and saved answer');
 h.click({mode:'worksheet'});h.input('[data-ws-input="5"]','101');h.click({view:'progress'});h.click({view:'trainer'});eq(h.run('state.mode'),'worksheet');eq(h.doc.querySelector('[data-ws-input="5"]').value,'101','Progress view and Continue keep notebook drafts');
 // A version-1 board session survives migration, and its last game answer goes to notebook.
 const partialSession=plain(h.run('sessionSnapshot()'));partialSession.version=1;partialSession.lesson=8;partialSession.mode='play';partialSession.demo=false;partialSession.index=5;partialSession.answer='19';partialSession.solved=false;delete partialSession.worksheetTask;delete partialSession.repeating;
 storage={[key]:JSON.stringify({lastLesson:8,read:[8],solved:marksFor(8),session:partialSession})};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,mode:state.mode,index:state.index,answer:state.answer})'),{lesson:8,mode:'play',index:5,answer:'19'},'Unfinished v1 session is kept intact');
 partialSession.index=17;partialSession.solved=true;storage={[key]:JSON.stringify({lastLesson:8,read:[8],solved:marksFor(8),session:partialSession})};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:8,mode:'worksheet'},'Completed v1 final game resumes in same notebook');eq(h.run('allSolved()'),18);eq(h.run("modeCount(8,'worksheet')"),0);
 storage={[key]:JSON.stringify({...legacy,session:{version:2,lesson:4,mode:'play',index:5,demo:false,zones:{a:{unit:100000},b:{},removed:{}}}})};h=harness(folder,storage);eq(h.run('({lesson:state.lesson,index:state.index})'),{lesson:4,index:1},'Malformed oversized sessions fall back to valid achievements');
 h=harness(folder,{},true);ok(h.run('memory'),'Unavailable storage does not crash');h.run('startTask(2,3);render();');eq(h.run('state.index'),3);
 const all={};for(let l=1;l<=36;l++)Object.assign(all,marksFor(l));h=harness(folder,{[key]:JSON.stringify({solved:all,read:Array.from({length:36},(_,i)=>i+1),lastLesson:36})});eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:36,mode:'worksheet'},'All old game marks never fabricate notebook completion');eq(h.run('allSolved()'),648);
 // Completing notebook first must still require explanation and game before the next lesson.
 storage={};h=harness(folder,storage);h.click({mode:'worksheet'});fillNotebook(h);for(const i of [16,17]){h.click({practice:String(i),owner:'worksheet'});solveBoard(h);}eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:1,mode:'learn'});eq(h.run("modeCount(1,'play')"),0);finishLearn(h);eq(h.run('({lesson:state.lesson,mode:state.mode})'),{lesson:1,mode:'play'});
}
const shared={};harness('kubiki',shared).run('startTask(5,3);render();');harness('bricks',shared).run('startTask(8,7);render();');eq(harness('kubiki',shared).run('({lesson:state.lesson,index:state.index})'),{lesson:5,index:3});eq(harness('bricks',shared).run('({lesson:state.lesson,index:state.index})'),{lesson:8,index:7});
console.log(JSON.stringify({checks,trainers:2,fullCourseRoutes:2,independentModeLedgers:true,worksheetBoardOwnership:true,immediateDraftSaving:true,fullRestartResume:true,legacyMigration:true,independentKeys:true}));
