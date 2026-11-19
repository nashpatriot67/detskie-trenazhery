'use strict';
// Explicit prerequisites for the old, focused P0 / Stage-1 acceptance suites.
// New mandatory gates have separate refine-*-browser tests. This fixture writes
// only synthetic localhost progress before the application loads; no production
// code, checks, numeric answers, task models or existing observations are changed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});context.window=context;
for(const file of ['learning-progress.js','concepts.js','kubiki/course.js','math-journey.js','slovograd/lessons.js','russian-journey.js','learning-journey.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
context.MathJourney.register(context.ConceptTrainer,context.COURSE);
const math=context.MathJourney.coverage(context.COURSE).concat(['build','read','exchange','arithmetic'].map(kind=>context.MathJourney.pvGate({kind}))).filter(Boolean);
const russian=context.RussianJourney.bank.topics.flatMap(topic=>[1,2].map(grade=>context.RussianJourney.gateFor({grade,lessonId:topic.id.replace(/^russian\.lesson\./,'')}))).filter(Boolean);
function template(subject,list){const journey=context.LearningJourney.create({subject,grade:2,generation:'initial'});for(const gate of list)journey.gates[gate.id]={status:'completed',revision:1,assisted:false,afterError:false,checkedAt:1};const learning=context.LearningProgress.setModule(context.LearningProgress.empty('initial'),'journey',journey,{ownerId:'legacy-ui-synthetic-fixture',updatedAt:1});return JSON.parse(JSON.stringify(learning.modules.journey));}
const specification={keys:{'kubiki-progress-v1':'math','detalki-progress-v1':'math','slovograd-v1':'russian'},templates:{math:template('math',math),russian:template('russian',russian)}};
function seed(spec){
 const object=v=>v&&typeof v==='object'&&!Array.isArray(v),copy=v=>JSON.parse(JSON.stringify(v));
 for(const [key,subject]of Object.entries(spec.keys))try{
  const raw=localStorage.getItem(key),progress=JSON.parse(raw||'{}');if(!object(progress))continue;
  if(progress.learning!==undefined&&(!object(progress.learning)||progress.learning.version!==1))continue;
  const generation=typeof progress.resetEpoch==='string'?progress.resetEpoch:'initial',learning=progress.learning||{version:1,generation,observations:[],activity:null};
  if(learning.generation!==generation)continue;
  const modules=learning.modules||{},old=modules.journey,base=copy(spec.templates[subject]);let changed=false;
  const compatible=object(old)&&object(old.state)&&old.state.version===1&&old.state.generation===generation;
  const journey=compatible?copy(old):base;journey.state.generation=generation;
  for(const [id,value]of Object.entries(base.state.gates))if(journey.state.gates?.[id]?.status!=='completed'){
   if(!object(journey.state.gates))journey.state.gates={};journey.state.gates[id]=value;changed=true;
  }
  if(!compatible)changed=true;
  if(!changed)continue;
  if(compatible)journey.revision=(Number.isInteger(old.revision)?old.revision:0)+1;
  progress.learning={...learning,modules:{...modules,journey}};
  localStorage.setItem(key,JSON.stringify(progress));
 }catch(_){/* Interrupted or unavailable storage is left byte-for-byte alone. */}
}
async function installLegacyConceptFixture(browserContext){await browserContext.addInitScript(seed,specification);}
async function prepareLegacyMathMode(page,id){
 // The fixture is an already-taught arithmetic exercise. Learn-mode regression
 // cases omit this call so they still verify the original read achievement.
 await page.evaluate(lesson=>{if(!progress.read.includes(lesson))markRead(lesson);},id);
}
module.exports={installLegacyConceptFixture,prepareLegacyMathMode,gateCounts:{math:math.length,russian:russian.length}};
