(function(root){
'use strict';
// One optional named activity inside the existing progress owner. No awards,
// real-life confirmations, migrations, or additional localStorage keys.
const KEY='kubiki-progress-v1',ID='life-room-adventure';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const signature=v=>JSON.stringify(v===undefined?null:v);
function create(options={}){
 const LP=root.LearningProgress;
 const tidy=options.episode==='tidy',moduleId=tidy?'life-room-tidy':ID,kind=tidy?'RoomTidyAdventure':'RoomAdventurePrototype';
 const writer='room-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
 let seen=null,epoch=null,initialized=false,blocked=false,message='';
 const listeners=new Set();
 function notify(){for(const listener of listeners)try{listener({error:message});}catch(_){}}
 function fail(text,permanent=false){message=text;if(permanent)blocked=true;notify();return false;}
 function validSnapshot(snapshot){
  if(!object(snapshot)||snapshot.version!==1||snapshot.kind!==kind||!object(snapshot.state))return false;
  if(!root.RoomAdventure)return true;
  if(tidy)return root.RoomAdventure.create({episode:'tidy'}).restore(snapshot).accepted===true;
  if(root.LifeQuestData){
   const pool=root.LifeQuestData.quests.find(q=>q.id==='life.sport.pool');
   return !!pool&&root.RoomAdventure.create({pool}).restore(snapshot).accepted===true;
  }
  return true;
 }
 function record(){
  if(!LP)throw Error('unsupported');
  const text=root.localStorage.getItem(KEY),raw=JSON.parse(text===null?'{}':text);
  if(!object(raw))throw Error('invalid');
  const generation=typeof raw.resetEpoch==='string'?raw.resetEpoch:'initial';
  if(!LP.isSupported(raw.learning))throw Error('unsupported');
  const learning=LP.clean(raw.learning,generation);
  if(learning.generation!==generation)throw Error('generation');
  const wrapper=LP.getModule(learning,moduleId),value=wrapper&&wrapper.state;
  if(object(raw.learning?.modules)&&Object.prototype.hasOwnProperty.call(raw.learning.modules,moduleId)&&!wrapper)throw Error('unsupported');
  if(value!==undefined&&value!==null){
   if(!object(value)||value.version!==1||!validSnapshot(value.adventure))throw Error('unsupported');
   if(tidy&&options.withCampaign&&value.campaign!==undefined&&!root.RoomCampaign?.valid(value.campaign))throw Error('unsupported');
  }
  return {text,raw,generation,learning,wrapper,value};
 }
 function read(){
  try{
   const entry=record();seen=entry.wrapper||null;epoch=entry.generation;initialized=true;blocked=false;message='';
   const result={snapshot:entry.value?JSON.parse(JSON.stringify(entry.value.adventure)):null,sound:entry.value?.sound===true,error:''};
   if(tidy&&options.withCampaign)result.campaign=entry.value?.campaign?JSON.parse(JSON.stringify(entry.value.campaign)):null;
   return result;
  }catch(error){
   initialized=true;blocked=true;message=error.message==='unsupported'?'Это сохранение использует другую версию. Обнови приложение; прежние результаты не изменены.':'Не получилось прочитать сохранение. Можно играть на этой странице; прежние результаты не изменены.';
   return {snapshot:null,sound:false,error:message};
  }
 }
 function current(){
  let entry;try{entry=record();}catch(_){fail('Не получилось прочитать сохранение. Прежние результаты не изменены.',true);return null;}
  if(entry.generation!==epoch){fail('В другой вкладке начали заново. Обнови страницу, чтобы продолжить актуальную игру.',true);return null;}
  if(signature(entry.wrapper)!==signature(seen)){
   fail('Эту игру продолжили в другой вкладке. Обнови страницу перед продолжением.',true);return null;
  }
  return entry;
 }
 function save(snapshot,settings={}){
  if(!initialized)read();if(blocked)return false;
  // Only the domain's versioned, small snapshot is eligible for this module.
  if(!object(snapshot)||snapshot.version!==1||snapshot.kind!==kind)return fail('Не получилось сохранить этот шаг. Прежние результаты остаются на месте.');
  if(tidy){try{if(!validSnapshot(snapshot))return fail('Не получилось сохранить этот шаг. Прежние результаты остаются на месте.');}catch(_){return fail('Не получилось сохранить этот шаг. Прежние результаты остаются на месте.');}}
  const entry=current();if(!entry)return false;
  let state;try{
   state={version:1,adventure:snapshot,sound:settings.sound===true};
   if(tidy){
    const campaign=settings.campaign===undefined?entry.value?.campaign:settings.campaign;
    if(settings.campaign!==undefined&&(!options.withCampaign||!root.RoomCampaign?.valid(campaign)))return fail('Не получилось сохранить карту уровней.');
    if(campaign!==undefined)state.campaign=campaign;
   }
   state=JSON.parse(JSON.stringify(state));
  }catch(_){return fail('Не получилось сохранить этот шаг.');}
  const modules=object(entry.raw.learning?.modules)?entry.raw.learning.modules:{};
  if(!entry.wrapper&&Object.keys(modules).length>=LP.MAX_MODULES)return fail('На устройстве уже сохранено много занятий. Это приключение пока останется на этой странице; прежние результаты не изменены.');
  const next=LP.setModule(entry.learning,moduleId,state,{ownerId:writer,generation:epoch});
  const candidate=LP.getModule(next,moduleId);
  if(!candidate||signature(candidate.state)!==signature(state))return fail('На устройстве не удалось сохранить это приключение. Остальные результаты сохранены; пока продолжай на этой странице.');
  // Use the existing serializer/limits for this module, while preserving every
  // unrelated field byte-equivalently as parsed data, including unknown modules.
  const learning=Object.assign({},entry.learning,object(entry.raw.learning)?entry.raw.learning:{},{version:LP.VERSION,generation:epoch,modules:Object.assign({},modules,{[moduleId]:candidate})});
  const text=JSON.stringify(Object.assign({},entry.raw,{learning}));
  try{
   if(root.localStorage.getItem(KEY)!==entry.text)return fail('Сохранение изменилось в другой вкладке. Обнови страницу перед продолжением.',true);
   root.localStorage.setItem(KEY,text);
   if(root.localStorage.getItem(KEY)!==text)return fail('Сохранение изменилось в другой вкладке. Обнови страницу перед продолжением.',true);
  }catch(_){return fail('Не получилось сохранить на устройстве. Не закрывай страницу, чтобы продолжить эту работу.');}
  seen=candidate;message='';notify();return true;
 }
 function onStorage(event){if(event.key!==KEY&&event.key!==null)return;if(!initialized||blocked)return;current();}
 root.addEventListener?.('storage',onStorage);
 return Object.freeze({read,save,warning:()=>message,subscribe(listener){if(typeof listener==='function')listeners.add(listener);return()=>listeners.delete(listener);},destroy(){listeners.clear();root.removeEventListener?.('storage',onStorage);}});
}
root.RoomProgress=Object.freeze({create,key:KEY,moduleId:ID});
})(typeof window==='undefined'?globalThis:window);
