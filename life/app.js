(function(root){
'use strict';
// This is an entry point for the existing LifeQuests engine, not another
// progress owner. PracticeHub persists its named life snapshot in the same
// canonical browser record used by the previous integrated version.
const doc=root.document;
if(!doc)return;
const app=doc.getElementById('app');
if(!app)return;
const TITLE='Дела и приключения',OWNER='kubiki-progress-v1';
const missions=[
 {id:'life.places.after-play',icon:'🧸',title:'Начну с одной вещи',text:'Поможем игрушкам найти своё место.'},
 {id:'life.school.math-russian',icon:'🎒',title:'Соберусь в школу',text:'Выберем день в твоём расписании и приготовим нужные вещи.'},
 {id:'life.plan.room',icon:'🧭',title:'Сделаю по шагам',text:'Придумаем небольшой понятный план.'}
];
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brand='<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="17" fill="#387d70"/><path d="M22 22v-5a10 10 0 0 1 20 0v5" stroke="#fff9e9" stroke-width="5"/><rect x="15" y="19" width="34" height="36" rx="10" fill="#fff9e9"/><rect x="21" y="33" width="22" height="15" rx="5" fill="#b8d7bd"/><path d="m27 40 4 4 7-8" stroke="#387d70" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
if(!root.LearningProgress||!root.LifeQuestData||!root.LifeQuests||!root.PracticeHub||typeof root.PracticeHub.mount!=='function'||root.LifeSchoolSchedule&&!root.SchoolPackingFlow){
 app.innerHTML='<main class="life-update"><h1>Завершим обновление</h1><p>Подключись к интернету и открой тренажёр ещё раз. Прежние результаты останутся на устройстве.</p><a href="../">Все игры</a></main>';
 return;
}
const available=new Set(root.LifeQuestData.quests.map(q=>q.id));
app.innerHTML='<div class="life-app-shell"><header class="life-topbar"><a class="life-brand" href="../" aria-label="На главную со всеми тренажёрами">'+brand+'<span>'+TITLE+'<small>Учимся заботиться о своих делах</small></span></a><a class="life-home" href="../"><span aria-hidden="true">←</span> Все игры</a></header><section class="life-today" id="life-today" aria-labelledby="life-today-title"><div class="life-today-heading"><span class="life-eyebrow">ОДНО НЕБОЛЬШОЕ ДЕЛО</span><h1 id="life-today-title">С чего сегодня начнём?</h1><p>Выбери приключение. Сначала попробуем в игре, а потом — в жизни. Можно остановиться и продолжить позже.</p></div><div class="life-missions">'+missions.filter(m=>available.has(m.id)).map(m=>'<button type="button" class="life-mission" data-life-start="'+esc(m.id)+'"><span class="life-mission-icon" aria-hidden="true">'+m.icon+'</span><span><strong>'+esc(m.title)+'</strong><small>'+esc(m.text)+'</small></span><span class="life-mission-arrow" aria-hidden="true">→</span></button>').join('')+'</div></section><main id="life-stage" class="life-stage" aria-label="Жизненные приключения"></main><footer class="life-footer"><p>В игре можно ошибаться, пробовать и исправлять. Настоящее дело отмечаем отдельно.</p><a href="../">Выбрать другой тренажёр</a></footer></div>';

root.PracticeHub.mount({
 subject:'life',trainerId:'life',storageKey:OWNER,
 standalone:true,initial:'quests',container:'#life-stage',
 beforeOpen(){},syncLearning(){},
 atBoundary(){const current=root.PracticeHub.snapshot?.();return current?.kind==='quests'&&current.state?.solved===true&&!['real','small-real'].includes(current.state?.phase);},
 isStudyActive(){const current=root.PracticeHub.snapshot?.();return !!current&&!['real','small-real'].includes(current.state?.phase);}
});

doc.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-life-start]');
 if(!button||button.disabled)return;
 const questId=button.dataset.lifeStart;
 if(!available.has(questId))return;
 event.preventDefault();
 if(questId==='life.school.math-russian'&&root.LifeSchoolSchedule){const picker=doc.getElementById('life-school-picker');if(picker){picker.scrollIntoView?.({behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});doc.getElementById('life-school-title')?.focus?.({preventScroll:true});return;}}
 if(typeof root.PracticeHub.startQuest==='function')root.PracticeHub.startQuest(questId);
 else root.PracticeHub.open('quests',{questId});
});
function updateMenu(){
 const panel=doc.getElementById('life-today');if(!panel)return;
 const current=root.PracticeHub.snapshot?.();
 panel.hidden=!!(current?.kind==='quests'&&current.state?.view==='quest');
}
if(typeof root.MutationObserver==='function'){
 const stage=doc.getElementById('life-stage');
 if(stage)new root.MutationObserver(updateMenu).observe(stage,{childList:true,subtree:true});
}
updateMenu();
root.LifeTrainer=Object.freeze({title:TITLE,storageKey:OWNER,moduleId:'life-quests',missions:missions.map(m=>m.id)});
})(typeof window==='undefined'?globalThis:window);
