'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),bytes=p=>fs.readFileSync(path.join(root,p)),sha=v=>crypto.createHash('sha256').update(v).digest('hex');let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;};
const registry=JSON.parse(read('trainer-assets.json')),report=JSON.parse(read('trainer-build.json')),plain=v=>JSON.parse(JSON.stringify(v));
function runBuild(directory){return vm.runInNewContext(read('tools/build-offline.cjs'),{require,__dirname:path.join(directory,'tools'),Buffer,console:{log(){}}});}
const generated=['sw.js','trainer-build.json','otkryt-bez-interneta.html',...Object.keys(registry.trainers).flatMap(f=>[f+'/index.html',f+'/offline.html'])];
const first=Object.fromEntries(generated.map(f=>[f,sha(bytes(f))]));runBuild(root);eq(Object.fromEntries(generated.map(f=>[f,sha(bytes(f))])),first,'A second build is byte-identical');
eq(Object.keys(registry.trainers),['kubiki','bricks','slovograd','life']);eq(Object.keys(report.mediaHashes).length,41);ok(report.coreBytes<report.budgetBytes);eq(report.budgetBytes,16*1024*1024);
for(const [folder,entry]of Object.entries(registry.trainers)){
 const html=read(folder+'/index.html'),manifest=JSON.parse(html.match(/data-trainer-assets>([\s\S]*?)<\/script>/)[1]),offline=read(folder+'/offline.html');
 eq(manifest.build,report.build);eq(manifest.styles.map(a=>a.path),entry.styles);eq(manifest.scripts.map(a=>a.path),entry.scripts);eq(manifest.media.length,41);
 ok(!/<script[^>]+src=/.test(offline));ok(!/<link[^>]+rel=["']stylesheet/.test(offline));
 for(const asset of manifest.styles.concat(manifest.scripts)){
  eq(asset.hash,sha(bytes(asset.path)),'Live source '+asset.path);ok(offline.includes(read(asset.path).replace(/<\/script/gi,'<\\/script')),'Standalone exact source '+asset.path);
 }
 const source=offline.match(/<script data-coach-audio>([\s\S]*?)<\/script>/)[1],sandbox=vm.createContext({window:{}});vm.runInContext(source,sandbox);eq(Object.keys(sandbox.window.COACH_AUDIO_FILES).length,41);
 for(const asset of manifest.media){const data=sandbox.window.COACH_AUDIO_FILES[asset.path];ok(data.startsWith('data:audio/mpeg;base64,'));const embedded=Buffer.from(data.split(',')[1],'base64');eq(sha(embedded),asset.hash);eq(embedded.length,asset.bytes);eq(asset.hash,report.mediaHashes[asset.path]);}
 for(const notice of manifest.mediaNotices)eq(sandbox.window.COACH_AUDIO_NOTICES[notice.path],read(notice.path));
 for(const dep of ['study-clock.js','coach-plan.js','coach-audio-manifest.js','audio-coach.js','active-breaks.js','practice-hub.js'])ok(entry.scripts.includes(dep));
 ok(entry.scripts.indexOf('coach-plan.js')<entry.scripts.indexOf('active-breaks.js'));ok(entry.scripts.indexOf('audio-coach.js')<entry.scripts.indexOf('practice-hub.js'));
 if(folder!=='life'){ok(!entry.scripts.includes('life-quests.js'));ok(!entry.scripts.includes('life-quest-data.js'));ok(!entry.styles.includes('life-quests.css'));}
 ok(read('otkryt-bez-interneta.html').includes('href="./'+folder+'/offline.html"'));
}
const listeners={},cache=new Map(),writes=[];let fetches=0;
const c=vm.createContext({URL,Request,Response,Headers,Uint8Array,ArrayBuffer,self:{location:{href:'https://refine.invalid/detskie-trenazhery/sw.js'},addEventListener:(name,fn)=>listeners[name]=fn,clients:{claim(){}}},caches:{open:async()=>({match:async key=>cache.get(key)?.clone(),put:async(key,response)=>{writes.push(response.status);cache.set(key,response.clone());}})},fetch:async()=>{fetches++;throw Error('Offline');}});
vm.runInContext(read('sw.js'),c);
const core=plain(vm.runInContext('CORE',c));eq(core.filter(f=>/^audio\/coach\/[a-z0-9-]+\.mp3\?/.test(f)).length,41);ok(core.every(f=>!f.startsWith('audio/')||/^audio\/coach\/(?:[a-z0-9-]+\.mp3|credits\.txt|license\.txt)\?/.test(f)));
async function dispatch(url,range){let promise;listeners.fetch({request:new Request(url,{headers:range?{Range:range}:{}}),respondWith:p=>promise=p});return promise?await promise:null;}
(async()=>{
 for(const file of Object.keys(report.mediaHashes)){
  const exact='https://refine.invalid/detskie-trenazhery/'+file+'?v=s1-'+report.mediaHashes[file].slice(0,12),url=exact.split('?')[0],original=bytes(file);cache.set(exact,new Response(original,{headers:{'Content-Type':'audio/mpeg'}}));
  for(const [range,start,end]of [['bytes=0-1',0,1],['bytes=10-',10,original.length-1],['bytes=-17',original.length-17,original.length-1],['bytes=4-99999999',4,original.length-1]]){const response=await dispatch(url,range);eq(response.status,206);eq(response.headers.get('content-range'),'bytes '+start+'-'+end+'/'+original.length);eq(Buffer.from(await response.arrayBuffer()),original.subarray(start,end+1));}
  for(const range of ['bytes=99999999-','bytes=7-2','bytes=-0','bytes=0-1,4-5','items=0-1']){const response=await dispatch(url,range);eq(response.status,416);eq(response.headers.get('content-range'),'bytes */'+original.length);}
  const full=await dispatch(url);eq(full.status,200);eq(Buffer.from(await full.arrayBuffer()),original);
 }
 eq(fetches,0,'Every offline coach request uses the exact current full cache entry');eq(writes,[],'No partial range is cached');eq(await dispatch('https://refine.invalid/detskie-trenazhery/audio/coach/unknown.mp3','bytes=0-1'),null);eq(await dispatch('https://refine.invalid/detskie-trenazhery/kubiki/audio/legacy.mp3','bytes=0-1'),null);
 // Independent synthetic build proves that modified audio is rejected until its
 // review manifest is updated, and then changes the generated build fingerprint.
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'refine-build-fixture-'));
 try{
  const names=new Set(['trainer-assets.json','trainer-loader.js','offline-bundle.js','sw.js','index.html','manifest.webmanifest','pwa.js','tools/build-offline.cjs',...Object.keys(report.sourceHashes),...Object.keys(report.mediaHashes),...Object.keys(registry.trainers).flatMap(f=>[f+'/index.html',f+'/manifest.webmanifest']),...fs.readdirSync(path.join(root,'icons')).map(f=>'icons/'+f)]);
  for(const name of names){fs.mkdirSync(path.dirname(path.join(temp,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(temp,name));}
  const file=Object.keys(report.mediaHashes)[0],changed=Buffer.from(bytes(file));changed[changed.length-1]^=1;fs.writeFileSync(path.join(temp,file),changed);
  assert.throws(()=>runBuild(temp),/Coach manifest is stale/);checks++;
  const manifestFile=path.join(temp,registry.coachMedia);fs.writeFileSync(manifestFile,fs.readFileSync(manifestFile,'utf8').replace(report.mediaHashes[file],sha(changed)));
  runBuild(temp);const newer=JSON.parse(fs.readFileSync(path.join(temp,'trainer-build.json'),'utf8'));ok(newer.build!==report.build,'Audio change invalidates the whole build');eq(newer.mediaHashes[file],sha(changed));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 const result={success:true,checks,build:report.build,reproducible:true,trainers:4,coachClips:41,coreBytes:report.coreBytes,budgetBytes:report.budgetBytes,offlineRangeCoverage:'all 41 clips, full/suffix/open/invalid/multipart',productionWrites:false};console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});
