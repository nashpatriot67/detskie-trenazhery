(function(root){
'use strict';
// A brick's value is its number of studs. The number of plastic pieces is irrelevant.
const values={unit:1,double:2,five:5,ten:10,hundred:100};
const types=Object.keys(values);
const empty=()=>({unit:0,double:0,five:0,ten:0,hundred:0});
const small=p=>(p.unit||0)+2*(p.double||0)+5*(p.five||0);
const total=p=>types.reduce((sum,type)=>sum+(p[type]||0)*values[type],0);
// Prefer a 5-stud brick, then 2-stud bricks, then single studs.
function parts(n){const result=empty(),rest=n%10;result.hundred=Math.floor(n/100);result.ten=Math.floor(n/10)%10;result.five=Math.floor(rest/5);result.double=Math.floor((rest%5)/2);result.unit=(rest%5)%2;return result;}
const canonical=p=>types.every(type=>Number.isInteger(p[type])&&p[type]>=0)&&small(p)<10&&p.ten<10;
function move(zones,from,to,type){
 if(!Object.prototype.hasOwnProperty.call(values,type)||from===to)return false;
 if(to==='bank'){if(from==='bank'||!zones[from]||zones[from][type]<1)return false;zones[from][type]--;return true;}
 if(!zones[to])return false;
 if(from!=='bank'&&(!zones[from]||zones[from][type]<1))return false;
 if(total(zones[to])+values[type]>200)return false;
 if(from!=='bank')zones[from][type]--;
 zones[to][type]++;return true;
}
function exchange(p,action){
 if(action==='pack2'&&p.unit>=2){p.unit-=2;p.double++;return true;}
 if(action==='split2'&&p.double>0){p.double--;p.unit+=2;return true;}
 if(action==='pack5'&&p.unit+2*p.double>=5){const rest=p.unit+2*p.double-5;p.unit=rest%2;p.double=Math.floor(rest/2);p.five++;return true;}
 if(action==='split5'&&p.five>0){p.five--;p.unit+=5;return true;}
 if(action==='pack'&&small(p)>=10){const rest=small(p)-10;p.five=Math.floor(rest/5);p.double=Math.floor((rest%5)/2);p.unit=(rest%5)%2;p.ten++;return true;}
 if(action==='split'&&p.ten>0){p.ten--;p.unit+=10;return true;}
 if(action==='pack100'&&p.ten>=10){p.ten-=10;p.hundred++;return true;}
 if(action==='split100'&&p.hundred>0){p.hundred--;p.ten+=10;return true;}
 return false;
}
function check(task,zones,build){
 const target=task.answer??task.result;
 if(build)return total(zones.a)===target&&canonical(zones.a);
 return total(zones.a)===task.result&&canonical(zones.a)&&(task.op==='+'?total(zones.b)===0:total(zones.removed)===task.b);
}
root.Kubiki={values,types,parts,empty,small,total,canonical,move,exchange,check};
})(typeof window==='undefined'?globalThis:window);
