'use strict';
// Reproducible asset integration checks. Only temporary synthetic copies mutate.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),os=require('node:os');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const registry=JSON.parse(read('trainer-assets.json')),report=JSON.parse(read('trainer-build.json'));let checks=0;
function ok(v,m){assert.ok(v,m);checks++;}function eq(a,b,m){assert.deepEqual(a,b,m);checks++;}
function manifest(folder){return JSON.parse(read(folder+'/index.html').match(/data-trainer-assets>([\s\S]*?)<\/script>/)[1]);}
const shared=['workspace-layout.css','workspace-layout.js'],art=['object-art.css','object-art.js'];
for(const [folder,entry]of Object.entries(registry.trainers)){
 const m=manifest(folder),offline=read(folder+'/offline.html');
 eq(m.build,report.build,'One current generated build per entry');
 eq(m.styles.map(x=>x.path),entry.styles);eq(m.scripts.map(x=>x.path),entry.scripts);
 if(['kubiki','bricks'].includes(folder)){
  eq(entry.styles.at(-1),'math-workspace.css','Mathematical workbench overrides follow all shared and subject styles');
  ok(entry.styles.indexOf('workspace-layout.css')<entry.styles.indexOf('math-workspace.css'));
  ok(entry.scripts.indexOf('place-value-activities.js')<entry.scripts.indexOf('math-workspace.js'));
  ok(entry.scripts.indexOf('math-workspace.js')<entry.scripts.indexOf(folder+'/app.js'));
 }else eq(entry.styles.at(-1),'workspace-layout.css','Shared responsive workspace overrides follow subject styles');
 ok(entry.scripts.indexOf('workspace-layout.js')<entry.scripts.indexOf(folder+'/app.js'),'Task-boundary helper available before rendering app');
 for(const file of shared.concat(folder==='life'?art:[]).concat(['kubiki','bricks'].includes(folder)?['math-workspace.css','math-workspace.js']:[])){
  const a=m.styles.concat(m.scripts).find(a=>a.path===file);ok(a,'Registry includes '+file+' in '+folder);
  eq(a.hash,sha(read(file)),'Generated manifest fingerprints exact '+file);eq(report.sourceHashes[file],a.hash);
  ok(offline.includes(read(file).replace(/<\/script/gi,'<\\/script')),'Standalone embeds exact '+file);
  ok(read('sw.js').includes(file+'?v=s1-'+a.hash.slice(0,12)),'PWA caches current '+file);
 }
 if(folder==='life')ok(entry.scripts.indexOf('object-art.js')<entry.scripts.indexOf('life-quests.js'),'One image catalogue loaded before all Life renderers');
 else for(const file of art)ok(!entry.styles.concat(entry.scripts).includes(file),'Other trainers do not load unnecessary object catalogue');
}
ok(report.coreBytes<=16*1024*1024,'Full offline cache remains within reviewed16MiB budget');
ok(!/(?:src|href)\s*=\s*["']https?:/i.test(read('object-art.js')),'Object catalogue does not require online images');
// Every participating source edit must invalidate the release and all generated
// entry manifests, rather than leave a standalone/PWA copy on previous logic.
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'visual-build-fixture-'));
try{
 const names=new Set(['trainer-assets.json','trainer-loader.js','offline-bundle.js','sw.js','index.html','manifest.webmanifest','pwa.js','tools/build-offline.cjs',...Object.keys(report.sourceHashes),...Object.keys(report.mediaHashes),...Object.keys(report.staticHashes),...Object.keys(registry.trainers).map(f=>f+'/index.html')]);
 for(const name of names){fs.mkdirSync(path.dirname(path.join(temp,name)),{recursive:true});fs.copyFileSync(path.join(root,name),path.join(temp,name));}
 const build=()=>vm.runInNewContext(read('tools/build-offline.cjs'),{require,__dirname:path.join(temp,'tools'),Buffer,console:{log(){}}});
 build();let previous=JSON.parse(fs.readFileSync(path.join(temp,'trainer-build.json'),'utf8'));eq(previous.build,report.build,'Unmodified fixture reproduces build');
 for(const file of ['workspace-layout.css','workspace-layout.js','math-workspace.css','math-workspace.js','object-art.js']){
  fs.appendFileSync(path.join(temp,file),'\n/* synthetic asset update */\n');build();const next=JSON.parse(fs.readFileSync(path.join(temp,'trainer-build.json'),'utf8'));
  ok(next.build!==previous.build,'Change to '+file+' invalidates build');eq(next.sourceHashes[file],sha(fs.readFileSync(path.join(temp,file),'utf8')));
  for(const folder of Object.keys(registry.trainers)){
   const html=fs.readFileSync(path.join(temp,folder,'index.html'),'utf8'),m=JSON.parse(html.match(/data-trainer-assets>([\s\S]*?)<\/script>/)[1]);eq(m.build,next.build,'All entries move together after '+file);
   const entry=registry.trainers[folder];if(entry.styles.concat(entry.scripts).includes(file))ok(fs.readFileSync(path.join(temp,folder,'offline.html'),'utf8').includes(fs.readFileSync(path.join(temp,file),'utf8').replace(/<\/script/gi,'<\\/script')),'Updated standalone includes '+file);
  }
  ok(fs.readFileSync(path.join(temp,'sw.js'),'utf8').includes("const VERSION = '"+next.build+"';"),'PWA version follows all generated entries');previous=next;
 }
}finally{fs.rmSync(temp,{recursive:true,force:true});}
const result={success:true,checks,build:report.build,coreBytes:report.coreBytes,budgetBytes:report.budgetBytes,exactSharedOfflineSources:true,sourceChangeInvalidatesBuild:true,productionWrites:false};
if(process.env.VISUAL_REVIEW_DIR){fs.mkdirSync(process.env.VISUAL_REVIEW_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.VISUAL_REVIEW_DIR,'visual-build-report.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result));
