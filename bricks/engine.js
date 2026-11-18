(function(root){
'use strict';
// A brick's value is its number of studs. The number of plastic pieces is irrelevant.
const values={unit:1,double:2,five:5,ten:10,hundred:100};
const max=()=>root.MathRange?root.MathRange.MAX:1000;
const types=Object.keys(values);
const empty=()=>({unit:0,double:0,five:0,ten:0,hundred:0});
const small=p=>(p.unit||0)+2*(p.double||0)+5*(p.five||0);
const total=p=>types.reduce((sum,type)=>sum+(p[type]||0)*values[type],0);
// Prefer a 5-stud brick, then 2-stud bricks, then single studs.
function parts(n,options){if(!Number.isInteger(n)||n<0||n>max())throw new RangeError('Expected a whole quantity from 0 to '+max());const result=empty(),rest=n%10;result.hundred=Math.floor(n/100);result.ten=Math.floor(n/10)%10;if(options&&options.unitsOnly===true){result.unit=rest;return result;}result.five=Math.floor(rest/5);result.double=Math.floor((rest%5)/2);result.unit=(rest%5)%2;return result;}
const valid=p=>!!p&&types.every(type=>Number.isInteger(p[type])&&p[type]>=0)&&total(p)<=max();
const canonical=p=>valid(p)&&small(p)<10&&p.ten<10;
function move(zones,from,to,type){
 if(!zones||!Object.prototype.hasOwnProperty.call(values,type)||from===to)return false;
 if(to==='bank'){if(from==='bank'||!valid(zones[from])||zones[from][type]<1)return false;zones[from][type]--;return true;}
 if(!valid(zones[to]))return false;
 if(from!=='bank'&&(!valid(zones[from])||zones[from][type]<1))return false;
 if(total(zones[to])+values[type]>max())return false;
 if(from!=='bank')zones[from][type]--;
 zones[to][type]++;return true;
}
// Packing consumes one exact group. The pieces outside that group do not change.
// If 2/5-point pieces cannot make the exact group, split them explicitly first.
function packPlan(p,target,allowFive){
 for(let unit=Math.min(p.unit,target);unit>=0;unit--){
  for(let double=Math.min(p.double,Math.floor((target-unit)/2));double>=0;double--){
   const rest=target-unit-2*double,five=rest/5;
   if(rest>=0&&Number.isInteger(five)&&five<=(allowFive?p.five:0))return {unit,double,five};
  }
 }
 return null;
}
function canExchange(p,action){
 if(!valid(p))return false;
 if(action==='pack2')return p.unit>=2;
 if(action==='split2')return p.double>0;
 if(action==='pack5')return !!packPlan(p,5,false);
 if(action==='split5')return p.five>0;
 if(action==='pack')return !!packPlan(p,10,true);
 if(action==='split')return p.ten>0;
 if(action==='pack100')return p.ten>=10;
 if(action==='split100')return p.hundred>0;
 return false;
}
function exchange(p,action){
 if(!canExchange(p,action))return false;
 if(action==='pack2'){p.unit-=2;p.double++;return true;}
 if(action==='split2'){p.double--;p.unit+=2;return true;}
 if(action==='pack5'||action==='pack'){
  const plan=packPlan(p,action==='pack5'?5:10,action==='pack');
  p.unit-=plan.unit;p.double-=plan.double;p.five-=plan.five;
  if(action==='pack5')p.five++;else p.ten++;
  return true;
 }
 if(action==='split5'){p.five--;p.unit+=5;return true;}
 if(action==='split'){p.ten--;p.unit+=10;return true;}
 if(action==='pack100'){p.ten-=10;p.hundred++;return true;}
 if(action==='split100'){p.hundred--;p.ten+=10;return true;}
 return false;
}
function check(task,zones,build){
 if(!task||!zones||!valid(zones.a)||(!build&&(!valid(zones.b)||!valid(zones.removed))))return false;
 const target=task.answer??task.result;
 if(!Number.isInteger(target)||target<0||target>max())return false;
 if(build)return total(zones.a)===target&&canonical(zones.a);
 return total(zones.a)===task.result&&canonical(zones.a)&&(task.op==='+'?total(zones.b)===0:total(zones.removed)===task.b);
}
root.Kubiki={values,types,parts,empty,small,total,canonical,move,canExchange,exchange,check};
})(typeof window==='undefined'?globalThis:window);
