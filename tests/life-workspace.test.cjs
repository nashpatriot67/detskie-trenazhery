'use strict';
// Presentation contracts on the real engine. Synthetic records only;
// layout must not introduce another progress owner or alter its snapshots.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),ctx=vm.createContext({});
for(const file of ['learning-progress.js','life-quest-data.js','life-school-schedule.js','school-packing-flow.js','life-quests.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const L=ctx.LifeQuests,F=ctx.SchoolPackingFlow,D=ctx.LifeQuestData,LP=ctx.LearningProgress;
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;},eq=(a,b,m)=>{assert.equal(a,b,m);checks++;},plain=v=>JSON.stringify(v),env={LP,generation:'synthetic-workspace',observe(){},announce(){}},act=(s,a,p)=>L.handle(s,a,p||{},env),key=h=>h.match(/data-workspace-key="([^"]+)"/)?.[1];
for(const q of D.quests){
 const s=L.create(env);act(s,'open',{quest:q.id});act(s,'begin');const before=plain(L.snapshot(s)),html=L.render(s,env);
 ok(html.includes('trainer-workspace'),q.id+' marks the active task');ok(key(html),q.id+' has stable identity');eq(plain(L.snapshot(s)),before,'Rendering preserves every progress field');
 ok(html.includes('data-workspace-focus'),q.id+' has a focus target for a task transition');
 if(q.mode==='pack'||q.mode==='sort'||q.mode==='rule')ok(html.includes('lq-workbench')||q.packingStages?.[0]?.itemIds.length===0,q.id+' uses a workbench');
 const hasChoices=!q.packingStages||F.visibleItems(q,s.packingFlow).length>0;
 if(q.mode!=='sequence'&&hasChoices)ok(html.includes('data-workspace-fit data-workspace-scroll="life-bank"'),q.id+' remembers inventory position and fits below the condition');
 if(hasChoices){ok(html.indexOf('lq-scene-preview')>html.indexOf('workspace-actions'),q.id+' scene follows the working controls');ok(html.includes('data-workspace-disclosure="life-scene"'),q.id+' scene can stay open on rerender');}
 const first=q.packingStages?F.visibleItems(q,s.packingFlow)[0]:q.itemIds?.[0];
 if(first){act(s,q.mode==='pack'?'toggle':'select',{item:first});eq(key(L.render(s,env)),key(html),'A selection never requests a new-task scroll');}
}
const s=L.create(env);act(s,'open',{quest:'life.school.week.tue.base'});act(s,'begin');let q=L.current(s),oldkey=key(L.render(s,env));
for(const id of F.current(q,s.packingFlow).required)act(s,'toggle',{item:id});act(s,'packing-check');eq(key(L.render(s,env)),oldkey,'Checking a local stage preserves the working position');
act(s,'packing-next');ok(key(L.render(s,env))!==oldkey,'The next lesson gets a new focus/scroll boundary');
// All exact item IDs must be passed to the same artwork API in card and scene.
ctx.ObjectArt={has:id=>!!D.items[id],markup:id=>'<svg data-art-item="'+id+'"></svg>',inner:id=>'<g data-art-item="'+id+'"></g>'};
let html=L.render(s,env),id=F.visibleItems(q,s.packingFlow)[0];ok(html.includes('<svg data-art-item="'+id+'"'),'A card uses its own item identity');ok(html.includes('<g data-art-item="'+id+'"'),'The live scene uses the identical item identity');
const sort=L.create(env);act(sort,'open',{quest:'life.places.after-play'});act(sort,'begin');html=L.render(sort,env);ok(html.includes('lq-sort-layout lq-workbench'),'Sorting keeps source and destinations together');
const pool=L.create(env);act(pool,'open',{quest:'life.sport.pool'});act(pool,'begin');const poolHtml=L.render(pool,env),poolQ=L.current(pool);ok(poolHtml.includes(poolQ.story),'The full packing memo remains visible in the task');ok(poolHtml.indexOf('lq-help-preview')>poolHtml.indexOf('workspace-actions'),'Optional generic help follows the working table');ok(!poolHtml.includes('lq-first-step'),'Repeated generic first-step chrome no longer pushes the bank down');ok(poolHtml.includes('lq-scroll-cue'),'Large inventories have a remaining-content cue');ok(L.render(s,env).includes('data-workspace-disclosure="life-roadmap"'),'The day map remembers its open state');ok(L.render(s,env).includes('data-workspace-disclosure="life-ready"'),'Previously checked things remember their open state');
// Interpret the illustrated step itself: laundry differs from clean clothing,
// sports preparation includes its shoes, and a pen is not an eraser.
vm.runInContext(fs.readFileSync(path.join(root,'object-art.js'),'utf8'),ctx,{filename:'object-art.js'});
for(const [questId,step,artIds]of [['life.plan.pool-return','wash',['dirty-shirt']],['life.plan.room','clothes',['dirty-shirt','clean-shirt']],['life.plan.thursday-evening','sport',['sport-uniform','sport-shoes']],['life.plan.desk','tools',['pencil','blue-pen']]]){
 const run=L.create(env);act(run,'open',{quest:questId});act(run,'begin');act(run,'step',{step});const before=plain(L.snapshot(run)),markup=L.render(run,env);
 for(const id of artIds)ok(markup.includes('data-object-art="'+id+'"'),questId+' illustrates the stated item: '+id);
 eq(plain(L.snapshot(run)),before,'Semantic artwork never changes saved answers');
}
const css=fs.readFileSync(path.join(root,'life-quests.css'),'utf8');ok(css.includes('.lq .workspace-actions .lq-btn[hidden]{display:none!important}'),'Only the applicable check/next primary is shown');ok(css.includes('min-height:44px'),'Compact controls retain touch dimensions');
console.log(JSON.stringify({success:true,checks,quests:D.quests.length,renderPreservesProgress:true,stableTaskBoundaries:true,sameArtAcrossContexts:true,productionWrites:false}));
