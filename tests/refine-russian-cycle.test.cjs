'use strict';
// Synthetic application-level integration: use the established real app harness
// with a contract-faithful shared host and a deterministic automatic clock.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const folder=path.resolve(__dirname,'../slovograd');
let source=fs.readFileSync(path.join(folder,'progress.test.cjs'),'utf8').split('// Reopening a half-built word')[0];
source=source.replace("'core.js','lessons.js']","'core.js','lessons.js','../concepts.js','../russian-journey.js','../russian-check.js']");
source=source.replace('const context=vm.createContext({',`const timers=new Map();let timerId=0;
 calls.gates=[];calls.boundaries=[];calls.gateDone={};calls.active=null;calls.breakReady=false;
 w.PracticeHub={
  mount(config){calls.mount=config;},
  isOpen(){return !!calls.active;},
  requireConcepts(config){if(!calls.mount||calls.gateDone[config.id])return false;calls.active='gate';calls.gate=config;calls.gates.push(plain(config));calls.mount.beforeOpen();return true;},
  cycleBoundary(config){calls.boundaries.push(plain(config));if(!calls.breakReady)return false;calls.active='break';calls.boundary=config;return true;},
  completeGate(){const config=calls.gate;calls.gateDone[config.id]=true;calls.active=null;calls.mount.onConceptGateComplete(config.context);},
  cancelGate(){const config=calls.gate;calls.active=null;calls.mount.onConceptGateCancel(config.context);},
  finishBreak(){const config=calls.boundary;calls.breakReady=false;calls.active=null;calls.mount.onCycleContinue(config.context);}
 };
 w.__advance=()=>{for(const [id,task]of [...timers])if(task.ms===2400){timers.delete(id);task.callback();}};
 w.__pendingAdvance=()=>[...timers.values()].filter(task=>task.ms===2400).length;
 const context=vm.createContext({`);
source=source.replace('setTimeout(){return 1;},clearTimeout(){},','setTimeout(callback,ms){const id=++timerId;timers.set(id,{callback,ms});return id;},clearTimeout(id){timers.delete(id);},');
const {harness}=new Function('require','__dirname',source+'; return {harness};')(require,folder);
let checks=0,scenarios=0;const eq=(a,b,m)=>{assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
function test(name,fn){fn();scenarios++;console.log(JSON.stringify({name,pass:true}));}
function known(h){h.run('for(const [id,unit]of Object.entries(L))progress.lessonRead[id]=unit.version;');}
function completeGate(h){ok(h.calls.active==='gate');h.run('window.PracticeHub.completeGate();');}
function solveWord(h){h.run("if(state.mode.spelling==='construct'){state.assembled=[];for(const letter of current().word){const tile=state.bank.find(x=>x.text===letter&&!state.assembled.includes(x.id));state.assembled.push(tile.id);}}else state.draft=current().word;check();");}
function auto(h){h.run('window.__advance();');}
function clearMeaning(h){if(h.run('!!state.meaning&&!state.meaning.finished')){h.run('state.meaning.open=true;');h.run('answerMeaning(state.meaning.options.findIndex(x=>K.norm(x)===K.norm(state.meaning.correct)));');}}

test('existing-theory-first-then-three-related-cards-before-live-word',()=>{const h=harness();h.enter('spelling',{free:false,grade:1});eq(h.run('state.lesson.reason'),'initial');eq(h.calls.active,null,'Theory precedes concepts');h.ack();eq(h.calls.active,'gate');eq(h.run('progress.resume.contexts[resumeScope()].lesson'),null,'Cleared theory saved before shared host writes');eq(h.calls.gate.topicId,'russian.lesson.spell-zhishi');eq(h.calls.gate.taskIds.length,3);ok(h.html().includes('Три маленьких шага'));const id=h.run('current().id');solveWord(h);eq(h.run('state.solved'),false,'Check cannot bypass cancelled or hidden gate');eq(h.run('Object.keys(progress.completions).length'),0);completeGate(h);eq(h.run('current().id'),id);ok(h.html().includes('Буквенная мастерская'));solveWord(h);eq(h.run('state.solved'),true);});

test('closing-concept-study-stops-safely-and-resumes-exact-draft',()=>{const h=harness();known(h);h.enter('spelling',{mode:'write',grade:2,id:'sp1'});eq(h.calls.active,'gate');h.run("state.draft='мой черновик';rememberSession();");const attempt=h.run('state.attempt.attemptId'),id=h.run('current().id');h.run('window.PracticeHub.cancelGate();');eq(h.run('state.view'),'home');h.run("go('spelling');");eq(h.run('current().id'),id);eq(h.run('state.draft'),'мой черновик');eq(h.run('state.attempt.attemptId'),attempt);eq(h.calls.active,'gate');completeGate(h);eq(h.run('state.draft'),'мой черновик');eq(h.run('state.attempt.attemptId'),attempt);});

test('an-acknowledged-initial-theory-snapshot-is-not-resurrected',()=>{const h=harness();h.enter('spelling',{free:false,read:true});const record=JSON.parse(h.storage['slovograd-v1']),scope=h.run('resumeScope()');record.resume.contexts[scope].lesson={id:'spell-zhishi',parentId:'spell-zhishi',reason:'initial',contextKey:h.run('key()')};h.storage['slovograd-v1']=JSON.stringify(record);const resumed=harness(h.storage);eq(resumed.run('state.lesson'),null);eq(resumed.calls.active,'gate');completeGate(resumed);ok(resumed.html().includes('Буквенная мастерская'));});

test('mixed-morphology-gets-its-real-prerequisite-not-only-root-and-ending',()=>{const h=harness();known(h);h.enter('morphology',{read:true});if(h.calls.active==='gate')completeGate(h);h.run("state.index.morphology=list().findIndex(x=>K.morphemeStructure(x)==='full');prepare();render();");eq(h.calls.gate.topicId,'russian.lesson.morph-full');completeGate(h);h.run("state.index.morphology=list().findIndex(x=>K.morphemeStructure(x)==='suffix');prepare();render();");eq(h.calls.gate.topicId,'russian.lesson.morph-suffix');});

test('correct-auto-next-retains-feedback-dwell-and-errors-do-not-advance',()=>{const h=harness();known(h);h.enter('spelling',{mode:'write',id:'sp1',read:true});completeGate(h);const id=h.run('current().id');h.input('машына');h.click({action:'check'});eq(h.run('state.solved'),false);eq(h.run('window.__pendingAdvance()'),0);auto(h);eq(h.run('current().id'),id);h.ack();solveWord(h);eq(h.run('state.solved'),true);eq(h.run('current().id'),id,'Feedback stays until timer');eq(h.run('window.__pendingAdvance()'),1);clearMeaning(h);auto(h);ok(h.run('current().id')!==id);});

test('automatic-meaning-probe-waits-for-child-after-error',()=>{const h=harness();known(h);h.enter('spelling',{mode:'write',id:h.run('D.spelling.find(x=>x.checkWord).id'),read:true});completeGate(h);solveWord(h);const id=h.run('current().id');auto(h);eq(h.run('state.meaning.open'),true);eq(h.run('window.__pendingAdvance()'),0);h.run('answerMeaning(state.meaning.options.findIndex(x=>K.norm(x)!==K.norm(state.meaning.correct)));');auto(h);eq(h.run('current().id'),id);eq(h.run('state.meaning.finished'),false);h.run('answerMeaning(state.meaning.options.findIndex(x=>K.norm(x)===K.norm(state.meaning.correct)));');auto(h);ok(h.run('current().id')!==id);});

test('construct-write-dictation-next-rule-remains-automatic-with-a-boundary-before-mode-change',()=>{const h=harness();h.enter('spelling',{free:false,grade:1,read:true});completeGate(h);
 function lastOfMode(){h.run('{const stage=courseStage();for(const t of stage.tasks.slice(0,-1))progress.spellingCourse.done[state.grade+":"+stage.mode+":"+t.id]=true;state.index.spelling=stage.tasks.length-1;prepare();render();}');h.ack();if(h.calls.active==='gate')completeGate(h);solveWord(h);clearMeaning(h);auto(h);}
 const category=h.run('state.courseCategory');h.calls.breakReady=true;lastOfMode();eq(h.calls.active,'break');eq(h.run('state.mode.spelling'),'construct','No transition under active pause');ok(h.calls.boundary.id.startsWith('rus.cycle.1.spell-'));h.run('window.PracticeHub.finishBreak();');eq(h.run('state.mode.spelling'),'write');eq(h.run('state.courseCategory'),category);lastOfMode();eq(h.run('state.mode.spelling'),'dictation');eq(h.run('state.courseCategory'),category);lastOfMode();eq(h.run('state.mode.spelling'),'construct');ok(h.run('state.courseCategory')!==category);eq(h.run('state.lesson.reason'),'initial','New topic starts with its own existing theory');h.ack();eq(h.calls.active,'gate');eq(h.calls.gate.topicId,'russian.lesson.spell-chashcha');});

test('automatic-transition-is-stopped-when-child-leaves-or-overlay-opens',()=>{const h=harness();known(h);h.enter('builder',{read:true});completeGate(h);const id=h.run('current().id');h.run('state.assembled=[...current().order];check();');h.calls.active='assessment';auto(h);eq(h.run('current().id'),id);h.calls.active=null;h.run('scheduleRussianAdvance();');h.run("go('home');");auto(h);eq(h.run('state.view'),'home');});

test('real-app-mount-exposes-only-compatible-assessment-and-boundary-contract',()=>{const h=harness();eq(h.calls.mount.trainerId,'slovograd');eq(h.calls.mount.subject,'russian');eq(h.calls.mount.storageKey,'slovograd-v1');eq(h.run('window.PracticeHub!==undefined'),true);ok(h.calls.mount.assessment===h.context.window.RussianCheck);eq(typeof h.calls.mount.onCycleContinue,'function');eq(typeof h.calls.mount.onConceptGateComplete,'function');});
console.log(JSON.stringify({success:true,scenarios,checks,productionAccess:false,syntheticDataOnly:true}));
