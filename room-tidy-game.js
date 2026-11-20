(function(global){
'use strict';
const D=global.RoomTidyData,W=720,ORDER=['search','garage','lego','clothes','done'];
const Layout=global.RoomTidyLayout;
const COLOR={red:'#d64a3d',blue:'#398cba',yellow:'#e7b93c',green:'#58986a'};
const NAMES={search:'Найдём любимую машинку',garage:'У каждой машинки свой бокс',lego:'Сохраним детали и постройки',clothes:'Одежде тоже нужно место',done:'В комнате стало свободнее'};
const RULES={color:'по цветам',type:'по типам машин',size:'по размерам'};
const ZONE_LABELS={laundry:['Для стирки'],toybox:['Игрушки'], 'parking-tray':['Гараж машинок'], 'lego-tray':['Детали LEGO'],bookshelf:['Книги'],'small-parts':['Мелкие детали','2–4 точки'],'large-parts':['Крупные детали','6 точек и больше'],'model-shelf':['Готовые модели','не разбираем'],drawer:['Ящик для','чистой одежды'],wardrobe:['Шкаф для','чистой одежды']};
const INSTRUCTIONS={search:'Любимая машинка спряталась под вещами. Убирай их по местам. Найденную машинку нажми — и не забудь остальные вещи.',garage:'Выбери машинку и свободный подходящий бокс. На полу появляются следующие машины из этой же коллекции.',lego:'Мелкие и крупные детали — в разные коробки. Готовые постройки бережно ставим на полку.',clothes:'То, что нужно постирать, — в корзину. Чистое можно сложить в ящик или убрать в шкаф. Носки — в ящик.',done:'В игре ты нашёл машинку и разобрал вещи. Маленькое настоящее дело можно попробовать дома.'};
const HELP={search:'Сначала посмотри, какая вещь лежит сверху. Грязную футболку отправим в стирку. Под ней есть ещё предмет. Остальные вещи тоже ждут своих мест.',garage:'Прочитай таблички на гараже. По цвету ищем нужный столбик; по типу или размеру — нужный этаж. Внутри этой группы подойдёт любой свободный бокс.',lego:'У маленьких деталей здесь 2 или 4 точки сверху. У крупных — 6, 8 или 10. Собранные машинку, ракету и домик не разбираем: им нужна полка.',clothes:'Сперва узнай, чистая вещь или её уже решили постирать. Чистую одежду можно хранить разными удобными способами. Грязная не смешивается с чистой.',done:'Игра помогает выбрать порядок действий. В своей комнате начинаем с небольшого места и нескольких предметов.'};
const REAL_STEPS={
 'floor-path':['Выбери небольшой участок пола.','Убери с него только несколько вещей в подходящие места.','Проверь, можно ли пройти, не наступая на игрушки.'],
 'park-cars':['Возьми три свои машинки.','Выбери для них свободные ячейки гаража.','Поставь машинки так, чтобы потом легко было их найти.'],
 'bricks-box':['Найди пять деталей на полу.','Сложи их в коробку для деталей.','Готовую постройку сохрани целиком.'],
 'clothes-home':['Выбери одну вещь.','Узнай, чистая она или её нужно постирать.','Положи её на подходящее место.']
};
const ESC=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function visual(id){
 const item=D.items[id],legacy=global.RoomToyArt.legacy(id);if(legacy)return legacy;
 if(D.carIds.includes(id))return {...item,kind:'car',color:COLOR[item.color],colorName:item.color,carType:item.type,sizeClass:item.size};
 if(D.legoIds.includes(id)||id==='loose-brick')return {...item,kind:item.model?'model':'brick',color:['#d54b3d','#438fa6','#e6b646','#4e9678'][Math.max(0,D.legoIds.indexOf(id))%4],cols:item.cols||2,rows:item.rows||3};
 if(id==='storybook')return {...item,kind:'book',color:'#418f96'};
 return {...item,kind:'clothing',clothingType:({top:'hoodie',jacket:'hoodie',shorts:'trousers',dress:'hoodie'})[item.kind]||item.kind||'shirt',color:item.dirty?'#7799a3':['#d7b36e','#8ca7bd','#8ca493'][D.clothesIds.indexOf(id)%3]};
}
function mount(host,options={}){
 const campaign=options.campaign===true,doneMessage='Игрушки, LEGO и одежда теперь на своих местах.';
 const store=options.store||global.RoomProgress.create({episode:'tidy'}),saved=store.read();
 const game=global.RoomAdventure.create({episode:'tidy'});if(saved.snapshot)game.restore(saved.snapshot);
 const continuing=!!saved.snapshot&&(!campaign||game.snapshot().ruleLocked||game.state.rule!=='color');
 host.innerHTML='<div id="ray-tidy-game"><nav class="tidy-nav" aria-label="Навигация"><a href="./">← Все приключения</a><a href="?room=1">Короткая игра с Рэем</a></nav><header><span class="tidy-kicker">РЭЙ · БОЛЬШАЯ УБОРКА</span><h1>Куда пропала любимая машинка?</h1><p class="tidy-description">Разберём вещи на полу и найдём удобное место для каждой.</p></header><fieldset class="tidy-rule-choice" data-tidy-choices><legend>Как расставим машинки в гараже?</legend><div>'+Object.keys(RULES).map(rule=>'<button type="button" data-tidy-rule="'+rule+'" aria-pressed="false">'+ESC(RULES[rule])+'</button>').join('')+'</div></fieldset><div class="tidy-route" aria-label="Маршрут">'+ORDER.slice(0,-1).map((s,i)=>'<span data-tidy-stage="'+s+'">'+['Поиск','Гараж','LEGO','Одежда'][i]+'</span>').join('')+'</div><div class="tidy-scene" data-tidy-scene><canvas data-tidy-canvas aria-label="Комната и объёмные вещи. Можно перетаскивать или выбрать вещь и нажать на место."></canvas><div class="tidy-hits" data-tidy-hits></div><div class="tidy-intro" data-tidy-intro><div><h2>Машинка где-то под вещами</h2><p>Поможем Рэю найти её. Разберём игрушки, гараж, детали и одежду. Каждый шаг сохраняется.</p><button type="button" class="tidy-primary" data-tidy-start disabled>Готовим комнату…</button></div></div></div><div class="tidy-story"><strong data-tidy-heading></strong><p data-tidy-feedback role="status" aria-live="polite"></p></div><div class="tidy-tools"><button type="button" class="tidy-action" data-tidy-undo>↶ Отменить</button><button type="button" class="tidy-action" data-tidy-hint>Как действовать?</button><button type="button" class="tidy-action" data-tidy-sound aria-pressed="false">Звук: выкл.</button></div><div class="tidy-help" data-tidy-help hidden></div><section class="tidy-end" data-tidy-end hidden><h2>Теперь попробуем в своей комнате?</h2><p>Выбери одно маленькое дело. Игра не выполняет его за тебя.</p><div class="tidy-real-choices" data-tidy-real-choices></div><div class="tidy-real-plan" data-tidy-real-plan></div><div class="tidy-replay-row"><button type="button" class="tidy-action" data-tidy-replay>Сыграть ещё раз</button></div></section><p class="tidy-save" data-tidy-save role="status"></p></div>';
 const root=host.firstElementChild,scene=root.querySelector('[data-tidy-scene]'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d'),hits=root.querySelector('[data-tidy-hits]');
 const reduced=!!global.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
 const actor=global.AdventureActor.create({x:67,y:699,scale:1.35});
 const motion=global.RoomTidyMotion.create({reducedMotion:reduced});
 const outgoing=document.createElement('canvas');outgoing.width=W;outgoing.height=W;
 let started=false,loaded=false,visible=!document.hidden,intersecting=true,raf=0,last=0,time=0,frames=0,scale=1,artwork=null,stage=game.state.stage,selected=null,dragging=null,hover=null,transition=null,sprites=[],flyers=[],message='',help=false,sound=false,audio=null,reactUntil=0,reaction='idle',actorX=67,regionList=[];
 let completed=false,destroyed=false;
 if(campaign){
  const nav=root.querySelector('.tidy-nav'),back=nav.firstElementChild,end=root.querySelector('[data-tidy-end]');
  nav.lastElementChild.remove();
  back.href='?room=campaign';
  back.textContent='← Карта уровней';
  back.setAttribute('data-tidy-map','');
  root.querySelector('.tidy-kicker').textContent='Приключение с Рэем';
  root.querySelector('header h1').textContent='Большая уборка';
  root.querySelector('.tidy-description').textContent='Найди любимую машинку Рэя и разложи вещи по местам.';
  end.querySelector('h2').textContent='Уборка закончена!';
  end.querySelector('p').textContent='Рэй нашёл машинку и навёл порядок в комнате.';
  end.querySelector('[data-tidy-real-choices]').remove();
  end.querySelector('[data-tidy-real-plan]').remove();
  const mapButton=end.querySelector('[data-tidy-replay]');
  mapButton.textContent='К карте';
  mapButton.setAttribute('data-ri-native','');
  sound=saved.sound===true;
  if(sound){
   const soundButton=root.querySelector('[data-tidy-sound]');
   soundButton.setAttribute('aria-pressed','true');
   soundButton.textContent='Звук: вкл.';
  }
 }
 function notice(){root.querySelector('[data-tidy-save]').textContent=store.warning()||'Сохраняем на этом устройстве · можно продолжить позже';}
 function save(){store.save(game.snapshot(),{sound});notice();}
 function enableAudio(){try{if(!audio)audio=new(global.AudioContext||global.webkitAudioContext)();audio.resume().catch(()=>{});}catch(_){}}
 function tone(good){if(!sound||!visible||!audio)return;try{const now=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(good?660:380,now);o.frequency.exponentialRampToValueAtTime(good?980:320,now+.12);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.045,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+.15);o.connect(g);g.connect(audio.destination);o.start(now);o.stop(now+.16);}catch(_){}}
 function currentIds(){return game.availableItems(3);}
 function sourcePoint(id,index){
  return Layout.source(stage,id,index,D.targetId);
 }
 function syncSprites(){
  const old=new Map(sprites.map(s=>[s.id,s]));sprites=currentIds().map((id,index)=>{const p=sourcePoint(id,index),s=old.get(id);return s?Object.assign(s,{tx:p.x,ty:p.y,ox:p.x,oy:p.y}):{id,x:p.x,y:p.y,tx:p.x,ty:p.y,ox:p.x,oy:p.y,size:stage==='search'&&id==='dirty-shirt'?165:stage==='search'?145:160,s:1,ts:1,angle:stage==='search'?({'dirty-shirt':-.18,'storybook':.15,teddy:.08}[id]||0):0};});
 }
 function zones(){
  return Layout.rooms[stage]||[];
 }
 function cells(){return Layout.cells(D.slots);}
 function regions(){
  if(!started||transition||stage==='done')return [];
  const r=sprites.map(s=>({item:s.id,x:s.ox,y:s.oy,w:Math.min(155,s.size),h:stage==='garage'?106:120}));
  if(stage==='garage')for(const c of cells())r.push({target:c.id,x:c.x,y:c.y,w:c.w,h:c.h});
  else for(const z of zones())r.push({target:z.id,x:z.x+z.w/2,y:z.y+z.h/2,w:z.w,h:z.h});
  return r;
 }
 function rebuildHits(){
  const active=document.activeElement,focus=hits.contains(active)?active.dataset.riItem||active.dataset.riTarget:null;
  regionList=regions();hits.innerHTML=regionList.map(r=>{const item=r.item&&D.items[r.item],label=item?item.label:r.target.startsWith('garage-')?'Бокс '+r.target.slice(7).split('-').map(x=>Number(x)+1).join(', '):(ZONE_LABELS[r.target]||[r.target]).join(' ');return '<button type="button" class="tidy-hit" '+(r.item?'data-ri-item="'+r.item+'"':'data-ri-target="'+r.target+'"')+' aria-label="'+ESC(label)+'" style="left:'+r.x/W*100+'%;top:'+r.y/W*100+'%;width:'+Math.max(44,r.w*scale)+'px;height:'+Math.max(44,r.h*scale)+'px"><span class="tidy-sr">'+ESC(label)+'</span></button>';}).join('');
  if(focus)Array.from(hits.children).find(n=>(n.dataset.riItem||n.dataset.riTarget)===focus)?.focus({preventScroll:true});
 }
 function endUI(){
  const end=root.querySelector('[data-tidy-end]');end.hidden=stage!=='done'||!started||(campaign&&!completed);
  if(campaign)return;
  const s=game.state;
  root.querySelector('[data-tidy-real-choices]').innerHTML=D.realGoals.map(g=>'<button type="button" data-tidy-real-goal="'+g.id+'" aria-pressed="'+(s.realGoal===g.id)+'">'+ESC(g.label)+'</button>').join('');
  root.querySelector('[data-tidy-real-plan]').innerHTML=s.realGoal?'<ol>'+REAL_STEPS[s.realGoal].map(t=>'<li>'+ESC(t)+'</li>').join('')+'</ol>'+(s.selfReported?'<p>Ты отметил, что попробовал. Это твоя отметка о настоящем деле.</p>':'<button type="button" class="tidy-primary" data-tidy-real-done>Я попробовал это дома</button>'):'';
  let variants=root.querySelector('[data-tidy-variants]');if(!variants){variants=document.createElement('div');variants.className='tidy-real-choices';variants.dataset.tidyVariants='';variants.setAttribute('aria-label','Новая миссия с другим правилом гаража');root.querySelector('.tidy-replay-row').after(variants);}
  variants.innerHTML=Object.keys(RULES).filter(rule=>rule!==s.rule).map(rule=>'<button type="button" data-tidy-replay-rule="'+rule+'">Новая миссия: '+ESC(RULES[rule])+'</button>').join('');
 }
 function updateUI(){
  const state=game.state;
  root.querySelector('[data-tidy-heading]').textContent=NAMES[stage]+(stage==='garage'?' · '+RULES[state.rule]:'');
  root.querySelector('[data-tidy-feedback]').textContent=message||(campaign&&stage==='done'?doneMessage:INSTRUCTIONS[stage]);
  root.querySelector('[data-tidy-start]').disabled=!loaded;
  root.querySelector('[data-tidy-start]').textContent=continuing?'Продолжить':'Начать приключение';
  root.querySelector('[data-tidy-choices]').hidden=started||game.snapshot().ruleLocked===true;
  root.querySelectorAll('[data-tidy-rule]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tidyRule===state.rule)));
  const undo=root.querySelector('[data-tidy-undo]');
  undo.hidden=campaign&&stage==='done';
  undo.disabled=!state.history?.length||(campaign&&state.stage==='done');
  root.querySelector('[data-tidy-hint]').hidden=campaign&&stage==='done';
  root.querySelector('[data-tidy-help]').hidden=!help;root.querySelector('[data-tidy-help]').textContent=HELP[stage];
  root.querySelectorAll('[data-tidy-stage]').forEach(el=>{const n=ORDER.indexOf(el.dataset.tidyStage),index=ORDER.indexOf(stage);el.classList.toggle('current',n===index);el.classList.toggle('complete',n<index);});
  endUI();rebuildHits();notice();
 }
 function reportCompletion(){
  if(completed||!started||stage!=='done'||transition||motion.active())return;
  completed=true;
  if(campaign)updateUI();
  options.onComplete?.();
 }
 function flightFor(type,payload,item){
  const slot=type==='park'?cells().find(c=>c.id===payload.slot):null;
  const zone=type==='drop'?zones().find(z=>z.id===payload.zone):null;
  const kind=slot?'garage':zone?.id==='laundry'?'laundry':stage==='lego'?'lego':type==='find'?'reveal':'settle';
  const from={x:item.x,y:item.y,scale:item.s,angle:item.angle};
  const to=slot?{x:slot.x,y:slot.baseY,scale:127/item.size}:zone?{x:zone.dropX,y:zone.dropY,scale:placedSize(zone)/item.size}:{x:562,y:556,scale:1.06};
  const cue=motion.trigger(kind,{from,to,item:{...visual(item.id),size:item.size},stage});
  if(cue?.duration>0)flyers.push({id:item.id,size:item.size,cue,startedAt:time,zone:zone?.id});
  if(!reduced)actorX=Math.max(67,Math.min(W-63,to.x-78));
  return cue?.duration||0;
 }
 function doAction(type,payload={}){
  if(transition)return;const before=game.state,result=game.act(type,payload);selected=null;message=result.message;reactUntil=time+.95;reaction=result.accepted?'happy':'think';tone(result.accepted);
  if(result.accepted){
   const item=sprites.find(s=>s.id===payload.id);
   const duration=item&&['drop','park','find'].includes(type)?flightFor(type,payload,item):0;
   if(stage==='search'&&payload.id==='loose-brick'&&type==='drop'){
    const point=sourcePoint(D.targetId,0);
    motion.trigger('reveal',{to:point,stage,duration});
   }
   if(before.stage!==game.state.stage){
    help=false;
    if(campaign&&game.state.stage==='done')message=doneMessage;
    if(reduced){stage=game.state.stage;sprites=[];flyers=[];syncSprites();}
    else transition={to:game.state.stage,at:time+Math.max(.18,duration),end:time+Math.max(.18,duration)+.56,changed:false};
   }
   else syncSprites();
   save();
  }else{const item=sprites.find(s=>s.id===payload.id);if(item){item.tx=item.ox;item.ty=item.oy;item.ts=1;}}
  updateUI();wake();return result;
 }
 function targetAt(p){return regionList.filter(r=>r.target).find(r=>Math.abs(p.x-r.x)<=Math.max(r.w/2,22/scale)&&Math.abs(p.y-r.y)<=Math.max(r.h/2,22/scale))?.target;}
 function place(id,target){if(!target){const s=sprites.find(s=>s.id===id);if(s){s.tx=s.ox;s.ty=s.oy;s.ts=1;}message='Положи вещь в подходящее место. Можно выбрать её и нажать на место.';selected=null;updateUI();return;}doAction(stage==='garage'?'park':'drop',stage==='garage'?{id,slot:target}:{id,zone:target});}
 const input=global.RoomInput.attach({root,scene,
  onSelect(id,p){if(!started||transition)return;if(stage==='search'&&id===D.targetId){doAction('find',{id});input.cancel();return;}selected=id;const s=sprites.find(s=>s.id===id);if(s)s.ts=1.1;message=D.items[id].label+'. Выбери подходящее место.';root.querySelector('[data-tidy-feedback]').textContent=message;draw();},
  onMove(id,p){if(!started||transition)return;const s=sprites.find(s=>s.id===id);if(!s)return;dragging=id;s.x=p.x;s.y=p.y;s.angle=Math.max(-.14,Math.min(.14,(p.x-s.ox)*.001));hover=targetAt(p);draw();},
  onDrop(id,p){if(!started||transition)return;dragging=null;hover=null;place(id,targetAt(p));},
  onTarget(target){if(selected&&started&&!transition)place(selected,target);},
  onCancel(id){dragging=null;hover=null;const s=sprites.find(s=>s.id===id);if(s){s.tx=s.ox;s.ty=s.oy;s.ts=1;}wake();}
 });
 function onControlClick(event){
  const mapLink=event.target.closest('[data-tidy-map]');
  if(mapLink){if(options.onExit){event.preventDefault();options.onExit();}return;}
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-tidy-start')){if(!loaded)return;started=true;root.querySelector('[data-tidy-intro]').hidden=true;if(sound)enableAudio();message='';syncSprites();updateUI();wake();reportCompletion();}
  else if(b.hasAttribute('data-tidy-rule')){doAction('rule',{rule:b.dataset.tidyRule});}
  else if(b.hasAttribute('data-tidy-undo')){input.cancel();flyers=[];motion.clear();doAction('undo');}
  else if(b.hasAttribute('data-tidy-hint')){help=!help;updateUI();}
  else if(b.hasAttribute('data-tidy-sound')){sound=!sound;b.textContent='Звук: '+(sound?'вкл.':'выкл.');b.setAttribute('aria-pressed',String(sound));if(sound){enableAudio();tone(true);}save();}
  else if(b.hasAttribute('data-tidy-replay')){
   if(campaign){root.querySelector('[data-tidy-map]').click();return;}
   input.cancel();game.reset({rule:game.state.rule});stage='search';transition=null;flyers=[];selected=null;help=false;message='';sprites=[];syncSprites();save();updateUI();wake();
  }
  else if(b.hasAttribute('data-tidy-replay-rule')){input.cancel();game.reset({rule:b.dataset.tidyReplayRule});stage='search';transition=null;flyers=[];selected=null;help=false;message='Новая миссия: в гараже будем парковать '+RULES[game.state.rule]+'.';sprites=[];syncSprites();save();updateUI();wake();}
  else if(b.hasAttribute('data-tidy-real-goal'))doAction('real-goal',{id:b.dataset.tidyRealGoal});
  else if(b.hasAttribute('data-tidy-real-done'))doAction('real-done');
 }
 root.addEventListener('click',onControlClick);
 function rounded(x,y,w,h,r,fill){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
 function chip(lines,x,y,selectedStyle=false,font=12){
  lines=Array.isArray(lines)?lines:[lines];ctx.save();ctx.font=(font/scale)+'px "Trebuchet MS",Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const pad=6/scale,line=17/scale,width=Math.max(...lines.map(t=>ctx.measureText(t).width))+pad*2;
  x=Math.max(width/2+5,Math.min(W-width/2-5,x));rounded(x-width/2,y-line*lines.length/2,width,line*lines.length,7/scale,selectedStyle?'#e1f4d5f2':'#fffdf1eb');ctx.fillStyle='#294d3c';lines.forEach((t,i)=>ctx.fillText(t,x,y+(i-(lines.length-1)/2)*line));ctx.restore();
 }
 function placedSize(zone){return zone.itemSize||(zone.id==='model-shelf'?83:zone.id==='wardrobe'?103:Math.min(zone.w*.46,115));}
 function isFlying(id){return flyers.some(flight=>flight.id===id);}
 function objectAt(id,pose){(artwork?.drawItem||global.RoomToyArt.drawItem)(ctx,visual(id),pose);}
 function drawPlaced(z,state){
  const ids=Object.entries(state[stage]||{}).filter(([id,zone])=>zone===z.id&&!isFlying(id)).map(([id])=>id);
  if(!ids.length)return;
  const count=Math.min(ids.length,z.id==='wardrobe'?2:3),shown=ids.slice(-count);
  ctx.save();
  if(z.lipY){ctx.beginPath();ctx.rect(z.x,z.y-25,z.w,z.lipY-z.y+25);ctx.clip();}
  shown.forEach((id,i)=>{
   const offset=(i-(count-1)/2)*Math.min(53,z.w/3);
   objectAt(id,{x:z.dropX+offset,y:z.dropY+(i%2)*7,size:placedSize(z),folded:z.id==='drawer',angle:z.id==='wardrobe'?0:(i-1)*.09});
  });
  ctx.restore();
 }
 function drawSprite(s){
  objectAt(s.id,{x:s.x,y:s.y,size:s.size*s.s,angle:s.angle||0,lift:s.id===dragging?17:0,time});
  if(selected===s.id&&!dragging){ctx.save();ctx.strokeStyle='#f8d275';ctx.lineWidth=4;ctx.setLineDash([8,7]);ctx.beginPath();ctx.ellipse(s.x,s.y+30,s.size*.5,s.size*.33,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
 }
 function drawFlight(flight){
  const progress=(time-flight.startedAt)/flight.cue.duration;
  const pose=motion.sampleFlight(flight.cue,progress);
  const zone=zones().find(z=>z.id===flight.zone);
  ctx.save();
  if(zone?.lipY&&progress>.86){
   ctx.beginPath();ctx.rect(zone.x-20,0,zone.w+40,zone.lipY);ctx.clip();
  }
  ctx.globalAlpha=pose.alpha;
  objectAt(flight.id,{...pose,size:flight.size*pose.scale,folded:zone?.id==='drawer'&&progress>.72});
  ctx.restore();
 }
 function draw(){
  frames++;ctx.clearRect(0,0,W,W);
  const sceneId=stage==='done'?'garage':stage;
  const background=artwork?.backgrounds[sceneId];
  ctx.fillStyle='#243b35';ctx.fillRect(0,0,W,W);
  if(background)ctx.drawImage(background,0,0,W,W);
  else {const floor=ctx.createLinearGradient(0,175,0,W);floor.addColorStop(0,'#a57a4f');floor.addColorStop(1,'#dfb87b');ctx.fillStyle=floor;ctx.fillRect(0,175,W,W-175);}
  motion.drawUnder(ctx);
  const state=game.state;
  if(stage==='garage'||stage==='done'){
   const list=cells();
   if(!background)global.RoomToyArt.drawGarage(ctx,{cells:list,hover,rule:state.rule});
   const hovered=list.find(c=>c.id===hover);
   if(hovered)rounded(hovered.x-hovered.w/2,hovered.y-hovered.h/2,hovered.w,hovered.h,7,'#ffe6993e');
   Object.entries(state.garage).forEach(([id,slot])=>{
    const c=list.find(c=>c.id===slot);if(isFlying(id))return;
    objectAt(id,{x:c.x,y:c.baseY,size:127,time});
   });
   if(stage==='done')chip('Теперь вещи легко найти',360,577,true,14);
   else {
    if(state.rule==='color')D.colors.forEach((color,i)=>chip(({red:'Красные',blue:'Синие',yellow:'Жёлтые',green:'Зелёные'})[color],list[i].x,114,false,11));
    else (state.rule==='type'?['Гоночные','Внедорожники','Рабочие машины']:['Маленькие','Средние','Большие']).forEach((t,i)=>chip(t,360,[169,278,387][i],false,11));
    chip('В гараже: '+Object.keys(state.garage).length+' из 12',360,45,true,12);
   }
  }else{
   for(const z of zones()){
    if(!background)global.RoomToyArt.drawZone(ctx,{...z,hover:hover===z.id,time});
    if(hover===z.id)rounded(z.x,z.y,z.w,z.h,10,'#ffe7a43c');
    drawPlaced(z,state);chip(ZONE_LABELS[z.id],z.x+z.w/2,z.labelY,false,11);
   }
  }
  if(stage!=='search'&&stage!=='done'){
   const total=stage==='garage'?D.carIds.length-Object.keys(state.garage).length:stage==='lego'?D.legoIds.length-Object.keys(state.lego).length:D.clothesIds.length-Object.keys(state.clothes).length;
   chip('На полу осталось: '+total,360,700,false,11);
  }
  actor.draw(ctx);
  for(const s of sprites)if(s.id!==dragging)drawSprite(s);
  for(const flight of flyers)drawFlight(flight);
  const lifted=sprites.find(s=>s.id===dragging);if(lifted)drawSprite(lifted);
  motion.drawOver(ctx);
  if(transition?.changed){
   const direction=transition.back?-1:1;
   const frame=motion.camera({x:0,scale:1,alpha:1},{x:-140*direction,scale:1.10,alpha:0},(time-transition.at)/(transition.end-transition.at));
   ctx.save();ctx.globalAlpha=frame.alpha;const pad=(W*frame.scale-W)/2;ctx.drawImage(outgoing,frame.x-pad,-pad,W*frame.scale,W*frame.scale);ctx.restore();
  }
 }
 function resize(){const width=scene.clientWidth;if(destroyed||!width)return;scale=width/W;const dpr=Math.min(global.devicePixelRatio||1,2.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(width*dpr);ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);rebuildHits();draw();}
 function tick(timestamp){raf=0;if(destroyed||!started||!visible||!root.isConnected)return;const dt=last?Math.min(.045,(timestamp-last)/1000):0;last=timestamp;time+=dt;
  motion.update(dt);
  flyers=flyers.filter(f=>time-f.startedAt<f.cue.duration);
  if(transition){
   if(time>=transition.at&&!transition.changed){
    outgoing.getContext('2d').drawImage(canvas,0,0,W,W);
    transition.changed=true;transition.back=ORDER.indexOf(transition.to)<ORDER.indexOf(stage);
    stage=transition.to;selected=null;sprites=[];flyers=[];motion.clear();syncSprites();updateUI();
    actorX=stage==='done'?570:67;
    if(stage==='done')motion.trigger('finale',{to:{x:380,y:430},stage});
   }
   if(time>=transition.end){transition=null;updateUI();}
  }
  for(const sprite of sprites){
   if(sprite.id===dragging)continue;
   const p=reduced?1:1-Math.exp(-10*dt);
   sprite.x+=(sprite.tx-sprite.x)*p;sprite.y+=(sprite.ty-sprite.y)*p;sprite.s+=(sprite.ts-sprite.s)*p;
  }
  const watched=sprites.find(s=>s.id===(dragging||selected));
  actor.update(dt,{targetX:actorX,targetY:699,mood:stage==='done'?'celebrate':time<reactUntil?reaction:'idle',lookX:watched?.x||360,lookY:watched?.y||410,reducedMotion:reduced});
  draw();reportCompletion();
  if(!destroyed)raf=global.requestAnimationFrame(tick);
 }
 function wake(){if(destroyed)return;if(started&&visible&&!raf){last=0;raf=global.requestAnimationFrame(tick);}else if(!started)draw();}
 function visibility(){if(destroyed)return;visible=intersecting&&!document.hidden;if(!visible){input.cancel();if(raf)global.cancelAnimationFrame(raf);raf=0;last=0;audio?.suspend().catch(()=>{});}else{if(sound)audio?.resume().catch(()=>{});wake();}}
 const hidePage=()=>{intersecting=false;visibility();};
 document.addEventListener('visibilitychange',visibility);global.addEventListener('pagehide',hidePage);
 const observer=global.IntersectionObserver?new IntersectionObserver(e=>{intersecting=e[0]?.isIntersecting!==false;visibility();},{threshold:0}):null;
 observer?.observe(scene);
 const resizer=global.ResizeObserver?new ResizeObserver(resize):null;
 if(resizer)resizer.observe(scene);else global.addEventListener('resize',resize);
 const unsubscribe=store.subscribe?.(()=>notice());
 const debug=Object.freeze({snapshot:()=>({state:game.state,started,loaded,frames,visible,clock:time,displayStage:stage,transitioning:!!transition,reducedMotion:reduced,selected,actor:{x:actor.x,y:actor.y,time:actor._time,moving:actor.moving}}),regions:()=>Array.from(hits.children).map(el=>{const r=el.getBoundingClientRect();return {item:el.dataset.riItem,target:el.dataset.riTarget,x:r.x,y:r.y,width:r.width,height:r.height,centerX:r.x+r.width/2,centerY:r.y+r.height/2};})});
 global.RayTidy=debug;
 syncSprites();updateUI();resize();
 global.RoomTidyArtwork.load().then(result=>{if(!destroyed&&root.isConnected){artwork=result;loaded=true;updateUI();draw();}});
 return {destroy(){
  if(destroyed)return;
  destroyed=true;
  root.removeEventListener('click',onControlClick);
  input.destroy();unsubscribe?.();
  if(!options.store)store.destroy?.();
  observer?.disconnect();resizer?.disconnect();
  document.removeEventListener('visibilitychange',visibility);
  global.removeEventListener('pagehide',hidePage);global.removeEventListener('resize',resize);
  if(raf)global.cancelAnimationFrame(raf);
  audio?.close().catch(()=>{});
  if(global.RayTidy===debug)delete global.RayTidy;
 }};
}
global.RoomTidyGame=Object.freeze({mount,visual});
})(typeof window==='undefined'?globalThis:window);
