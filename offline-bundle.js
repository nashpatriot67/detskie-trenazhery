(function(root){
'use strict';
function checksum(text){var h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
function binaryChecksum(bytes){var h=2166136261;for(var i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619);return h>>>0;}
function cleanHead(head){return String(head).replace(/<meta\b[^>]*name=["']trainer-build["'][^>]*>/gi,'').replace(/<(?:link|meta)\b(?=[^>]*\bdata-pwa\b)[^>]*>/gi,'').replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'').replace(/<style\b[^>]*data-trainer-style[^>]*>[\s\S]*?<\/style>/gi,'');}
function safeScript(text){return String(text).replace(/<\/script/gi,'<\\/script');}
function build(options){
 var m=options.manifest,sources=options.sources||{},head=cleanHead(options.head),media=options.media||{},notices={};
 var styles=m.styles.map(function(a){if(typeof sources[a.path]!=='string')throw Error('missing '+a.path);return '<style data-source-path="'+a.path+'" data-source-hash="'+a.hash+'">'+sources[a.path]+'</style>';}).join('');
 var scripts=m.scripts.map(function(a){if(typeof sources[a.path]!=='string')throw Error('missing '+a.path);return '<script data-source-path="'+a.path+'" data-source-hash="'+a.hash+'">'+safeScript(sources[a.path])+'</script>';}).join('');
 (m.media||[]).forEach(function(a){if(!/^data:audio\/mpeg;base64,[A-Za-z0-9+/]+=*$/.test(media[a.path]||''))throw Error('missing '+a.path);});
 (m.mediaNotices||[]).forEach(function(a){if(typeof sources[a.path]!=='string')throw Error('missing '+a.path);notices[a.path]=sources[a.path];});
 var audio=options.audioBase?'<script>window.VOICE_AUDIO_BASE='+safeScript(JSON.stringify(options.audioBase))+';window.VOICE_BASE_URL=window.VOICE_AUDIO_BASE;</script>':'';
 if((m.media||[]).length)audio+='<script data-coach-audio>window.COACH_AUDIO_FILES='+safeScript(JSON.stringify(media))+';window.COACH_AUDIO_NOTICES='+safeScript(JSON.stringify(notices))+';</script>';
 return '<!doctype html><html lang="ru"><head>'+head+'<meta name="trainer-build" content="'+m.build+'">'+styles+'</head><body><div id="app"></div><div id="live" class="sr-only" aria-live="polite"></div><div id="overlay"></div><script type="application/json" data-trainer-assets>'+safeScript(JSON.stringify(m))+'</script>'+audio+scripts+'</body></html>';
}
function hex(bytes){return Array.from(bytes).map(function(n){return n.toString(16).padStart(2,'0');}).join('');}
async function verified(response,item,binary){
 if(!response||!response.ok||response.status!==200)throw Error('resource');
 var value=binary?new Uint8Array(await response.arrayBuffer()):await response.text();
 if((binary?binaryChecksum(value):checksum(value))!==item.checksum||(binary&&value.byteLength!==item.bytes))throw Error('different-build');
 if(root.crypto&&root.crypto.subtle&&(binary||root.TextEncoder)){
  var bytes=binary?value:new root.TextEncoder().encode(value),digest=await root.crypto.subtle.digest('SHA-256',bytes);
  if(hex(new Uint8Array(digest))!==item.hash)throw Error('different-build');
 }
 return value;
}
async function content(item,binary){
 var url=new URL(item.href,root.location.href).href;
 try{return await verified(await root.fetch(url,{cache:'no-store'}),item,binary);}catch(_){return verified(root.caches&&await root.caches.match(url),item,binary);}
}
function base64(bytes){var chunks=[];for(var i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode.apply(null,bytes.subarray(i,i+8192)));return root.btoa(chunks.join(''));}
async function download(button){
 if(!button)return;
 if(root.location.protocol==='file:'||root.location.protocol==='content:'){button.textContent=root.COACH_AUDIO_FILES?'Задания и голос разминки уже работают офлайн':'Задания работают офлайн; для озвучки нужен интернет';return;}
 button.disabled=true;
 try{
  var el=root.document.querySelector('script[data-trainer-assets]');if(!el)throw Error('manifest');var manifest=JSON.parse(el.textContent),sources={},media={};
  await Promise.all(manifest.styles.concat(manifest.scripts,manifest.mediaNotices||[]).map(async function(item){sources[item.path]=await content(item,false);}));
  await Promise.all((manifest.media||[]).map(async function(item){media[item.path]='data:audio/mpeg;base64,'+base64(await content(item,true));}));
  var value=build({head:root.document.head.innerHTML,manifest:manifest,sources:sources,media:media,audioBase:new URL('./',root.location.href).href}),url=URL.createObjectURL(new Blob([value],{type:'text/html;charset=utf-8'})),a=root.document.createElement('a');a.href=url;a.download=manifest.trainer+'-stage1-offline.html';a.click();setTimeout(function(){URL.revokeObjectURL(url);},5000);button.textContent='Скачано — задания и разминка работают без интернета';
 }catch(_){button.disabled=false;button.textContent='Не удалось скачать. Попробовать ещё раз';}
}
root.TrainerBundle={build:build,download:download};
})(typeof window==='undefined'?globalThis:window);
