'use strict';
// Pure P0 contract tests. Run from the isolated checkout: node tests/place-value.test.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const plain=value=>JSON.parse(JSON.stringify(value));
let assertions=0,scenarios=0;
function eq(actual,expected,message){assert.deepEqual(plain(actual),plain(expected),message);assertions++;}
function ok(value,message){assert.ok(value,message);assertions++;}
function throws(fn,message){assert.throws(fn,message);assertions++;}
function load(folder){
 const ctx=vm.createContext({window:{}});
 vm.runInContext(fs.readFileSync(path.join(root,folder,'engine.js'),'utf8'),ctx,{filename:folder+'/engine.js'});
 vm.runInContext(fs.readFileSync(path.join(root,'place-value.js'),'utf8'),ctx,{filename:'place-value.js'});
 return {K:ctx.window.Kubiki,P:ctx.window.PlaceValue};
}
function singles(K,n){
 const p=K.empty();p.hundred=Math.floor(n/100);p.ten=Math.floor(n/10)%10;p.unit=n%10;return p;
}
function zonesFor(K,a,b,op){return {a:singles(K,a),b:op==='+'?singles(K,b):K.empty(),removed:K.empty()};}
function quantity(K,z){return K.total(z.a)+K.total(z.b)+K.total(z.removed);}
function profile(P,K,p){const d=P.describe(p,K);return {h:d.hundreds,t:d.tens,u:d.looseUnits};}
function move(K,z,from,to,type,count=1){
 for(let i=0;i<count;i++){const before=quantity(K,z);eq(K.move(z,from,to,type),true,'Existing engine must permit each fixture movement');eq(quantity(K,z),before,'Moving pieces between board areas conserves quantity');}
}
function exchange(K,p,action){
 const before=K.total(p);eq(K.exchange(p,action),true,'Existing engine must permit the requested exchange');eq(K.total(p),before,'An exchange must conserve quantity');
}
const cases=[
 {a:15,b:12,op:'+',result:27,join:{h:0,t:2,u:7},exchanges:0},
 {a:18,b:7,op:'+',result:25,join:{h:0,t:1,u:15},exchanges:1},
 {a:27,b:8,op:'+',result:35,join:{h:0,t:2,u:15},exchanges:1},
 {a:30,b:8,op:'-',result:22,split:{h:0,t:2,u:10},exchanges:1},
 {a:32,b:8,op:'-',result:24,split:{h:0,t:2,u:12},exchanges:1},
 {a:42,b:14,op:'-',result:28,split:{h:0,t:3,u:12},exchanges:1},
 {a:15,b:7,op:'+',result:22,join:{h:0,t:1,u:12},exchanges:1},
 {a:17,b:14,op:'+',result:31,join:{h:0,t:2,u:11},exchanges:1},
 {a:20,b:15,op:'+',result:35,join:{h:0,t:3,u:5},exchanges:0},
 {a:34,b:16,op:'-',result:18,split:{h:0,t:2,u:14},exchanges:1}
];
for(const folder of ['kubiki','bricks']){
 const {K,P}=load(folder);ok(P&&typeof P.explanation==='function',folder+': shared namespace is loaded');
 // The rendered description must preserve the representation rather than normalizing its total.
 const raw=K.empty();raw.ten=2;raw.unit=15;const untouched=plain(raw),d=P.describe(raw,K);
 eq({hundreds:d.hundreds,tens:d.tens,looseUnits:d.looseUnits,total:d.total},{hundreds:0,tens:2,looseUnits:15,total:35});
 eq(d.actualText,'2Д + 15Е');eq(d.expandedText,'20 + 15');eq(d.canonicalText,'3Д + 5Е');
 eq(d.canonicalExpandedText,'30 + 5');eq(d.isCanonical,false);
 eq(raw,untouched,'Describing a representation never exchanges or replaces pieces');
 const exchanged=plain(raw);exchange(K,exchanged,'pack');const after=P.describe(exchanged,K);
 eq({t:after.tens,u:after.looseUnits,total:after.total},{t:3,u:5,total:35});
 eq(after.actualText,'3Д + 5Е');eq(after.isCanonical,true);
 const unpack=singles(K,32);exchange(K,unpack,'split');
 eq(profile(P,K,unpack),{h:0,t:2,u:12});eq(P.describe(unpack,K).total,32);
 const tenTens=K.empty();tenTens.ten=10;const tenDescription=P.describe(tenTens,K);
 eq(tenDescription.tens,10);eq(tenDescription.total,100);ok(tenDescription.actualText.includes('10Д'));eq(tenDescription.hundreds,0);
 ok(tenDescription.canonicalText.includes('1С'),'The standard record is distinct from the actual ten-rods representation');
 for(const n of [0,1,9,10,19,20,99,100,200]){
  const model=singles(K,n),value=P.describe(model,K);eq(value.total,n);ok(value.actualText&&!/undefined|NaN/.test(value.actualText));
 }
 eq(P.assess(raw,35,'quantity',K).quantityCorrect,true);
 eq(P.assess(raw,35,'quantity',K).correct,true,'A quantity question accepts 2D15E=35 without forcing an exchange');
 eq(P.assess(raw,35,'canonical',K).representationCorrect,false);
 eq(P.assess(raw,35,'canonical',K).correct,false,'A normalization task still requires the requested representation');
 eq(P.assess(exchanged,35,'canonical',K).correct,true);eq(P.assess(exchanged,34,'quantity',K).correct,false);
 eq(raw,untouched,'Assessment has no mathematical side effects');
 for(const context of [{view:'trainer',mode:'play',solved:false},{view:'trainer',mode:'worksheet',worksheetTask:false,solved:false},{view:'trainer',mode:'worksheet',worksheetTask:true,solved:false},'independent']){
  const v=P.visibility(context);eq(v.context,'independent');eq(v.showTotal,false);eq(v.showRepresentation,false);eq(v.showCanonical,false);eq(v.showPieceValues,true,'An independent task retains its countable objects');
 }
 for(const context of [{view:'workshop',mode:'play',solved:false},{view:'trainer',mode:'learn',solved:false},'teaching']){
  const v=P.visibility(context);eq(v.context,'teaching');eq(v.showTotal,true);eq(v.showRepresentation,true);
 }
 const review=P.visibility({view:'trainer',mode:'play',solved:true});eq(review.context,'reviewed');eq(review.showTotal,true);eq(review.showCanonical,true);
 const early=P.visibility({view:'trainer',mode:'learn',solved:false,frame:{phase:'transform',showTotal:false,showCanonical:false}});
 eq(early.showTotal,false,'Teaching frames may withhold a final total until the final frame');eq(early.showCanonical,false);
 const originalTask={a:27,b:8,op:'+',result:35};P.explanation(originalTask,K);eq(originalTask,{a:27,b:8,op:'+',result:35},'Explanation does not mutate existing exercise data');
 scenarios++;
 for(const item of cases){
  const task={a:item.a,b:item.b,op:item.op,result:item.result};const calls={moves:0,exchanges:[]};
  const instrumented={...K,move(...args){calls.moves++;return K.move(...args);},exchange(p,action){calls.exchanges.push(action);return K.exchange(p,action);}};
  const lesson=P.explanation(task,instrumented),frames=[lesson.initial,...lesson.transformations,lesson.final],label=folder+' '+item.a+item.op+item.b;
  eq(lesson.initial.phase,'initial',label+' starts with the original objects');eq(lesson.initial.step,0);
  eq(lesson.final.phase,'final');eq(lesson.final.step,2);eq(lesson.final.showTotal,true);eq(lesson.final.showCanonical,true);
  eq(profile(P,K,lesson.initial.zones.a),profile(P,K,singles(K,item.a)),label+' initial quantity uses tens and single units');
  eq(K.total(lesson.initial.zones.b),item.op==='+'?item.b:0);
  const conserved=item.op==='+'?item.a+item.b:item.a;
  for(const [i,frame]of frames.entries()){
   eq(quantity(K,frame.zones),conserved,label+' frame '+i+' preserves the full board quantity');
   for(const p of Object.values(frame.zones))for(const value of Object.values(p))ok(Number.isInteger(value)&&value>=0,label+' has non-negative whole objects');
   eq(frame.after,frame.zones,label+' after-state matches the displayed state');
   if(i>0&&i<frames.length-1){eq(frame.phase,'transform');eq(frame.step,1);}
   ok(typeof frame.label==='string'&&frame.label.length>0);ok(typeof frame.caption==='string');ok(typeof frame.actionLabel==='string'&&frame.actionLabel.length>0);
   if(folder==='bricks')for(const p of Object.values(frame.zones)){eq(p.double,0,'The introductory model does not hide units in 2-point pieces');eq(p.five,0,'The introductory model does not hide units in 5-point pieces');}
  }
  let previous=lesson.initial;
  for(const frame of lesson.transformations){
   eq(frame.before,previous.zones,label+' follows the actual previous object state');
   if(item.op==='+')eq(frame.showTotal,false,label+' does not print the addition answer before the final explanation');
   if(/^remove/.test(frame.operation))eq(frame.showTotal,false,label+' does not print the subtraction answer before the final explanation');
   if(/^split/.test(frame.operation)){eq(K.total(frame.before.a),K.total(frame.after.a),label+' split leaves the current quantity unchanged');eq(frame.showTotal,true,label+' may show the known quantity while unpacking');}
   const answerPattern=new RegExp('(^|[^0-9])'+item.result+'([^0-9]|$)');
   ok(!answerPattern.test(frame.caption),label+' caption does not announce the final numeric answer early');
   previous=frame;
  }
  eq(K.total(lesson.final.zones.a),item.result,label+' final answer');eq(K.canonical(lesson.final.zones.a),true);
  eq(K.check({...task,answer:item.result},lesson.final.zones,false),true,label+' existing exercise checker accepts the final board');
  eq(K.total(lesson.final.zones.removed),item.op==='-'?item.b:0);
  eq(calls.exchanges.length,item.exchanges,label+' uses the actual required exchange operation count');ok(calls.moves>0,label+' uses the existing movement engine');
  if(item.join){const joined=lesson.transformations.find(f=>f.operation==='join');ok(joined,label+' contains the pre-exchange joined state');eq(profile(P,K,joined.zones.a),item.join,label+' joined units are not normalized before the exchange');}
  if(item.split){const split=lesson.transformations.find(f=>f.operation==='split');ok(split,label+' includes an explicit ten-to-units state');eq(profile(P,K,split.zones.a),item.split);eq(K.total(split.zones.a),item.a);}
  // Snapshots are independently owned; a renderer cannot alter another frame by mutation.
  const finalBefore=plain(lesson.final.zones);lesson.initial.zones.a.unit+=1;eq(lesson.final.zones,finalBefore,label+' frames do not alias each other');
  scenarios++;
 }
 // Boundary cases need two successive exchanges rather than a jump to the standard result.
 for(const task of [{a:99,b:1,op:'+',result:100},{a:100,b:1,op:'-',result:99},{a:0,b:0,op:'+',result:0},{a:0,b:0,op:'-',result:0},{a:100,b:100,op:'-',result:0}]){
  const lesson=P.explanation(task,K),conserved=task.op==='+'?task.a+task.b:task.a;
  for(const frame of [lesson.initial,...lesson.transformations,lesson.final])eq(quantity(K,frame.zones),conserved,'Boundary explanation conserves the full board quantity');
  eq(K.total(lesson.final.zones.a),task.result);eq(K.check({...task,answer:task.result},lesson.final.zones,false),true);
  if(task.a===99){eq(lesson.transformations.filter(f=>/^pack/.test(f.operation)).map(f=>f.operation),['pack','pack100']);ok(lesson.transformations.some(f=>P.describe(f.zones.a,K).tens===10),'Ten tens are visible before becoming a hundred');}
  if(task.a===100&&task.b===1){eq(lesson.transformations.filter(f=>/^split/.test(f.operation)).map(f=>f.operation),['split100','split']);ok(lesson.transformations.some(f=>P.describe(f.zones.a,K).tens===10),'A hundred is visibly unpacked into ten tens');ok(lesson.transformations.some(f=>P.describe(f.zones.a,K).tens===9&&P.describe(f.zones.a,K).looseUnits===10),'One ten is unpacked before removing one unit');}
  scenarios++;
 }
 // Both valid addition strategies are retained; helper explanations do not constrain play to one click script.
 for(const earlyPack of [false,true]){
  const z=zonesFor(K,27,8,'+');
  if(earlyPack){move(K,z,'b','a','unit',3);eq(profile(P,K,z.a),{h:0,t:2,u:10});exchange(K,z.a,'pack');move(K,z,'b','a','unit',5);}
  else{move(K,z,'b','a','unit',8);eq(profile(P,K,z.a),{h:0,t:2,u:15});exchange(K,z.a,'pack');}
  eq(K.check({a:27,b:8,op:'+',result:35,answer:35},z,false),true,'Both early and late grouping are mathematically correct');eq(K.total(z.a),35);scenarios++;
 }
 // Borrow before removing anything or remove the available two units first: both represent 32-8.
 for(const removeFirst of [false,true]){
  const z=zonesFor(K,32,8,'-');
  if(removeFirst){move(K,z,'a','removed','unit',2);eq(K.total(z.a),30);exchange(K,z.a,'split');move(K,z,'a','removed','unit',6);}
  else{exchange(K,z.a,'split');eq(profile(P,K,z.a),{h:0,t:2,u:12});move(K,z,'a','removed','unit',8);}
  eq(K.check({a:32,b:8,op:'-',result:24,answer:24},z,false),true,'Both legal subtraction strategies remain accepted');eq(K.total(z.a),24);eq(K.total(z.removed),8);scenarios++;
 }
 if(folder==='bricks'){
  const p=K.empty();p.ten=2;p.unit=1;p.double=2;p.five=2;const result=P.describe(p,K);
  eq(result.looseUnits,15,'LEGO descriptions count studs, not plastic pieces');eq(result.total,35);eq(result.actualText,'2Д + 15Е');scenarios++;
 }
}
console.log(JSON.stringify({success:true,assertions,scenarios,trainers:2,requestedExamples:10,intermediateModels:true,quantityConservation:true,alternativeStrategies:true,answerVisibility:true,storageAccess:false},null,2));
