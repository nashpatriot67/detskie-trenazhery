'use strict';
// Pure-engine and presentation tests. No browser, storage or student data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const plain=x=>JSON.parse(JSON.stringify(x));
let assertions=0,scenarioPaths=0,exchangeCases=0;
function eq(a,b,message){assert.deepEqual(plain(a),plain(b),message);assertions++;}
function ok(value,message){assert.ok(value,message);assertions++;}
function throws(fn,message){assert.throws(fn,message);assertions++;}
function load(folder,withRange=true){
 const context=vm.createContext({window:{}});
 for(const file of [...(withRange?['math-range.js']:[]),folder+'/engine.js','place-value.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 return {K:context.window.Kubiki,P:context.window.PlaceValue,R:context.window.MathRange};
}
const cases=[
 {a:95,b:8,op:'+',result:103,states:[[0,9,13],[0,10,3],[1,0,3]]},
 {a:180,b:35,op:'+',result:215,states:[[1,11,5],[2,1,5]]},
 {a:270,b:45,op:'+',result:315,states:[[2,11,5],[3,1,5]]},
 {a:198,b:7,op:'+',result:205,states:[[1,9,15],[1,10,5],[2,0,5]]},
 {a:302,b:8,op:'-',result:294,states:[[2,10,2],[2,9,12],[2,9,4]]},
 {a:300,b:18,op:'-',result:282,states:[[2,10,0],[2,9,10],[2,8,10],[2,8,2]]},
 {a:405,b:27,op:'-',result:378,states:[[3,10,5],[3,9,15],[3,7,15],[3,7,8]]},
 {a:500,b:176,op:'-',result:324,states:[[4,10,0],[4,9,10],[3,9,10],[3,2,10],[3,2,4]]},
 {a:999,b:1,op:'+',result:1000,states:[[9,9,10],[9,10,0],[10,0,0]]},
 {a:1000,b:1,op:'-',result:999,states:[[9,10,0],[9,9,10],[9,9,9]]},
 {a:1000,b:999,op:'-',result:1,states:[[9,10,0],[9,9,10],[0,9,10],[0,0,10],[0,0,1]]},
 {a:0,b:0,op:'+',result:0,states:[[0,0,0]]},
 {a:0,b:0,op:'-',result:0,states:[[0,0,0]]},
 {a:99,b:1,op:'+',result:100,states:[[0,9,10],[0,10,0],[1,0,0]]},
 {a:1000,b:0,op:'+',result:1000,states:[[10,0,0]]}
];
for(const folder of ['kubiki','bricks']){
 const {K,P,R}=load(folder),p0=load(folder,false);
 eq(R.MAX,1000);eq(R.NORMAL_MAX,999);eq(R.draft('1000'),'1000');eq(R.draft('1001'),'1001','Invalid four-digit answers are not silently clipped into correct ones');eq(R.draft('9999'),'9999');eq(R.draft('1 0a0z0'),'1000');eq(R.draft(null),'');
 for(const n of [0,99,100,109,247,305,470,999,1000])ok(R.isValue(n));
 for(const n of [-1,1001,NaN,Infinity,1.5,'1000'])eq(R.isValue(n),false);
 for(let n=0;n<=1000;n++){
  const p=K.parts(n),single=P.unitsOnly(n,K),d=P.describe(single,K);
  eq(K.total(p),n);eq(K.total(single),n);eq(single.unit,n%10);eq(single.ten,Math.floor(n/10)%10);eq(single.hundred,Math.floor(n/100));ok(K.canonical(single));eq(d.total,n);
  eq(d.digits,{thousands:Math.floor(n/1000),hundreds:Math.floor(n/100)%10,tens:Math.floor(n/10)%10,units:n%10});
  eq(K.total(p0.K.parts(n)),n,'Standalone existing engine entry remains compatible without a separate range script');
  if(folder==='bricks'){eq(single.double,0);eq(single.five,0);eq(p.five,Math.floor((n%10)/5));eq(p.double,Math.floor(((n%10)%5)/2));}
 }
 for(const n of [-1,1001,1.5,NaN,Infinity,'305']){throws(()=>K.parts(n));throws(()=>P.unitsOnly(n,K));}
 const boundary=P.describe(K.parts(1000),K);eq(boundary.actualText,'10С + 0Д + 0Е');eq(boundary.boundary,true);ok(boundary.boundaryText.includes('10 сотен'));ok(boundary.canonicalText.includes('1 тысяча'));ok(!boundary.canonicalText.startsWith('10С'),'Standard numeral and ten-hundreds model must remain distinct');
 const qty=zones=>K.total(zones.a)+K.total(zones.b)+K.total(zones.removed);
 const profile=p=>[p.hundred,p.ten,P.describe(p,K).looseUnits];
 function exchange(zones,action){const previous=qty(zones);ok(K.exchange(zones.a,action));eq(qty(zones),previous);}
 function move(zones,from,to,type,count=1){for(let i=0;i<count;i++){const previous=qty(zones);ok(K.move(zones,from,to,type));eq(qty(zones),previous);}}
 for(const t of cases){
  const frozen=plain(t),plan=P.explanation(t,K),frames=[plan.initial,...plan.transformations,plan.final],conserved=t.op==='+'?t.result:t.a;
  eq(plan.transformations.map(f=>profile(f.zones.a)),t.states,folder+' exact states for '+t.a+t.op+t.b);
  eq(t,frozen,'The lesson source is not rewritten');
  for(const frame of frames){
   eq(qty(frame.zones),conserved,'Model plus removed objects conserves quantity');eq(frame.zones,frame.after);
   for(const p of Object.values(frame.zones))for(const v of Object.values(p))ok(Number.isInteger(v)&&v>=0);
   if(frame.phase==='transform'){
    const replay=plain(frame.before);
    for(const action of frame.actions){
     if(action.kind==='exchange')exchange(replay,action.action);
     else if(action.kind==='move')move(replay,action.from,action.to,action.type,action.count);
     else assert.fail('Unsupported recorded action');
    }
    eq(replay,frame.after,'Every explained state is reached by real existing engine operations');
    if(['pack','pack100','split','split100'].includes(frame.operation)){eq(K.total(frame.before.a),K.total(frame.after.a));ok(frame.conservationText);}
    if(t.op==='+'||frame.operation.startsWith('remove'))eq(frame.showTotal,false,'The computed answer is withheld before the result frame');
   }
  }
  eq(K.total(plan.final.zones.a),t.result);ok(K.check(t,plan.final.zones,false));eq(plan.final.showTotal,true);
  if(t.result===1000)ok(plan.final.caption.includes('10 сотен — одна тысяча'));
  scenarioPaths++;
 }
 // General representation properties, including temporary counts above 9.
 for(let h=0;h<=10;h++)for(let t=0;t<=15;t++)for(let u=0;u<=20;u++){
  const base=K.empty();Object.assign(base,{hundred:h,ten:t,unit:u});if(K.total(base)>1000)continue;
  for(const action of ['pack','split','pack100','split100']){
   const sample=plain(base),before=K.total(base),can=K.canExchange(base,action),expected=action==='pack'?u>=10:action==='split'?t>0:action==='pack100'?t>=10:h>0;
   eq(can,expected);eq(K.exchange(sample,action),expected);eq(K.total(sample),before);
   if(!can)eq(sample,base,'Rejected action is a no-op');
   for(const v of Object.values(sample))ok(Number.isInteger(v)&&v>=0);
   exchangeCases++;
  }
 }
 // Groupings requested by the brief, with no hidden normalization of remainders.
 for(const [initial,actions,expected]of [
  [{unit:0,ten:13,hundred:0},['pack100'],[1,3,0]],
  [{unit:0,ten:15,hundred:2},['pack100'],[3,5,0]],
  [{unit:15,ten:9,hundred:0},['pack','pack100'],[1,0,5]],
  [{unit:100,ten:0,hundred:0},Array(10).fill('pack').concat('pack100'),[1,0,0]]
 ]){
  const z={a:Object.assign(K.empty(),initial),b:K.empty(),removed:K.empty()},start=qty(z);
  for(const action of actions){exchange(z,action);eq(qty(z),start);}
  eq(profile(z.a),expected);
 }
 // Alternative strategies remain valid, rather than matching an action script.
 let z={a:P.unitsOnly(198,K),b:P.unitsOnly(7,K),removed:K.empty()};move(z,'b','a','unit',2);exchange(z,'pack');exchange(z,'pack100');move(z,'b','a','unit',5);ok(K.check({op:'+',result:205},z,false));eq(profile(z.a),[2,0,5]);scenarioPaths++;
 z={a:P.unitsOnly(302,K),b:K.empty(),removed:K.empty()};move(z,'a','removed','unit',2);exchange(z,'split100');exchange(z,'split');move(z,'a','removed','unit',6);ok(K.check({op:'-',b:8,result:294},z,false));eq(profile(z.a),[2,9,4]);scenarioPaths++;
 z={a:P.unitsOnly(500,K),b:K.empty(),removed:K.empty()};move(z,'a','removed','hundred');exchange(z,'split100');exchange(z,'split');move(z,'a','removed','ten',7);move(z,'a','removed','unit',6);ok(K.check({op:'-',b:176,result:324},z,false));scenarioPaths++;
 z={a:K.parts(1000),b:K.empty(),removed:K.empty()};let old=plain(z);eq(K.move(z,'bank','a','unit'),false);eq(z,old,'A limit rejection preserves every object');eq(K.move(z,'a','b','hundred'),true);eq(K.total(z.a),900);eq(K.total(z.b),100);
 for(const name of ['missing','__proto__','constructor']){old=plain(z);eq(K.move(z,'bank','a',name),false);eq(z,old);}
 const broken=Object.assign(K.empty(),{unit:-1});old=plain(broken);eq(K.exchange(broken,'pack'),false);eq(broken,old);eq(K.canonical(broken),false);
 const nonstandard=Object.assign(K.empty(),{hundred:2,ten:14,unit:6});eq(P.assess(nonstandard,346,'quantity',K).correct,true);eq(P.assess(nonstandard,346,'canonical',K).correct,false);
 const hidden=P.visibility('independent');eq(hidden.showTotal,false);eq(hidden.showCanonical,false);eq(hidden.showRepresentation,false);
 for(const t of [{a:999,b:2,op:'+'},{a:0,b:1,op:'-'},{a:1001,b:0,op:'+'}])throws(()=>P.explanation(t,K));
}
console.log(JSON.stringify({success:true,assertions,scenarioPaths,exchangeCases,trainers:2,newRequiredExamples:8,boundaries:[0,99,100,999,1000],actualEngineActionReplay:true,quantityConserved:true,alternativeStrategies:true,legacyDefaultParts:true,storageAccess:false},null,2));
