/* Dimensional toy-room art. All geometry is local, deterministic, and image-free. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RoomToyArt = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  var TAU = Math.PI * 2;
  function num(v, d) { return Number.isFinite(v) ? v : d; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function color(v, d) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d || '#d6493e'; }
  function tint(c, amount) {
    var match = typeof c === 'string' && c.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
    c = color(c, '#c28d5d'); var n = parseInt(c.slice(1), 16), target = amount < 0 ? 0 : 255;
    var a = Math.abs(amount), r = match ? +match[1] : n >> 16, g = match ? +match[2] : (n >> 8) & 255, b = match ? +match[3] : n & 255;
    return 'rgb(' + [r, g, b].map(function (v) { return Math.round(v + (target - v) * a); }).join(',') + ')';
  }
  function rr(c, x, y, w, h, r) {
    r = Math.min(Math.max(0, r), w / 2, h / 2);
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }
  function poly(c, p) { c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.closePath(); }
  function ell(c, x, y, rx, ry, a) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), a || 0, 0, TAU); }
  function fill(c, value) { c.fillStyle = value; c.fill(); }
  function line(c, value, width) { c.strokeStyle = value; c.lineWidth = width || 1; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function grad(c, x, y, x2, y2, stops) { var g = c.createLinearGradient(x, y, x2, y2); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); return g; }
  function radial(c, x, y, r, light, dark) { var g = c.createRadialGradient(x - r * .32, y - r * .4, r * .03, x, y, r); g.addColorStop(0, light); g.addColorStop(1, dark); return g; }
  function shadow(c, x, y, w, h) { ell(c, x, y, w, h); fill(c, 'rgba(33,39,32,.18)'); }
  function segment(c, x, y, x2, y2, color, width) { c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); line(c, color, width); }
  function wheel(c, x, y, r) {
    ell(c, x, y, r, r * .83); fill(c, grad(c, x, y-r, x, y+r, [[0,'#4c5255'],[.4,'#151c20'],[1,'#070b0e']])); line(c,'#11171a',1.4);
    ell(c, x-.5, y-.5, r*.59, r*.49); fill(c, grad(c,x-r,y-r,x+r,y+r,[[0,'#f5f4e8'],[.45,'#9daeb0'],[.6,'#52636c'],[1,'#d4dedb']]));
    for(var k=0;k<5;k++){var a=k*TAU/5; segment(c,x,y,x+Math.cos(a)*r*.44,y+Math.sin(a)*r*.36,'#65747a',1.3);}
    ell(c,x,y,r*.16,r*.13); fill(c,'#e9efea');
  }
  function car(c, item) {
    var type=item.carType || 'race', col=color(item.color), high=type==='offroad', truck=type==='utility';
    var scale=item.sizeClass==='small'?.67:item.sizeClass==='medium'?.83:1;
    c.save(); c.scale(scale,scale); if(high)c.scale(.94,1.04);
    shadow(c,1,24,55,9);
    // The far wheels, visible beyond the die-cast shell.
    wheel(c,-34,-4,high?12:9); wheel(c,33,-4,high?12:9);
    poly(c,[[-53,2],[-43,-12],[34,-12],[53,1],[48,18],[-45,18]]); fill(c,tint(col,-.35));
    var roof=high?-30:-27;
    poly(c,truck?[[-49,-8],[-37,-17],[-7,-17],[4,roof],[22,roof],[37,-13],[51,-7],[43,7],[-45,7]]:
      [[-51,-7],[-29,-15],[-16,roof],[17,roof],[36,-14],[52,-4],[45,8],[-46,8]]);
    fill(c,grad(c,-17,-31,10,15,[[0,tint(col,.62)],[.18,col],[.47,tint(col,.18)],[.62,col],[1,tint(col,-.3)]])); line(c,tint(col,-.38),1);
    // A narrow top face and a fully shaded side keep the silhouette readable at tray size.
    poly(c,[[-48,7],[45,7],[51,-4],[51,10],[44,21],[-44,21],[-51,12]]); fill(c,grad(c,0,3,0,24,[[0,col],[.28,tint(col,.07)],[1,tint(col,-.37)]]));
    poly(c,[[45,7],[51,-4],[53,7],[45,21]]); fill(c,tint(col,-.46));
    var glass=grad(c,-20,-31,25,-4,[[0,'#e0f7ed'],[.25,'#80b8ba'],[.55,'#295a6a'],[1,'#183744']]);
    if(truck){
      poly(c,[[0,-17],[7,-27],[21,-27],[31,-15],[23,-7],[1,-7]]); fill(c,glass); line(c,tint(col,-.25),1.7);
      segment(c,12,-26,12,-8,tint(col,.25),2.4);
      poly(c,[[-43,-12],[-11,-12],[-5,-5],[-13,1],[-43,1]]); fill(c,tint(col,-.5));
      poly(c,[[-41,-10],[-13,-10],[-8,-5],[-15,-1],[-41,-1]]); fill(c,tint(col,-.16));
      [-35,-28,-21].forEach(function(x){segment(c,x,-9,x+3,-2,tint(col,-.35),1);});
      segment(c,-44,-14,-8,-14,tint(col,.54),2);
    }else{
      poly(c,[[-24,-14],[-13,roof+3],[15,roof+3],[30,-14],[21,-7],[-20,-7]]); fill(c,glass); line(c,tint(col,-.3),1.7);
      segment(c,-1,roof+3,-1,-7,tint(col,.25),2.4);
      segment(c,-11,roof+5,10,roof+5,'rgba(255,255,255,.7)',1.2);
      poly(c,[[31,-12],[46,-6],[40,-1],[25,-4]]); fill(c,tint(col,.29));
      if(high){segment(c,-20,-30,21,-30,'#293e42',3);segment(c,-18,-33,19,-33,'#84989a',2);}
      else {segment(c,-47,-11,-35,-15,tint(col,.6),2);segment(c,28,-9,45,-3,'rgba(255,255,255,.55)',1.3);}
    }
    segment(c,-40,9,38,9,tint(col,.45),1.3); segment(c,2,-4,2,15,tint(col,-.36),.8);
    segment(c,6,3,13,3,'#dce9de',1.8);
    if(high){poly(c,[[-48,9],[-20,9],[-19,19],[-48,19]]);fill(c,'#26363b');poly(c,[[20,9],[47,9],[45,20],[18,20]]);fill(c,'#26363b');}
    wheel(c,-32,18,high?13:10); wheel(c,32,18,high?13:10);
    rr(c,44,5,6,5,1.5);fill(c,'#fff2bb');rr(c,-48,5,5,4,1);fill(c,'#f2664d');
    segment(c,46,17,51,9,'#c2ced0',2);segment(c,-46,19,-49,13,'#aab5b7',2);
    if(type==='race'){segment(c,-45,-12,-46,-19,tint(col,-.3),2);segment(c,-51,-20,-34,-20,tint(col,.12),3);}
    c.restore();
  }
  function brickShape(c, cols, rows, col, unit, height, x, y) {
    var ux=unit, uy=unit*.48, left=x-rows*ux, right=x+cols*ux, bottom=y+(cols+rows)*uy;
    poly(c,[[left,y+rows*uy],[x,y],[right,y+cols*uy],[x+(cols-rows)*ux,bottom]]);
    fill(c,grad(c,left,y,right,bottom,[[0,tint(col,.42)],[.4,tint(col,.12)],[1,col]])); line(c,tint(col,-.18),.7);
    poly(c,[[left,y+rows*uy],[x+(cols-rows)*ux,bottom],[x+(cols-rows)*ux,bottom+height],[left,y+rows*uy+height]]);
    fill(c,grad(c,left,y,left,bottom+height,[[0,tint(col,-.07)],[1,tint(col,-.3)]]));
    poly(c,[[right,y+cols*uy],[x+(cols-rows)*ux,bottom],[x+(cols-rows)*ux,bottom+height],[right,y+cols*uy+height]]);fill(c,tint(col,-.39));
    for(var r=0;r<rows;r++)for(var j=0;j<cols;j++){
      var sx=x+(j-r)*ux, sy=y+(j+r+1)*uy;
      ell(c,sx,sy,unit*.34,unit*.2);fill(c,tint(col,-.28));
      rr(c,sx-unit*.34,sy-unit*.26,unit*.68,unit*.27,unit*.1);fill(c,tint(col,-.13));
      ell(c,sx,sy-unit*.25,unit*.34,unit*.18);fill(c,grad(c,sx-unit*.3,sy-unit*.4,sx+unit*.2,sy,[[0,tint(col,.68)],[.5,tint(col,.2)],[1,col]]));
      c.beginPath();c.ellipse(sx,sy-unit*.25,unit*.27,unit*.12,0,Math.PI,Math.PI*1.65);line(c,'rgba(255,255,255,.65)',.65);
    }
    segment(c,left+1,y+rows*uy+.8,x+(cols-rows)*ux,bottom+.8,'rgba(255,255,255,.37)',.8);
  }
  function brick(c,item){
    var cols=clamp(Math.round(num(item.cols,2)),1,12), rows=clamp(Math.round(num(item.rows,2)),1,8);
    var unit=Math.min(15,94/(cols+rows)), col=color(item.color,'#e9b83c');
    var x=(rows-cols)*unit*.5,y=-(cols+rows)*unit*.24-5;
    shadow(c,0,(cols+rows)*unit*.24+9,Math.min(51,(cols+rows)*unit*.57),8);
    brickShape(c,cols,rows,col,unit,11,x,y);
  }
  function model(c,item){
    var type=item.modelType||'car';shadow(c,0,36,48,9);c.save();
    if(type==='house'){
      brickShape(c,4,3,'#679f9a',9,11,-4,5);brickShape(c,4,3,'#72b5aa',9,11,-4,-7);
      brickShape(c,3,2,'#d77250',9,9,-4,-21);brickShape(c,2,1,'#e49364',9,9,-4,-33);
      poly(c,[[-7,10],[8,17],[8,35],[-7,28]]);fill(c,'#41696c');poly(c,[[15,13],[26,8],[26,21],[15,26]]);fill(c,'#e6f6df');line(c,'#286476',1.2);
      segment(c,20,11,20,23,'#286476',1.2);segment(c,16,19,25,15,'#286476',1.2);
    }else if(type==='rocket'){
      c.save();c.translate(0,9);brickShape(c,3,2,'#cc6450',10,9,-5,15);
      brickShape(c,2,2,'#dce4d4',10,17,0,-1);brickShape(c,2,2,'#e6ecdd',10,17,0,-18);
      brickShape(c,1,1,'#d35d4b',10,13,0,-34);
      poly(c,[[-10,-29],[0,-49],[10,-29],[0,-24]]);fill(c,grad(c,-10,-49,10,-22,[[0,'#efaa78'],[.5,'#d46550'],[1,'#a43f38']]));
      ell(c,7,-2,5,7,-.3);fill(c,'#397e8c');line(c,'#b7c6c1',2);
      poly(c,[[-20,20],[-32,32],[-28,8],[-17,2]]);fill(c,'#ce6050');poly(c,[[17,14],[30,27],[26,4],[16,-1]]);fill(c,'#a54039');c.restore();
    }else{
      wheel(c,-28,25,10);wheel(c,27,25,10);brickShape(c,5,2,'#dfb13e',10,10,-15,0);
      brickShape(c,3,2,'#468f9b',10,10,-7,-13);brickShape(c,2,1,'#74b0b2',10,8,-2,-25);
      wheel(c,-19,34,10);wheel(c,34,24,10);rr(c,35,5,8,5,1);fill(c,'#fff0b4');
    }
    c.restore();
  }
  function clothOutline(c,type){
    if(type==='trousers') {poly(c,[[-27,-41],[26,-41],[29,-18],[20,43],[2,43],[-1,-7],[-8,43],[-27,41],[-29,-17]]);return;}
    c.beginPath();c.moveTo(-15,-34);c.quadraticCurveTo(0,-26,15,-34);c.lineTo(34,-24);c.lineTo(47,-3);c.lineTo(31,9);c.lineTo(22,-4);c.lineTo(25,37);c.quadraticCurveTo(0,43,-25,37);c.lineTo(-22,-4);c.lineTo(-31,9);c.lineTo(-47,-3);c.lineTo(-34,-24);c.closePath();
  }
  function dirty(c){
    [[-9,11,7,4],[14,25,9,5],[-19,-4,5,7]].forEach(function(p){ell(c,p[0],p[1],p[2],p[3],-.4);fill(c,'rgba(110,76,44,.25)');});
    [[-13,10],[-5,15],[10,23],[18,28],[-18,-5],[-22,0]].forEach(function(p){ell(c,p[0],p[1],1.4,1);fill(c,'rgba(96,63,33,.46)');});
    segment(c,-10,8,-3,10,'rgba(95,66,42,.35)',1.4);
  }
  function clothing(c,item,folded){
    var col=color(item.color,'#6b9fb2'),type=item.clothingType||'shirt';shadow(c,1,37,43,8);
    if(folded){
      rr(c,-32,-22,65,54,8);fill(c,tint(col,-.3));rr(c,-34,-27,65,54,7);fill(c,grad(c,-30,-26,28,29,[[0,tint(col,.45)],[.5,col],[1,tint(col,-.16)]]));line(c,tint(col,-.22),.8);
      c.beginPath();c.moveTo(-12,-26);c.quadraticCurveTo(0,-10,12,-26);line(c,tint(col,-.25),4);line(c,tint(col,.45),1.1);
      segment(c,-23,-12,-23,23,tint(col,-.12),1);segment(c,22,-10,22,23,tint(col,.3),1);
      if(item.dirty)dirty(c);return;
    }
    if(type==='socks'){
      [-1,1].forEach(function(s,i){c.save();c.translate(s*18,i*4);c.rotate(s*.17);
        c.beginPath();c.moveTo(-12,-36);c.lineTo(11,-36);c.lineTo(12,8);c.quadraticCurveTo(31,16,22,29);c.quadraticCurveTo(8,41,-9,25);c.quadraticCurveTo(-16,20,-12,6);c.closePath();
        fill(c,grad(c,-16,-30,24,29,[[0,tint(col,.5)],[.4,col],[1,tint(col,-.26)]]));line(c,tint(col,-.25),1);
        segment(c,-10,-26,10,-26,tint(col,.54),2);segment(c,-10,-21,10,-21,tint(col,-.16),1);
        c.beginPath();c.moveTo(-9,9);c.quadraticCurveTo(2,6,10,17);line(c,tint(col,-.2),1.3);
        if(item.dirty){ell(c,11,24,8,4);fill(c,'rgba(115,76,44,.3)');}c.restore();});return;
    }
    if(type==='pajamas'){c.save();c.translate(12,19);c.scale(.77,.77);clothOutline(c,'trousers');fill(c,tint(col,-.1));line(c,tint(col,-.3),1);c.restore();c.save();c.translate(-8,-16);c.scale(.8,.8);}
    clothOutline(c,type);c.save();c.translate(2,3);fill(c,tint(col,-.34));c.restore();
    clothOutline(c,type);fill(c,grad(c,-36,-35,28,42,[[0,tint(col,.5)],[.3,tint(col,.12)],[.68,col],[1,tint(col,-.22)]]));line(c,tint(col,-.28),1);
    c.save();clothOutline(c,type);c.clip();
    [-20,-5,15].forEach(function(x,k){c.beginPath();c.moveTo(x,-18);c.bezierCurveTo(x+13,-4,x-12,16,x+4,36);line(c,'rgba(25,44,47,.08)',7-k);line(c,'rgba(255,255,255,.19)',1.5);});
    if(type==='pajamas'){for(var s=0;s<14;s++){var px=((s*19)%61)-30,py=((s*29)%65)-27;segment(c,px-2,py,px+2,py,'rgba(255,247,216,.7)',1.3);segment(c,px,py-2,px,py+2,'rgba(255,247,216,.7)',1.3);}}
    if(item.dirty)dirty(c);c.restore();
    if(type==='trousers'){segment(c,-25,-32,25,-32,tint(col,-.25),2);segment(c,-1,-31,-1,-8,tint(col,-.3),1.2);segment(c,-19,40,-8,40,tint(col,.35),1);segment(c,6,41,18,41,tint(col,.35),1);}
    else {c.beginPath();c.moveTo(-14,-32);c.quadraticCurveTo(0,-14,14,-32);line(c,tint(col,-.3),3.7);line(c,tint(col,.45),1.1);
      if(type==='hoodie'){c.beginPath();c.moveTo(-15,-31);c.bezierCurveTo(-27,-52,26,-55,16,-31);c.quadraticCurveTo(0,-21,-15,-31);fill(c,grad(c,-12,-48,13,-28,[[0,tint(col,.2)],[1,tint(col,-.32)]]));line(c,tint(col,-.24),1.2);segment(c,-5,-23,-7,-8,'#e4dbc5',1.2);segment(c,5,-23,8,-9,'#e4dbc5',1.2);rr(c,-15,14,30,14,4);line(c,tint(col,-.18),1.2);}
      segment(c,-22,34,22,34,tint(col,.38),1);}
    if(type==='pajamas')c.restore();
  }
  function teddy(c,item){
    var col=color(item.color,'#b47e4c');shadow(c,0,43,35,8);
    function puff(x,y,rx,ry,co){ell(c,x,y,rx,ry);fill(c,radial(c,x,y,Math.max(rx,ry),tint(co,.46),tint(co,-.22)));}
    puff(-26,-31,13,14,col);puff(26,-31,13,14,col);puff(-27,-30,7,8,tint(col,-.2));puff(27,-30,7,8,tint(col,-.2));
    puff(-29,15,14,23,col);puff(29,15,14,23,col);puff(0,17,28,31,col);puff(0,22,18,22,tint(col,.35));
    puff(-20,40,17,12,col);puff(20,40,17,12,col);puff(0,-20,30,27,col);puff(0,-10,18,13,tint(col,.5));
    [-11,11].forEach(function(x){puff(x,-24,3.5,4,'#262824');ell(c,x-1,-25,1,1);fill(c,'#fff9dd');});
    ell(c,0,-13,6,4.5);fill(c,'#4c372d');segment(c,0,-9,0,-4,'#5c4232',1.4);c.beginPath();c.moveTo(-7,-4);c.quadraticCurveTo(0,2,7,-4);line(c,'#6e4b36',1.2);
    // Small curved fibres describe soft plush rather than a flat bear icon.
    for(var i=0;i<36;i++){var a=i*2.399,x=Math.cos(a)*(10+(i%5)*4),y=10+Math.sin(a)*(9+(i%4)*5);segment(c,x,y,x+.8,y-1.6,'rgba(255,235,199,.19)',.7);}
    segment(c,0,10,0,37,'rgba(107,70,40,.22)',.8);
  }
  function book(c,item){var col=color(item.color,'#588f9b');shadow(c,2,27,37,8);poly(c,[[-31,-35],[22,-43],[37,-32],[37,27],[-17,39],[-31,30]]);fill(c,tint(col,-.3));poly(c,[[-25,-31],[23,-38],[32,-29],[32,24],[-19,34],[-25,27]]);fill(c,'#f4e9cb');for(var i=0;i<5;i++)segment(c,-20,27+i,31,18+i,'#c8b995',.6);poly(c,[[-31,-35],[22,-43],[33,-34],[-20,-25],[-20,34],[-31,29]]);fill(c,tint(col,-.2));poly(c,[[-20,-25],[33,-34],[37,-28],[37,25],[-17,36],[-20,31]]);fill(c,grad(c,-20,-30,37,32,[[0,tint(col,.34)],[.5,col],[1,tint(col,-.2)]]));segment(c,-12,-20,30,-28,tint(col,.55),1);segment(c,-13,-15,-11,26,tint(col,-.3),1.4);ell(c,10,0,12,15,-.1);fill(c,'rgba(245,223,162,.58)');poly(c,[[3,5],[10,-9],[18,3]]);fill(c,tint(col,-.22));}
  function key(c){shadow(c,2,24,34,7);c.save();c.rotate(-.35);c.shadowColor='rgba(50,43,22,.2)';c.shadowBlur=3;c.shadowOffsetY=3;ell(c,-20,-9,18,19);fill(c,grad(c,-36,-30,15,30,[[0,'#fff3bf'],[.25,'#cfa854'],[.46,'#fff0ae'],[.7,'#ad7c2c'],[1,'#e8c371']]));rr(c,-7,-15,51,12,3);fill(c,'#d1a850');poly(c,[[26,-5],[44,-5],[44,7],[36,7],[36,1],[29,1],[29,8],[24,8]]);fill(c,'#c49a43');c.shadowColor='transparent';ell(c,-20,-9,9,10);fill(c,'#627e73');line(c,'#a17b34',1);segment(c,-5,-12,41,-12,'#fff1b1',2);c.restore();}
  function drawItem(ctx,item,options){
    if(!ctx)return;item=item||{};options=options||{};
    ctx.save();ctx.translate(num(options.x,0),num(options.y,0));ctx.rotate(num(options.angle,0));var s=clamp(num(options.size,120),4,1200)/120;ctx.scale(s,s);
    try{switch(item.kind){case'car':car(ctx,item);break;case'brick':brick(ctx,item);break;case'model':model(ctx,item);break;case'clothing':clothing(ctx,item,!!options.folded);break;case'teddy':teddy(ctx,item);break;case'book':book(ctx,item);break;case'key':key(ctx);break;default:brick(ctx,item);}}
    finally{ctx.restore();}
  }
  function wood(c,x,y,w,h,dark){
    rr(c,x,y,w,h,5);fill(c,grad(c,x,y,x+w,y+h,[[0,dark?'#ac794c':'#e2bc84'],[.28,dark?'#bd8b58':'#d5a972'],[.68,dark?'#99683f':'#c18b53'],[1,dark?'#805632':'#a97143']]));
    c.save();rr(c,x,y,w,h,5);c.clip();for(var i=1;i<7;i++){var yy=y+h*i/7;c.beginPath();c.moveTo(x,yy);c.bezierCurveTo(x+w*.3,yy-3,x+w*.7,yy+4,x+w,yy-1);line(c,'rgba(104,63,31,.11)',.8);}c.restore();
    segment(c,x+4,y+1,x+w-4,y+1,'rgba(255,238,199,.65)',1.3);
  }
  function well(c,x,y,w,h,hover){
    rr(c,x,y,w,h,8);fill(c,grad(c,x,y,x,y+h,[[0,hover?'#497e76':'#5b7775'],[.5,hover?'#80aa91':'#8fa99b'],[1,hover?'#9abc9e':'#a9bb9e']]));line(c,hover?'#f8cf6d':'rgba(29,63,61,.45)',hover?3:1.2);
    rr(c,x+5,y+6,w-10,h-11,5);line(c,'rgba(233,244,212,.25)',1);
  }
  function drawGarage(ctx,o){
    if(!ctx)return;o=o||{};var cells=Array.isArray(o.cells)?o.cells:[];ctx.save();var sc=clamp(num(o.scale,1),.1,5);ctx.scale(sc,sc);
    try{
      // Three warm timber decks, deep shadowed parking wells, and structural posts.
      shadow(ctx,361,480,323,15);wood(ctx,35,75,650,398,true);
      rr(ctx,48,91,624,369,6);fill(ctx,grad(ctx,0,90,0,460,[[0,'#324e50'],[.5,'#486460'],[1,'#223e43']]));
      [97,227,357].forEach(function(y){poly(ctx,[[48,y],[656,y],[672,y+20],[62,y+20]]);fill(ctx,'#d1ad75');wood(ctx,48,y+108,624,16,false);segment(ctx,52,y+109,665,y+109,'#fae0af',1.4);});
      cells.forEach(function(cell){var w=clamp(num(cell.w,140),24,300),h=clamp(num(cell.h,110),24,200),x=num(cell.x,120)-w/2,y=num(cell.y,150)-h/2;well(ctx,x+7,y+13,w-14,h-26,o.hover===cell.id || (o.hover&&o.hover.id===cell.id));
        segment(ctx,x+19,y+31,x+19,y+h-26,'rgba(244,226,163,.52)',1.4);segment(ctx,x+w-19,y+31,x+w-19,y+h-26,'rgba(244,226,163,.52)',1.4);
        poly(ctx,[[x+w*.5-6,y+h-28],[x+w*.5,y+h-35],[x+w*.5+6,y+h-28]]);line(ctx,'rgba(244,226,163,.4)',1.1);
      });
      [41,194,354,514,670].forEach(function(x,i){wood(ctx,x,86,i===0||i===4?12:7,381,true);segment(ctx,x+1,89,x+1,461,'#e4bc82',1.2);});
      wood(ctx,32,64,656,25,false);wood(ctx,30,463,660,20,true);rr(ctx,301,64,119,23,6);fill(ctx,'#39777a');segment(ctx,314,70,406,70,'#7cb2a6',1);
    }finally{ctx.restore();}
  }
  function basket(c,w,h,laundry,hover){
    var rim=h*.21, body=h*.66;shadow(c,w*.52,h*.96,w*.42,h*.05);
    ell(c,w/2,rim,w*.45,rim*.76);fill(c,'#766440');ell(c,w/2,rim-2,w*.41,rim*.55);fill(c,laundry?'#6b8580':'#6a654b');
    c.beginPath();c.moveTo(w*.05,rim);c.quadraticCurveTo(w*.08,h*.72,w*.17,h*.89);c.quadraticCurveTo(w/2,h*1.01,w*.83,h*.89);c.quadraticCurveTo(w*.94,h*.66,w*.95,rim);c.quadraticCurveTo(w*.5,rim+body*.36,w*.05,rim);c.closePath();fill(c,grad(c,0,rim,w,h,[[0,'#cfae78'],[.4,'#b89460'],[.73,'#ad8854'],[1,'#826139']]));line(c,hover?'#ffe09a':'#8d6b43',hover?3:1.2);
    c.save();c.clip();for(var y=rim+8;y<h;y+=7)segment(c,0,y,w,y,'rgba(247,217,162,.48)',2);for(var x=0;x<w;x+=11){c.beginPath();c.moveTo(x,rim);c.quadraticCurveTo(x-8,h*.6,x+6,h);line(c,'rgba(103,76,42,.33)',3);segment(c,x+2,rim+5,x+4,h,'rgba(237,205,151,.23)',1);}c.restore();
    ell(c,w/2,rim,w*.45,rim*.7);line(c,'#d9bc85',6);line(c,'#967445',1);
    if(laundry){c.beginPath();c.moveTo(w*.16,rim+2);c.bezierCurveTo(w*.18,-h*.03,w*.53,-h*.08,w*.6,rim);c.quadraticCurveTo(w*.77,rim-h*.13,w*.83,rim+2);fill(c,grad(c,0,0,w,rim+8,[[0,'#c4d0bc'],[.5,'#edf0da'],[1,'#9caf9f']]));segment(c,w*.29,0,w*.37,rim,'rgba(94,131,128,.25)',3);}
  }
  function chest(c,w,h,hover){
    shadow(c,w*.51,h*.95,w*.45,h*.06);
    // Lifted timber lid has a beveled inset, metal hinges, and a shadowed opening.
    poly(c,[[w*.04,h*.04],[w*.88,0],[w*.97,h*.32],[w*.12,h*.36]]);fill(c,grad(c,0,0,w,h*.4,[[0,'#dfb778'],[.5,'#b7854b'],[1,'#8f623b']]));line(c,'#9b6d40',1.2);
    poly(c,[[w*.12,h*.09],[w*.83,h*.06],[w*.89,h*.27],[w*.17,h*.29]]);fill(c,grad(c,0,0,w,h*.4,[[0,'#d5ad71'],[1,'#b18450']]));line(c,'rgba(109,70,34,.35)',1);
    for(var i=0;i<3;i++)segment(c,w*(.17+i*.05),h*(.14+i*.03),w*(.81+i*.02),h*(.1+i*.045),'rgba(111,73,34,.13)',.8);
    poly(c,[[w*.03,h*.38],[w*.86,h*.32],[w*.98,h*.48],[w*.15,h*.57]]);fill(c,'#5e644a');
    poly(c,[[w*.09,h*.4],[w*.83,h*.36],[w*.9,h*.46],[w*.17,h*.53]]);fill(c,grad(c,0,h*.3,0,h*.6,[[0,'#3c5149'],[1,'#758174']]));
    poly(c,[[w*.86,h*.32],[w*.98,h*.48],[w*.96,h*.88],[w*.86,h*.82]]);fill(c,'#95673b');
    poly(c,[[w*.03,h*.38],[w*.15,h*.57],[w*.15,h*.96],[w*.04,h*.82]]);fill(c,'#b5844b');
    poly(c,[[w*.15,h*.57],[w*.98,h*.48],[w*.96,h*.88],[w*.15,h*.96]]);fill(c,grad(c,0,h*.45,0,h,[[0,'#d6ad70'],[.4,'#c59659'],[1,'#aa7844']]));line(c,hover?'#ffe2a1':'#996c3e',hover?3:1.1);
    segment(c,w*.18,h*.61,w*.94,h*.53,'#efd09a',1.7);segment(c,w*.18,h*.91,w*.92,h*.84,'rgba(113,72,32,.2)',1);
    [0.27,.79].forEach(function(t){rr(c,w*t,h*.35,9,9,2);fill(c,'#bba672');segment(c,w*t+2,h*.37,w*t+6,h*.37,'#e4d1a0',1);});
    c.save();c.translate(w*.56,h*.69);c.rotate(-.095);rr(c,-w*.1,0,w*.2,h*.045,3);fill(c,'#826b47');segment(c,-w*.075,1,w*.075,1,'#e3cc96',1);c.restore();
    [w*.2,w*.9].forEach(function(x){ell(c,x,h*.63,1.3,1.3);fill(c,'#9c794e');});
  }
  function drawZone(ctx,o){
    if(!ctx)return;o=o||{};var x=num(o.x,0),y=num(o.y,0),w=clamp(num(o.w,180),36,720),h=clamp(num(o.h,120),36,600),id=o.id||'toybox',hover=!!o.hover;
    ctx.save();ctx.translate(x,y);
    try{
      var lip=Math.max(10,h*.12), border=hover?'#f7ce71':'#8c653e';
      if(id==='laundry'){basket(ctx,w,h,true,hover);return;}
      if(id==='toybox'){chest(ctx,w,h,hover);return;}
      shadow(ctx,w*.52,h*.96,w*.46,h*.055);
      if(id==='wardrobe'){
        wood(ctx,0,0,w,h,true);rr(ctx,9,8,w-18,h-20,4);fill(ctx,grad(ctx,0,0,w,h,[[0,'#416563'],[1,'#294c50']]));
        segment(ctx,w*.13,h*.2,w*.87,h*.2,'#c4cbb4',4);segment(ctx,w*.13,h*.19,w*.87,h*.19,'#f1edcd',1.1);
        [0.28,.51,.74].forEach(function(t){var hx=w*t,hy=h*.34;ctx.beginPath();ctx.arc(hx,hy-h*.09,5,Math.PI,TAU*1.1);ctx.lineTo(hx,hy);ctx.lineTo(hx-w*.14,hy+h*.1);ctx.quadraticCurveTo(hx,hy+h*.14,hx+w*.14,hy+h*.1);ctx.lineTo(hx,hy);line(ctx,'#d4b888',2);});
        wood(ctx,0,h-15,w,15,false);wood(ctx,0,0,10,h,false);wood(ctx,w-10,0,10,h,false);wood(ctx,-3,-2,w+6,13,false);
      }else if(id==='bookshelf'||id==='model-shelf'){
        wood(ctx,0,0,w,h,true);rr(ctx,9,7,w-18,h-17,2);fill(ctx,'#5e7367');
        var levels=id==='bookshelf'?2:1;for(var l=1;l<=levels;l++){var yy=h*l/(levels+1);poly(ctx,[[10,yy-8],[w-11,yy-8],[w-3,yy+2],[3,yy+2]]);fill(ctx,'#dcc098');wood(ctx,4,yy+2,w-8,8,false);}
        wood(ctx,0,0,9,h,false);wood(ctx,w-9,0,9,h,false);wood(ctx,-2,-2,w+4,11,false);wood(ctx,-2,h-11,w+4,11,false);
        if(id==='model-shelf'){rr(ctx,w*.2,h*.71,w*.6,h*.13,4);fill(ctx,'#597f78');segment(ctx,w*.23,h*.73,w*.77,h*.73,'#bdd2b2',1);}
      }else if(id==='parking-tray'){
        wood(ctx,0,0,w,h,true);
        const gap=6, bayWidth=(w-gap*4)/3, bayHeight=(h-gap*3)/2;
        for(let row=0;row<2;row++)for(let column=0;column<3;column++){
          well(ctx,gap+column*(bayWidth+gap),gap+row*(bayHeight+gap),bayWidth,bayHeight,hover);
        }
        wood(ctx,0,0,w,gap,false);
      }else if(id==='drawer'){
        wood(ctx,1,0,w-2,h,true);poly(ctx,[[6,h*.12],[w-12,h*.12],[w,h*.33],[14,h*.33]]);fill(ctx,'#ead0a6');well(ctx,13,h*.17,w-26,h*.46,hover);
        wood(ctx,4,h*.59,w-8,h*.36,false);rr(ctx,w*.36,h*.71,w*.28,8,4);fill(ctx,'#5f7468');segment(ctx,w*.38,h*.72,w*.62,h*.72,'#d6d4b2',1.3);
      }else{
        // Low trays use a visible recessed interior, thick lip, and projecting front wall.
        var teal=id==='parking-tray'||id==='lego-tray', base=teal?'#4c9290':'#c5955b';
        rr(ctx,0,h*.12,w,h*.8,9);fill(ctx,tint(base,-.34));rr(ctx,2,1,w-4,h*.78,9);fill(ctx,grad(ctx,0,0,w,h,[[0,tint(base,.4)],[.45,base],[1,tint(base,-.2)]]));
        well(ctx,10,10,w-20,h*.61,hover);rr(ctx,0,h*.69,w,h*.23,7);fill(ctx,grad(ctx,0,h*.69,0,h,[[0,tint(base,.22)],[.23,base],[1,tint(base,-.3)]]));line(ctx,border,hover?2.5:1);
        segment(ctx,7,h*.72,w-7,h*.72,tint(base,.5),1.5);
        if(id==='lego-tray'||id==='small-parts'||id==='large-parts'){[.33,.66].forEach(function(a){rr(ctx,w*a-3,12,6,h*.57,2);fill(ctx,tint(base,-.28));segment(ctx,w*a-2,13,w*a-2,h*.63,tint(base,.5),1);});
          if(id==='small-parts')segment(ctx,12,h*.36,w-12,h*.36,tint(base,-.25),4);
        }
        if(id==='parking-tray'){[.25,.5,.75].forEach(function(a){segment(ctx,w*a,17,w*a,h*.61,'rgba(246,229,173,.52)',1.5);});}
        rr(ctx,w*.38,h*.76,w*.24,6,3);fill(ctx,teal?'#285b61':'#8d673f');
      }
      if(hover){rr(ctx,-2,-3,w+4,h+4,10);line(ctx,'rgba(255,214,111,.78)',2.5);}
    }finally{ctx.restore();}
  }
  function legacy(id){
    if(id==='toy-car')return{id:'toy-car',kind:'car',carType:'race',sizeClass:'medium',color:'#53955e',colorName:'green'};
    if(id==='teddy')return{id:'teddy',kind:'teddy',color:'#b47e4c',colorName:'brown'};
    if(id==='dirty-shirt')return{id:'dirty-shirt',kind:'clothing',clothingType:'shirt',color:'#6e9eae',colorName:'blue',dirty:true};
    return null;
  }
  return {drawItem:drawItem,drawGarage:drawGarage,drawZone:drawZone,legacy:legacy};
}));
