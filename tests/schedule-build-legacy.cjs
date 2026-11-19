'use strict';
// Frozen pre-schedule compatibility contract: these 38 saved task IDs and
// positional real-world checklist meanings must survive content expansion.
const LEGACY=[
  {
    "id": "life.places.after-play",
    "mode": "sort",
    "itemIds": [
      "teddy",
      "blocks",
      "storybook",
      "clean-shirt",
      "dirty-socks",
      "sneakers"
    ],
    "zoneIds": [
      "toybox",
      "bookshelf",
      "wardrobe",
      "laundry",
      "shoe-rack"
    ],
    "realSteps": [
      "Выбери три вещи, которым уже знаешь место.",
      "Убери их на настоящие места.",
      "Посмотри, свободен ли проход."
    ],
    "accepted": {
      "teddy": [
        "toybox"
      ],
      "blocks": [
        "toybox"
      ],
      "storybook": [
        "bookshelf"
      ],
      "clean-shirt": [
        "wardrobe"
      ],
      "dirty-socks": [
        "laundry"
      ],
      "sneakers": [
        "shoe-rack"
      ]
    },
    "before": []
  },
  {
    "id": "life.places.clothes",
    "mode": "sort",
    "itemIds": [
      "clean-shirt",
      "clean-socks",
      "dirty-shirt",
      "dirty-socks",
      "boots"
    ],
    "zoneIds": [
      "wardrobe",
      "clothes-shelf",
      "laundry",
      "shoe-rack"
    ],
    "realSteps": [
      "Найди чистую вещь и убери её.",
      "Отнеси вещь для стирки в корзину.",
      "Поставь обувь парой."
    ],
    "accepted": {
      "clean-shirt": [
        "wardrobe",
        "clothes-shelf"
      ],
      "clean-socks": [
        "wardrobe",
        "clothes-shelf"
      ],
      "dirty-shirt": [
        "laundry"
      ],
      "dirty-socks": [
        "laundry"
      ],
      "boots": [
        "shoe-rack"
      ]
    },
    "before": []
  },
  {
    "id": "life.places.desk",
    "mode": "sort",
    "itemIds": [
      "art-album",
      "pencils",
      "ruler",
      "teddy",
      "blocks",
      "storybook",
      "dirty-shirt"
    ],
    "zoneIds": [
      "desk",
      "stationery",
      "toybox",
      "bookshelf",
      "laundry"
    ],
    "realSteps": [
      "Выбери одно дело для стола.",
      "Убери лишнее.",
      "Положи две нужные принадлежности."
    ],
    "accepted": {
      "art-album": [
        "desk"
      ],
      "pencils": [
        "desk"
      ],
      "ruler": [
        "stationery"
      ],
      "teddy": [
        "toybox"
      ],
      "blocks": [
        "toybox"
      ],
      "storybook": [
        "bookshelf"
      ],
      "dirty-shirt": [
        "laundry"
      ]
    },
    "before": []
  },
  {
    "id": "life.places.school-return",
    "mode": "sort",
    "itemIds": [
      "math-book",
      "russian-book",
      "math-notebook",
      "pencil-case",
      "change-shoes",
      "sport-uniform"
    ],
    "zoneIds": [
      "bookshelf",
      "desk",
      "stationery",
      "shoe-rack",
      "laundry"
    ],
    "realSteps": [
      "Открой настоящий рюкзак.",
      "Убери учебники и тетради на привычные места.",
      "Проверь, нет ли внутри влажных вещей."
    ],
    "accepted": {
      "math-book": [
        "bookshelf"
      ],
      "russian-book": [
        "bookshelf"
      ],
      "math-notebook": [
        "desk"
      ],
      "pencil-case": [
        "desk",
        "stationery"
      ],
      "change-shoes": [
        "shoe-rack"
      ],
      "sport-uniform": [
        "laundry"
      ]
    },
    "before": []
  },
  {
    "id": "life.places.hobbies",
    "mode": "sort",
    "itemIds": [
      "ball",
      "rope",
      "notes",
      "flute",
      "paper",
      "glue",
      "storybook",
      "puzzle"
    ],
    "zoneIds": [
      "sports-box",
      "music-place",
      "craft-box",
      "bookshelf",
      "toybox"
    ],
    "realSteps": [
      "Выбери одно увлечение.",
      "Собери его вещи вместе.",
      "Верни их в подготовленное место."
    ],
    "accepted": {
      "ball": [
        "sports-box"
      ],
      "rope": [
        "sports-box"
      ],
      "notes": [
        "music-place"
      ],
      "flute": [
        "music-place"
      ],
      "paper": [
        "craft-box"
      ],
      "glue": [
        "craft-box"
      ],
      "storybook": [
        "bookshelf"
      ],
      "puzzle": [
        "toybox"
      ]
    },
    "before": []
  },
  {
    "id": "life.places.shopping",
    "mode": "sort",
    "itemIds": [
      "milk",
      "yogurt",
      "cereal",
      "pasta",
      "apples",
      "bananas",
      "bread",
      "soap"
    ],
    "zoneIds": [
      "fridge",
      "pantry",
      "fruit-bowl",
      "breadbox",
      "bathroom"
    ],
    "realSteps": [
      "Спроси взрослого, какие покупки можно помочь разобрать.",
      "Сначала помоги убрать то, что должно храниться в холоде.",
      "Отнеси остальные вещи по договорённости."
    ],
    "accepted": {
      "milk": [
        "fridge"
      ],
      "yogurt": [
        "fridge"
      ],
      "cereal": [
        "pantry"
      ],
      "pasta": [
        "pantry"
      ],
      "apples": [
        "fruit-bowl",
        "fridge"
      ],
      "bananas": [
        "fruit-bowl"
      ],
      "bread": [
        "breadbox"
      ],
      "soap": [
        "bathroom"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.red",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "match"
      ],
      "red-circle-large": [
        "match"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "other"
      ],
      "red-square-small": [
        "match"
      ],
      "red-square-large": [
        "match"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "match"
      ],
      "blue-triangle-large": [
        "other"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.blue",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "other"
      ],
      "red-circle-large": [
        "other"
      ],
      "blue-circle-small": [
        "match"
      ],
      "blue-circle-large": [
        "match"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "match"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "other"
      ],
      "blue-triangle-large": [
        "match"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.round",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "match"
      ],
      "red-circle-large": [
        "match"
      ],
      "blue-circle-small": [
        "match"
      ],
      "blue-circle-large": [
        "match"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "other"
      ],
      "blue-triangle-large": [
        "other"
      ],
      "yellow-circle-small": [
        "match"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.triangles",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "other"
      ],
      "red-circle-large": [
        "other"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "other"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "match"
      ],
      "blue-triangle-large": [
        "match"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "match"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.small",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "match"
      ],
      "red-circle-large": [
        "other"
      ],
      "blue-circle-small": [
        "match"
      ],
      "blue-circle-large": [
        "other"
      ],
      "red-square-small": [
        "match"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "match"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "match"
      ],
      "blue-triangle-large": [
        "other"
      ],
      "yellow-circle-small": [
        "match"
      ],
      "yellow-triangle-small": [
        "match"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.large",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "other"
      ],
      "red-circle-large": [
        "match"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "match"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "match"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "match"
      ],
      "red-triangle-small": [
        "other"
      ],
      "blue-triangle-large": [
        "match"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.red-small",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "match"
      ],
      "red-circle-large": [
        "other"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "other"
      ],
      "red-square-small": [
        "match"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "match"
      ],
      "blue-triangle-large": [
        "other"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.red-small-round",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "match"
      ],
      "red-circle-large": [
        "other"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "other"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "other"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "other"
      ],
      "red-triangle-small": [
        "other"
      ],
      "blue-triangle-large": [
        "other"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "other"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.wood",
    "mode": "sort",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Договорись об одном признаке для двух групп.",
      "Разложи и объясни своё правило."
    ],
    "accepted": {
      "red-circle-small": [
        "other"
      ],
      "red-circle-large": [
        "match"
      ],
      "blue-circle-small": [
        "other"
      ],
      "blue-circle-large": [
        "match"
      ],
      "red-square-small": [
        "other"
      ],
      "red-square-large": [
        "match"
      ],
      "blue-square-small": [
        "other"
      ],
      "yellow-square-large": [
        "match"
      ],
      "red-triangle-small": [
        "other"
      ],
      "blue-triangle-large": [
        "match"
      ],
      "yellow-circle-small": [
        "other"
      ],
      "yellow-triangle-small": [
        "match"
      ]
    },
    "before": []
  },
  {
    "id": "life.sort.choose-rule",
    "mode": "rule",
    "itemIds": [
      "red-circle-small",
      "red-circle-large",
      "blue-circle-small",
      "blue-circle-large",
      "red-square-small",
      "red-square-large",
      "blue-square-small",
      "yellow-square-large",
      "red-triangle-small",
      "blue-triangle-large",
      "yellow-circle-small",
      "yellow-triangle-small"
    ],
    "zoneIds": [
      "match",
      "other"
    ],
    "realSteps": [
      "Выбери несколько настоящих игрушек.",
      "Придумай признак для первой группы.",
      "Разложи игрушки и объясни правило взрослому."
    ],
    "before": []
  },
  {
    "id": "life.school.math-russian",
    "mode": "pack",
    "itemIds": [
      "math-book",
      "math-notebook",
      "russian-book",
      "russian-notebook",
      "pencil-case",
      "school-diary",
      "water",
      "reading-book",
      "teddy",
      "swim-cap"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "math-book",
      "math-notebook",
      "russian-book",
      "russian-notebook",
      "pencil-case",
      "school-diary"
    ],
    "realSteps": [
      "Посмотри настоящее расписание.",
      "Отметь нужные учебники и тетради.",
      "Проверь пенал.",
      "Убери вещи в рюкзак."
    ],
    "before": []
  },
  {
    "id": "life.school.reading-world",
    "mode": "pack",
    "itemIds": [
      "reading-book",
      "reader-diary",
      "world-book",
      "pencil-case",
      "school-diary",
      "water",
      "math-book",
      "russian-notebook",
      "ball"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "reading-book",
      "reader-diary",
      "world-book",
      "pencil-case",
      "school-diary"
    ],
    "realSteps": [
      "Сверься с расписанием.",
      "Найди нужную книгу для чтения.",
      "Положи дневники и пенал.",
      "Проверь, что лишние учебники остались дома."
    ],
    "before": []
  },
  {
    "id": "life.school.art",
    "mode": "pack",
    "itemIds": [
      "art-album",
      "paints",
      "brush",
      "apron",
      "pencils",
      "water",
      "math-book",
      "swimwear",
      "toy-car"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "art-album",
      "paints",
      "brush",
      "apron"
    ],
    "realSteps": [
      "Открой памятку занятия.",
      "Проверь, что краски закрыты.",
      "Собери принадлежности для рисования.",
      "Убери материалы так, чтобы они не испачкали другие вещи."
    ],
    "before": []
  },
  {
    "id": "life.school.pe",
    "mode": "pack",
    "itemIds": [
      "math-book",
      "math-notebook",
      "pencil-case",
      "sport-uniform",
      "sport-shoes",
      "shoe-bag",
      "water",
      "goggles",
      "russian-book",
      "large-robot"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "math-book",
      "math-notebook",
      "pencil-case",
      "sport-uniform",
      "sport-shoes",
      "shoe-bag"
    ],
    "realSteps": [
      "Проверь расписание.",
      "Собери учебные вещи.",
      "Положи чистую форму.",
      "Проверь обувь и отдельный мешок."
    ],
    "before": []
  },
  {
    "id": "life.school.rain",
    "mode": "pack",
    "itemIds": [
      "russian-book",
      "russian-notebook",
      "reading-book",
      "pencil-case",
      "umbrella",
      "raincoat",
      "water",
      "swim-cap",
      "sunhat",
      "drumsticks"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "russian-book",
      "russian-notebook",
      "reading-book",
      "pencil-case"
    ],
    "realSteps": [
      "Посмотри расписание и погоду.",
      "Собери учебные вещи.",
      "Выбери защиту от дождя.",
      "Проверь рюкзак перед выходом."
    ],
    "before": [],
    "alternatives": [
      {
        "id": "rain-protection",
        "label": "Зонт или дождевик",
        "items": [
          "umbrella",
          "raincoat"
        ],
        "min": 1,
        "max": 2
      }
    ]
  },
  {
    "id": "life.sport.pool",
    "mode": "pack",
    "itemIds": [
      "swimwear",
      "swim-cap",
      "towel",
      "pool-slippers",
      "shower-gel",
      "goggles",
      "water",
      "math-book",
      "boots",
      "toy-car"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "swimwear",
      "swim-cap",
      "towel",
      "pool-slippers",
      "shower-gel"
    ],
    "realSteps": [
      "Сверься с памяткой своего бассейна.",
      "Собери сухие вещи.",
      "Проверь полотенце и сменную обувь.",
      "После занятия отдели мокрые вещи от сухих."
    ],
    "before": []
  },
  {
    "id": "life.sport.gym",
    "mode": "pack",
    "itemIds": [
      "sport-uniform",
      "gym-socks",
      "water",
      "hair-tie",
      "towel",
      "helmet",
      "swim-cap",
      "reading-book"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "sport-uniform",
      "gym-socks",
      "water"
    ],
    "realSteps": [
      "Уточни список тренера.",
      "Проверь чистую форму.",
      "Приготовь воду.",
      "Убери вещи в спортивную сумку."
    ],
    "before": []
  },
  {
    "id": "life.sport.bmx",
    "mode": "pack",
    "itemIds": [
      "helmet",
      "knee-pads",
      "gloves",
      "sport-shoes",
      "water",
      "napkins",
      "swimwear",
      "flute",
      "art-album"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "helmet",
      "knee-pads",
      "gloves",
      "sport-shoes",
      "water"
    ],
    "realSteps": [
      "Сверь защиту со списком тренера.",
      "Подготовь одежду и воду.",
      "Попроси взрослого проверить велосипед и посадку защиты.",
      "Собери свои вещи перед выходом."
    ],
    "before": []
  },
  {
    "id": "life.sport.music-flute",
    "mode": "pack",
    "itemIds": [
      "flute",
      "notes",
      "music-notebook",
      "pencil-case",
      "water",
      "drumsticks",
      "guitar-pick",
      "ball"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "flute",
      "notes",
      "music-notebook",
      "pencil-case"
    ],
    "realSteps": [
      "Посмотри задание педагога.",
      "Приготовь свой инструмент.",
      "Положи нужные ноты и тетрадь.",
      "Проверь карандаш."
    ],
    "before": []
  },
  {
    "id": "life.sport.music-drums",
    "mode": "pack",
    "itemIds": [
      "drumsticks",
      "notes",
      "pencil-case",
      "music-notebook",
      "water",
      "flute",
      "guitar-pick",
      "goggles"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "drumsticks",
      "notes",
      "pencil-case"
    ],
    "realSteps": [
      "Уточни, на каком инструменте сегодня занятие.",
      "Положи нужные принадлежности.",
      "Найди ноты.",
      "Проверь пенал."
    ],
    "before": []
  },
  {
    "id": "life.trip.sunny-walk",
    "mode": "pack",
    "itemIds": [
      "water",
      "sunhat",
      "lunchbox",
      "napkins",
      "warm-hat",
      "large-robot",
      "math-book"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "water",
      "sunhat"
    ],
    "realSteps": [
      "Уточни погоду и длительность прогулки.",
      "Приготовь воду и головной убор.",
      "Проверь, удобно ли нести рюкзак."
    ],
    "before": []
  },
  {
    "id": "life.trip.rain-walk",
    "mode": "pack",
    "itemIds": [
      "raincoat",
      "boots",
      "napkins",
      "water",
      "pool-slippers",
      "swim-cap",
      "art-album"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "raincoat",
      "boots",
      "napkins"
    ],
    "realSteps": [
      "Посмотри погоду со взрослым.",
      "Подготовь одежду и обувь.",
      "Выбери удобную небольшую сумку."
    ],
    "before": []
  },
  {
    "id": "life.trip.overnight",
    "mode": "pack",
    "itemIds": [
      "pajamas",
      "underwear",
      "clean-socks",
      "toothbrush",
      "storybook",
      "teddy",
      "towel",
      "math-book",
      "helmet"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "pajamas",
      "underwear",
      "clean-socks",
      "toothbrush"
    ],
    "realSteps": [
      "Уточни, что уже есть в гостях.",
      "Собери личные принадлежности.",
      "Положи одежду на следующий день.",
      "Выбери одну небольшую вещь для отдыха."
    ],
    "before": []
  },
  {
    "id": "life.trip.library",
    "mode": "pack",
    "itemIds": [
      "storybook",
      "comics",
      "water",
      "ball",
      "paints",
      "boots"
    ],
    "zoneIds": [
      "bag"
    ],
    "required": [
      "storybook",
      "comics"
    ],
    "realSteps": [
      "Проверь, какие книги нужно вернуть.",
      "Найди обе книги.",
      "Сложи их аккуратно в сумку."
    ],
    "before": []
  },
  {
    "id": "life.plan.bed",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Убери лишние вещи с постели.",
      "Расправь простыню и одеяло.",
      "Устрой подушку.",
      "Проверь, удобно ли будет лечь вечером."
    ],
    "steps": [
      {
        "id": "clear",
        "label": "Убрать игрушку на её место"
      },
      {
        "id": "sheet",
        "label": "Расправить простыню"
      },
      {
        "id": "blanket",
        "label": "Расправить одеяло"
      },
      {
        "id": "pillow",
        "label": "Положить подушку аккуратно"
      }
    ],
    "before": [
      [
        "clear",
        "sheet"
      ],
      [
        "sheet",
        "blanket"
      ],
      [
        "sheet",
        "pillow"
      ]
    ]
  },
  {
    "id": "life.plan.desk",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Выбери одно задание.",
      "Освободи рабочее место.",
      "Приготовь только нужные вещи.",
      "Проверь, удобно ли сидеть."
    ],
    "steps": [
      {
        "id": "choose",
        "label": "Посмотреть, какое задание будем делать"
      },
      {
        "id": "clear",
        "label": "Убрать лишние вещи"
      },
      {
        "id": "wipe",
        "label": "При необходимости протереть свободный стол"
      },
      {
        "id": "materials",
        "label": "Положить нужный учебник и тетрадь"
      },
      {
        "id": "tools",
        "label": "Приготовить ручку и карандаш"
      },
      {
        "id": "start",
        "label": "Удобно сесть и начать"
      }
    ],
    "before": [
      [
        "choose",
        "materials"
      ],
      [
        "choose",
        "tools"
      ],
      [
        "clear",
        "wipe"
      ],
      [
        "wipe",
        "materials"
      ],
      [
        "wipe",
        "tools"
      ],
      [
        "materials",
        "start"
      ],
      [
        "tools",
        "start"
      ]
    ]
  },
  {
    "id": "life.plan.school-evening",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Посмотри расписание.",
      "Собери нужные вещи.",
      "Сверься со списком.",
      "Поставь рюкзак на привычное место."
    ],
    "steps": [
      {
        "id": "schedule",
        "label": "Посмотреть расписание на завтра"
      },
      {
        "id": "list",
        "label": "Назвать нужные учебники и тетради"
      },
      {
        "id": "pack",
        "label": "Положить нужные книги и тетради"
      },
      {
        "id": "pencil",
        "label": "Проверить пенал"
      },
      {
        "id": "check",
        "label": "Сверить собранное со списком"
      },
      {
        "id": "place",
        "label": "Поставить закрытый рюкзак на привычное место"
      }
    ],
    "before": [
      [
        "schedule",
        "list"
      ],
      [
        "list",
        "pack"
      ],
      [
        "pack",
        "check"
      ],
      [
        "pencil",
        "check"
      ],
      [
        "check",
        "place"
      ]
    ]
  },
  {
    "id": "life.plan.pool-return",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Разбери сумку после возвращения.",
      "Отдели мокрое от сухого.",
      "Повесь полотенце по договорённости.",
      "Передай вещи для стирки взрослому."
    ],
    "steps": [
      {
        "id": "open",
        "label": "Открыть спортивную сумку"
      },
      {
        "id": "separate",
        "label": "Отделить мокрые вещи от сухих"
      },
      {
        "id": "hang",
        "label": "Повесить полотенце на согласованное место"
      },
      {
        "id": "wash",
        "label": "Передать вещи для стирки по договорённости"
      },
      {
        "id": "bag",
        "label": "Оставить пустую сумку просохнуть"
      }
    ],
    "before": [
      [
        "open",
        "separate"
      ],
      [
        "separate",
        "hang"
      ],
      [
        "separate",
        "wash"
      ],
      [
        "separate",
        "bag"
      ]
    ]
  },
  {
    "id": "life.plan.bedtime",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Выбери удобный порядок вечерних дел.",
      "Приготовь вещи на завтра.",
      "Выполни привычные дела перед сном.",
      "Устройся для отдыха."
    ],
    "steps": [
      {
        "id": "tomorrow",
        "label": "Приготовить одежду на завтра"
      },
      {
        "id": "toys",
        "label": "Убрать несколько игрушек"
      },
      {
        "id": "teeth",
        "label": "Почистить зубы"
      },
      {
        "id": "pajamas",
        "label": "Надеть пижаму"
      },
      {
        "id": "story",
        "label": "Выбрать короткую историю для чтения"
      },
      {
        "id": "rest",
        "label": "Устроиться в постели"
      }
    ],
    "before": [
      [
        "tomorrow",
        "rest"
      ],
      [
        "toys",
        "rest"
      ],
      [
        "teeth",
        "rest"
      ],
      [
        "pajamas",
        "rest"
      ],
      [
        "story",
        "rest"
      ]
    ]
  },
  {
    "id": "life.plan.room",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Выбери маленький участок.",
      "Убери один вид вещей.",
      "Проверь проход.",
      "Заметь, что стало удобнее."
    ],
    "steps": [
      {
        "id": "look",
        "label": "Посмотреть и выбрать небольшой участок"
      },
      {
        "id": "toys",
        "label": "Собрать игрушки на их места"
      },
      {
        "id": "books",
        "label": "Поставить книги на полку"
      },
      {
        "id": "clothes",
        "label": "Разделить чистую одежду и бельё для стирки"
      },
      {
        "id": "floor",
        "label": "Проверить, что проход свободен"
      },
      {
        "id": "finish",
        "label": "Посмотреть, что уже получилось"
      }
    ],
    "before": [
      [
        "look",
        "toys"
      ],
      [
        "look",
        "books"
      ],
      [
        "look",
        "clothes"
      ],
      [
        "toys",
        "floor"
      ],
      [
        "books",
        "floor"
      ],
      [
        "clothes",
        "floor"
      ],
      [
        "floor",
        "finish"
      ]
    ]
  },
  {
    "id": "life.plan.pet",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Спроси взрослого о помощи.",
      "Выполни одно согласованное дело.",
      "Проверь результат вместе.",
      "Дай питомцу спокойно отдохнуть."
    ],
    "steps": [
      {
        "id": "ask",
        "label": "Спросить взрослого, чем можно помочь"
      },
      {
        "id": "place",
        "label": "Освободить согласованное место для лежанки"
      },
      {
        "id": "water",
        "label": "Помочь налить свежую воду по договорённости"
      },
      {
        "id": "toy",
        "label": "Положить подходящую игрушку в согласованное место"
      },
      {
        "id": "check",
        "label": "Вместе со взрослым проверить готовность"
      },
      {
        "id": "space",
        "label": "Оставить котёнку возможность спокойно отдохнуть"
      }
    ],
    "before": [
      [
        "ask",
        "place"
      ],
      [
        "ask",
        "water"
      ],
      [
        "ask",
        "toy"
      ],
      [
        "place",
        "check"
      ],
      [
        "water",
        "check"
      ],
      [
        "toy",
        "check"
      ],
      [
        "check",
        "space"
      ]
    ]
  },
  {
    "id": "life.plan.trip-check",
    "mode": "sequence",
    "itemIds": [],
    "zoneIds": [],
    "realSteps": [
      "Сверься со своей памяткой.",
      "Закрой сумку.",
      "Оденься по погоде.",
      "Встреться со взрослым в условленном месте."
    ],
    "steps": [
      {
        "id": "list",
        "label": "Посмотреть памятку поездки"
      },
      {
        "id": "check",
        "label": "Сверить вещи с памяткой"
      },
      {
        "id": "close",
        "label": "Закрыть сумку"
      },
      {
        "id": "shoes",
        "label": "Надеть подходящую обувь"
      },
      {
        "id": "meet",
        "label": "Подойти к взрослому в условленное место"
      }
    ],
    "before": [
      [
        "list",
        "check"
      ],
      [
        "check",
        "close"
      ],
      [
        "close",
        "meet"
      ],
      [
        "shoes",
        "meet"
      ]
    ]
  }
];
function checkLegacyBank(D,eq,ok){
 eq(LEGACY.length,38);
 for(const old of LEGACY){
  const matching=D.quests.filter(q=>q.id===old.id);eq(matching.length,1,old.id+' retained exactly once');const q=matching[0];
  eq(q.mode,old.mode,old.id+' unchanged task mode');eq(q.realSteps,old.realSteps,old.id+' positional real-action meanings preserved');
  ok(old.itemIds.every(id=>q.itemIds.includes(id)),old.id+' legacy object IDs remain');ok(old.zoneIds.every(id=>q.zoneIds.includes(id)),old.id+' legacy destination IDs remain');
  if(old.required)eq(q.required,old.required,old.id+' old required choices preserved');
  if(old.steps)eq(q.steps.map(s=>s.id),old.steps.map(s=>s.id),old.id+' old plan step IDs remain');
  if(old.before)eq(q.before,old.before,old.id+' existing alternative plan orders preserved');
  if(old.accepted)for(const[id,places]of Object.entries(old.accepted))ok(places.every(z=>q.accepted[id]?.includes(z)),old.id+' old valid layout still accepted');
 }
}
module.exports={LEGACY,checkLegacyBank};
