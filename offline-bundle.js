(function(root){
'use strict';
function checksum(text){var h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
function cleanHead(head){return String(head).replace(/<meta\b[^>]*name=["']trainer-build["'][^>]*>/gi,'').replace(/<(?:link|meta)\b(?=[^>]*\bdata-pwa\b)[^>]*>/gi,'').replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi,'').replace(/<style\b[^>]*data-trainer-style[^>]*>[\s\S]*?<\/style>/gi,'');}
function safeScript(text){return String(text).replace(/<\/script/gi,'<\\/script');}
function build(options){
 var m=options.manifest,sources=options.sources||{},head=cleanHead(options.head),styles=m.styles.map(function(a){if(typeof sources[a.path]!=='string')throw Error('missing '+a.path);return '<style data-source-path="'+a.path+'" data-source-hash="'+a.hash+'">'+sources[a.path]+'</style>';}).join('');
 var scripts=m.scripts.map(function(a){if(typeof sources[a.path]!=='string')throw Error('missing '+a.path);return '<script data-source-path="'+a.path+'" data-source-hash="'+a.hash+'">'+safeScript(sources[a.path])+'</script>';}).join('');
 var audio=options.audioBase?'<script>window.VOICE_AUDIO_BASE='+JSON.stringify(options.audioBase)+';window.VOICE_BASE_URL=window.VOICE_AUDIO_BASE;</script>':'';
 return '<!doctype html><html lang="ru"><head>'+head+'<meta name="trainer-build" content="'+m.build+'">'+styles+'</head><body><div id="app"></div><div id="live" class="sr-only" aria-live="polite"></div><div id="overlay"></div><script type="application/json" data-trainer-assets>'+safeScript(JSON.stringify(m))+'</script>'+audio+scripts+'</body></html>';
}
async function download(button){
 if(!button)return;
 if(location.protocol==='file:'||location.protocol==='content:'){button.textContent='Задания работают офлайн; для озвучки нужен интернет';return;}
 button.disabled=true;
 try{
  var el=document.querySelector('script[data-trainer-assets]');if(!el)throw Error('manifest');var manifest=JSON.parse(el.textContent),sources={};
  await Promise.all(manifest.styles.concat(manifest.scripts).map(async function(item){var url=new URL(item.href,location.href).href,response;try{response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error('resource');}catch(_){response=root.caches&&await caches.match(url);if(!response||!response.ok)throw Error('cache');}var text=await response.text();if(checksum(text)!==item.checksum){response=root.caches&&await caches.match(url);if(!response||!response.ok)throw Error('different-build');text=await response.text();if(checksum(text)!==item.checksum)throw Error('different-build');}sources[item.path]=text;}));
  var value=build({head:document.head.innerHTML,manifest:manifest,sources:sources,audioBase:new URL('./',location.href).href}),url=URL.createObjectURL(new Blob([value],{type:'text/html;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=manifest.trainer+'-stage1-offline.html';a.click();setTimeout(function(){URL.revokeObjectURL(url);},5000);button.textContent='Скачано — задания работают без интернета';
 }catch(_){button.disabled=false;button.textContent='Не удалось скачать. Попробовать ещё раз';}
}
root.TrainerBundle={build:build,download:download};
})(typeof window==='undefined'?globalThis:window);
