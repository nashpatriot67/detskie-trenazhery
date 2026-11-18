'use strict';
// Real localhost browser/PWA checks. Every profile and every progress record is
// synthetic; no published host, real student store, or production files are used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const baseline=process.env.STAGE1_BASELINE||'/workspace/math-p0-dev';
const output=process.env.STAGE1_REVIEW_DIR||'/workspace/scratch/stage1-review';
const reportFile=path.basename(process.env.STAGE1_REPORT_NAME||'stage1-pwa-report.json');
const prefix='/detskie-trenazhery/',staticBase='https://stage1.invalid'+prefix;
const report={success:false,syntheticProgressOnly:true,productionWrites:false,studentDataAccess:false,package:{},standalone:{},browser:{},limitations:['Desktop Chromium with mobile/tablet viewports is not a physical Huawei or Safari test.','Exact generated/downloaded HTML is served from an in-memory response with all other requests blocked; managed file:// navigation is not claimed.','A waiting worker is verified independently from the active controlling worker; closing a browser alone is not treated as proof of activation.']};
function ok(value,message){assert.ok(value,message);report.assertions=(report.assertions||0)+1;}
function equal(actual,expected,message){assert.deepEqual(actual,expected,message);report.assertions=(report.assertions||0)+1;}
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function coreFor(folder){const c=vm.createContext({self:{location:{href:staticBase+'sw.js'},addEventListener(){}},URL,Request,Response});vm.runInContext(fs.readFileSync(path.join(folder,'sw.js'),'utf8'),c);return JSON.parse(JSON.stringify(vm.runInContext('({version:VERSION,urls:CORE_URLS})',c)));}
function embeddedManifest(html){const match=html.match(/<script\b[^>]*\bdata-trainer-assets\b[^>]*>([\s\S]*?)<\/script>/i);return match?JSON.parse(match[1]):null;}
function assetPath(item){return typeof item==='string'?item:item.href||item.src||item.url||item.path;}
function manifestAssets(folder){const html=fs.readFileSync(path.join(root,folder,'index.html'),'utf8'),m=embeddedManifest(html);ok(m,folder+' index embeds a manifest');return{html,m,scripts:(m.scripts||[]).map(assetPath),styles:(m.styles||[]).map(assetPath)};}
function localFile(url,base=staticBase){const u=new URL(url,base);let relative=u.pathname.slice(prefix.length);if(!relative||relative.endsWith('/'))relative+='index.html';return path.join(root,relative);}
let stageCore,oldCore,initialSourceHashes={};
function packageChecks(){
 stageCore=coreFor(root);oldCore=coreFor(baseline);ok(stageCore.version!==oldCore.version,'Stage 1 has a new worker version');equal(new Set(stageCore.urls).size,stageCore.urls.length);let bytes=0;
 const known=new Set(stageCore.urls.map(v=>new URL(v).pathname+new URL(v).search));
 for(const value of stageCore.urls){const u=new URL(value);equal(u.origin,new URL(staticBase).origin);ok(u.pathname.startsWith(prefix));ok(!/\/audio\/|\.mp3$/i.test(u.pathname),'Audio is not bulk-preloaded');const file=localFile(value);ok(fs.existsSync(file),value);bytes+=fs.statSync(file).size;}
 ok(bytes<12*1024*1024,'Core excludes the large recordings');let dependencies=0;const entries={};
 for(const folder of ['kubiki','bricks','slovograd']){const manifest=manifestAssets(folder);equal(manifest.m.schemaVersion,1);equal(manifest.m.trainer,folder);ok(/^stage1-/.test(manifest.m.build),'content-addressed trainer build');for(const asset of manifest.m.scripts.concat(manifest.m.styles)){equal(sha(fs.readFileSync(path.join(root,asset.path))),asset.hash,'Manifest SHA256 matches current source '+asset.path);initialSourceHashes[asset.path]=asset.hash;}for(const href of manifest.scripts.concat(manifest.styles)){const u=new URL(href,staticBase+folder+'/');ok(fs.existsSync(localFile(u.href)),href);ok(known.has(u.pathname+u.search),href+' has an exact precache key');dependencies++;}const offline=path.join(root,folder,'offline.html');ok(fs.existsSync(offline));entries[folder]={scripts:manifest.scripts,styles:manifest.styles,offlineBytes:fs.statSync(offline).size};}
 report.package={oldWorker:oldCore.version,newWorker:stageCore.version,coreRequests:stageCore.urls.length,coreBytes:bytes,indexDependencies:dependencies,entries};
}
const keys={kubiki:'kubiki-progress-v1',bricks:'detalki-progress-v1',slovograd:'slovograd-v1'};
function decodeScripts(html){return html.replace(/<\\\/script/gi,'</script');}
async function expectedStandalone(page,html,folder,label){
 const tags=await page.evaluate(value=>{const doc=new DOMParser().parseFromString(value,'text/html');return{scripts:[...doc.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')),styles:[...doc.querySelectorAll('link[rel=stylesheet]')].map(x=>x.getAttribute('href')),build:doc.querySelector('meta[name="trainer-build"]')?.content,sources:[...doc.querySelectorAll('[data-source-path]')].map(x=>({path:x.getAttribute('data-source-path'),hash:x.getAttribute('data-source-hash')}))};},html);
 equal(tags.scripts,[],label+' embeds every script');equal(tags.styles,[],label+' embeds every stylesheet');
 const manifest=manifestAssets(folder);equal(tags.build,manifest.m.build,label+' uses the current build');equal(tags.sources.sort((a,b)=>a.path.localeCompare(b.path)),manifest.m.styles.concat(manifest.m.scripts).map(a=>({path:a.path,hash:a.hash})).sort((a,b)=>a.path.localeCompare(b.path)),label+' embeds the complete same source hash list');const normalized=html.replace(/\r\n/g,'\n');
 for(const href of manifest.scripts.concat(manifest.styles)){const source=fs.readFileSync(localFile(new URL(href,staticBase+folder+'/').href),'utf8').replace(/\r\n/g,'\n').trim();const isScript=manifest.scripts.includes(href),embedded=isScript?source.replace(/<\/script/gi,'<\\/script'):source;ok(normalized.includes(embedded),label+' contains exact current source '+href);}
}
async function main(){
 packageChecks();let upgraded=false,context,server;let browser;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'stage1-pwa-synthetic-'));
 const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.mp3':'audio/mpeg'};
 server=http.createServer((req,res)=>{try{const u=new URL(req.url,'http://localhost');let relative=decodeURIComponent(u.pathname);if(!relative.startsWith(prefix)||relative.includes('..')){res.writeHead(404).end();return;}relative=relative.slice(prefix.length);if(!relative||relative.endsWith('/'))relative+='index.html';const file=path.join(upgraded?root:baseline,relative);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}catch{res.writeHead(500).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port+prefix;
 async function launch(offline=false){context=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox'],viewport:{width:768,height:1024},reducedMotion:'reduce'});context.setDefaultTimeout(15000);await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());if(offline)await context.setOffline(true);return context.pages()[0]||await context.newPage();}
 const snapshot=page=>page.evaluate(()=>({saved:JSON.parse(localStorage.getItem(STORAGE_KEY)),view:state.view,lesson:state.lesson,mode:state.mode,index:state.index,zones:JSON.parse(JSON.stringify(state.zones)),answer:state.answer,freeTarget:state.freeTarget}));
 async function bootstrap(page,folder){await page.waitForFunction(({folder})=>!!document.querySelector('.app-shell')&&(folder==='slovograd'||!!window.PlaceValue)&&!!window.LearningProgress,{folder});}
 try{
  let page=await launch();await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);ok((await page.evaluate(()=>caches.keys())).some(x=>x.endsWith(':'+oldCore.version)),'P0 baseline worker installed');
  const original={};
  for(const folder of ['kubiki','bricks']){
   await page.goto(base+folder+'/');await page.waitForFunction(()=>typeof state==='object');
   original[folder]=await page.evaluate(()=>{markRead(8);markModeDone('play',8,0);startWorksheet(8);renderFresh();const input=document.querySelector('[data-ws-input="0"]');input.value='13';input.dispatchEvent(new Event('input',{bubbles:true}));save();startTask(8,2,false,'play');state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};state.zones.a.ten=2;state.zones.a.unit=12;if('double'in state.zones.a){state.zones.a.unit=3;state.zones.a.double=2;state.zones.a.five=1;}state.answer='7';state.undo=[JSON.stringify({a:K.parts(32),b:K.empty(),removed:K.empty()})];renderFresh();save();return JSON.parse(localStorage.getItem(STORAGE_KEY));});
   equal(original[folder].worksheet['8']['0'],'13');equal(original[folder].session.version,2);
  }
  const pinned=page;let navigations=0;pinned.on('framenavigated',frame=>{if(frame===pinned.mainFrame())navigations++;});upgraded=true;
  await pinned.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await pinned.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);equal(navigations,0,'Upgrade must not force page navigation');ok((await pinned.evaluate(()=>caches.keys())).some(x=>x.endsWith(':'+stageCore.version)),'New atomic cache prepared');
  page=await context.newPage();const staged={};
  for(const folder of ['kubiki','bricks']){
   await page.goto(base+folder+'/');await bootstrap(page,folder);const old=await snapshot(page);
   for(const field of ['solved','modeSolved','read','worksheet','resetEpoch'])equal(old.saved[field],original[folder][field],folder+' legacy '+field+' unchanged');
   staged[folder]=await page.evaluate(()=>{openWorkshop();state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};state.zones.a.hundred=10;state.freeTarget=1000;const L=window.LearningProgress;let a=L.attempt('math.qa.pwa.exchange',['math.qa.pwa.exchange']);L.help(a,'explanation');L.help(a,'error');progress.learning=L.record(progress.learning,{...a,outcome:'correct'});progress.learning=L.record(progress.learning,{...L.attempt('math.qa.pwa.skipped',['math.qa.pwa.skipped']),outcome:'skipped'});renderFresh();save();return {stored:JSON.parse(localStorage.getItem(STORAGE_KEY)),zones:JSON.parse(JSON.stringify(state.zones)),target:state.freeTarget};});
   equal(staged[folder].target,1000);equal(staged[folder].zones.a.hundred,10);equal(await page.evaluate(()=>K.total(state.zones.a)),1000,'Boundary value is not truncated');
   await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
  }
  // Deliberately leave stale known CORE assets in the OLD cache. The new
  // index must reject their source checksum and read the exact prepared cache,
  // rather than accepting old engine/app bytes just because fetch returned 200.
  const poisonedSources=Object.fromEntries(['kubiki/engine.js','kubiki/app.js','place-value.js'].filter(name=>fs.existsSync(path.join(baseline,name))).map(name=>[name,fs.readFileSync(path.join(baseline,name),'utf8')]));
  const poisoned=await page.evaluate(async({old,sources})=>{const names=await caches.keys(),name=names.find(x=>x.endsWith(':'+old));const cache=await caches.open(name),requests=await cache.keys(),changed=[];for(const [relative,source]of Object.entries(sources)){const suffix='/detskie-trenazhery/'+relative,request=requests.find(r=>new URL(r.url).pathname===suffix);if(request){await cache.put(request,new Response(source,{status:200,headers:{'Content-Type':'text/javascript'}}));changed.push(relative);}}return changed;},{old:oldCore.version,sources:poisonedSources});
  ok(poisoned.includes('kubiki/engine.js')&&poisoned.includes('kubiki/app.js'),'Old active cache contains deliberately stale known assets');
  report.browser.staleKnownAssetRecovery={poisonedOldCachePaths:poisoned,sourceChecksumRequired:true};
  await context.setOffline(true);const pending=[];
  for(const folder of ['kubiki','bricks']){
   const errors=[];const listener=e=>errors.push(String(e));page.on('pageerror',listener);await page.goto(base+folder+'/');await bootstrap(page,folder);page.off('pageerror',listener);equal(errors,[],folder+' pending offline has no exceptions');
   ok(await page.locator('[data-pv-open="practice"]').count()>0,folder+' new activity navigation survived stale app cache');equal(await page.evaluate(()=>PlaceValue.describe(K.parts(1000),K).total),1000,'Boundary-capable shared model survived stale helper cache');
   equal(await page.evaluate(()=>K.total(state.zones.a)),1000,folder+' pending offline restores 1000 model');equal(await page.evaluate(()=>state.freeTarget),1000);equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.qa.pwa.exchange')),'assisted');equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.qa.pwa.skipped')),'skipped');
   const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)));equal(saved.worksheet,original[folder].worksheet);equal(saved.solved,original[folder].solved);equal(saved.modeSolved,original[folder].modeSolved);equal(saved.learning.observations,staged[folder].stored.learning.observations);ok(await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting),'Recovery did not force worker activation');pending.push(folder);
  }
  const workers=await Promise.all(context.serviceWorkers().map(w=>w.evaluate(async()=>({version:VERSION,controlledClients:(await self.clients.matchAll()).length}))));ok(workers.some(x=>x.version===oldCore.version&&x.controlledClients>0),'Old P0 worker still controls');ok(workers.some(x=>x.version===stageCore.version&&x.controlledClients===0),'Stage1 worker remains waiting');report.browser.pendingOffline={entries:pending,workers,allNewModulesRecovered:true,progressPreserved:true};
  await context.setOffline(false);await page.close();await pinned.close();await new Promise(resolve=>setTimeout(resolve,1000));page=await context.newPage();await page.goto(base);await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(async({version,old})=>{const r=await navigator.serviceWorker.getRegistration(),keys=await caches.keys();return !r.waiting&&r.active&&r.active.state==='activated'&&keys.some(x=>x.endsWith(':'+version))&&!keys.some(x=>x.endsWith(':'+old));},{version:stageCore.version,old:oldCore.version});
  await context.close();context=null;page=await launch();
  for(const folder of ['kubiki','bricks']){await page.goto(base+folder+'/');await bootstrap(page,folder);equal(await page.evaluate(()=>K.total(state.zones.a)),1000);equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.qa.pwa.exchange')),'assisted');}
  await new Promise(resolve=>setTimeout(resolve,1200));await context.close();context=null;page=await launch(true);
  const offline=[];
  for(const folder of ['kubiki','bricks']){await page.goto(base+folder+'/');await bootstrap(page,folder);equal(await page.evaluate(()=>K.total(state.zones.a)),1000);equal(await page.evaluate(()=>state.freeTarget),1000);equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.qa.pwa.skipped')),'skipped');equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(STORAGE_KEY)).worksheet),original[folder].worksheet);offline.push(folder);}
  await page.goto(base+'slovograd/');await bootstrap(page,'slovograd');offline.push('slovograd');report.browser.fullRestartOffline={entries:offline,model1000:true,oldAwardsAndDrafts:true,assistanceAndSkipStatuses:true};
  // Preserve an unfinished diagnostic, including a skipped card and help/error
  // flags, across a complete offline browser restart. No new independent
  // result is credited merely because the corrected draft contains an answer.
  const diagnostic={};
  for(const folder of ['kubiki','bricks']){
   await page.goto(base+folder+'/');await bootstrap(page,folder);
   await page.evaluate(()=>{window.PlaceValueActivities.start(state,'diagnostic',K,window.LearningProgress,progress.learning);renderFresh();save();});
   await page.locator('[data-pv-action="skip"]').click();await page.locator('[data-pv-action="next"]').click();
   equal(await page.evaluate(()=>window.PlaceValueActivities.current(state.pv).kind),'read','Second diagnostic card reads an unlabelled model');
   await page.locator('[data-pv-action="hint"]').click();await page.locator('#pv-answer').fill('300');await page.locator('[data-pv-action="check"]').click();await page.locator('#pv-answer').fill('305');await page.evaluate(()=>save());
   diagnostic[folder]=await page.evaluate(()=>({queue:state.pv.queue,index:state.pv.index,taskId:window.PlaceValueActivities.current(state.pv).id,answer:state.answer,help:state.pv.help,firstOutcome:state.pv.firstOutcome,solved:state.solved,observations:JSON.parse(JSON.stringify(progress.learning.observations))}));
   equal(diagnostic[folder].answer,'305');equal(diagnostic[folder].solved,false);ok(diagnostic[folder].help.visual&&diagnostic[folder].help.afterError,'Diagnostic retains help and error facts separately');equal(diagnostic[folder].firstOutcome,'incorrect');
  }
  await context.close();context=null;page=await launch(true);
  for(const folder of ['kubiki','bricks']){
   await page.goto(base+folder+'/');await bootstrap(page,folder);
   const actual=await page.evaluate(()=>({queue:state.pv.queue,index:state.pv.index,taskId:window.PlaceValueActivities.current(state.pv).id,answer:state.answer,help:state.pv.help,firstOutcome:state.pv.firstOutcome,solved:state.solved,observations:JSON.parse(JSON.stringify(progress.learning.observations))}));
   equal(actual,diagnostic[folder],folder+' exact unfinished diagnostic resumes offline');equal(await page.evaluate(()=>K.total(progress.workshop.zones.a)),1000,'Previously saved boundary workshop is retained');
   equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.placevalue.position')),'skipped');equal(await page.evaluate(()=>window.LearningProgress.status(progress.learning,'math.placevalue.read')),'incorrect','Corrected draft is not a newly credited result');
  }
  report.browser.diagnosticRestart={entries:['kubiki','bricks'],queueAndCursor:true,unfinishedCorrectedDraft:true,visualHelpAndAfterError:true,skippedDistinctFromUnchecked:true,oldWorkshop1000Retained:true};
  await context.setOffline(false);browser=context.browser();const exactBundles={};
  for(const folder of ['kubiki','bricks','slovograd']){
   const isolated=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'});const p=await isolated.newPage();await p.goto(base+folder+'/');await bootstrap(p,folder);
   await p.locator('.topbar [data-action="help"]').click();const downloadPromise=p.waitForEvent('download');await p.locator('[data-action="download"]').click();const download=await downloadPromise;const downloaded=path.join(output,folder+'-stage1-download.html');await download.saveAs(downloaded);const dynamic=fs.readFileSync(downloaded,'utf8'),fixed=fs.readFileSync(path.join(root,folder,'offline.html'),'utf8');await expectedStandalone(p,fixed,folder,folder+' static');await expectedStandalone(p,dynamic,folder,folder+' dynamic');await isolated.close();
   for(const [kind,html]of [['static',fixed],['dynamic',dynamic]]){
    const standalone=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce'}),offlinePage=await standalone.newPage(),requests=[],errors=[],url='http://stage1-bundle.invalid/'+folder+'-'+kind+'.html';offlinePage.on('pageerror',e=>errors.push(String(e)));await standalone.route('**/*',route=>{if(route.request().url()===url)return route.fulfill({status:200,contentType:'text/html',body:html});requests.push(route.request().url());return route.abort();});
    try{await offlinePage.goto(url);await bootstrap(offlinePage,folder);if(folder!=='slovograd'){await offlinePage.evaluate(()=>{openWorkshop();state.zones={a:K.empty(),b:K.empty(),removed:K.empty()};state.zones.a.ten=2;state.zones.a.unit=15;renderFresh();});const before=await offlinePage.locator('[data-zone="a"] .quantity-summary').innerText();ok(/2\s*Д/.test(before)&&/15\s*Е/.test(before),'P0 actual raw representation in '+folder+' '+kind);await offlinePage.locator('[data-exchange="pack"]').click();await offlinePage.evaluate(async()=>PlaceValueMotion.idle());equal(await offlinePage.evaluate(()=>({u:state.zones.a.unit,t:state.zones.a.ten,f:state.zones.a.five||0})),{u:5,t:3,f:0},'Exact P0 leftovers in '+folder+' '+kind);equal(await offlinePage.evaluate(()=>K.total(K.parts(1000))),1000);
      await offlinePage.locator('[data-pv-open="practice"]').first().click();await offlinePage.locator('[data-pv-task-select]').selectOption('pv.digits.305');
      for(const [position,digit]of [3,0,5].entries()){await offlinePage.locator('[data-pv-action="digit"][data-digit="'+digit+'"]').click();await offlinePage.locator('[data-pv-action="place"][data-place="'+position+'"]').click();}
      await offlinePage.locator('[data-pv-action="check"]').click();equal(await offlinePage.evaluate(()=>state.solved),true,'Current constructor works in '+folder+' '+kind+' without network');equal(await offlinePage.evaluate(()=>LearningProgress.status(progress.learning,'math.placevalue.position')),'independent','Standalone new results use the same additive progress');
     }equal(errors,[],folder+' '+kind+' no exceptions');equal(requests,[],folder+' '+kind+' written practice no network dependency');}finally{await standalone.close();}
   }
   exactBundles[folder]={staticCurrentSources:true,dynamicCurrentSources:true,standaloneBothInteractive:true,staticSHA256:sha(fixed),dynamicSHA256:sha(dynamic)};
  }
  report.standalone=exactBundles;
  // Missing prepared cache: every raw store must survive a failed bootstrap.
  const empty=await browser.newContext({serviceWorkers:'block'}),p=await empty.newPage();await empty.route('**/learning-progress.js*',route=>route.abort());await p.goto(base);const raw={};for(const folder of ['kubiki','bricks'])raw[keys[folder]]=JSON.stringify(staged[folder].stored);await p.evaluate(raw=>Object.entries(raw).forEach(([key,value])=>localStorage.setItem(key,value)),raw);
  try{for(const folder of ['kubiki','bricks','slovograd']){await p.goto(base+folder+'/');await p.getByRole('heading',{name:/Завершим обновление|Не удалось|Обновление/}).waitFor();await p.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));document.dispatchEvent(new Event('visibilitychange'));});equal(await p.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(raw)),raw,'Missing cache leaves raw progress unchanged');}report.browser.missingCache={clearMessage:true,rawProgressUnchanged:true};}finally{await empty.close();}
  // A stale cached HTML document can request a newer stable app.js path
  // without ever loading its new helpers. This mixed-version document must
  // stop safely even before the current inline-loader HTML has been fetched.
  const mixed=[];
  for(const folder of ['kubiki','bricks','slovograd']){
   const legacyHTML=fs.readFileSync(path.join(baseline,folder,'index.html'),'utf8'),isolated=await browser.newContext({serviceWorkers:'block'}),mixedPage=await isolated.newPage(),errors=[],documentUrl=base+folder+'/';
   mixedPage.on('pageerror',error=>errors.push(String(error)));
   await isolated.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().url()===documentUrl)return route.fulfill({status:200,contentType:'text/html',body:legacyHTML});if(/\/(?:learning-progress|math-range|place-value-activities)\.(?:js|css)$/.test(url.pathname))return route.abort();return url.origin===new URL(base).origin?route.continue():route.abort();});
   try{
    await mixedPage.goto(base);const seeded=Object.fromEntries(Object.entries(staged).map(([name,data])=>[keys[name],JSON.stringify(data.stored)]));seeded[keys.slovograd]=JSON.stringify({grade:2,done:{'spelling:legacy-example':true},sentinel:'mixed-version-test',learning:{version:1,generation:'initial',observations:[],activity:null}});
    await mixedPage.evaluate(raw=>Object.entries(raw).forEach(([key,value])=>localStorage.setItem(key,value)),seeded);
    await mixedPage.goto(documentUrl);await mixedPage.getByRole('heading',{name:/Завершим обновление|Не удалось|Обновление/}).waitFor();
    await mixedPage.evaluate(()=>{window.dispatchEvent(new Event('pagehide'));document.dispatchEvent(new Event('visibilitychange'));});
    equal(errors,[],folder+' old HTML plus new app stops without exceptions');equal(await mixedPage.evaluate(keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)])),Object.keys(seeded)),seeded,folder+' mixed-version stop preserves all raw records');mixed.push(folder);
   }finally{await isolated.close();}
  }
  report.browser.mixedLegacyHTML={entries:mixed,missingNewHelpers:true,clearUpdateMessage:true,noAppExceptions:true,rawProgressUnchanged:true};
  const changed=Object.entries(initialSourceHashes).filter(([name,digest])=>sha(fs.readFileSync(path.join(root,name)))!==digest).map(([name])=>name);equal(changed,[],'Source files stayed frozen during PWA and standalone checks');report.sourceFilesChanged=false;report.sourceHashes=initialSourceHashes;
  report.success=true;
 }finally{if(context)await context.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(profile,{recursive:true,force:true});}
}
fs.mkdirSync(output,{recursive:true});main().then(()=>{fs.writeFileSync(path.join(output,reportFile),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));}).catch(error=>{report.error=String(error.stack||error);fs.writeFileSync(path.join(output,reportFile),JSON.stringify(report,null,2)+'\n');console.error(error);process.exitCode=1;});
