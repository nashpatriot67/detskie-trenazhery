(function (root) {
  'use strict';

  const chapters = [
    {id:'tidy', number:1, title:'Найди машинку и наведи порядок', scene:'search', detail:'Освободи проход, рассели машинки и разложи детали и одежду.'},
    {id:'departure', number:1, title:'Постель и сборы в бассейн', scene:'bed', detail:'Расправь покрывало. Собери и застегни сумку.'},
    {id:'garage', number:2, title:'Гараж по двум признакам', scene:'garage', detail:'У каждой машинки свой этаж и столбец. Сверь цвет и тип.'},
    {id:'workshop', number:3, title:'Мастерская конструктора', scene:'workshop', detail:'Различи детали, сохрани модели и продумай порядок работы.'},
    {id:'school', number:4, title:'Два разных школьных дня', scene:'school', detail:'Сравни расписание вторника и четверга. Собери вещи для каждого занятия.'}
  ];
  const advancedIds = chapters.slice(2).map(chapter => chapter.id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const blank = () => ({version:1, active:null, tidyFinished:false, departure:null, levels:{}});
  const escape = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function classic(snapshot) {
    if (!snapshot) return null;
    const pool = root.LifeQuestData.quests.find(quest => quest.id === 'life.sport.pool');
    const game = root.RoomAdventure.create({pool});
    return game.restore(snapshot).accepted && game.state.stage !== 'floor' ? game.snapshot() : null;
  }

  function advanced(id, snapshot) {
    if (!snapshot) return null;
    try {
      const game = root.RoomLevelsLogic.create(id, snapshot.variant);
      return game.restore(snapshot) ? game : null;
    } catch (_) { return null; }
  }

  function valid(value) {
    if (!object(value) || value.version !== 1 || typeof value.tidyFinished !== 'boolean' || !object(value.levels)) return false;
    if (value.active !== null && !chapters.some(chapter => chapter.id === value.active)) return false;
    if (value.departure !== null && !classic(value.departure)) return false;
    return Object.entries(value.levels).every(([id, snapshot]) => advancedIds.includes(id) && advanced(id, snapshot));
  }

  function defaultStore() {
    return root.RoomProgress.create({episode:'tidy', withCampaign:true});
  }

  function legacyDeparture() {
    const reader = root.RoomProgress.create();
    try { return classic(reader.read().snapshot); }
    finally { reader.destroy(); }
  }

  function sceneImage(scene) {
    return root.RoomCampaignScene?.[scene] || root.RoomTidyScene?.scenes[scene] || '';
  }

  function thumbnail(scene, className) {
    if (scene === 'bed') {
      const atlas = root.RoomGame.assets().atlas;
      return `<span class="${className} ray-bed-photo" aria-hidden="true"><img src="${atlas}" alt=""></span>`;
    }
    return `<span class="${className}" aria-hidden="true"><img src="${sceneImage(scene)}" alt=""></span>`;
  }

  function launcher() {
    return `<a class="room-launch ray-campaign-launch" href="?room=campaign">${thumbnail('search','room-launch-picture')}<span><strong>Приключения с Рэем</strong><small>Четыре уровня от комнаты до школьных сборов</small></span><span class="ray-launch-arrow" aria-hidden="true">→</span></a>`;
  }

  function mount(host, options = {}) {
    const disk = options.store || defaultStore();
    const saved = disk.read();
    const isInline = options.inline === true;
    let room = saved.snapshot || root.RoomAdventure.create({episode:'tidy'}).snapshot();
    let data = saved.campaign && valid(saved.campaign) ? clone(saved.campaign) : blank();
    if (!data.departure && !options.store) data.departure = legacyDeparture();
    if (room.state.stage === 'done') data.tidyFinished = true;
    let sound = saved.sound === true;
    let editor = null;
    let opened = null;
    let alive = true;
    const homeHref = root.location?.pathname.endsWith('/offline.html') ? 'offline.html' : './';
    host.innerHTML = '<div id="ray-campaign"><div data-ray-map></div><div data-ray-level-host hidden></div></div>';
    const shell = host.firstElementChild;
    const map = shell.querySelector('[data-ray-map]');
    const play = shell.querySelector('[data-ray-level-host]');

    function progress(chapter) {
      if (chapter === 'tidy') return data.tidyFinished ? 'done' : room.state.stage !== 'search' || room.state.found || Object.keys(room.state.search).length ? 'part' : 'new';
      if (chapter === 'departure') return data.departure?.state.stage === 'done' ? 'done' : data.departure ? 'part' : 'new';
      const game = advanced(chapter, data.levels[chapter]);
      return game?.state.complete ? 'done' : game ? 'part' : 'new';
    }

    function unlocked(index) {
      return chapters.slice(0,index).every(chapter => progress(chapter.id) === 'done');
    }

    function updateWarning() {
      const warning = map.querySelector('[data-ray-warning]');
      if (warning) warning.textContent = disk.warning?.() || saved.error || '';
    }

    function save() {
      if (!alive) return false;
      const written = disk.save(room,{sound,campaign:data});
      updateWarning();
      return written;
    }

    function card(chapter,index) {
      const status = progress(chapter.id);
      const allowed = unlocked(index);
      const button = status === 'done' ? 'Пройдено' : status === 'part' ? 'Продолжить' : 'Играть';
      return `<article class="ray-chapter${allowed?'':' ray-chapter-locked'}">${thumbnail(chapter.scene,'ray-chapter-photo')}<div class="ray-chapter-copy"><h3>${chapter.title}</h3><p>${chapter.detail}</p>${allowed ? `<button type="button" class="ray-level-button${status==='done'?' ray-level-complete':''}" data-ray-level="${chapter.id}"${status==='done'?' disabled':''}>${button}</button>` : '<span class="ray-locked">Откроется после предыдущего задания</span>'}</div></article>`;
    }

    function showMap(focus = false) {
      editor?.destroy?.();editor = null;opened = null;
      play.replaceChildren();play.hidden = true;map.hidden = false;
      const first = chapters.find((chapter,index) => unlocked(index) && progress(chapter.id) !== 'done');
      const doneCount = chapters.filter(chapter => progress(chapter.id) === 'done').length;
      const nextLabel = first && progress(first.id) === 'part' ? 'Продолжить приключение' : 'Начать следующее задание';
      map.innerHTML = `${isInline ? '' : `<nav class="ray-campaign-nav" aria-label="Навигация"><a href="${homeHref}">← Дела и приключения</a><a href="../">Все игры</a></nav>`}
        <header class="ray-campaign-hero">${thumbnail('search','ray-hero-painting')}<div class="ray-hero-copy"><h1>Приключения с Рэем</h1><p>${doneCount===chapters.length?'Все задания пройдены. Теперь выбери одно небольшое дело в своей комнате.':'Найди машинку и помоги Рэю собраться. С каждым уровнем задач становится больше.'}</p>${first ? `<button type="button" class="ray-level-button ray-next" data-ray-level="${first.id}">${doneCount===0&&progress(first.id)==='new'?'Начать игру':nextLabel}</button>` : ''}</div></header>
        <div class="ray-map-progress"><span>Задания</span><strong>${doneCount} из ${chapters.length}</strong></div>
        <section aria-labelledby="ray-first-heading"><h2 id="ray-first-heading">Уровень 1 · Осваиваемся</h2><div class="ray-chapter-grid">${card(chapters[0],0)}${card(chapters[1],1)}</div></section>
        ${chapters.slice(2).map((chapter,index)=>`<section aria-labelledby="ray-heading-${chapter.id}"><h2 id="ray-heading-${chapter.id}">Уровень ${chapter.number}</h2>${card(chapter,index+2)}</section>`).join('')}
        ${doneCount===chapters.length?'<p class="ray-real-tip">Начни с трёх вещей дома. Найди для каждой своё место и проверь, стало ли удобнее.</p>':''}
        <p data-ray-warning class="ray-save-warning" role="status"></p>`;
      updateWarning();
      if (focus) {
        map.querySelector('.ray-next')?.focus({preventScroll:true});
        map.scrollIntoView({block:'start'});
      }
    }

    function chapterStore(id) {
      return {
        read() {
          const snapshot = id === 'tidy' ? room : id === 'departure' ? data.departure : data.levels[id] || null;
          return {snapshot:clone(snapshot),sound,error:disk.warning?.() || saved.error || ''};
        },
        save(snapshot, settings = {}) {
          if (!alive || opened !== id) return false;
          if (id === 'tidy') {
            room = clone(snapshot);
            data.tidyFinished = snapshot.state.stage === 'done';
          } else if (id === 'departure') {
            const restored = classic(snapshot);
            if (!restored) return false;
            data.departure = restored;
          } else {
            if (!advanced(id,snapshot)) return false;
            data.levels[id] = clone(snapshot);
          }
          if (typeof settings.sound === 'boolean') sound = settings.sound;
          return save();
        },
        warning:() => disk.warning?.() || saved.error || '',
        subscribe: callback => disk.subscribe?.(callback)
      };
    }

    function playLevel(id) {
      const index = chapters.findIndex(chapter => chapter.id === id);
      if (index < 0 || !unlocked(index) || progress(id) === 'done' || opened) return false;
      data.active = id;opened = id;
      save();map.hidden = true;play.hidden = false;
      const store = chapterStore(id);
      const childOptions = {store,campaign:true,onExit:()=>showMap(true),onComplete:()=>save()};
      editor = id === 'tidy' ? root.RoomTidyGame.mount(play,childOptions) :
        id === 'departure' ? root.RoomGame.mount(play,{...childOptions,skipFloor:true}) :
        root.RoomLevelsView.mount(play,{...childOptions,levelId:id,variant:data.levels[id]?.variant});
      play.scrollIntoView({block:'start'});
      return true;
    }

    function click(event) {
      const button = event.target.closest?.('[data-ray-level]');
      if (button && !button.disabled) playLevel(button.dataset.rayLevel);
    }

    map.addEventListener('click',click);
    const unsubscribe = disk.subscribe?.(updateWarning);
    showMap();
    root.RayCampaign = Object.freeze({snapshot:()=>({active:opened,data:clone(data),room:clone(room),unlocked:chapters.filter((_,index)=>unlocked(index)).map(chapter=>chapter.id),statuses:Object.fromEntries(chapters.map(chapter=>[chapter.id,progress(chapter.id)]))})});
    return {destroy() {
      alive = false;editor?.destroy?.();unsubscribe?.();map.removeEventListener('click',click);
      if (!options.store) disk.destroy?.();
    }};
  }

  root.RoomCampaign = Object.freeze({valid,mount,launcher});
})(typeof window === 'undefined' ? globalThis : window);
