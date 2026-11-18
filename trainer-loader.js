(function(){
'use strict';
var doc=document,node=doc.querySelector('script[data-trainer-assets]');
if(!node)return;
var manifest=JSON.parse(node.textContent),base=new URL('./',location.href);
function cached(url){return window.caches?caches.match(url).then(function(r){if(r&&r.ok)return r;throw Error('missing-cache');}):Promise.reject(Error('no-cache'));}
function checksum(text){var h=2166136261;for(var i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return h>>>0;}
function verified(response,item){if(!response||!response.ok)throw Error('resource');return response.text().then(function(text){if(checksum(text)!==item.checksum)throw Error('different-build');if(window.crypto&&crypto.subtle&&window.TextEncoder)return crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(function(hash){var hex=Array.from(new Uint8Array(hash)).map(function(n){return n.toString(16).padStart(2,'0');}).join('');if(hex!==item.hash)throw Error('different-build');return text;});return text;});}
function content(item){var url=new URL(item.href,base).href;return fetch(url,{cache:'no-store'}).then(function(r){return verified(r,item);}).catch(function(){return cached(url).then(function(r){return verified(r,item);});});}
function script(source){return new Promise(function(resolve,reject){var el=doc.createElement('script'),url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));el.onload=function(){URL.revokeObjectURL(url);el.remove();resolve();};el.onerror=function(){URL.revokeObjectURL(url);el.remove();reject(Error('script'));};el.src=url;doc.body.appendChild(el);});}
var chain=Promise.resolve();
manifest.styles.forEach(function(item){chain=chain.then(function(){return content(item);}).then(function(text){var el=doc.createElement('style');el.dataset.trainerStyle=item.path;el.textContent=text;doc.head.appendChild(el);});});
// Load source bytes before running any app. A missing dependency never permits a
// partial app to overwrite saved data. Prepared caches cover pending SW updates.
var sources=[];
manifest.scripts.forEach(function(item){chain=chain.then(function(){return content(item);}).then(function(text){sources.push(text);});});
chain.then(function(){var run=Promise.resolve();sources.forEach(function(text){run=run.then(function(){return script(text);});});return run;}).catch(function(){var app=doc.getElementById('app');if(app)app.innerHTML='<main style="max-width:36em;margin:12vh auto;padding:24px;font:18px/1.6 sans-serif"><h1>Завершим обновление</h1><p>Подключись к интернету и открой тренажёр ещё раз. Сохранённые результаты останутся на устройстве.</p><a href="../">Все игры</a></main>';});
})();
