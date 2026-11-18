'use strict';
// Reproducible local build only. Sources, index, downloaded and static HTML use
// the same resource graph; no server, deployment, or visitor data is accessed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm');
const root=path.resolve(__dirname,'..'),registry=JSON.parse(fs.readFileSync(path.join(root,'trainer-assets.json'),'utf8'));
const read=name=>fs.readFileSync(path.join(root,name),'utf8'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function checksum(text){let h=2166136261;for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
const resourceNames=[...new Set(Object.values(registry.trainers).flatMap(t=>t.styles.concat(t.scripts)))].sort();
for(const name of resourceNames)if(!fs.existsSync(path.join(root,name)))throw Error('Source not ready: '+name);
const allHashes=Object.fromEntries(resourceNames.map(name=>[name,hash(read(name))]));
const build='stage1-'+hash(JSON.stringify(allHashes)+read('trainer-loader.js')).slice(0,12),ctx=vm.createContext({});vm.runInContext(read('offline-bundle.js'),ctx);const bundler=ctx.TrainerBundle;
const core=new Set(['./','index.html','manifest.webmanifest','pwa.js?v=pwa2']);
for(const name of ['trainers','kubiki','bricks','slovograd'])for(const suffix of ['180','192','512','maskable-512'])core.add('icons/'+name+'-'+suffix+'.png');
const manifests={};
for(const [folder,entry] of Object.entries(registry.trainers)){
 const item=name=>({path:name,href:path.posix.relative(folder,name)+'?v=s1-'+allHashes[name].slice(0,12),hash:allHashes[name],checksum:checksum(read(name))});
 const m={schemaVersion:1,trainer:folder,build,styles:entry.styles.map(item),scripts:entry.scripts.map(item)};manifests[folder]=m;
 let html=read(folder+'/index.html'),head=html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1];head=bundler.build?head:head;
 head=head.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'').replace(/<meta\b[^>]*name=["']trainer-build["'][^>]*>/gi,'').replace(/<style\b[^>]*data-trainer-style[^>]*>[\s\S]*?<\/style>/gi,'');
 const canonical='<!doctype html>\n<html lang="ru"><head>'+head+'<meta name="trainer-build" content="'+build+'"></head><body><div id="app"></div><div id="live" class="sr-only" aria-live="polite"></div><div id="overlay"></div><script type="application/json" data-trainer-assets>'+JSON.stringify(m).replace(/<\/script/gi,'<\\/script')+'</script><script data-trainer-bootstrap>'+read('trainer-loader.js').replace(/<\/script/gi,'<\\/script')+'</script><script data-pwa src="../pwa.js?v=pwa2" defer></script></body></html>\n';
 fs.writeFileSync(path.join(root,folder,'index.html'),canonical);
 const sources=Object.fromEntries(entry.styles.concat(entry.scripts).map(name=>[name,read(name)]));
 const audioBase='https://nashpatriot67.github.io/detskie-trenazhery/'+folder+'/';
 fs.writeFileSync(path.join(root,folder,'offline.html'),bundler.build({head,manifest:m,sources,audioBase}));
 core.add(folder+'/');core.add(folder+'/index.html');core.add(folder+'/manifest.webmanifest');core.add(folder+'/offline.html');
 for(const item of m.styles.concat(m.scripts))core.add(item.path+'?v=s1-'+item.hash.slice(0,12));
}
// Keep the autonomous chooser pointing to freshly generated standalone entries.
core.add('otkryt-bez-interneta.html');
let worker=read('sw.js').replace(/const VERSION = '[^']*';/,"const VERSION = '"+build+"';").replace(/const CORE = \[[\s\S]*?\];/,'const CORE = '+JSON.stringify([...core],null,2)+';');
fs.writeFileSync(path.join(root,'sw.js'),worker);
const report={schemaVersion:1,build,sourceHashes:allHashes,manifests,coreResources:core.size};
fs.writeFileSync(path.join(root,'trainer-build.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({build,trainers:Object.keys(manifests),coreResources:core.size,sourceFiles:resourceNames.length}));
