(function(root){
'use strict';
// Fixed, local female narration. The media clock is the only animation clock
// while sound is enabled. Completing this timeline never verifies movement.
const VERSION=1;
const finite=(n,fallback)=>Number.isFinite(n)?n:fallback;
const clamp=n=>Math.max(0,Math.min(1,finite(n,0)));
const clone=v=>JSON.parse(JSON.stringify(v));
function manifest(){return root.CoachAudioManifest||{version:1,clips:{}};}
function clipSource(id,clips,embedded,base){
 const clip=clips[id];if(!clip||!/^audio\/coach\/[a-z0-9-]+\.mp3$/.test(clip.src||''))return null;
 const local=embedded&&(embedded[id]||embedded[clip.src]);
 if(typeof local==='string'&&/^data:audio\/(?:mpeg|mp3|wav);base64,[A-Za-z0-9+/=\s]+$/.test(local))return local;
 try{
  const origin=base||root.COACH_AUDIO_BASE||new root.URL('../',root.location.href).href;
  const url=new root.URL(clip.src,origin);return /^(?:https?:)$/.test(url.protocol)?url.href:null;
 }catch(_){return null;}
}
function create(options){
 options=options||{};const clips=options.clips||manifest().clips||{},embedded=options.embedded||root.COACH_AUDIO_FILES||{};
 const audioFactory=options.audioFactory||(()=>typeof root.Audio==='function'?new root.Audio():null);
 const clock=options.now||(()=>root.performance&&typeof root.performance.now==='function'?root.performance.now():Date.now());
 const frameRequest=options.requestFrame||(fn=>typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame(fn):root.setTimeout(fn,16));
 const frameCancel=options.cancelFrame||(id=>typeof root.cancelAnimationFrame==='function'?root.cancelAnimationFrame(id):root.clearTimeout(id));
 let media=null,plan=[],index=-1,status='idle',mode='audio',generation=0,clipGeneration=0,raf=null,playing=false,muted=false;
 let pendingSeek=0,silentElapsed=0,silentStarted=0,lastError='',expectedSource='',metadataReady=false;
 const callback=(name,value)=>{if(typeof options[name]==='function')try{options[name](value);}catch(_){/* Host feedback must not corrupt the media session. */}};
 const segment=()=>plan[index]||null;
 function duration(){const s=segment();if(!s)return 0;const known=finite(clips[s.clipId]?.duration,finite(s.seconds,0));return mode==='audio'&&metadataReady&&media&&Number.isFinite(media.duration)&&media.duration>0?media.duration:Math.max(.1,known);}
 function currentTime(){
  if(mode==='audio')return media?Math.max(0,finite(media.currentTime,0)):pendingSeek;
  return Math.max(0,silentElapsed+(playing?Math.max(0,clock()-silentStarted)/1000:0));
 }
 function frame(final){const s=segment();if(!s)return null;const d=duration(),time=Math.min(d,currentTime());return {segmentId:s.id,index,progress:final?1:clamp(time/d),playing:!!playing,audioTime:time,duration:d,segment:clone(s),mode};}
 function emit(final){const value=frame(final);if(value)callback('onFrame',value);return value;}
 function stopFrame(){if(raf!==null){frameCancel(raf);raf=null;}}
 function detach(){if(!media)return;for(const key of ['onplaying','onended','onerror','onloadedmetadata','onwaiting','onstalled','onpause'])media[key]=null;}
 function silence(){if(!media)return;try{media.pause();}catch(_){};}
 function valid(token,clipToken){return token===generation&&clipToken===clipGeneration&&index>=0&&!!segment();}
 function fail(message,token,clipToken){
  if(token!==undefined&&!valid(token,clipToken))return;
  playing=false;status='error';lastError=message;stopFrame();silence();emit();callback('onError',{message,code:'coach-audio-unavailable',index,segmentId:segment()?.id||null,physicalVerified:false});
 }
 function schedule(token,clipToken){
  if(raf!==null||!playing)return;
  raf=frameRequest(()=>{raf=null;if(!valid(token,clipToken)||!playing)return;emit();
   if(mode==='silent'&&currentTime()>=duration()){advance(token,clipToken);return;}
   schedule(token,clipToken);
  });
 }
 function advance(token,clipToken){
  if(!valid(token,clipToken)||!playing)return;
  emit(true);playing=false;stopFrame();
  if(index+1>=plan.length){status='finished';callback('onEnd',{timelineComplete:true,physicalVerified:false,segments:plan.length,index,segmentId:segment().id,mode});return;}
  load(index+1,0,token);
 }
 function applySeek(){
  // Chromium can accept currentTime before metadata and then reset it when
  // the new resource loads. Keep the requested position until this clip's
  // metadata is available, so a resumed phase never restarts from zero.
  if(!media||!metadataReady||!pendingSeek)return;
  const d=duration();try{media.currentTime=Math.max(0,Math.min(pendingSeek,Math.max(0,d-.02)));pendingSeek=0;}catch(_){/* The first metadata event will retry. */}
 }
 function play(token,clipToken){
  if(!valid(token,clipToken)||!media)return false;
  status='loading';playing=false;lastError='';
  try{
   const promise=media.play();
   if(promise&&typeof promise.catch==='function')promise.catch(()=>{if(valid(token,clipToken)&&status!=='paused'&&status!=='stopped')fail('Не получилось включить запись. Нажми «Продолжить» или выбери режим без звука.',token,clipToken);});
   return true;
  }catch(_){fail('Не получилось включить запись. Нажми «Продолжить» или выбери режим без звука.',token,clipToken);return false;}
 }
 function load(next,time,token){
  if(token!==generation)return false;
  stopFrame();detach();silence();playing=false;index=next;clipGeneration++;const clipToken=clipGeneration,s=segment();
  if(!s)return false;
  metadataReady=false;pendingSeek=Math.max(0,Math.min(finite(time,0),Math.max(0,duration()-.02)));silentElapsed=pendingSeek;lastError='';status='loading';
  callback('onPhase',{segment:clone(s),index,duration:duration(),mode});
  if(!valid(token,clipToken))return false;if(status==='paused')return true;
  if(mode==='silent'){
   status='playing';playing=true;silentStarted=clock();emit();schedule(token,clipToken);return true;
  }
  if(!media){try{media=audioFactory();}catch(_){media=null;}}
  if(!media){fail('В этом браузере запись недоступна. Можно выбрать режим без звука.',token,clipToken);return false;}
  expectedSource=clipSource(s.clipId,clips,embedded,options.base);
  if(!expectedSource){fail('Запись этого движения не найдена. Обнови приложение или выбери режим без звука.',token,clipToken);return false;}
  media.preload='auto';media.playsInline=true;media.muted=muted;
  media.onloadedmetadata=()=>{if(!valid(token,clipToken))return;metadataReady=true;const minimum=finite(clips[s.clipId]?.minDuration,0);if(Number.isFinite(media.duration)&&media.duration+0.12<minimum){fail('Запись загрузилась не полностью. Повтори загрузку или выбери режим без звука.',token,clipToken);return;}applySeek();};
  media.onplaying=()=>{if(!valid(token,clipToken)||!['loading','playing'].includes(status))return;metadataReady=true;applySeek();status='playing';playing=true;emit();schedule(token,clipToken);};
  media.onwaiting=()=>{if(!valid(token,clipToken)||status==='paused')return;playing=false;status='loading';stopFrame();emit();};
  media.onstalled=()=>{if(!valid(token,clipToken)||status==='paused')return;playing=false;status='loading';stopFrame();emit();};
  media.onended=()=>{if(!valid(token,clipToken)||!['loading','playing'].includes(status))return;if(media.ended===false)return;playing=true;advance(token,clipToken);};
  media.onerror=()=>{if(media.error===null)return;if(valid(token,clipToken))fail('Не удалось загрузить голосовую запись. Можно повторить или заниматься без звука.',token,clipToken);};
  try{media.src=expectedSource;applySeek();}catch(_){fail('Не удалось открыть голосовую запись.',token,clipToken);return false;}
  emit();if(!valid(token,clipToken))return false;if(status==='paused')return true;return play(token,clipToken);
 }
 function start(value,settings){
  settings=settings||{};
  if(!Array.isArray(value)||!value.length||value.length>256||value.some(s=>!s||typeof s.id!=='string'||typeof s.clipId!=='string'||!clips[s.clipId]||!Number.isFinite(clips[s.clipId].duration)||clips[s.clipId].duration<=0)){stop();fail('Не удалось подготовить разминку. Выбери другое упражнение.');return false;}
  generation++;clipGeneration++;stopFrame();detach();silence();plan=clone(value);index=-1;status='idle';playing=false;lastError='';mode=settings.silent===true?'silent':'audio';muted=settings.muted===true;
  const selected=Number.isInteger(settings.index)?Math.max(0,Math.min(plan.length-1,settings.index)):0;
  return load(selected,Math.max(0,finite(settings.time,0)),generation);
 }
 function pause(){
  if(!segment()||['idle','finished','stopped','error'].includes(status))return false;
  if(mode==='silent')silentElapsed=currentTime();playing=false;status='paused';stopFrame();silence();emit();return true;
 }
 function resume(){
  if(!segment()||!['paused','error'].includes(status))return false;
  if(status==='error'&&mode==='audio')return load(index,currentTime(),generation);
  const token=generation,clipToken=clipGeneration;
  if(mode==='silent'){silentStarted=clock();playing=true;status='playing';lastError='';emit();schedule(token,clipToken);return true;}
  return play(token,clipToken);
 }
 function stop(){generation++;clipGeneration++;playing=false;status='stopped';stopFrame();detach();silence();emit();return true;}
 function snapshot(){const value=frame();return {version:1,status,index,segmentId:segment()?.id||null,time:value?.audioTime||0,duration:value?.duration||0,progress:value?.progress||0,playing,mode,muted,error:lastError};}
 function setMuted(value){muted=value===true;if(media)media.muted=muted;return muted;}
 return {start,pause,resume,stop,snapshot,setMuted};
}
root.AudioCoach={VERSION,create,clipSource};
})(typeof window==='undefined'?globalThis:window);
