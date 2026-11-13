(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFC').trim().toLocaleLowerCase('ru');
const words=s=>String(s||'').match(/[а-яё]+(?:-[а-яё]+)*/gi)||[];
function shuffled(list,seed=1){const out=[...list];let n=(Number(seed)||1)>>>0;for(let i=out.length-1;i>0;i--){n=(n*1664525+1013904223)>>>0;const j=n%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out;}
const hash=s=>[...String(s)].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,7);
function spelling(task,text){return norm(text)===norm(task.word);}
// Every added tile represents a documented, task-specific spelling trap.
// Keep repeated letters: «лыжи» needs a SECOND ы to make the typical «лыжы» error possible.
function spellingPool(task){return [...task.word,...(task.confusions||[]).filter(c=>typeof c.wrong==='string'&&/^[а-яё]$/.test(c.wrong)).map(c=>c.wrong)];}
function spellingFeedback(task,answer){
 const entered=norm(answer),expected=norm(task.word);
 if(entered===expected)return '';
 for(const c of task.confusions||[]){
  if(c.omission&&entered===expected.slice(0,c.index)+expected.slice(c.index+1))return c.explanation;
  if(entered.length===expected.length&&entered[c.index]===c.wrong&&entered[c.index]!==expected[c.index])return c.explanation;
 }
 if(entered.length<expected.length)return 'В слове пока не хватает букв. '+(task.hint||task.rule);
 if(entered.length>expected.length)return 'В слове оказались лишние буквы. '+(task.hint||task.rule);
 return 'Проверь порядок букв. '+(task.hint||task.rule);
}
function morphemes(task){return task.parts.reduce((letters,part)=>letters.concat([...part.text].map(()=>part.kind)),[]);}
function morphology(task,marks,zero){return marks.length===task.word.length&&morphemes(task).every((kind,i)=>kind===marks[i])&&Boolean(zero)===task.parts.some(p=>p.kind==='ending'&&p.text==='');}
function syntax(task,marks,full){return task.words.length===marks.length&&task.roles.every((role,i)=>(full||role==='subject'||role==='predicate'?role:'')===(marks[i]||''));}
function builder(task,ids){return ids.length===task.order.length&&ids.every((id,i)=>id===task.order[i]);}
function sentence(chunks,ids){const s=ids.map(i=>chunks[i]?.text||'').join(' ').replace(/\s+/g,' ').trim();return s?s[0].toLocaleUpperCase('ru')+s.slice(1).replace(/[.!?]+$/,'')+'.':'';}
function creative(task,choices){let s=task.template.replace(/\{(\d+)\}/g,(_,i)=>task.banks[i]?.options[choices[i]]||'…');return s?s[0].toLocaleUpperCase('ru')+s.slice(1):'';}
function writingChecks(text){const s=String(text||'').trim(),w=words(s),ns=w.map(norm);return [{key:'capital',text:'Начало с большой буквы',ok:/^[А-ЯЁ]/.test(s)},{key:'punct',text:'В конце есть точка, ! или ?',ok:/[.!?]$/.test(s)},{key:'words',text:'Есть хотя бы три слова',ok:w.length>=3},{key:'repeats',text:'Нет одинаковых слов подряд',ok:w.length>0&&!ns.some((x,i)=>i>0&&x===ns[i-1])}];}
function morphemeStructure(task){const prefix=task.parts.some(p=>p.kind==='prefix'),suffix=task.parts.some(p=>p.kind==='suffix');return prefix&&suffix?'full':prefix?'prefix':suffix?'suffix':'basic';}
function topicMatches(section,task,topic){
 if(!topic||topic==='all')return true;
 const has=role=>task.roles?.includes(role)||task.chunks?.some(c=>c.role===role);
 if(section==='morphology')return topic==='basic'?morphemeStructure(task)==='basic':topic==='prefix'?task.parts.some(p=>p.kind==='prefix'):topic==='suffix'?task.parts.some(p=>p.kind==='suffix'):topic==='full'?morphemeStructure(task)==='full':topic==='zero'?task.parts.some(p=>p.kind==='ending'&&!p.text):false;
 if(section==='prepositions')return topic==='together'?task.together:topic==='separate'?!task.together:false;
 if(section==='syntax')return topic==='simple'?task.roles.every(r=>r==='subject'||r==='predicate'):topic==='inversion'?task.roles.indexOf('predicate')<task.roles.indexOf('subject'):has(topic);
 if(section==='builder')return topic==='foundation'?task.chunks.every(c=>c.role==='subject'||c.role==='predicate'):topic==='inversion'?task.chunks[task.order[0]].role==='predicate':topic==='extended'?task.chunks.length>=4:has(topic);
 return (task.goals||[]).includes(topic);
}
function interleave(tasks,keyFor,order,block=1){const groups=new Map(order.map(k=>[k,[]]));for(const task of tasks){const key=keyFor(task);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(task);}const out=[],keys=[...groups.keys()];for(let round=0;out.length<tasks.length;round+=block)for(const key of keys)for(let offset=0;offset<block;offset++)if(groups.get(key)[round+offset])out.push(groups.get(key)[round+offset]);return out;}
function mixTopics(tasks,section){
 if(section==='morphology')return interleave(tasks,morphemeStructure,['basic','prefix','suffix','full']);
 if(section==='spelling')return interleave(tasks,t=>t.category,[],5);
 if(section==='prepositions')return interleave(tasks,t=>t.together?'together':'separate',['separate','together']);
 if(section==='syntax')return interleave(tasks,t=>{const has=r=>t.roles.includes(r);return has('attribute')&&has('object')&&has('adverbial')?'rich':has('attribute')?'attribute':has('object')?'object':has('adverbial')?'adverbial':'simple';},['simple','attribute','object','adverbial','rich']);
 if(section==='builder')return interleave(tasks,t=>t.order.map(i=>t.chunks[i].role).join('/'),[]);
 return interleave(tasks,t=>t.goals?.[0]||'other',[],section==='creative'?3:1);
}
// A rule is practised three ways before the course moves to the next rule.
// Separate word sets test transfer of the rule instead of memorising one answer.
function spellingCourse(tasks,grade){
 if(grade!==1&&grade!==2)throw new RangeError('Spelling course grade must be 1 or 2');
 const groups=new Map();
 for(const task of tasks){
  if(task.level>grade)continue;
  if(!groups.has(task.category))groups.set(task.category,[]);
  groups.get(task.category).push(task);
 }
 return [...groups].map(([category,items])=>{
  const ordered=grade===2?items.filter(t=>t.level===2).concat(items.filter(t=>t.level!==2)):items;
  const stages=['construct','write','dictation'].map(mode=>({mode,tasks:[]}));
  ordered.forEach((task,index)=>stages[index%3].tasks.push(task));
  // Current categories have at least four words. A tiny future category can
  // still offer all modes; reuse only where a third distinct word is absent.
  stages.forEach((stage,index)=>{if(!stage.tasks.length)stage.tasks.push(ordered[index%ordered.length]);});
  return {category,stages};
 });
}
root.RusCore={norm,words,shuffled,hash,spelling,spellingPool,spellingFeedback,morphemeStructure,topicMatches,mixTopics,spellingCourse,morphemes,morphology,syntax,builder,sentence,creative,writingChecks};
})(typeof window==='undefined'?globalThis:window);
