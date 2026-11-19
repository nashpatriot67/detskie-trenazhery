(function (root) {
  'use strict';
  const colors = ['red', 'blue', 'yellow', 'green'];
  const types = ['race', 'offroad', 'utility'];
  const sizes = ['small', 'medium', 'large'];
  const colorLabels = {red: 'Красная', blue: 'Синяя', yellow: 'Жёлтая', green: 'Зелёная'};
  const typeLabels = {race: 'гоночная машинка', offroad: 'машинка-внедорожник', utility: 'рабочая машинка'};
  const searchItems = [
    {id: 'dirty-shirt', label: 'Грязная футболка', zones: ['laundry'], covers: 'loose-brick', dirty: true},
    {id: 'loose-brick', label: 'Деталь конструктора', zones: ['lego-tray'], covers: 'car-red-race'},
    {id: 'teddy', label: 'Мишка', zones: ['toybox']},
    {id: 'toy-car', label: 'Машинка', zones: ['parking-tray']},
    {id: 'storybook', label: 'Книга сказок', zones: ['bookshelf']}
  ].map(item => Object.assign({source: 'floor'}, item));
  const cars = [];
  colors.forEach((color, colorIndex) => types.forEach((type, typeIndex) => {
    cars.push({id: 'car-' + color + '-' + type, label: color === 'red' && type === 'race' ? 'Любимая красная гоночная машинка' : colorLabels[color] + ' ' + typeLabels[type],
      color, type, size: sizes[(colorIndex + typeIndex) % sizes.length], source: 'floor'});
  }));
  // Mix attributes in the visible group; three consecutive identical colors
  // would let the child repeat one location without comparing the cars.
  const mixedCarOrder = [0, 4, 8, 9, 2, 7, 3, 11, 1, 6, 10, 5].map(index => cars[index].id);
  cars.sort((a, b) => mixedCarOrder.indexOf(a.id) - mixedCarOrder.indexOf(b.id));
  const slots = [];
  types.forEach((_, row) => colors.forEach((__, col) => slots.push({id: 'garage-' + row + '-' + col, row, col})));
  const dimensions = [[1, 2], [2, 2], [2, 3], [2, 4], [2, 5], [1, 2], [2, 2], [2, 3], [2, 4]];
  const legoItems = dimensions.map((pair, index) => {
    const studs = pair[0] * pair[1];
    return {id: 'brick-' + (index + 1), label: 'Деталь ' + pair[0] + ' × ' + pair[1],
      cols: pair[0], rows: pair[1], studs, model: false, source: 'floor',
      zones: [studs <= 4 ? 'small-parts' : 'large-parts']};
  }).concat([
    {id: 'model-car', label: 'Готовая машинка', model: true, modelType: 'car', zones: ['model-shelf'], source: 'floor'},
    {id: 'model-rocket', label: 'Готовая ракета', model: true, modelType: 'rocket', zones: ['model-shelf'], source: 'floor'},
    {id: 'model-house', label: 'Готовый домик', model: true, modelType: 'house', zones: ['model-shelf'], source: 'floor'}
  ]);
  const clothesItems = [
    {id: 'dirty-socks', label: 'Грязные носки', dirty: true, kind: 'socks', zones: ['laundry']},
    {id: 'dirty-top', label: 'Грязная кофта', dirty: true, kind: 'top', zones: ['laundry']},
    {id: 'dirty-trousers', label: 'Грязные брюки', dirty: true, kind: 'trousers', zones: ['laundry']},
    {id: 'clean-socks', label: 'Чистые носки', dirty: false, kind: 'socks', folded: true, zones: ['drawer']},
    {id: 'clean-shirt', label: 'Чистая сложенная футболка', dirty: false, kind: 'shirt', folded: true, zones: ['drawer', 'wardrobe']},
    {id: 'clean-pajamas', label: 'Чистая пижама', dirty: false, kind: 'pajamas', folded: true, zones: ['drawer', 'wardrobe']},
    {id: 'clean-hoodie', label: 'Чистая толстовка', dirty: false, kind: 'hoodie', large: true, zones: ['wardrobe', 'drawer']},
    {id: 'clean-trousers', label: 'Чистые брюки', dirty: false, kind: 'trousers', large: true, zones: ['wardrobe', 'drawer']}
  ].map(item => Object.assign({source: 'floor'}, item));
  const realGoals = [
    {id: 'floor-path', label: 'Освободить маленькую дорожку на полу'},
    {id: 'park-cars', label: 'Припарковать свои машинки'},
    {id: 'bricks-box', label: 'Убрать несколько деталей конструктора'},
    {id: 'clothes-home', label: 'Положить одну вещь на место'}
  ];
  function freeze(value) {
    if (value && typeof value === 'object') { Object.keys(value).forEach(key => freeze(value[key])); Object.freeze(value); }
    return value;
  }
  const items = {};
  searchItems.concat(cars, legoItems, clothesItems).forEach(item => { items[item.id] = item; });
  root.RoomTidyData = freeze({episode: 'tidy', targetId: 'car-red-race', colors, types, sizes, rules: ['color', 'type', 'size'], items,
    searchIds: searchItems.map(item => item.id), carIds: cars.map(item => item.id),
    legoIds: legoItems.map(item => item.id), clothesIds: clothesItems.map(item => item.id),
    searchItems, cars, slots, legoItems, clothesItems, realGoals,
    zones: {search: ['laundry', 'lego-tray', 'toybox', 'parking-tray', 'bookshelf'],
      lego: ['small-parts', 'large-parts', 'model-shelf'], clothes: ['laundry', 'drawer', 'wardrobe']}});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RoomTidyData;
})(typeof window !== 'undefined' ? window : globalThis);
