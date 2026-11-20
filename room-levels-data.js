(function (root) {
  'use strict';

  if (typeof module !== 'undefined' && module.exports) {
    require('./room-tidy-data.js');
    require('./life-quest-data.js');
    require('./life-school-schedule.js');
  }

  const tidy = root.RoomTidyData;
  const life = root.LifeQuestData;
  const school = root.LifeSchoolSchedule;
  const colors = {red: '#d64a3d', blue: '#398cba', yellow: '#e7b93c', green: '#58986a'};
  const colorNames = {red: 'Красные', blue: 'Синие', yellow: 'Жёлтые', green: 'Зелёные'};
  const typeNames = {race: 'Гоночные', offroad: 'Внедорожники', utility: 'Рабочие'};
  const sizeNames = {small: 'Маленькие', medium: 'Средние', large: 'Большие'};
  const brickColors = ['#d54b3d', '#438fa6', '#e6b646', '#4e9678'];

  function garageStage(attribute) {
    const names = attribute === 'type' ? typeNames : sizeNames;
    const columns = tidy.colors.map(id => ({id, label: colorNames[id], color: colors[id]}));
    const rows = Object.entries(names).map(([id, label]) => ({id, label}));
    const targets = rows.flatMap((row, rowIndex) => columns.map((col, colIndex) => ({
      id: 'garage-' + rowIndex + '-' + colIndex,
      label: col.label + ' · ' + row.label,
      row: rowIndex,
      col: colIndex,
      color: col.color,
      capacity: 1,
      match: {colorName: col.id, [attribute === 'type' ? 'carType' : 'sizeClass']: row.id}
    })));
    return {
      id: 'park-cars',
      type: 'placement',
      title: 'Два правила одного гаража',
      instruction: 'Поставь все 12 машинок в боксы. У каждого бокса два признака.',
      memo: attribute === 'type' ? 'Столбик показывает цвет. Ряд подсказывает, для какого типа машин бокс.' :
        'Столбик показывает цвет. Ряд подсказывает, для какого размера машин бокс.',
      hint: 'Найди столбик по цвету машинки. Теперь прочитай табличку слева и найди нужный ряд. Их пересечение — твой бокс.',
      wrong: 'Посмотри на цвет столбика и на табличку ряда.',
      columns,
      rows,
      targets,
      items: tidy.cars.map(item => ({
        ...item, kind: 'car', color: colors[item.color], colorName: item.color,
        carType: item.type, sizeClass: item.size
      }))
    };
  }

  const workshopItems = tidy.legoItems.map((item, index) => ({
    ...item, kind: item.model ? 'model' : 'brick', color: brickColors[index % brickColors.length]
  }));
  const planItems = [
    {id: 'sort', label: 'Разложить детали по коробкам', kind: 'step'},
    {id: 'shelf', label: 'Перенести готовые модели на полку', kind: 'step'},
    {id: 'inspect', label: 'Проверить стол и полку', kind: 'step'},
    {id: 'boxes', label: 'Поставить коробки на свободный край', kind: 'step'},
    {id: 'clear', label: 'Освободить край стола', kind: 'step'}
  ];
  const workshop = [
    {
      id: 'bricks',
      type: 'placement',
      title: 'Ящики для деталей',
      instruction: 'Разложи девять отдельных деталей. Считай выступы сверху и сравнивай ширину.',
      memo: 'У узких деталей один ряд выступов в ширину, у широких — два.',
      hint: 'Сначала отличи узкую деталь от широкой. Потом пересчитай все выступы сверху и прочитай табличку на коробке.',
      wrong: 'Сверь ширину детали и число выступов с табличкой на коробке.',
      items: workshopItems.filter(item => !item.model),
      targets: [
        {id: 'narrow-small', label: 'Узкие · до 4 выступов', match: {cols: 1}, maxStuds: 4},
        {id: 'wide-small', label: 'Широкие · до 4 выступов', match: {cols: 2}, maxStuds: 4},
        {id: 'wide-six', label: 'Широкие · 6 выступов', match: {cols: 2, studs: 6}},
        {id: 'wide-eight', label: 'Широкие · 8 выступов', match: {cols: 2, studs: 8}},
        {id: 'wide-ten', label: 'Широкие · 10 выступов', match: {cols: 2, studs: 10}}
      ]
    },
    {
      id: 'models',
      type: 'placement',
      title: 'Полка готовых моделей',
      instruction: 'Поставь каждую готовую модель на подходящее место. Сохрани постройки целиком.',
      memo: 'На полке есть площадка с дорожкой, высокий отсек и широкий отсек с низким потолком.',
      hint: 'Колёсам подойдёт дорожка. Высокая постройка поместится в самом высоком отсеке. Остаётся широкий отсек для домика.',
      wrong: 'Посмотри, какой модели подходят форма и высота этого места.',
      items: workshopItems.filter(item => item.model),
      targets: [
        {id: 'stand-car', label: 'Площадка с дорожкой', capacity: 1, match: {modelType: 'car'}},
        {id: 'stand-rocket', label: 'Высокий отсек', capacity: 1, match: {modelType: 'rocket'}},
        {id: 'stand-house', label: 'Широкий низкий отсек', capacity: 1, match: {modelType: 'house'}}
      ]
    },
    {
      id: 'plan',
      type: 'sequence',
      title: 'План на следующую уборку',
      instruction: 'Расставь пять шагов в удобном порядке. У Рэя может получиться несколько верных планов.',
      memo: 'Иногда удобно перенести модели сразу, иногда — после деталей. Проверяем стол и полку в самом конце.',
      hint: 'Коробки ставим на уже свободный край стола. Детали раскладываем после того, как коробки готовы.',
      items: planItems,
      targets: planItems.map((_, index) => ({
        id: 'position-' + (index + 1), label: 'Шаг ' + (index + 1), row: index, capacity: 1
      })),
      before: [
        ['clear', 'boxes', 'Сначала освободи край стола, потом поставь туда коробки.'],
        ['boxes', 'sort', 'Сначала поставь коробки, потом раскладывай детали.'],
        ['sort', 'inspect', 'Стол нужно проверить после того, как детали разложены.'],
        ['shelf', 'inspect', 'Полку нужно проверить после того, как поставишь модели.']
      ]
    }
  ];

  const schoolDays = ['tue', 'thu'].map(id => {
    const day = school.day(id);
    return {id: day.id, label: day.label, lessons: day.lessons.map(({id, title}) => ({id, title}))};
  });
  const baseQuest = id => school.questsForDay(id).find(quest => quest.id === school.questId(id, 'base'));
  const lessonStage = (quest, lessonId) => quest.packingStages.find(stage => stage.lessonId === lessonId);
  const backpackItems = quest => quest.packingStages
    .filter(stage => !['pe', 'pool'].includes(stage.lessonId))
    .flatMap(stage => stage.required);
  const tuesday = baseQuest('tue');
  const thursday = baseQuest('thu');
  const tuesdayBackpack = backpackItems(tuesday);
  const thursdayBackpack = backpackItems(thursday);
  const commonBackpack = tuesdayBackpack.filter(id => thursdayBackpack.includes(id));
  const tuesdayOnly = tuesdayBackpack.filter(id => !thursdayBackpack.includes(id));
  const thursdayOnly = thursdayBackpack.filter(id => !tuesdayBackpack.includes(id));
  const sports = lessonStage(tuesday, 'pe').required;
  const pool = lessonStage(tuesday, 'pool');
  function schoolItem(id) {
    const {label, icon, description, illustration} = life.items[id];
    return {id, label, icon, description, illustration: {...illustration}, kind: 'school'};
  }

  function mixed(correct, others) {
    const ids = correct.concat(others);
    let seed = 53193;
    for (let index = ids.length - 1; index > 0; index--) {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      const swap = seed % (index + 1);
      [ids[index], ids[swap]] = [ids[swap], ids[index]];
    }
    return ids.map(schoolItem);
  }

  const schoolStages = [
    {
      id: 'common',
      type: 'selection',
      title: 'Один набор на оба дня',
      instruction: 'Выбери общие школьные вещи и всё для уроков, которые есть в оба дня.',
      memo: 'Общие вещи по памятке: пенал, дневник, сменная обувь и мешок для неё. Для каждого из общих уроков пригодится один комплект.',
      hint: 'Сравни два расписания. Русский язык и чтение есть и во вторник, и в четверг. В бассейн собираем отдельную сумку дальше.',
      wrong: 'Проверь, нужен ли этот предмет в школьном рюкзаке в оба дня.',
      items: mixed(commonBackpack, ['world-book', 'sport-uniform', 'foreign-book', 'swim-cap', 'math-notebook']),
      required: commonBackpack
    },
    {
      id: 'tuesday',
      type: 'selection',
      title: 'Добавляем уроки вторника',
      instruction: 'Доложи в рюкзак учебники и тетради для уроков, которые есть только во вторник.',
      memo: 'Один комплект — учебник и тетрадь. Общие вещи уже в рюкзаке. Для физкультуры и бассейна есть отдельные сумки.',
      hint: 'Сравни уроки. Во вторник нужны комплекты для окружающего мира и математики.',
      wrong: 'Сверь этот предмет с уроками вторника и проверь, куда его кладут.',
      items: mixed(tuesdayOnly, ['russian-book', 'foreign-notebook', 'sport-shoes', 'music-folder', 'reading-book']),
      required: tuesdayOnly
    },
    {
      id: 'sports',
      type: 'placement',
      title: 'Две сумки для спорта',
      instruction: 'Собери отдельно вещи для зала и вещи для бассейна. Школьные вещи оставь на столе.',
      memo: 'В зал берём форму, обувь и носки. Для бассейна нужны плавки, шапочка, полотенце, тапочки, средство для душа, пакет для мокрых вещей и сухое бельё. Очки можно взять по желанию.',
      hint: 'Физкультура — занятие в зале, а «Золотая рыбка» — бассейн. Подумай, где понадобится каждый предмет.',
      wrong: 'Подумай, нужен предмет в зале, в бассейне или вообще останется на столе.',
      items: mixed(sports.concat(pool.required), ['pencil-case', 'change-shoes', 'goggles', 'math-book']),
      required: sports.concat(pool.required),
      targets: [
        {id: 'sport-bag', label: 'Сумка для физкультуры', accepts: sports},
        {id: 'pool-bag', label: 'Сумка для бассейна', accepts: pool.required.concat(pool.optional)}
      ]
    },
    {
      id: 'thursday',
      type: 'selection',
      title: 'Меняем набор к четвергу',
      instruction: 'Общие вещи уже собраны. Выбери только то, что добавим для новых уроков четверга.',
      memo: 'Для иностранного языка нужен учебник с тетрадью. На технологии по памятке делают бумажную закладку: нужны папка, бумага, клей и ножницы в чехле. Для музыки нужна папка.',
      hint: 'Проверь иностранный язык, технологию и музыку. Русский язык, чтение и бассейн уже подготовлены.',
      wrong: 'Проверь, пригодится ли предмет для одного из новых уроков четверга.',
      items: mixed(thursdayOnly, ['math-book', 'world-notebook', 'plasticine', 'sport-uniform', 'reading-book']),
      required: thursdayOnly
    }
  ].map(stage => ({...stage, schedule: schoolDays}));

  const levels = {
    garage: {
      id: 'garage',
      title: 'Гараж с двумя правилами',
      description: 'Найди свой бокс для каждой машинки по двум признакам сразу.',
      scene: 'garage',
      stages: [garageStage('type')],
      variants: {size: [garageStage('size')]}
    },
    workshop: {
      id: 'workshop',
      title: 'Мастерская LEGO',
      description: 'Разбери детали, сохрани постройки и составь план для Рэя.',
      scene: 'lego',
      stages: workshop
    },
    school: {
      id: 'school',
      title: 'Два дня в школе',
      description: 'Сравни вторник и четверг, собери рюкзак и две разные спортивные сумки.',
      scene: 'school',
      stages: schoolStages
    }
  };

  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }

  const api = freeze({levels, ids: Object.keys(levels)});
  root.RoomLevelsData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
