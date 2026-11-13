(function(root){
'use strict';
const values={unit:1,ten:10,hundred:100};
const parts=n=>({unit:n%10,ten:Math.floor(n/10)%10,hundred:Math.floor(n/100)});
const empty=()=>({unit:0,ten:0,hundred:0});
const total=p=>p.unit+10*p.ten+100*p.hundred;
const canonical=p=>p.unit<10&&p.ten<10;
function move(zones,from,to,type){
 if(!values[type]||from===to)return false;
 if(to==='bank'){if(from==='bank'||!zones[from]||zones[from][type]<1)return false;zones[from][type]--;return true;}
 if(!zones[to])return false;
 if(from!=='bank'&&(!zones[from]||zones[from][type]<1))return false;
 if(total(zones[to])+values[type]>200)return false;
 if(from!=='bank')zones[from][type]--;
 zones[to][type]++;return true;
}
function exchange(p,action){
 if(action==='pack'&&p.unit>=10){p.unit-=10;p.ten++;return true;}
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
root.Kubiki={values,parts,empty,total,canonical,move,exchange,check};
})(typeof window==='undefined'?globalThis:window);
