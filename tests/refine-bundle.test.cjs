'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;},ok=(v,m)=>{assert.ok(v,m);checks++;},sha=b=>crypto.createHash('sha256').update(b).digest('hex'),fnv=v=>{let h=2166136261;for(let i=0;i<v.length;i++)h=Math.imul(h^(typeof v==='string'?v.charCodeAt(i):v[i]),16777619);return h>>>0;};
const source=fs.readFileSync(path.join(__dirname,'..','offline-bundle.js'),'utf8');
function fixture(options={}){
 const styles='body { color: green; }',script='window.fixtureLoaded=true;',raw=new Uint8Array([0,1,2,128,255]),other=new Uint8Array([4,5,6,7]);
 const contents={'fixture.css':styles,'fixture.js':script,'audio/coach/count-one.mp3':raw,'audio/coach/count-two.mp3':other,'audio/coach/credits.txt':'Credit: synthetic test fixture only.'};
 const item=(name,binary)=>({path:name,href:'../'+name+'?v=fixture',hash:sha(contents[name]),checksum:fnv(contents[name]),...(binary?{bytes:contents[name].length,mime:'audio/mpeg'}:{})});
 const manifest={schemaVersion:1,trainer:'fixture',build:'fixture',styles:[item('fixture.css')],scripts:[item('fixture.js')],media:[item('audio/coach/count-one.mp3',true),item('audio/coach/count-two.mp3',true)],mediaNotices:[item('audio/coach/credits.txt')]};
 if(options.badHash)manifest.media[0].hash='0'.repeat(64);
 let captured=null,clicks=0,network=0,cache=0;const button={disabled:false,textContent:''};
 class TestURL extends URL{static createObjectURL(blob){captured=blob;return 'blob:fixture';}static revokeObjectURL(){}}
 function response(url,fromCache){const name=new URL(url).pathname.replace(/^\/fixture\//,'');let content=contents[name];if(name==='audio/coach/count-one.mp3'&&(fromCache?options.badCache:options.badNetwork))content=new Uint8Array([9]);return new Response(content,{status:options.missing&&name==='fixture.js'?404:200});}
 const window={location:{href:'https://test.invalid/fixture/trainer/',protocol:options.file?'file:':'https:'},document:{head:{innerHTML:'<title>Fixture</title>'},querySelector:()=>({textContent:JSON.stringify(manifest)}),createElement:()=>({click(){clicks++;}})},fetch:async url=>{network++;return response(url,false);},caches:{match:async url=>{cache++;return response(url,true);}},crypto:crypto.webcrypto,TextEncoder,btoa:s=>Buffer.from(s,'binary').toString('base64')};
 if(options.file)window.COACH_AUDIO_FILES={one:'data:audio/mpeg;base64,AA=='};
 const context=vm.createContext({window,URL:TestURL,Blob,Uint8Array,setTimeout(){},Math});vm.runInContext(source,context);
 return {window,button,manifest,contents,get network(){return network;},get cache(){return cache;},get clicks(){return clicks;},get captured(){return captured;}};
}
(async()=>{
 for(const options of [{},{badNetwork:true}]){const f=fixture(options);await f.window.TrainerBundle.download(f.button);eq(f.clicks,1,'Complete verified download only');ok(f.captured);const html=await f.captured.text();ok(html.includes('data-coach-audio'));const raw=html.match(/<script data-coach-audio>([\s\S]*?)<\/script>/)[1],sandbox=vm.createContext({window:{}});vm.runInContext(raw,sandbox);eq(Buffer.from(sandbox.window.COACH_AUDIO_FILES['audio/coach/count-one.mp3'].split(',')[1],'base64'),Buffer.from(f.contents['audio/coach/count-one.mp3']));eq(sandbox.window.COACH_AUDIO_NOTICES['audio/coach/credits.txt'],f.contents['audio/coach/credits.txt']);if(options.badNetwork)ok(f.cache>0,'Corrupt network MP3 recovers from verified exact cache');}
 for(const options of [{badNetwork:true,badCache:true},{badHash:true},{missing:true}]){const f=fixture(options);await f.window.TrainerBundle.download(f.button);eq(f.clicks,0,'A damaged/partial build is never downloaded');eq(f.captured,null);eq(f.button.disabled,false);ok(f.button.textContent.includes('Не удалось скачать'));}
 const f=fixture({file:true});await f.window.TrainerBundle.download(f.button);eq(f.network,0);eq(f.clicks,0);ok(f.button.textContent.includes('голос разминки уже работают офлайн'));
 console.log(JSON.stringify({success:true,checks,binaryIntegrity:true,sha256Verified:true,exactCacheFallback:true,partialDownloadRefused:true,syntheticDataOnly:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
