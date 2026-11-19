'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox=vm.createContext({URL}),source=fs.readFileSync(path.join(__dirname,'..','audio-coach.js'),'utf8');vm.runInContext(source,sandbox);
const Coach=sandbox.AudioCoach,plain=x=>JSON.parse(JSON.stringify(x));let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(plain(a),plain(b),m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
function fixture(extra){
 let time=0,serial=0;const queue=new Map(),frames=[],phases=[],ends=[],errors=[],media=[];
 const clips={first:{src:'audio/coach/first.mp3',duration:4,minDuration:3},second:{src:'audio/coach/second.mp3',duration:2,minDuration:1}};
 class FakeAudio{
  constructor(){this.currentTime=0;this.duration=NaN;this.ended=false;this.paused=true;this.playCalls=0;this.pauseCalls=0;}
  set src(v){this._src=v;this.currentTime=0;this.duration=NaN;this.ended=false;this.error=null;}
  get src(){return this._src;}
  play(){this.playCalls++;this.paused=false;return Promise.resolve();}
  pause(){this.pauseCalls++;this.paused=true;}
  metadata(seconds){this.duration=seconds;this.onloadedmetadata?.();}
  playing(){this.paused=false;this.onplaying?.();}
  end(){this.currentTime=this.duration;this.ended=true;this.onended?.();}
 }
 const config={clips,base:'https://example.test/trainers/',audioFactory:()=>{const a=new FakeAudio();media.push(a);return a;},now:()=>time,
  requestFrame:fn=>{const id=++serial;queue.set(id,fn);return id;},cancelFrame:id=>queue.delete(id),
  onFrame:v=>frames.push(plain(v)),onPhase:v=>phases.push(plain(v)),onEnd:v=>ends.push(plain(v)),onError:v=>errors.push(plain(v)),...extra};
 const controller=Coach.create(config),plan=[{id:'s.0',clipId:'first',seconds:4,pose:'squat',from:0,to:1},{id:'s.1',clipId:'second',seconds:2,pose:'squat',from:1,to:0}];
 return {controller,plan,clips,frames,phases,ends,errors,media,queue,advance(ms){time+=ms;const pending=[...queue.values()];queue.clear();pending.forEach(f=>f());}};
}
(async()=>{
 let x=fixture();eq(x.media.length,0,'Creating the controller never starts audio');eq(x.frames,[]);eq(x.controller.snapshot().status,'idle');
 eq(x.controller.start(x.plan),true);eq(x.media.length,1);const a=x.media[0];eq(a.src,'https://example.test/trainers/audio/coach/first.mp3');eq(a.playCalls,1,'The first play happens directly in start');eq(x.controller.snapshot().status,'loading');eq(x.controller.snapshot().playing,false);
 x.advance(60000);eq(x.controller.snapshot().progress,0,'Elapsed wall time never starts the sound animation');eq(x.queue.size,0);eq(x.ends.length,0);
 a.metadata(4);a.playing();eq(x.controller.snapshot().playing,true);eq(x.queue.size,1);a.currentTime=1;x.advance(100);eq(x.frames.at(-1).progress,.25);eq(x.frames.at(-1).audioTime,1);
 x.advance(60000);eq(x.frames.at(-1).progress,.25,'Media progress is authoritative even if RAF time jumps');eq(x.ends.length,0);
 a.onwaiting();eq(x.controller.snapshot().status,'loading');eq(x.controller.snapshot().playing,false);eq(x.queue.size,0);const beforeWait=x.frames.length;a.currentTime=1.2;x.advance(1000);eq(x.frames.length,beforeWait,'Buffering does not invent movement');a.playing();eq(x.frames.at(-1).progress,.3);
 eq(x.controller.pause(),true);eq(x.controller.snapshot().status,'paused');eq(x.controller.snapshot().time,1.2);const pausedFrames=x.frames.length;x.advance(20000);eq(x.frames.length,pausedFrames);eq(x.controller.snapshot().time,1.2);
 const pausedEnd=a.onended;a.ended=true;pausedEnd();eq(x.controller.snapshot().index,0,'A paused end event cannot advance');a.ended=false;
 eq(x.controller.resume(),true);eq(a.playCalls,2);eq(x.controller.snapshot().playing,false);a.playing();eq(x.frames.at(-1).progress,.3,'Resume retains media position');
 const oldPlaying=a.onplaying,oldEnded=a.onended,oldError=a.onerror;a.end();eq(x.phases.length,2);eq(x.controller.snapshot().index,1);eq(x.controller.snapshot().duration,2,'New phase never reuses the previous media duration');eq(x.controller.snapshot().playing,false);
 oldPlaying();oldEnded();oldError();eq(x.controller.snapshot().index,1);eq(x.errors.length,0,'Late events from the previous clip are ignored');a.metadata(2);a.playing();a.currentTime=.5;x.advance(100);eq(x.frames.at(-1).progress,.25);a.end();eq(x.ends.length,1);eq(x.ends[0].physicalVerified,false);eq(x.ends[0].timelineComplete,true);eq(x.controller.snapshot().status,'finished');a.onended();a.onplaying();eq(x.ends.length,1,'The finished plan completes only once');eq(x.controller.snapshot().playing,false);
 x=fixture();x.controller.start(x.plan);const b=x.media[0];b.metadata(4);b.playing();const stale=[b.onplaying,b.onended,b.onerror];x.controller.start([x.plan[1]]);stale.forEach(fn=>fn());eq(x.controller.snapshot().index,0);eq(x.controller.snapshot().segmentId,'s.1');eq(x.controller.snapshot().status,'loading');eq(x.errors.length,0);eq(x.ends.length,0);
 b.metadata(2);b.playing();const finalStale=b.onended;x.controller.stop();eq(x.controller.snapshot().status,'stopped');eq(x.queue.size,0);finalStale();eq(x.ends.length,0);eq(x.controller.snapshot().playing,false);
 x=fixture();x.controller.start(x.plan);const c=x.media[0];c.metadata(4);c.playing();const stoppedPlaying=c.onplaying;eq(x.controller.start([{id:'missing',clipId:'does-not-exist'}]),false);eq(x.controller.snapshot().status,'error');stoppedPlaying();eq(x.controller.snapshot().playing,false,'Invalid new plans cannot leave old audio running');eq(x.errors.length,1);eq(x.ends.length,0);
 x=fixture();x.controller.start(x.plan);const d=x.media[0];d.onerror();eq(x.errors.length,0,'An obsolete media error with no current MediaError is ignored');d.error={code:4};d.onerror();eq(x.controller.snapshot().status,'error');eq(x.errors.length,1);d.onplaying();d.ended=true;d.onended();eq(x.controller.snapshot().index,0);eq(x.controller.snapshot().playing,false,'An audio error never becomes a successful timeline');eq(x.controller.resume(),true);eq(d.playCalls,2,'Retry reloads and plays the current clip');d.metadata(4);d.playing();eq(x.controller.snapshot().playing,true);
 x=fixture();x.controller.start(x.plan);const short=x.media[0];short.metadata(.2);eq(x.controller.snapshot().status,'error');eq(x.errors.length,1,'A truncated recording cannot accelerate the required movement');eq(x.ends.length,0);
 x=fixture();eq(x.controller.start(x.plan,{index:1,time:.6}),true);const resumed=x.media[0];eq(resumed.currentTime,0,'Resume waits for real resource metadata before seeking');resumed.currentTime=0;resumed.metadata(2);resumed.playing();eq(x.controller.snapshot().index,1);eq(x.controller.snapshot().time,.6);eq(x.controller.snapshot().progress,.3);eq(x.controller.setMuted(true),true);eq(resumed.muted,true);eq(x.controller.setMuted(false),false);eq(resumed.muted,false);
 x=fixture({embedded:{first:'data:audio/mpeg;base64,YWJj'}});x.controller.start(x.plan);eq(x.media[0].src,'data:audio/mpeg;base64,YWJj','Standalone clips take precedence over any network URL');
 eq(Coach.clipSource('x',{x:{src:'https://unrelated.test/voice.mp3'}},{},'https://example.test/'),null,'The manifest cannot redirect audio to another service');
 x=fixture();eq(x.controller.start(x.plan,{silent:true}),true);eq(x.media.length,0,'A silent timeline is an explicit separate mode');eq(x.controller.snapshot().mode,'silent');eq(x.controller.snapshot().playing,true);x.advance(1500);eq(x.frames.at(-1).progress,.375);x.controller.pause();const silenceTime=x.controller.snapshot().time;x.advance(50000);eq(x.controller.snapshot().time,silenceTime,'A paused silent timeline does not catch up');x.controller.resume();x.advance(2500);eq(x.controller.snapshot().index,1);x.advance(2000);eq(x.ends.length,1);eq(x.ends[0].physicalVerified,false);eq(x.ends[0].mode,'silent');
 // A rejected play from an obsolete session must not poison a replacement.
 let rejectPlay;class DeferredAudio{constructor(){this.duration=4;this.currentTime=0;this.ended=false;}pause(){}play(){return new Promise((_,reject)=>{rejectPlay=reject;});}}
 x=fixture({audioFactory:()=>new DeferredAudio()});x.controller.start(x.plan);const rejectOld=rejectPlay;x.controller.start(x.plan,{silent:true});rejectOld(new Error('old rejection'));await Promise.resolve();await Promise.resolve();eq(x.controller.snapshot().mode,'silent');eq(x.errors.length,0);
 let cancelFromPhase; x=fixture({onPhase:()=>cancelFromPhase.stop()});cancelFromPhase=x.controller;eq(x.controller.start(x.plan),false);eq(x.controller.snapshot().status,'stopped');eq(x.media.length,0,'A host can cancel a phase before its media is created');
 console.log(JSON.stringify({success:true,checks,audioClockAuthoritative:true,noMotionBeforePlaying:true,lateCallbacksIgnored:true,pauseAndRetry:true,explicitSilentMode:true,physicalVerification:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});
