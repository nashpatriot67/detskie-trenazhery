'use strict';
// No browser or student data: the production mathematical engines are exercised
// through their public operations in isolated VMs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function engine(folder){const ctx=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(root,folder,'engine.js'),'utf8'),ctx);return ctx.window.Kubiki;}
const plain=value=>JSON.parse(JSON.stringify(value));
let assertions=0,legalExchanges=0,rejectedExchanges=0;
const check=(actual,expected,message)=>{assert.deepEqual(plain(actual),plain(expected),message);assertions++;};
const truth=(actual,message)=>{assert.ok(actual,message);assertions++;};
const B=engine('bricks');
for(let n=0;n<=200;n++){
 const p=B.parts(n),single=B.parts(n,{unitsOnly:true});
 check(B.total(p),n);check(B.total(single),n);check(single.double,0);check(single.five,0);check(single.unit,n%10);truth(B.canonical(single));
}
check(B.parts(17),{unit:0,double:1,five:1,ten:1,hundred:0},'Existing default representation remains 5/2/1');
let p={unit:15,double:0,five:0,ten:2,hundred:0};truth(B.exchange(p,'pack'));check(p,{unit:5,double:0,five:0,ten:3,hundred:0},'Packing ten leaves five separate units separate');
p={unit:12,double:0,five:0,ten:2,hundred:0};truth(B.exchange(p,'pack5'));check(p,{unit:7,double:0,five:1,ten:2,hundred:0},'Packing five leaves the other seven units separate');
p={unit:0,double:3,five:1,ten:0,hundred:0};const impossible=plain(p);check(B.canExchange(p,'pack'),false,'Eleven points do not guarantee a whole-piece group of ten');check(B.exchange(p,'pack'),false);check(p,impossible,'Impossible exact exchange does not split a piece invisibly');truth(B.exchange(p,'split2'));truth(B.exchange(p,'pack'));check(B.total(p),11);check(p.ten,1);
p={unit:0,double:3,five:0,ten:0,hundred:0};check(B.canExchange(p,'pack5'),false);truth(B.exchange(p,'split2'));truth(B.exchange(p,'pack5'));check(p,{unit:1,double:0,five:1,ten:0,hundred:0},'Explicit split enables an exact five-point group');
function exactGroup(p,target,allowFive){for(let u=0;u<=p.unit;u++)for(let d=0;d<=p.double;d++)for(let f=0;f<=(allowFive?p.five:0);f++)if(u+2*d+5*f===target)return true;return false;}
const actions=['pack2','split2','pack5','split5','pack','split','pack100','split100','unknown'];
for(let unit=0;unit<=20;unit++)for(let double=0;double<=8;double++)for(let five=0;five<=5;five++)for(const ten of [0,1,2,10])for(const hundred of [0,1]){
 const initial={unit,double,five,ten,hundred};if(B.total(initial)>200)continue;
 for(const action of actions){
  const sample=plain(initial),before=B.total(sample),expected=action==='pack'?exactGroup(sample,10,true):action==='pack5'?exactGroup(sample,5,false):action==='pack2'?sample.unit>=2:action==='split2'?sample.double>0:action==='split5'?sample.five>0:action==='split'?sample.ten>0:action==='pack100'?sample.ten>=10:action==='split100'?sample.hundred>0:false;
  check(B.canExchange(sample,action),expected);check(B.exchange(sample,action),expected);
  if(!expected){check(sample,initial,'Rejected operation preserves every piece');rejectedExchanges++;continue;}
  check(B.total(sample),before,'Exchange preserves quantity');truth(B.types.every(type=>Number.isInteger(sample[type])&&sample[type]>=0));legalExchanges++;
  if(action==='pack'){
   check(sample.ten,initial.ten+1);check(sample.hundred,initial.hundred);truth(['unit','double','five'].every(type=>sample[type]<=initial[type]),'Packing ten cannot create leftover 2/5 pieces');check((initial.unit-sample.unit)+2*(initial.double-sample.double)+5*(initial.five-sample.five),10);
  }
  if(action==='pack5'){check(sample.five,initial.five+1);check(sample.ten,initial.ten);check(sample.hundred,initial.hundred);truth(sample.unit<=initial.unit&&sample.double<=initial.double);check((initial.unit-sample.unit)+2*(initial.double-sample.double),5);}
 }
}
const cases=[[15,12,'+',27],[18,7,'+',25],[27,8,'+',35],[30,8,'-',22],[32,8,'-',24],[42,14,'-',28],[15,7,'+',22],[17,14,'+',31],[20,15,'+',35],[34,16,'-',18],[99,1,'+',100],[100,1,'-',99],[0,0,'+',0],[0,0,'-',0]];
const traces=[];
for(const folder of ['kubiki','bricks']){
 const K=engine(folder);
 const singles=n=>{const v=K.empty();v.hundred=Math.floor(n/100);v.ten=Math.floor(n/10)%10;v.unit=n%10;return v;};
 const qty=zones=>Object.values(zones).reduce((sum,value)=>sum+K.total(value),0);
 function exchange(zones,action){const before=qty(zones);truth(K.exchange(zones.a,action),folder+' '+action);check(qty(zones),before);}
 function move(zones,from,to,type){const before=qty(zones);truth(K.move(zones,from,to,type));check(qty(zones),before);}
 for(const [a,b,op,result]of cases){
  const zones={a:singles(a),b:op==='+'?singles(b):K.empty(),removed:K.empty()},states=[plain(zones)];
  if(op==='+'){
   for(const type of Object.keys(K.values))while(zones.b[type])move(zones,'b','a',type);states.push(plain(zones));
   while(zones.a.unit>=10){exchange(zones,'pack');states.push(plain(zones));}
   while(zones.a.ten>=10){exchange(zones,'pack100');states.push(plain(zones));}
  }else{
   if(zones.a.hundred&&b>0){exchange(zones,'split100');states.push(plain(zones));}
   if(zones.a.unit<b%10){exchange(zones,'split');states.push(plain(zones));}
   const removed=singles(b);for(const type of Object.keys(K.values))while(removed[type]-- >0)move(zones,'a','removed',type);states.push(plain(zones));
  }
  check(K.total(zones.a),result);truth(K.check({a,b,op,result,answer:result},zones,false),folder+' final '+a+op+b);traces.push({folder,expression:a+op+b,result,states});
 }
 // An early exchange after adding only three of eight is just as valid.
 let z={a:singles(27),b:singles(8),removed:K.empty()};for(let i=0;i<3;i++)move(z,'b','a','unit');exchange(z,'pack');for(let i=0;i<5;i++)move(z,'b','a','unit');check(K.total(z.a),35);truth(K.check({op:'+',result:35,answer:35},z,false));
 // Removing the two available units first, then borrowing, is also valid.
 z={a:singles(32),b:K.empty(),removed:K.empty()};for(let i=0;i<2;i++)move(z,'a','removed','unit');exchange(z,'split');for(let i=0;i<6;i++)move(z,'a','removed','unit');check(K.total(z.a),24);truth(K.check({op:'-',b:8,result:24,answer:24},z,false));
}
// Old mixed 2/5 models remain solvable using explicit split actions.
for(let n=0;n<=100;n++){
 const v=B.parts(n);while(v.five)truth(B.exchange(v,'split5'));while(v.double)truth(B.exchange(v,'split2'));check(B.total(v),n);while(v.unit>=10)truth(B.exchange(v,'pack'));truth(B.canonical(v));check(B.total(v),n);
}
console.log(JSON.stringify({assertions,legalExchanges,rejectedExchanges,scenarioPaths:traces.length,requestedPaths:20,alternativePaths:4,quantityConserved:true,exactLeftovers:true,legacyDefaultPartsRetained:true,unitsOnlyOptional:true}));
