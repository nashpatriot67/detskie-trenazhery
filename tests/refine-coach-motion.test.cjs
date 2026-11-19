'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({window:{},setTimeout(){throw Error('No motion timer belongs in pure model')},setInterval(){throw Error('No independent animation timer')}});
for(const f of ['coach-plan.js','coach-audio-manifest.js','active-breaks.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
const A=context.window.ActiveBreaks,P=context.window.CoachMovementPlan,M=context.window.CoachAudioManifest,plain=v=>JSON.parse(JSON.stringify(v));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++},ok=(v,m)=>{assert.ok(v,m);checks++};
const env={announce(){},observe(){throw Error('Physical demonstration must not award academic evidence')}};
const act=(s,a,d={})=>A.handle(s,a,d,env);
eq(A.ROUTINES.length,12);eq(Object.keys(P.CUES).length,41);eq(Object.keys(M.clips).length,41);
let totalSegments=0,animatedSegments=0;
for(const r of A.ROUTINES){
 const s=A.create({routineId:r.id}),p=A.plan(s);ok(p.length>=5,r.id+' has a full start/movement/rest sequence');eq(p[0].step,0);eq(p.at(-1).clipId,'rest');eq(new Set(p.map(x=>x.id)).size,p.length);
 const before=A.frame(s,{segmentId:p[1].id,progress:.8,playing:true});eq(before.playing,false);eq(before.progress,0,'No movement before Start');eq(s.elapsed,0);eq(s.completed,false);
 eq(act(s,'start'),true);eq(s.phase,'moving');eq(s.coachStatus,'loading');eq(A.frame(s,{segmentId:p[1].id,progress:.8,playing:false}).progress,0,'Loading does not move the avatar');
 const start=plain(s);eq(act(s,'tick',{seconds:1,visible:true}),false,'Old wall clock cannot drive a voiced movement');eq(s.elapsed,start.elapsed);
 let cumulative=0;
 for(let index=0;index<p.length;index++){
  const segment=p[index],clip=M.clips[segment.clipId];totalSegments++;ok(!!clip,'Every movement has a real coach clip');eq(segment.text,clip.text);eq(segment.seconds,clip.duration);ok(segment.seconds>=P.CUES[segment.clipId].minDuration);ok(fs.existsSync(path.join(root,clip.src)));
  const zero=A.frame(s,{segmentId:segment.id,index,progress:0,playing:true}),quarter=A.frame(s,{segmentId:segment.id,index,progress:.25,playing:true}),half=A.frame(s,{segmentId:segment.id,index,progress:.5,playing:true}),full=A.frame(s,{segmentId:segment.id,index,progress:1,playing:true});
  const moving=JSON.stringify(zero.points)!==JSON.stringify(quarter.points)||JSON.stringify(quarter.points)!==JSON.stringify(half.points)||JSON.stringify(half.points)!==JSON.stringify(full.points);if(moving)animatedSegments++;if(segment.from!==segment.to||segment.motion)ok(moving,'Each designated movement changes the actual joints: '+segment.id);
  for(const view of [zero,quarter,half,full])for(const value of Object.values(view.points)){if(Array.isArray(value)){ok(value.every(Number.isFinite));ok(value[0]>=25&&value[0]<=315,'Joint stays in the fixed viewbox');ok(value[1]>=9&&value[1]<=270,'Joint stays above the floor');}else ok(Number.isFinite(value));}
  eq(act(s,'coach-frame',{segmentId:segment.id,index,progress:.5,playing:true,audioTime:clip.duration/2,duration:clip.duration}),true);eq(s.coachIndex,index);eq(s.coachTime,clip.duration/2);ok(Math.abs(s.elapsed-(cumulative+clip.duration/2))<1e-8,'Elapsed derives from media time');
  const held=A.frame(s,{segmentId:segment.id,progress:.5,playing:true});act(s,'pause');const frozen=A.frame(s,{segmentId:p.at(-1).id,progress:.9,playing:true});eq(frozen.points,held.points,'Late frames cannot move a paused figure');eq(act(s,'coach-frame',{segmentId:segment.id,progress:.9,playing:true}),false);eq(s.coachTime,clip.duration/2);
  const saved=plain(s),restored=A.restore(saved);eq(restored.coachTime,saved.coachTime);eq(restored.coachProgress,saved.coachProgress);eq(restored.running,false);eq(restored.completed,false);eq(A.frame(restored,{playing:false}).points,held.points,'Reopen is held on the saved pose');
  act(s,'resume');eq(s.coachStatus,'loading');eq(A.frame(s,{segmentId:segment.id,progress:.8,playing:false}).points,held.points);act(s,'coach-frame',{segmentId:segment.id,index,progress:1,playing:true,audioTime:clip.duration,duration:clip.duration});cumulative+=clip.duration;
 }
 ok(A.duration(s)>20&&A.duration(s)<100,'The complete routine stays brief and realistic');eq(s.demoReps,p.filter(x=>x.completesRep).length);eq(s.completed,false);eq(s.solved,false);
 act(s,'coach-end');eq(s.running,false);eq(s.coachFinished,true);eq(s.completed,false,'Finishing the media does not verify a child moved');eq(s.solved,false);eq(s.reports,[]);
 const finished=A.render(s,env);ok(finished.includes('Я размялся, закончить'));ok(finished.includes('Повторить показ'));
 act(s,'finish');eq(s.completed,true);eq(s.reports.length,1);eq(s.reports[0].status,'self-reported');ok(A.render(s,env).includes('Отмечено тобой'));act(s,'finish');eq(s.reports.length,1);
}
ok(animatedSegments>=70,'Every exercise has genuine joint movement, alongside deliberate preparation/count/rest holds');
// Squats keep both feet planted and move hips/head down; wall hands stay fixed.
for(const [id,clipId]of [['break.squats','squat-down'],['break.wall-push','wall-bend']]){
 const s=A.create({routineId:id});act(s,'start');const segment=A.plan(s).find(x=>x.clipId===clipId),a=A.frame(s,{segmentId:segment.id,progress:0,playing:true}),b=A.frame(s,{segmentId:segment.id,progress:1,playing:true});
 eq(a.points.la,b.points.la);eq(a.points.ra,b.points.ra);
 if(id==='break.squats'){ok(b.points.head[1]>a.points.head[1]);ok(b.points.lh[1]>a.points.lh[1]);eq(segment.repTotal,3);ok(!A.current(s).title.includes('Пять'));}
 else{eq(a.points.lw,b.points.lw);eq(a.points.rw,b.points.rw);ok(b.points.head[0]>a.points.head[0]);eq(segment.repTotal,3);}
}
// Separate failure and silent modes never pretend recorded sound played.
const failure=A.create({routineId:'break.squats'});act(failure,'start');act(failure,'audio-error');eq(failure.running,false);eq(failure.coachStatus,'error');ok(A.render(failure,env).includes('Показ без звука'));eq(failure.completed,false);act(failure,'silent-start');eq(failure.audioMode,'silent');eq(failure.running,true);eq(act(failure,'tick',{seconds:2,visible:true}),true);eq(failure.elapsed,2);act(failure,'hide');eq(failure.running,false);
act(failure,'skip');eq(failure.completed,false);eq(failure.returnRequested,true);const reopened=A.restore(plain(failure));act(reopened,'start');eq(reopened.skipped,false);eq(reopened.solved,false);eq(reopened.coachTime,0);
// Old v1 snapshots restore safely without starting media or inventing movement.
const legacy=A.restore({version:1,routineId:'break.wall-push',phase:'moving',step:1,elapsed:12,running:true,timerEnabled:true,reports:[]});eq(legacy.running,false);eq(legacy.coachIndex,0);eq(legacy.coachTime,0);eq(legacy.audioMode,'voice');eq(legacy.completed,false);
// Attribute-only rendering keeps the same SVG and the same controls alive.
const dom=A.create({routineId:'break.squats'});act(dom,'start');const nodes={},attrs={},text={};for(const name of ['torso','neck','leftArm','rightArm','leftUpper','rightUpper','leftLower','rightLower','leftShoe','rightShoe','head','leftHand','rightHand','leftSleeve','rightSleeve','eyes','leftFingers','rightFingers'])nodes[name]={setAttribute(k,v){attrs[name+':'+k]=v},getAttribute(k){return k==='data-ab-node'?name:null}};
const svg={dataset:{},querySelectorAll(){return Object.values(nodes)},setAttribute(k,v){attrs['svg:'+k]=v}};let htmlWrites=0;
const container={matches(){return false},querySelector(selector){if(selector==='[data-ab-avatar]')return svg;if(selector==='[data-ab-motion-progress]')return {style:{}};return text[selector]||(text[selector]={textContent:''})},set innerHTML(v){htmlWrites++;}};
const seg=A.plan(dom).find(x=>x.clipId==='squat-down');for(const progress of [0,.2,.5,.8,1])ok(A.updateFrame(container,dom,{segmentId:seg.id,progress,playing:true,audioTime:seg.seconds*progress,duration:seg.seconds}));eq(htmlWrites,0);eq(dom.coachProgress,1);ok(attrs['torso:d']);ok(attrs['head:transform']);eq(text['[data-ab-current-instruction]'].textContent,seg.text);eq(text['[data-ab-repetition]'].textContent,'Показ: 1 из 3');eq(text['[data-ab-coach-status]'].textContent,'Женский голос тренера');act(dom,'pause');A.updateFrame(container,dom,{playing:false});eq(text['[data-ab-coach-status]'].textContent,'Показ на паузе');
console.log(JSON.stringify({success:true,checks,routines:A.ROUTINES.length,realAudioCues:Object.keys(M.clips).length,totalSegments,animatedSegments,mediaClockAuthority:true,noPreStartMotion:true,pauseFreezes:true,physicalCompletion:'self-reported-only',legacySnapshotsSafe:true,attributeOnlyFrames:true}));
