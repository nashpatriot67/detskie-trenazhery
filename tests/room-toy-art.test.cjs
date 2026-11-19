'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Art = require('../room-toy-art.js');

// A numeric recorder checks the Canvas contract without depending on a browser,
// native rendering package, screenshots, or implementation-specific coordinates.
function recorder(){
  const calls=[], states=[]; let depth=0;
  const ctx=new Proxy({}, {get(target,key){
    if(key==='calls')return calls;
    if(key==='depth')return depth;
    if(key==='createLinearGradient'||key==='createRadialGradient')return (...args)=>{
      args.forEach(n=>assert.ok(Number.isFinite(n),`${key}: ${n}`));return {addColorStop(){}};
    };
    return (...args)=>{
      for(const n of args)if(typeof n==='number')assert.ok(Number.isFinite(n),`${String(key)}: ${n}`);
      calls.push([key,...args]);
      if(key==='save'){states.push({...target});depth++;}
      if(key==='restore'){assert.ok(depth>0,'balanced restore');const prior=states.pop();for(const k of Object.keys(target))delete target[k];Object.assign(target,prior);depth--;}
    };
  },set(target,key,value){if(typeof value==='number')assert.ok(Number.isFinite(value));target[key]=value;return true;}});
  return ctx;
}

test('all toy families and furniture generate finite, balanced Canvas geometry',()=>{
  const c=recorder();
  const items=[
    ...['race','offroad','utility'].flatMap(carType=>['small','medium','large'].map(sizeClass=>({kind:'car',carType,sizeClass,color:'#dc5145'}))),
    ...['car','rocket','house'].map(modelType=>({kind:'model',modelType})),
    ...['shirt','socks','pajamas','hoodie','trousers'].flatMap(clothingType=>[{kind:'clothing',clothingType,dirty:true},{kind:'clothing',clothingType,dirty:false}]),
    {kind:'brick',cols:1,rows:1},{kind:'brick',cols:4,rows:2},{kind:'brick',cols:8,rows:4},
    {kind:'teddy'},{kind:'book'},{kind:'key'},{}
  ];
  items.forEach(item=>{Art.drawItem(c,item,{x:80,y:80,size:96,angle:.4});assert.equal(c.depth,0);});
  Art.drawItem(c,{kind:'brick',cols:Infinity,rows:-5},{size:NaN,x:Infinity,angle:NaN});
  Art.drawItem(c,{kind:'clothing',clothingType:'hoodie',dirty:true},{folded:true});
  ['toybox','laundry','lego-tray','parking-tray','bookshelf','small-parts','large-parts','model-shelf','drawer','wardrobe'].forEach(id=>{
    Art.drawZone(c,{id,x:20,y:20,w:180,h:150,hover:true});assert.equal(c.depth,0);
  });
  Art.drawGarage(c,{cells:Array.from({length:12},(_,i)=>({id:'bay-'+i,x:120+i%4*160,y:150+Math.floor(i/4)*130,w:140,h:110})),hover:'bay-3'});
  assert.equal(c.depth,0);
});

test('brick stud count exactly follows the requested grid',()=>{
  for(const [cols,rows] of [[1,1],[2,2],[4,2],[6,3]]){
    const c=recorder();Art.drawItem(c,{kind:'brick',cols,rows},{});
    // Two complete ellipses (stud side/bottom and top) plus one contact shadow.
    const completeEllipses=c.calls.filter(call=>call[0]==='ellipse'&&call[7]===Math.PI*2);
    assert.equal(completeEllipses.length,1+cols*rows*2,`${cols} by ${rows} studs`);
  }
});

test('garage draws furniture only and legacy mapping returns independent metadata',()=>{
  const c=recorder();Art.drawGarage(c,{cells:[]});
  assert.equal(c.calls.filter(call=>call[0]==='ellipse').length,1,'only its floor contact shadow');
  const a=Art.legacy('toy-car');a.color='#000000';
  assert.equal(Art.legacy('toy-car').color,'#53955e');
  assert.equal(Art.legacy('dirty-shirt').dirty,true);
  assert.equal(Art.legacy('unknown'),null);
});
