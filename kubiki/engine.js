(function(root){
'use strict';
const values={unit:1,ten:10,hundred:100};
const max=()=>root.MathRange?root.MathRange.MAX:1000;
function parts(n){if(!Number.isInteger(n)||n<0||n>max())throw new RangeError('Expected a whole quantity from 0 to '+max());return {unit:n%10,ten:Math.floor(n/10)%10,hundred:Math.floor(n/100)};}
const empty=()=>({unit:0,ten:0,hundred:0});
const total=p=>p.unit+10*p.ten+100*p.hundred;
const valid=p=>!!p&&Object.keys(values).every(type=>Number.isInteger(p[type])&&p[type]>=0)&&total(p)<=max();
// Ten hundreds is an intentional boundary model for 1000, explained in the UI.
const canonical=p=>valid(p)&&p.unit<10&&p.ten<10;
function move(zones,from,to,type){
 if(!zones||!Object.prototype.hasOwnProperty.call(values,type)||from===to)return false;
 if(to==='bank'){if(from==='bank'||!valid(zones[from])||zones[from][type]<1)return false;zones[from][type]--;return true;}
 if(!valid(zones[to]))return false;
 if(from!=='bank'&&(!valid(zones[from])||zones[from][type]<1))return false;
 if(total(zones[to])+values[type]>max())return false;
 if(from!=='bank')zones[from][type]--;
 zones[to][type]++;return true;
}
function canExchange(p,action){
 if(!valid(p))return false;
 return action==='pack'?p.unit>=10:action==='split'?p.ten>0:action==='pack100'?p.ten>=10:action==='split100'?p.hundred>0:false;
}
function exchange(p,action){
 if(!canExchange(p,action))return false;
 if(action==='pack'){p.unit-=10;p.ten++;return true;}
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
root.Kubiki={values,parts,empty,total,canonical,move,canExchange,exchange,check};
})(typeof window==='undefined'?globalThis:window);
