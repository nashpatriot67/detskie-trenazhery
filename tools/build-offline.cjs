'use strict';
// Reproducible local build only. No deployment, server or visitor data access.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const root=path.resolve(__dirname,'..'),registry=JSON.parse(fs.readFileSync(path.join(root,'trainer-assets.json'),'utf8'));
const read=name=>fs.readFileSync(path.join(root,name),'utf8'),raw=name=>fs.readFileSync(path.join(root,name));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function checksum(value){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^(typeof value==='string'?value.charCodeAt(i):value[i]),16777619);return h>>>0;}
const noticeNames=['audio/coach/credits.txt','audio/coach/license.txt'];
const resourceNames=[...new Set(Object.values(registry.trainers).flatMap(t=>t.styles.concat(t.scripts)).concat(noticeNames))].sort();
for(const name of resourceNames)if(!fs.existsSync(path.join(root,name)))throw Error('Source not ready: '+name);
const allHashes=Object.fromEntries(resourceNames.map(name=>[name,hash(read(name))]));
const coachContext=vm.createContext({});vm.runInContext(read(registry.coachMedia),coachContext);
const clips=Object.values(coachContext.CoachAudioManifest.clips).sort((a,b)=>a.id.localeCompare(b.id,'en'));
if(clips.length!==41)throw Error('Expected 41 reviewed coach clips, found '+clips.length);
const mediaHashes={},mediaBytes={};
for(const clip of clips){
 if(!/^audio\/coach\/[a-z0-9-]+\.mp3$/.test(clip.src)||mediaHashes[clip.src])throw Error('Invalid/duplicate coach source '+clip.src);
 const value=raw(clip.src),digest=hash(value);if(digest!==clip.sha256||value.length!==clip.bytes)throw Error('Coach manifest is stale: '+clip.src);
 mediaHashes[clip.src]=digest;mediaBytes[clip.src]=value;
}
const ctx=vm.createContext({});vm.runInContext(read('offline-bundle.js'),ctx);const bundler=ctx.TrainerBundle;
const cleanHead=folder=>read(folder+'/index.html').match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1].replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'').replace(/<meta\b[^>]*name=["']trainer-build["'][^>]*>/gi,'').replace(/<style\b[^>]*data-trainer-style[^>]*>[\s\S]*?<\/style>/gi,'');
const heads=Object.fromEntries(Object.keys(registry.trainers).map(folder=>[folder,cleanHead(folder)]));
const staticNames=['manifest.webmanifest','pwa.js',...Object.keys(registry.trainers).map(f=>f+'/manifest.webmanifest'),...['trainers',...Object.keys(registry.trainers)].flatMap(name=>['180','192','512','maskable-512'].map(suffix=>'icons/'+name+'-'+suffix+'.png'))];
const staticHashes=Object.fromEntries(staticNames.map(name=>[name,hash(raw(name))]));
const workerTemplate=read('sw.js').replace(/const VERSION = '[^']*';/,"const VERSION = '';").replace(/const CORE = \[[\s\S]*?\];/,'const CORE = [];');
const fingerprint={registry,sourceHashes:allHashes,mediaHashes,staticHashes,loader:read('trainer-loader.js'),home:read('index.html'),heads,workerTemplate,builder:read('tools/build-offline.cjs')};
const build='stage1-'+hash(JSON.stringify(fingerprint)).slice(0,12);
const core=new Set(['./','index.html','manifest.webmanifest','pwa.js?v=pwa2']);
for(const name of ['trainers',...Object.keys(registry.trainers)])for(const suffix of ['180','192','512','maskable-512'])core.add('icons/'+name+'-'+suffix+'.png');
const manifests={},outputs=new Map();
for(const [folder,entry] of Object.entries(registry.trainers)){
 const item=name=>({path:name,href:path.posix.relative(folder,name)+'?v=s1-'+allHashes[name].slice(0,12),hash:allHashes[name],checksum:checksum(read(name))});
 const media=clips.map(c=>({id:c.id,path:c.src,href:path.posix.relative(folder,c.src)+'?v=s1-'+mediaHashes[c.src].slice(0,12),hash:mediaHashes[c.src],checksum:checksum(mediaBytes[c.src]),bytes:mediaBytes[c.src].length,mime:'audio/mpeg'}));
 const m={schemaVersion:1,trainer:folder,build,styles:entry.styles.map(item),scripts:entry.scripts.map(item),media,mediaNotices:noticeNames.map(item)};manifests[folder]=m;
 const head=heads[folder],canonical='<!doctype html>\n<html lang="ru"><head>'+head+'<meta name="trainer-build" content="'+build+'"></head><body><div id="app"></div><div id="live" class="sr-only" aria-live="polite"></div><div id="overlay"></div><script type="application/json" data-trainer-assets>'+JSON.stringify(m).replace(/<\/script/gi,'<\\/script')+'</script><script data-trainer-bootstrap>'+read('trainer-loader.js').replace(/<\/script/gi,'<\\/script')+'</script><script data-pwa src="../pwa.js?v=pwa2" defer></script></body></html>\n';
 outputs.set(folder+'/index.html',canonical);
 const sources=Object.fromEntries(entry.styles.concat(entry.scripts,noticeNames).map(name=>[name,read(name)]));
 const embedded=Object.fromEntries(media.map(m=>[m.path,'data:audio/mpeg;base64,'+mediaBytes[m.path].toString('base64')]));
 const audioBase='https://nashpatriot67.github.io/detskie-trenazhery/'+folder+'/';
 outputs.set(folder+'/offline.html',bundler.build({head,manifest:m,sources,media:embedded,audioBase}));
 core.add(folder+'/');core.add(folder+'/index.html');core.add(folder+'/manifest.webmanifest');core.add(folder+'/offline.html');
 for(const asset of m.styles.concat(m.scripts,m.media,m.mediaNotices))core.add(asset.path+'?v=s1-'+asset.hash.slice(0,12));
}
let chooser=read('index.html').replace(/<(?:link|meta)\b(?=[^>]*\bdata-pwa\b)[^>]*>/gi,'').replace(/<script\b(?=[^>]*\bdata-pwa\b)[^>]*>[\s\S]*?<\/script>/gi,'');
for(const folder of Object.keys(registry.trainers))chooser=chooser.replaceAll('href="./'+folder+'/"','href="./'+folder+'/offline.html"');
outputs.set('otkryt-bez-interneta.html',chooser);core.add('otkryt-bez-interneta.html');
const coreBytes=[...core].reduce((total,url)=>{let name=url.split('?')[0];if(name.endsWith('/'))name+='index.html';if(name==='./index.html')name='index.html';return total+(outputs.has(name)?Buffer.byteLength(outputs.get(name)):raw(name).length);},0);
const budgetBytes=16*1024*1024;if(coreBytes>budgetBytes)throw Error('Core budget exceeded before writing outputs: '+coreBytes+' > '+budgetBytes);
const worker=read('sw.js').replace(/const VERSION = '[^']*';/,"const VERSION = '"+build+"';").replace(/const CORE = \[[\s\S]*?\];/,'const CORE = '+JSON.stringify([...core],null,2)+';');
outputs.set('sw.js',worker);
const report={schemaVersion:1,build,sourceHashes:allHashes,mediaHashes,staticHashes,manifests,coreResources:core.size,coreBytes,budgetBytes,coachClips:clips.length,coachBytes:Object.values(mediaBytes).reduce((n,b)=>n+b.length,0)};
outputs.set('trainer-build.json',JSON.stringify(report,null,2)+'\n');
for(const [name,value] of outputs)fs.writeFileSync(path.join(root,name),value);
console.log(JSON.stringify({build,trainers:Object.keys(manifests),coreResources:core.size,coreBytes,budgetBytes,sourceFiles:resourceNames.length,coachClips:clips.length,coachBytes:report.coachBytes}));
