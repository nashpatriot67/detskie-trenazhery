(function(root){
'use strict';
// This is the common contract between the recorded coach and the avatar.
// Each MP3 is padded to minDuration. Its real media clock drives the movement.
const CUES={};
function cue(id,text,minDuration){CUES[id]={id,text,minDuration};}
cue('prepare-general','Встань удобно. Дыши свободно. Повторяй со мной, сколько удобно.',6);
cue('prepare-squat','Встань устойчиво. Стопы остаются на полу. Приседаем неглубоко, без спешки.',6);
cue('prepare-wall','Поставь ладони на стену на высоте плеч. Немного отойди. Держи тело ровно.',6);
cue('prepare-walk','Освободи немного места перед собой. Спокойно шагаем на месте.',5);
cue('prepare-shoulders','Встань или сядь удобно. Руки свободно опущены. Разбудим плечи.',5);
cue('prepare-cross','Встань устойчиво. Поднимаем колено и касаемся его противоположной ладонью. Можно просто шагать.',7);
cue('prepare-heel','Встань возле стены. Если нужно, слегка придерживайся рукой.',5);
cue('prepare-side','Проверь, что рядом свободно. Делаем два маленьких шага в сторону.',5);
cue('prepare-hands','Отложи мышку или планшет. Согни руки и подними ладони перед собой.',5);
cue('prepare-posture','Встань удобно. Поставь ладони на пояс. Спина остаётся в удобном положении.',5);
cue('prepare-look','Встань и отойди от экрана на пару шагов. Найди взглядом далёкий предмет.',6);
cue('prepare-stars','Встань удобно. По очереди потянемся к двум звёздочкам над головой.',5);
cue('rest','Хорошо. Расслабь руки и отдохни. Можно вернуться к заданиям.',5);
cue('squat-down','Плавно присядь.',2.8);
cue('squat-up','Спокойно встань.',2.8);
cue('wall-bend','Мягко согни руки.',2.8);
cue('wall-push','Плавно оттолкнись от стены.',3.2);
cue('reach-up','Подними руки и мягко потянись вверх.',3.6);
cue('reach-down','Плавно опусти руки.',2.8);
cue('walk-step','Шаг.',1.7);
cue('shoulder-up','Медленно подними плечи.',2.8);
cue('shoulder-down','Опусти и расслабь.',2.8);
cue('cross-left','Коснись колена противоположной ладонью.',3.6);
cue('cross-right','Теперь другая сторона.',3.2);
cue('cross-rest','Опусти ногу и руку.',2.4);
cue('heel-up','Поднимись на носки.',2.8);
cue('heel-down','Плавно опусти пятки.',2.8);
cue('side-out','Два маленьких шага в одну сторону.',4.2);
cue('side-back','Два шага обратно.',4.2);
cue('hands-open','Раскрой ладони. Разведи пальцы.',3.2);
cue('hands-close','Мягко собери пальцы в кулачки.',3.2);
cue('posture-open','Мягко отведи локти назад. Расправь плечи.',3.6);
cue('posture-rest','Вернись в удобное положение.',3);
cue('look-far','Посмотри на далёкий предмет.',3.5);
cue('look-relax','Расслабь плечи. Дыши спокойно.',6);
cue('star-left','Потяни вверх одну руку.',3.2);
cue('star-right','Теперь потянись другой рукой.',3.2);
cue('star-down','Плавно опусти руку.',2.6);
cue('count-one','Один.',1.3);
cue('count-two','Два.',1.3);
cue('count-three','Три.',1.3);

const CONFIG={
 'break.reach-cloud':{pose:'reach',prepare:'prepare-general',from:'neutral',a:['reach-up','neutral','reach'],b:['reach-down','reach','neutral'],reps:3},
 'break.squats':{pose:'squat',prepare:'prepare-squat',from:'neutral',a:['squat-down','neutral','squat'],b:['squat-up','squat','neutral'],reps:3},
 'break.wall-push':{pose:'wall',prepare:'prepare-wall',from:'wall-ready',a:['wall-bend','wall-ready','wall-bent'],b:['wall-push','wall-bent','wall-ready'],reps:3},
 'break.room-walk':{pose:'walk',prepare:'prepare-walk',from:'neutral',reps:12},
 'break.shoulders':{pose:'shoulder',prepare:'prepare-shoulders',from:'neutral',a:['shoulder-up','neutral','shoulder-up'],b:['shoulder-down','shoulder-up','neutral'],reps:3},
 'break.cross-march':{pose:'cross',prepare:'prepare-cross',from:'neutral',reps:3},
 'break.heel-rise':{pose:'heel',prepare:'prepare-heel',from:'heel-ready',a:['heel-up','heel-ready','heel-up'],b:['heel-down','heel-up','heel-ready'],reps:3},
 'break.side-steps':{pose:'side',prepare:'prepare-side',from:'neutral',a:['side-out','neutral','side-right','side-out'],b:['side-back','side-right','neutral','side-back'],reps:3},
 'break.fingers':{pose:'hands',prepare:'prepare-hands',from:'hands-ready',a:['hands-open','hands-ready','hands-open'],b:['hands-close','hands-open','hands-ready'],reps:3},
 'break.wings':{pose:'posture',prepare:'prepare-posture',from:'posture-ready',a:['posture-open','posture-ready','posture-open'],b:['posture-rest','posture-open','posture-ready'],reps:3},
 'break.look-far':{pose:'look',prepare:'prepare-look',from:'neutral',reps:1},
 'break.stars':{pose:'diagonal',prepare:'prepare-stars',from:'neutral',reps:2}
};
function build(id){
 const config=CONFIG[id];if(!config)return [];
 const segments=[];
 function add(clipId,from,to,rep,step,motion){
  const c=CUES[clipId];segments.push({id:id+'.'+segments.length,pose:config.pose,from,to,seconds:c.minDuration,clipId,rep,repTotal:config.reps,step,text:c.text,motion:motion||null,completesRep:clipId.indexOf('count-')===0||clipId==='walk-step'});
 }
 add(config.prepare,config.from,config.from,0,0);
 if(config.pose==='walk'){
  for(let i=0;i<config.reps;i++)add('walk-step','neutral','neutral',i+1,1,i%2?'walk-right':'walk-left');
 }else if(config.pose==='cross'){
  for(let rep=1;rep<=config.reps;rep++){
   add('cross-left','neutral','cross-left',rep,1);add('cross-rest','cross-left','neutral',rep,2);
   add('cross-right','neutral','cross-right',rep,1);add('cross-rest','cross-right','neutral',rep,2);
   add(['count-one','count-two','count-three'][rep-1],'neutral','neutral',rep,2);
  }
 }else if(config.pose==='look'){
  add('look-far','neutral','look-right',0,1);add('look-relax','look-right','look-right',0,1,'breathe');add('look-relax','look-right','look-right',0,2,'breathe');segments[segments.length-1].completesRep=true;
 }else if(config.pose==='diagonal'){
  for(let rep=1;rep<=config.reps;rep++){
   add('star-left','neutral','star-left',rep,1);add('star-down','star-left','neutral',rep,2);
   add('star-right','neutral','star-right',rep,1);add('star-down','star-right','neutral',rep,2);segments[segments.length-1].completesRep=true;
  }
 }else{
  for(let rep=1;rep<=config.reps;rep++){
   add(config.a[0],config.a[1],config.a[2],rep,1,config.a[3]);
   add(config.b[0],config.b[1],config.b[2],rep,2,config.b[3]);
   add(['count-one','count-two','count-three'][rep-1],config.from,config.from,rep,2);
  }
 }
 const from=segments[segments.length-1].to;add('rest',from,config.from,config.reps,2);
 return segments;
}
root.CoachMovementPlan={version:1,CUES,CONFIG,build,plan:build};
})(typeof window==='undefined'?globalThis:window);
