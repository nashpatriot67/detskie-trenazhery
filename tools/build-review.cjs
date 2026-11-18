'use strict';
// Acceptance wrapper only. Real application bytes run in a sandboxed iframe;
// its Storage API is an in-memory object. No real browser records are read.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=process.env.STAGE1_REVIEW_DIR||'/workspace/scratch/stage1-review';
const build=JSON.parse(fs.readFileSync(path.join(root,'trainer-build.json'),'utf8')).build;
const pages=Object.fromEntries(['kubiki','bricks','slovograd'].map(name=>[name,fs.readFileSync(path.join(root,name,'offline.html'),'utf8')]));
const data=JSON.stringify(pages).replace(/</g,'\\u003c');
const html=`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Этап 1 — ручная проверка</title><style>body{margin:0;font:15px/1.5 "Trebuchet MS",Arial,sans-serif;color:#263e3b;background:#f4f8f3}header{padding:14px 20px;border-bottom:1px solid #d9e6dc;background:#fff}.bar{display:flex;flex-wrap:wrap;align-items:center;gap:9px}h1{font-size:20px;margin:0 12px 0 0}button{font:inherit;min-height:44px;padding:8px 14px;border:1px solid #b9d1c3;border-radius:9px;background:#fff;color:#246e65;cursor:pointer}button[aria-pressed=true]{background:#167d78;color:#fff}.note{margin:10px 0 0;max-width:95em;font-size:12px;color:#586f63}iframe{display:block;width:100%;height:calc(100vh - 147px);min-height:660px;border:0;background:#fff}.stamp{color:#758d7f;font-size:11px}@media(max-width:600px){header{padding:12px}h1{flex-basis:100%}iframe{height:calc(100vh - 220px)}}</style><header><div class="bar"><h1>Проверяем этап 1</h1><button data-trainer="kubiki" aria-pressed="true">Кубики</button><button data-trainer="bricks" aria-pressed="false">LEGO</button><button data-trainer="slovograd" aria-pressed="false">Русский язык</button><button id="reopen">Переоткрыть тренажёр</button><button id="clear">Очистить тестовые ответы</button></div><p class="note"><b>Изолированная версия для приёмки.</b> Это рабочий код упражнений. Тестовые ответы живут только в памяти этой страницы и не затрагивают результаты ребёнка. «Переоткрыть» проверяет восстановление на этом тестовом хранилище; после закрытия файла тестовые ответы исчезнут. Публикация не выполнялась.</p><span class="stamp">Сборка ${build}</span></header><iframe id="trainer" title="Тренажёр для ручной проверки" sandbox="allow-scripts allow-downloads"></iframe><script>
'use strict';
const pages=${data};const frame=document.getElementById('trainer'),stores={kubiki:{},bricks:{},slovograd:{}};let current='kubiki',pending=null;
function prelude(name,initial){
 return '('+function(name,initial){
  const records={...initial};
  const store={getItem:key=>Object.prototype.hasOwnProperty.call(records,key)?records[key]:null,setItem:(key,value)=>{records[key]=String(value);parent.postMessage({type:'review-records',name,records:{...records}},'*');},removeItem:key=>{delete records[key];},clear:()=>{Object.keys(records).forEach(k=>delete records[k]);},key:i=>Object.keys(records)[i]||null,get length(){return Object.keys(records).length;}};
  Object.defineProperty(window,'localStorage',{value:store,configurable:false});
  window.addEventListener('message',event=>{if(event.source===parent&&event.data&&event.data.type==='review-flush'){window.dispatchEvent(new Event('pagehide'));parent.postMessage({type:'review-flushed',name,records:{...records}},'*');}});
  document.addEventListener('click',event=>{const a=event.target.closest('a');if(a&&a.getAttribute('href')==='../'){event.preventDefault();parent.postMessage({type:'review-home',name},'*');}},true);
 }.toString()+')('+JSON.stringify(name)+','+JSON.stringify(initial).replace(/</g,'\\u003c')+');';
}
function load(name){current=name;document.querySelectorAll('[data-trainer]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.trainer===name)));const script='<scr'+'ipt>'+prelude(name,stores[name])+'</scr'+'ipt><style>[data-action="download"]{display:none!important}</style>';frame.srcdoc=pages[name].replace(/<body>/i,'<body>'+script);}
function flushThen(next){pending=next;frame.contentWindow.postMessage({type:'review-flush'},'*');}
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||!event.data)return;const d=event.data;if(d.name!==current)return;if(d.type==='review-records'||d.type==='review-flushed')stores[current]=d.records;if(d.type==='review-flushed'&&pending){const next=pending;pending=null;load(next);}if(d.type==='review-home')document.querySelector('[data-trainer="'+current+'"]').focus();});
document.querySelectorAll('[data-trainer]').forEach(b=>b.addEventListener('click',()=>flushThen(b.dataset.trainer)));
document.getElementById('reopen').addEventListener('click',()=>flushThen(current));
document.getElementById('clear').addEventListener('click',()=>{stores[current]={};pending=null;load(current);});
load(current);
</script></html>`;
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'review-demo.html'),html);console.log(JSON.stringify({file:path.join(out,'review-demo.html'),build,bytes:Buffer.byteLength(html),realStorageRead:false,realStorageWrite:false,source:'generated current standalone applications'}));
