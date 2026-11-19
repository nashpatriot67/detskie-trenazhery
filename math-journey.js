(function(root){
'use strict';
// Lesson concepts use the lesson's already explained example. They do not
// introduce a future carry/borrow operation before the learner has seen it.
const VERSION=1;
const topicId=id=>'math.lesson.'+id;
const taskId=(id,part)=>'concept.math.lesson.'+id+'.'+part;
const validLesson=(value,course)=>Number.isInteger(value)&&value>=1&&value<=course.length;
function choice(id,topic,prompt,options,answer,explanation){return {id,topic,subject:'math',grade:2,kind:'choice',title:'Проверим смысл',prompt,options:options.map((text,i)=>({id:'o'+i,text})),answer:'o'+answer,explanation,skillIds:['math.lesson.'+topic.split('.').at(-1)+'.concepts'],version:1};}
function bank(course){
 const topics=[],tasks=[];
 for(const lesson of course){
  const id=lesson.id,t=lesson.example,plus=t.op==='+',topic=topicId(id),symbol=plus?'+':'−',expression=t.a+' '+symbol+' '+t.b+' = '+t.result;
  const terms=plus?['Первое слагаемое','Второе слагаемое','Сумма']:['Уменьшаемое','Вычитаемое','Разность'];
  const roles=plus?'Два числа, которые складывают, — слагаемые. Результат — сумма.':'Уменьшаемое — сколько было. Вычитаемое — сколько убрали. Разность — сколько осталось.';
  topics.push({id:topic,subject:'math',grade:2,title:lesson.title,icon:plus?'＋':'−',lead:'Свяжем правило и названия с действием из этого урока.',rule:roles+' '+lesson.rule,example:expression,steps:['Прочитай знакомый пример.','Расскажи, какую работу выполняет каждое число.','Проверь смысл действия и группировки.']});
  tasks.push({id:taskId(id,'roles'),topic,subject:'math',grade:2,kind:'match',title:'У каждого числа своя работа',prompt:'Подпиши числа в знакомом примере: '+expression,slots:[{id:'n0',text:'Первое число: '+t.a},{id:'n1',text:'Второе число: '+t.b},{id:'n2',text:'Результат: '+t.result}],items:terms.map((text,i)=>({id:'t'+i,text})),answer:{n0:'t0',n1:'t1',n2:'t2'},explanation:roles,skillIds:[plus?'math.terms.addition':'math.terms.subtraction','math.lesson.'+id+'.concepts'],expression:{a:t.a,b:t.b,op:t.op,result:t.result},version:1});
  const tens=Math.floor(t.a/10),carry=plus&&t.a%10+t.b%10>=10,borrow=!plus&&t.a%10<t.b%10,hundred=plus&&Math.floor(t.a/10)%10+Math.floor(t.b/10)%10+(carry?1:0)>=10;
  let prompt,options,answer,explanation;
  if(hundred){prompt='Собрали 10 десятков. Как называется это количество?';options=['Одна сотня','Один десяток','Десять единиц'];answer=0;explanation='Десять десятков содержат сто единиц. Это одна сотня.';}
  else if(carry||id===2){prompt='Сколько отдельных единиц нужно объединить, чтобы получить один десяток?';options=['10 единиц','1 единица','100 единиц'];answer=0;explanation='Один десяток содержит ровно десять единиц. Объединяя их, мы не меняем количество.';}
  else if(borrow||[8,9,10,27,28,34,36].includes(id)){prompt='Разменяли одну палочку-десяток. Сколько отдельных единиц получили?';options=['10 единиц','1 единицу','100 единиц'];answer=0;explanation='Один десяток — те же десять единиц. При размене ничего не добавляется и не исчезает.';}
  else if(t.result===0){prompt='Убрали все предметы. Как называют количество, которое осталось?';options=['Ноль','Один','Десяток'];answer=0;explanation='Когда ни одного предмета не осталось, количество равно нулю.';}
  else if(t.a>=10||t.b>=10){const n=t.a>=10?t.a:t.b,d=n>=100?Math.floor(n/100):Math.floor(n/10),value=d*(n>=100?100:10),place=n>=100?'сотнях':'десятках';prompt='В числе '+n+' цифра '+d+' стоит в '+place+'. Какое количество она обозначает?';options=[String(value),String(d),String(value+1)];answer=0;explanation='Положение цифры определяет её значение. Здесь цифра '+d+' обозначает '+value+' единиц.';}
  else{prompt=plus?'Как называется результат сложения?':'Как называется результат вычитания?';options=plus?['Сумма','Вычитаемое','Разность']:['Разность','Слагаемое','Сумма'];answer=0;explanation=plus?'Результат сложения называется суммой.':'Результат вычитания называется разностью.';}
  tasks.push(choice(taskId(id,'quantity'),topic,prompt,options,answer,explanation));
  if(carry||borrow||hundred||id===2||[8,9,10,19,27,28,32,34,36].includes(id))tasks.push(choice(taskId(id,'meaning'),topic,'Предметы объединили в группу или разменяли группу обратно. Что произошло с общим количеством?',['Количество осталось тем же','Количество всегда увеличилось','Количество всегда уменьшилось'],0,'Обмен меняет только способ представления. Один десяток и десять единиц — одинаковое количество.'));
  else tasks.push(choice(taskId(id,'meaning'),topic,plus?'В примере '+expression+' два количества соединили. Что является целым?':'В примере '+expression+' количество разделили на то, что убрали, и то, что осталось. Что было целым?',[String(plus?t.result:t.a),String(plus?t.a:t.result),'Только знак действия'],0,plus?'Целое составляют обе части вместе. В этом примере целое — '+t.result+'.':'До вычитания было '+t.a+'. Убранная часть и оставшаяся часть вместе составляют это целое.'));
 }
 return {topics,tasks};
}
function gate(lessonId,course){if(!Array.isArray(course)||!validLesson(lessonId,course))return null;const lesson=course[lessonId-1];return {id:'math.lesson.'+lessonId+'.concepts.v1',topicId:topicId(lessonId),taskIds:['roles','quantity','meaning'].map(part=>taskId(lessonId,part)),title:'Поймём правило: '+lesson.title,lesson:lessonId};}
function register(concepts,course){if(!concepts||typeof concepts.register!=='function'||!Array.isArray(course))return false;concepts.register(bank(course));return true;}
function coverage(course){return course.map(lesson=>gate(lesson.id,course));}
function pvGate(task){
 if(!task||task.diagnostic)return null;
 const family=['build','digits','fix','expand'].includes(task.kind)?'build':['read','value','compare'].includes(task.kind)?'read':task.kind==='exchange'?'exchange':task.kind==='arithmetic'?'arithmetic':null;
 if(!family)return null;
 const parts={build:['order','zero','hundred'],read:['right','order','zero'],exchange:['ten','hundred','same'],arithmetic:['ten','hundred','same']}[family];
 return {id:'math.pv.'+family+'.concepts.v1',topicId:'math.position',taskIds:parts.map(id=>'concept.math.position.'+id),title:'Разряды: '+({build:'строим число',read:'читаем модель',exchange:'обмениваем группы',arithmetic:'считаем осмысленно'}[family])};
}
root.MathJourney={VERSION,bank,gate,pvGate,register,coverage};
})(typeof window==='undefined'?globalThis:window);
