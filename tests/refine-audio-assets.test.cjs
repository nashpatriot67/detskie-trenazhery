'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),context=vm.createContext({});let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
for(const f of ['coach-plan.js','coach-audio-manifest.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context);
const bank=context.CoachMovementPlan,manifest=context.CoachAudioManifest;eq(manifest.version,1);eq(manifest.voice.speaker,'kseniya');eq(manifest.voice.synthesized,true);eq(Object.keys(manifest.clips).sort(),Object.keys(bank.CUES).sort());
let bytes=0,seconds=0;
for(const [id,cue]of Object.entries(bank.CUES)){
 const clip=manifest.clips[id],file=path.join(root,clip.src),data=fs.readFileSync(file);bytes+=data.length;seconds+=clip.duration;
 eq(clip.id,id);eq(clip.text,cue.text,'Visible instructions and actual narration use the same cue');eq(clip.minDuration,cue.minDuration);eq(crypto.createHash('sha256').update(data).digest('hex'),clip.sha256);eq(data.length,clip.bytes);ok(clip.duration>=cue.minDuration,'Movement audio includes the full safe tempo');ok(clip.decodedPeak>.01&&clip.decodedPeak<1,'Every recording is audible and not clipped');
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','format=duration:stream=codec_name,sample_rate,channels','-of','json',file],{encoding:'utf8'}));eq(probe.streams[0].codec_name,'mp3');eq(probe.streams[0].channels,1);eq(probe.streams[0].sample_rate,'24000');ok(Math.abs(Number(probe.format.duration)-clip.duration)<.001);
}
ok(bytes<1024*1024,'All fixed coach recordings together remain below one MiB');
const routines=['break.reach-cloud','break.squats','break.wall-push','break.room-walk','break.shoulders','break.cross-march','break.heel-rise','break.side-steps','break.fingers','break.wings','break.look-far','break.stars'];
const durations={};
for(const id of routines){const plan=bank.build(id);ok(plan.length>3);const ids=plan.map(s=>s.id);eq(new Set(ids).size,plan.length);let total=0;for(const s of plan){ok(!!manifest.clips[s.clipId],id+' has an actual recording for every movement');eq(s.text,manifest.clips[s.clipId].text);ok(s.seconds>=.5);total+=manifest.clips[s.clipId].duration;}ok(total>=15&&total<=120,'A short comfortable routine is bounded');durations[id]=Math.round(total*1000)/1000;}
console.log(JSON.stringify({success:true,checks,clips:Object.keys(manifest.clips).length,bytes,seconds:Math.round(seconds*1000)/1000,hashesAndDurationsVerified:true,allRoutineSegmentsHaveActualAudio:true,routineSeconds:durations}));
