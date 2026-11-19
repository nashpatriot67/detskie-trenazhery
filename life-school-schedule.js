(function(root){
'use strict';
// The photo supplies lesson order. Equipment below is an explicit authored
// game memo, never an inferred instruction from the child's real teacher.
const SOURCE='Расписание 2 А класса с фотографии родителя';
const unique=list=>[...new Set(list)],copy=v=>JSON.parse(JSON.stringify(v));
const lesson=(id,title,options)=>Object.assign({id,title},options?{options}:{});
const days=[
 {id:'mon',label:'Понедельник',labelShort:'Пн',accusative:'понедельник',pool:false,lessons:[lesson('conversation','Разговоры о важном'),lesson('math','Математика'),lesson('russian','Русский язык'),lesson('foreign','Иностранный язык'),lesson('reading','Литературное чтение'),lesson('workshop-or-functional','Проектная мастерская / Функциональная грамотность (математика)',['Проектная мастерская','Функциональная грамотность (математика)'])]},
 {id:'tue',label:'Вторник',labelShort:'Вт',accusative:'вторник',pool:true,lessons:[lesson('world','Окружающий мир'),lesson('math','Математика'),lesson('russian','Русский язык'),lesson('pe','Физкультура'),lesson('reading','Литературное чтение'),lesson('pool','Золотая рыбка — бассейн')]},
 {id:'wed',label:'Среда',labelShort:'Ср',accusative:'среду',pool:false,lessons:[lesson('reading','Литературное чтение'),lesson('math','Математика'),lesson('russian','Русский язык'),lesson('world','Окружающий мир'),lesson('club-or-professions','Читательский клуб / Азбука профессий',['Читательский клуб','Азбука профессий'])]},
 {id:'thu',label:'Четверг',labelShort:'Чт',accusative:'четверг',pool:true,lessons:[lesson('foreign','Иностранный язык'),lesson('russian','Русский язык'),lesson('technology','Технология'),lesson('reading','Литературное чтение'),lesson('music','Музыка'),lesson('pool','Золотая рыбка — бассейн')]},
 {id:'fri',label:'Пятница',labelShort:'Пт',accusative:'пятницу',pool:false,lessons:[lesson('foreign','Иностранный язык'),lesson('pe','Физкультура'),lesson('russian','Русский язык'),lesson('math','Математика'),lesson('art','ИЗО')]}
];
days.forEach(d=>{d.subjects=d.lessons.map(x=>x.title);});
const dayMap=Object.fromEntries(days.map(d=>[d.id,d]));
const variantInfo=[
 {id:'base',label:'Соберу всё нужное',description:'Собираем полный набор по расписанию и игровой памятке.'},
 {id:'rain',label:'По дороге дождь',description:'Тот же учебный день и подготовка к дождливой дороге.'},
 {id:'request',label:'Особая памятка',description:'В игровой памятке есть конкретное задание по одному из уроков.'},
 {id:'ready',label:'Часть уже готова',description:'Заметим, что уже приготовлено, и выберем только оставшееся.'}
];
const additionalItems=[
 {id:'project-folder',label:'Папка для проекта',icon:'📂',description:'Папка для материалов проектной мастерской.'},
 {id:'profession-cards',label:'Карточки профессий',icon:'🧑‍🔧',description:'Конверт с карточками для игрового задания «Азбука профессий».'},
 {id:'club-book',label:'Книга для читательского клуба',icon:'📚',description:'Отдельная книга, указанная в игровой памятке читательского клуба.'},
 {id:'observation-sheet',label:'Лист наблюдений',icon:'🍃',description:'Подготовленный лист для записи наблюдений на окружающем мире.'}
];
const COMMON=['pencil-case','school-diary','change-shoes','shoe-bag'];
const SUBJECT_ITEMS={math:['math-book','math-notebook'],russian:['russian-book','russian-notebook'],foreign:['foreign-book','foreign-notebook'],reading:['reading-book'],world:['world-book','world-notebook']};
const PE=['sport-uniform','sport-shoes','gym-socks'];
const POOL=['swimwear','swim-cap','towel','pool-slippers','shower-gel','pool-wet-bag','spare-underwear'];
const TECH=['technology-folder','paper','glue','safe-scissors'];
const ART=['art-album','paints','brush','art-water-cup','craft-cloth'];
const GROUPS={school:'В школьный рюкзак',sport:'Отдельно для физкультуры',pool:'Отдельно в сумку бассейна',weather:'Приготовлю для выхода'};
const distractionPool=['math-book','math-notebook','russian-book','russian-notebook','foreign-book','foreign-notebook','reading-book','world-book','world-notebook','sport-uniform','sport-shoes','swimwear','swim-cap','pool-slippers','art-album','paints','brush','music-folder','technology-folder','paper','glue','safe-scissors','project-folder','reader-diary','profession-cards'];
const photoSubjectsByItem={
 'math-book':'math','math-notebook':'math','russian-book':'russian','russian-notebook':'russian','foreign-book':'foreign','foreign-notebook':'foreign','reading-book':'reading','world-book':'world','world-notebook':'world','sport-uniform':'pe','sport-shoes':'pe','gym-socks':'pe','swimwear':'pool','swim-cap':'pool','towel':'pool','pool-slippers':'pool','shower-gel':'pool','pool-wet-bag':'pool','spare-underwear':'pool','art-album':'art','paints':'art','brush':'art','art-water-cup':'art','craft-cloth':'art','music-folder':'music','music-notebook':'music','technology-folder':'technology','paper':'technology','glue':'technology','safe-scissors':'technology','plasticine':'technology','model-board':'technology'
};
const subjectNames={math:'математика',russian:'русский язык',foreign:'иностранный язык',reading:'литературное чтение',world:'окружающий мир',pe:'физкультура',pool:'бассейн',art:'ИЗО',music:'музыка',technology:'технология'};
let bank=null,authored=[];
function day(id){return typeof id==='string'&&Object.prototype.hasOwnProperty.call(dayMap,id)?dayMap[id]:null;}
function questId(dayId,variantId){variantId=variantId||'base';return day(dayId)&&variantInfo.some(v=>v.id===variantId)?'life.school.week.'+dayId+'.'+variantId:null;}
function variantsFor(dayId){if(!day(dayId))return [];return variantInfo.map(v=>Object.assign({},v,{questId:questId(dayId,v.id),description:dayId==='mon'&&v.id==='request'?'В этой игре шестой урок — проектная мастерская.':dayId==='wed'&&v.id==='ready'?'В этой игре пятый урок — «Азбука профессий», часть вещей уже приготовлена.':v.description}));}
function weekday(value){
 if(value===undefined)value=new Date();
 if(Number.isInteger(value))return value>=0&&value<=6?value:null;
 if(value&&typeof value.getDay==='function'){const n=value.getDay();return Number.isInteger(n)&&n>=0&&n<=6?n:null;}
 return null;
}
function weekend(value){const n=weekday(value);return n===0||n===6;}
function nextSchoolDay(value){const n=weekday(value);return n===null?null:({0:'mon',1:'tue',2:'wed',3:'thu',4:'fri',5:'mon',6:'mon'})[n];}
function recommended(value){
 const n=weekday(value),id=nextSchoolDay(n)||'mon';
 return {dayId:id,variantId:'base',questId:questId(id,'base'),weekend:n===0||n===6,todayId:({1:'mon',2:'tue',3:'wed',4:'thu',5:'fri'})[n]||null,
  reason:n===null?'Выбери учебный день вручную.':n===5?'После пятницы следующий учебный день — понедельник.':n===0||n===6?'Сегодня выходной. Можно заранее приготовиться к понедельнику.':'Приготовимся к следующему учебному дню. День можно поменять.'};
}
function questsForDay(id){return authored.filter(q=>q.schedule.dayId===id);}
function itemLabel(id){return bank?.items?.[id]?.label||additionalItems.find(x=>x.id===id)?.label||id;}
function names(ids){return ids.map(itemLabel).join(', ');}
function shuffled(values,seed){
 let n=2166136261;for(let i=0;i<seed.length;i++)n=Math.imul(n^seed.charCodeAt(i),16777619)>>>0;
 const result=values.slice();for(let i=result.length-1;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;
}
function planned(dayData,variant){
 const groups={school:COMMON.slice(),sport:[],pool:[],weather:[]},notes=[],provided=[];
 const lessonIds=dayData.lessons.map(l=>l.id),selected=dayData.subjects.slice();
 for(const id of lessonIds)groups.school.push(...(SUBJECT_ITEMS[id]||[]));
 if(lessonIds.includes('pe'))groups.sport.push(...PE);
 if(dayData.pool)groups.pool.push(...POOL);
 if(dayData.id==='thu'){groups.school.push(...TECH,'music-folder');notes.push('На технологии в этой игре делаем бумажную закладку. На музыку готовим папку с материалами.');}
 if(dayData.id==='fri'){groups.school.push(...ART);notes.push('На ИЗО в этой игре рисуем красками: нужны альбом, краски, кисточка, стаканчик для рисования и тряпочка.');}
 if(dayData.id==='mon'){
  const project=variant==='request';selected[5]=project?'Проектная мастерская':'Функциональная грамотность (математика)';
  if(project){groups.school.push('project-folder','paper','glue','safe-scissors');notes.push('Шестой урок в этой игре — проектная мастерская. Для бумажной модели приготовь папку проекта, цветную бумагу, клей-карандаш и безопасные ножницы.');}
  else notes.push('Шестой урок в этой игре — функциональная грамотность по математике. Подойдут те же учебник и тетрадь математики: второй комплект не нужен.');
 }
 if(dayData.id==='wed'){
  const professions=variant==='ready';selected[4]=professions?'Азбука профессий':'Читательский клуб';
  if(professions){groups.school.push('profession-cards');notes.push('Пятый урок в этой игре — «Азбука профессий». Нужны приготовленные карточки профессий; читательский дневник для этого занятия не просили.');}
  else{groups.school.push('reader-diary');notes.push('Пятый урок в этой игре — читательский клуб. Берём книгу для чтения и читательский дневник.');}
 }
 if(variant==='request'){
  if(dayData.id==='tue'){groups.school.push('observation-sheet');groups.pool.push('goggles');notes.push('Особая памятка игры: на окружающем мире будем записывать наблюдения в готовый лист. В бассейн сегодня также нужны очки для плавания.');}
  if(dayData.id==='wed'){groups.school.push('club-book');notes.push('Особая памятка игры: в читательский клуб нужна ещё отдельная книга для обсуждения — она подписана «Книга для читательского клуба».');}
  if(dayData.id==='thu'){groups.school=groups.school.filter(id=>!['paper','glue','safe-scissors'].includes(id));groups.school.push('plasticine','model-board','music-notebook');notes[0]='Особая памятка игры: на технологии лепим из пластилина на доске. Ножницы, бумагу и клей не просили. На музыке сегодня нужны папка и нотная тетрадь.';}
  if(dayData.id==='fri'){groups.school=groups.school.filter(id=>!['paints','brush','art-water-cup','craft-cloth'].includes(id));groups.school.push('pencils','ruler');notes[0]='Особая памятка игры: на ИЗО рисуем узор цветными карандашами с линейкой. Краски, кисточка и стаканчик сегодня не нужны.';}
 }
 if(variant==='ready'){
  const prepared={mon:['math-book','math-notebook','pencil-case'],tue:['sport-uniform','sport-shoes','gym-socks','swim-cap','towel','pool-wet-bag'],wed:['world-book','world-notebook','pencil-case'],thu:['technology-folder','paper','glue','safe-scissors','shower-gel','towel'],fri:['paints','brush','art-water-cup','craft-cloth']}[dayData.id];
  provided.push(...prepared);for(const key of Object.keys(groups))groups[key]=groups[key].filter(id=>!provided.includes(id));
 }
 if(variant==='rain')groups.weather.push('umbrella','raincoat');
 for(const key of Object.keys(groups))groups[key]=unique(groups[key]);
 return {groups,notes,provided,selected};
}
// A school day is prepared in order, rather than by one undifferentiated list.
// These stages are a partition of the already reviewed day memo. They never
// introduce another required object or ask for a second copy of a shared book.
function stageBuilder(q){
 const drafts=[],owned=new Set(),provided=new Set(q.alreadyProvided||[]);
 function addStage(id,kind,title,wanted,extra){
  extra=extra||{};wanted=unique(wanted);
  const given=wanted.filter(x=>provided.has(x)),reused=wanted.filter(x=>!provided.has(x)&&owned.has(x));
  const required=wanted.filter(x=>!provided.has(x)&&!owned.has(x)&&q.required.includes(x));
  const optional=(extra.optional||[]).filter(x=>!provided.has(x)&&!owned.has(x)&&q.optional.includes(x));
  const alternatives=copy(extra.alternatives||[]);
  const allowed=unique(required.concat(optional,alternatives.flatMap(g=>g.items)));
  allowed.forEach(x=>owned.add(x));
  const conditions=[];
  if(required.length)conditions.push('По памятке этого шага приготовь: '+names(required)+'.');
  if(given.length)conditions.push('Уже приготовлено: '+names(given)+'. Повторно эти вещи не выбираем.');
  if(reused.length)conditions.push('Уже выбрано на предыдущем шаге: '+names(reused)+'. Второй комплект не нужен.');
  if(optional.length)conditions.push('По желанию: '+names(optional)+'. Можно продолжить без этих дополнительных вещей.');
  if(alternatives.length)conditions.push('Для дороги подойдёт зонт или дождевик. Можно приготовить оба.');
  if(!allowed.length)conditions.push(given.length||reused.length?'Для этого шага ничего нового добавлять не нужно.':'Для этого занятия по нашей памятке отдельных вещей не нужно. Общие школьные вещи уже подготовлены.');
  if(kind==='common'&&!extra.partial&&!extra.constituents)conditions.unshift('Эти вещи нужны в школе независимо от уроков. Пенал уже содержит ручку, простой карандаш и ластик.');
  if(extra.constituents)conditions.unshift('Готовим общий пенал для учебных записей. Сейчас выбираем его принадлежности, а не второй пенал.');
  if(extra.note)conditions.unshift(extra.note);
  drafts.push(Object.assign({},extra,{id,kind,title,required,optional,alternatives,provided:given,reused,allowed,itemIds:[],distractors:[],conditions,why:{},instruction:extra.instruction|| (kind==='common'?'Начнём с обязательных общих вещей для школы.':allowed.length?'Выбери вещи только для этого шага. Остальное приготовим по порядку.':'Посмотри, почему новый комплект здесь не нужен, и продолжай.') }));
 }
 function finish(){
 const owner=new Map();drafts.forEach((s,i)=>s.allowed.forEach(id=>owner.set(id,i)));
 drafts.forEach((s,i)=>{
  if(s.allowed.length){
   const later=q.itemIds.filter(id=>owner.has(id)&&owner.get(id)>i),count=q.distractors.length<=5?q.distractors.length:3,wrong=q.distractors.map((_,n)=>q.distractors[(n+i*3)%q.distractors.length]);
   s.distractors=unique(later.slice(0,2).concat(wrong.slice(0,count))).filter(id=>!s.allowed.includes(id)&&!s.provided.includes(id)&&!s.reused.includes(id));
   s.itemIds=shuffled(s.allowed.concat(s.distractors),q.id+'.'+s.id);
  }
  s.itemIds.forEach(id=>{
   const later=owner.get(id);
   s.why[id]=s.allowed.includes(id)?q.why[id]:later>i?(q.optional.includes(id)?'«'+itemLabel(id)+'» можно взять по желанию позже, на шаге «'+drafts[later].title+'».':q.alternatives?.some(g=>g.items.includes(id))?'Защиту от дождя выберем позже, на шаге «'+drafts[later].title+'». Подойдёт зонт или дождевик.':'«'+itemLabel(id)+'» понадобится позже, на шаге «'+drafts[later].title+'».')+' Сейчас готовим «'+s.title+'».':q.why[id]||'Для этого шага эта вещь не нужна. Посмотри памятку текущего занятия.';
  });
 });
 return drafts;
 }
 return {addStage,finish,owns:id=>owned.has(id)};
}
function packingStages(dayData,variant,p,q){
 const {addStage,finish,owns}=stageBuilder(q);
 addStage('common','common','Общие школьные вещи',COMMON,{destination:GROUPS.school});
 dayData.lessons.forEach((l,i)=>{
  let wanted=(SUBJECT_ITEMS[l.id]||[]).slice(),note='',optional=[];
  if(l.id==='conversation')note='На «Разговорах о важном» в этой игре не просили отдельный учебник или тетрадь.';
  if(l.id==='world'&&variant==='request'&&dayData.id==='tue')wanted.push('observation-sheet');
  if(l.id==='pe'){wanted=PE.slice();note='Для физкультуры в зале приготовим отдельный спортивный комплект.';}
  if(l.id==='pool'){
   wanted=POOL.slice();if(q.required.includes('goggles'))wanted.push('goggles');
   optional=q.optional.includes('goggles')?['goggles']:[];
   note='«Золотая рыбка» — бассейн. Этот комплект собираем отдельно от книг и формы для зала.';
  }
  if(l.id==='technology'){
   wanted=variant==='request'?['technology-folder','plasticine','model-board']:TECH.slice();
   note=variant==='request'?'В этой игре на технологии лепим на доске. Бумагу, клей и ножницы не просили.':'В этой игре на технологии делаем бумажную закладку.';
  }
  if(l.id==='music')wanted=variant==='request'?['music-folder','music-notebook']:['music-folder'];
  if(l.id==='art'){
   wanted=variant==='request'?['art-album','pencils','ruler']:ART.slice();
   note=variant==='request'?'На ИЗО в этой игре рисуем узор цветными карандашами с линейкой.':'На ИЗО в этой игре рисуем красками.';
  }
  if(l.id==='workshop-or-functional'){
   wanted=variant==='request'?['project-folder','paper','glue','safe-scissors']:SUBJECT_ITEMS.math.slice();
   note=variant==='request'?'В этой игре шестое занятие — проектная мастерская: делаем бумажную модель.':'На функциональной грамотности пригодится уже собранный комплект математики.';
  }
  if(l.id==='club-or-professions'){
   wanted=variant==='ready'?['profession-cards']:['reading-book','reader-diary'].concat(variant==='request'?['club-book']:[]);
   note=variant==='ready'?'В этой игре пятое занятие — «Азбука профессий».':'Для читательского клуба используем ту же книгу, которую приготовили на чтение.';
  }
  addStage('lesson.'+l.id,'lesson',p.selected[i],wanted,{lessonId:l.id,lessonIndex:i,destination:l.id==='pe'?GROUPS.sport:l.id==='pool'?GROUPS.pool:GROUPS.school,optional,note});
 });
 if(variant==='rain')addStage('weather','weather','Одежда для дороги',[],{alternatives:q.alternatives,destination:GROUPS.weather,note:'До школы идём со взрослым. По дороге дождь: подготовим защиту для выхода.'});
 const remainingOptional=q.optional.filter(x=>!owns(x));
 if(remainingOptional.length)addStage('optional','optional','Дополнительные вещи по желанию',[],{optional:remainingOptional,destination:GROUPS.school});
 return finish();
}

// Earlier school mini-games are partial preparations, not another full day.
// Keep their reviewed items and saved IDs, but check covered lessons in order.
function partialPackingStages(q){
 const specs={
  'life.school.math-russian':{dayId:'mon',common:['pencil-case','school-diary'],lessons:[['math',1,'Математика',['math-book','math-notebook']],['russian',2,'Русский язык',['russian-book','russian-notebook']]]},
  'life.school.reading-world':{dayId:'wed',common:['pencil-case','school-diary'],lessons:[['reading',0,'Литературное чтение',['reading-book']],['world',3,'Окружающий мир',['world-book']],['club-or-professions',4,'Читательский клуб',['reading-book','reader-diary']]]},
  'life.school.art':{dayId:'fri',common:[],lessons:[['art',4,'ИЗО',['art-album','paints','brush','apron'],['pencils']]]},
  'life.school.pe':{dayId:'fri',common:['pencil-case'],lessons:[['pe',1,'Физкультура',['sport-uniform','sport-shoes','shoe-bag']],['math',3,'Математика',['math-book','math-notebook']]]},
  'life.school.rain':{dayId:'wed',common:['pencil-case'],lessons:[['reading',0,'Литературное чтение',['reading-book']],['russian',2,'Русский язык',['russian-book','russian-notebook']]]},
  'life.pack.pencilcase':{dayId:null,common:['blue-pen','pencil','eraser','ruler'],constituents:true,lessons:[]},
  'life.pack.thursday-technology':{dayId:'thu',common:[],lessons:[['technology',2,'Технология',['plasticine','model-board','craft-cloth','technology-folder'],['pencil','glue']]]},
  'life.pack.friday-art':{dayId:'fri',common:[],lessons:[['art',4,'ИЗО',['art-album','paints','brush','art-water-cup','craft-cloth'],['apron','pencil','eraser']]]}
 };
 const spec=specs[q.id];if(!spec)return null;
 const {addStage,finish,owns}=stageBuilder(q),emptyCommon=!spec.common.length;
 addStage('common','common',spec.constituents?'Пенал для всех уроков':'Общая часть сборов',spec.common,{destination:spec.constituents?'В пенал':GROUPS.school,constituents:spec.constituents===true,partial:emptyCommon,
  note:spec.constituents?'Это отдельная проверка общего пенала, а не сбор всего школьного дня.':emptyCommon?'Это отдельный набор для одного занятия. Остальные школьные вещи уже готовы; заново их не добавляем.':'Это небольшая досборка. Остальные вещи из расписания уже приготовлены по условию.',
  instruction:emptyCommon?'Общие школьные вещи уже готовы. Посмотри условие и перейди к отдельному набору.':spec.constituents?'Подготовим общие принадлежности для учебных записей.':'Начнём с общих вещей, которые ещё нужно добавить в этой истории.'});
 for(const [id,index,title,required,optional]of spec.lessons){
  addStage('lesson.'+id,'lesson',title,required,{lessonId:id,lessonIndex:index,optional:optional||[],destination:id==='pe'?GROUPS.sport:GROUPS.school,
   note:id==='pe'?'Здесь мешок нужен именно для спортивной обуви, поэтому готовим его вместе с формой.':id==='club-or-professions'?'Ту же книгу используем для чтения и читательского клуба. Вторая книга не нужна.':'Проверяем только этот набор по условиям маленького задания.'});
 }
 if((q.alternatives||[]).length)addStage('weather','weather','Одежда для дороги',[],{alternatives:q.alternatives,destination:GROUPS.weather,note:'После учебных вещей приготовим защиту от дождя для дороги со взрослым.'});
 const extra=q.optional.filter(id=>!owns(id));if(extra.length)addStage('optional','optional','Дополнительные вещи по желанию',[],{optional:extra,destination:spec.constituents?'В пенал':GROUPS.school});
 q.packingScope={kind:'partial',dayId:spec.dayId,lessonIds:spec.lessons.map(s=>s[0]),note:spec.constituents?'Отдельная маленькая проверка общего пенала.':'Это часть сборов, а не полный набор на весь учебный день.'};
 return finish();
}
function author(dayData,variant){
 const p=planned(dayData,variant),id=questId(dayData.id,variant),alternatives=variant==='rain'?[{id:'rain-protection',label:'Защита от дождя: зонт или дождевик',items:['umbrella','raincoat'],min:1,max:2}]:[];
 const required=unique(p.groups.school.concat(p.groups.sport,p.groups.pool));
 const optional=(dayData.pool?['water','goggles']:['water','wipes']).filter(x=>!required.includes(x));
 const allowed=unique(required.concat(optional,alternatives.flatMap(g=>g.items)));
 const lessonIds=dayData.lessons.map(l=>l.id),selectedIncludes=id=>id==='reader-diary'?p.selected.includes('Читательский клуб'):id==='profession-cards'?p.selected.includes('Азбука профессий'):id==='project-folder'?p.selected.includes('Проектная мастерская'):lessonIds.includes(photoSubjectsByItem[id]);
 const absent=distractionPool.filter(x=>!allowed.includes(x)&&!p.provided.includes(x)&&!selectedIncludes(x));
 const sameSubjectUnasked=distractionPool.filter(x=>!allowed.includes(x)&&!p.provided.includes(x)&&!absent.includes(x));
 const distractors=unique(absent.concat(sameSubjectUnasked)).slice(0,Math.min(8,28-allowed.length));
 const why={};
 required.forEach(x=>{const subject=photoSubjectsByItem[x];why[x]=subject&&lessonIds.includes(subject)?'В расписании есть '+subjectNames[subject]+', а «'+itemLabel(x)+'» указано в игровой памятке этого занятия.':'«'+itemLabel(x)+'» указано в памятке этой игры. Проверь полный список приготовлений.';});
 Object.assign(why,{'pencil-case':'В игровой памятке пенал с ручкой, простым карандашом и ластиком. Эти мелочи не нужно выбирать повторно по отдельности.','school-diary':'По игровой памятке школьный дневник нужен, чтобы сверить расписание.','change-shoes':'Сменная обувь нужна для школы. Она не заменяет спортивную обувь или тапочки для бассейна.','shoe-bag':'Сменную школьную обувь кладём отдельно в её мешок.','sport-uniform':'Физкультура есть в этом дне. Одежда для плавания не заменяет форму для зала.','sport-shoes':'На физкультуре нужна спортивная обувь для зала. Тапочки для бассейна её не заменяют.','gym-socks':'Чистые носки для зала включены в игровую памятку физкультуры.','pool-slippers':'В бассейн нужны сменные тапочки. Спортивные кроссовки для зала — другая вещь.','pool-wet-bag':'После бассейна мокрые вещи отделим от сухих и учебников. Пустой непромокаемый пакет готовим заранее.','spare-underwear':'В этой памятке после бассейна нужна сухая смена белья.','project-folder':'В этой игре выбран вариант «Проектная мастерская»: материалы проекта собираем в папку.','profession-cards':'В этой игре выбран вариант «Азбука профессий». Карточки перечислены в её памятке.','club-book':'Особая книга для обсуждения нужна по игровой памятке читательского клуба.','observation-sheet':'Готовый лист нужен для наблюдений на окружающем мире по условиям этой игры.'});
 optional.forEach(x=>{why[x]='«'+itemLabel(x)+'» можно приготовить дополнительно. Отсутствие этой вещи не является ошибкой.';});
 if(variant==='rain'){why.umbrella='По дороге дождь. Подойдёт зонт или дождевик; можно приготовить оба.';why.raincoat='Дождевик готовят для дороги и надевают по погоде. Его не нужно прятать в учебники. Подойдёт и зонт.';}
 distractors.forEach(x=>{const subject=photoSubjectsByItem[x];why[x]=subject&&!lessonIds.includes(subject)?'В этот день нет занятия «'+subjectNames[subject]+'», и «'+itemLabel(x)+'» в памятке не указано. Оставим лишнее дома.':'В этой игровой памятке «'+itemLabel(x)+'» не нужно. Сверь выбранный вариант дня и конкретное задание, чтобы не нести лишнее.';});
 // Only explanations for visible items are exported. An unshown item never
 // acts as a hidden requirement or a covert extra answer.
 const itemIds=shuffled(allowed.concat(distractors),id),visibleWhy=Object.fromEntries(itemIds.map(x=>[x,why[x]]));
 const commonLeft=p.groups.school.filter(x=>COMMON.includes(x));
 const conditions=['По памятке этой игры ещё приготовь для школы: '+names(commonLeft)+'. Пенал содержит ручку, простой карандаш и ластик — их не выбираем по отдельности.',...p.notes];
 if(p.provided.length)conditions.push('Уже приготовлено и повторно не выбираем: '+names(p.provided)+'. В этой игре ищем только то, что осталось приготовить.');
 conditions.push('Ещё в школьный рюкзак по памятке: '+names(p.groups.school.filter(x=>!COMMON.includes(x)))+'.');
 if(dayData.pool)conditions.push('«Золотая рыбка» — бассейн. В отдельную сумку ещё нужны: '+names(p.groups.pool)+'.');
 if(p.groups.sport.length)conditions.push('Для физкультуры в зале отдельно приготовим: '+names(p.groups.sport)+'.');
 else if(lessonIds.includes('pe')&&p.provided.some(x=>PE.includes(x)))conditions.push('Физкультура остаётся в расписании. Её форма, обувь и носки уже приготовлены, поэтому повторно их не выбираем.');
 if(variant==='rain')conditions.push('До школы идём со взрослым, по дороге дождь. Приготовь зонт или дождевик для выхода. Можно выбрать оба. Это одежда для дороги, а не принадлежность для бассейна.');
 conditions.push('Дополнительно можно взять: '+names(optional)+'. Остальные вещи сейчас не нужны.');
 const groups=[{id:'school',label:GROUPS.school,itemIds:p.groups.school.slice()},{id:'sport',label:GROUPS.sport,itemIds:p.groups.sport.slice()},{id:'pool',label:GROUPS.pool,itemIds:p.groups.pool.slice()}].filter(g=>g.itemIds.length);
 for(const x of optional){const key=x==='goggles'?'pool':'school',g=groups.find(g=>g.id===key);if(g)g.itemIds.push(x);}
 if(variant==='rain')groups.push({id:'weather',label:GROUPS.weather,itemIds:['umbrella','raincoat']});
 const q={id,title:dayData.label+' · '+variantInfo.find(x=>x.id===variant).label,category:'school',mode:'pack',level:variant==='base'?1:2,
  story:'Готовимся на '+dayData.accusative+' по расписанию 2 А класса. '+(variant==='ready'?'Часть вещей уже приготовлена — выберем оставшееся.':variant==='rain'?'Учтём уроки и дождливую дорогу.':'Выберем вещи по понятной игровой памятке.'),
  instruction:'Сначала приготовим общие школьные вещи, затем пройдём уроки по порядку расписания. На каждом шаге выбирай вещи только для текущего занятия. Сумки уже есть; готовое повторно не выбираем.',
  itemIds,zoneIds:['bag'],required,optional,distractors,alternatives,why:visibleWhy,conditions,bagGroups:groups,
  schedule:{dayId:dayData.id,dayLabel:dayData.label,variantId:variant,subjects:dayData.subjects.slice(),lessons:copy(dayData.lessons),selectedLessons:p.selected,pool:dayData.pool,source:SOURCE,provided:p.provided.slice(),providedText:p.provided.length?'Уже приготовлено: '+names(p.provided)+'.':'Пока ничего не собрано. Начнём по памятке.',weather:variant==='rain'?'rain':'not-specified'},
  alreadyProvided:p.provided.slice(),
  hint:'Сначала сверь день и уроки. Потом проверь памятку: что ещё нужно, что уже приготовлено и что можно взять по желанию.',
  firstMove:'Начни с общих обязательных вещей. Потом приготовим каждый урок по порядку.',
  microReal:'Посмотри своё настоящее расписание на '+dayData.accusative+' и назови одну вещь, которую надо приготовить.',
  realSteps:['Уточни настоящее расписание и памятку вместе со взрослым.','Проверь, что уже собрано или приготовлено в школе.','Приготовь оставшиеся учебные вещи'+(dayData.pool?', форму и отдельную сумку для бассейна.':'.'),'Сверь готовое с настоящим списком и поставь сумки на привычное место.'],
  adultNote:'Расписание взято с фотографии. Список вещей — условия этой игры, а не новое требование настоящего учителя. Реальные материалы, погоду и принадлежности бассейна уточняют со взрослым.',
  materialRevision:1,criteriaRevision:1};
 q.packingStages=packingStages(dayData,variant,p,q);return q;
}
function register(data){
 if(!data||typeof data.extend!=='function')return false;bank=data;
 data.extend({items:additionalItems});authored=days.flatMap(d=>variantInfo.map(v=>author(d,v.id)));
 data.extend({quests:authored});
 // Reuse the actual normalized bank objects in consumers and tests.
 authored=authored.map(q=>data.quests.find(x=>x.id===q.id)||q);
 for(const q of data.quests){if(q.category!=='school'||q.schedule)continue;const stages=partialPackingStages(q);if(stages){q.packingStages=stages;q.firstMove='Сначала проверим общую часть, затем подготовим занятия по шагам.';}}
 return true;
}
function validate(){
 const errors=[];if(authored.length!==20)errors.push('Twenty weekday scenarios are required.');
 for(const d of days)for(const v of variantInfo){const q=authored.find(q=>q.id===questId(d.id,v.id));if(!q){errors.push('Missing '+d.id+'/'+v.id);continue;}
  if(q.itemIds.length<18||q.itemIds.length>28)errors.push(q.id+': bank size');
  if(new Set(q.itemIds).size!==q.itemIds.length)errors.push(q.id+': duplicate cards');
  if(q.required.some(id=>q.alreadyProvided.includes(id))||q.itemIds.some(id=>q.alreadyProvided.includes(id)))errors.push(q.id+': provided item is asked again');
  if(q.schedule.pool!==['tue','thu'].includes(d.id))errors.push(q.id+': pool day');
  if(q.bagGroups.flatMap(g=>g.itemIds).some(id=>!q.itemIds.includes(id)||q.distractors.includes(id)))errors.push(q.id+': invalid bag group');
  if(q.itemIds.some(id=>!bank?.items[id]||!q.why[id]))errors.push(q.id+': item or explanation');
  const stages=q.packingStages||[],lessons=stages.filter(s=>s.kind==='lesson');
  if(stages[0]?.id!=='common'||lessons.length!==d.lessons.length||lessons.some((s,i)=>s.lessonId!==d.lessons[i].id||s.lessonIndex!==i))errors.push(q.id+': stage order');
  for(const field of ['required','optional']){const merged=stages.flatMap(s=>s[field]);if(new Set(merged).size!==merged.length||merged.length!==q[field].length||merged.some(id=>!q[field].includes(id)))errors.push(q.id+': stage '+field+' partition');}
  if(stages.some(s=>s.itemIds.some(id=>!q.itemIds.includes(id)||!s.why[id])||s.required.some(id=>q.alreadyProvided.includes(id))))errors.push(q.id+': stage card or memo');
 }
 for(const q of bank?.quests||[]){
  if(q.category!=='school'||q.mode!=='pack')continue;
  const stages=q.packingStages||[],allowed=new Set();
  if(!stages.length||stages[0].kind!=='common')errors.push(q.id+': school preparation has no common first step');
  for(const field of ['required','optional']){const values=stages.flatMap(s=>s[field]);if(new Set(values).size!==values.length||values.length!==q[field].length||values.some(id=>!q[field].includes(id)))errors.push(q.id+': staged '+field+' criteria differ');}
  if(JSON.stringify(stages.flatMap(s=>s.alternatives))!==JSON.stringify(q.alternatives||[]))errors.push(q.id+': staged alternatives differ');
  for(const s of stages){
   if(s.reused.some(id=>!allowed.has(id)))errors.push(q.id+': reused object has not appeared earlier');
   if(s.itemIds.some(id=>!q.itemIds.includes(id)||!s.why[id]||s.reused.includes(id)||s.provided.includes(id))||s.allowed.some(id=>!s.itemIds.includes(id)))errors.push(q.id+': current stage bank is incomplete');
   s.allowed.forEach(id=>{if(allowed.has(id))errors.push(q.id+': duplicated physical item');allowed.add(id);});
  }
 }
 return {success:errors.length===0,errors,days:days.length,quests:authored.length,source:SOURCE};
}
root.LifeSchoolSchedule={version:1,source:SOURCE,days,variants:variantInfo,day,variantsFor,questId,questsForDay,nextSchoolDay,weekend,recommended,register,validate};
if(root.LifeQuestData)register(root.LifeQuestData);
})(typeof window==='undefined'?globalThis:window);
