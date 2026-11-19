(function (root) {
  'use strict';
  const KIND = 'RoomTidyAdventure';
  const VERSION = 1;
  const HISTORY_LIMIT = 20;
  const D = root.RoomTidyData || (typeof require === 'function' ? require('./room-tidy-data.js') : null);
  if (!D) throw new Error('Load RoomTidyData before RoomTidyLogic.');
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));
  const keysAre = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => own(value, key));
  const CORE_KEYS = ['episode', 'stage', 'search', 'found', 'garage', 'lego', 'clothes', 'rule', 'realGoal', 'selfReported'];
  function lookup(items, value) { return typeof value === 'string' ? items.find(item => item.id === value) : value; }
  function slotAccepts(car, slot, rule) {
    car = lookup(D.cars, car); slot = lookup(D.slots, slot);
    if (!car || !slot || !D.rules.includes(rule)) return false;
    // Match metadata from the reviewed catalog rather than trusting supplied attributes.
    const reviewedCar = D.cars.find(item => item.id === car.id);
    const reviewedSlot = D.slots.find(item => item.id === slot.id);
    if (!reviewedCar || !reviewedSlot) return false;
    if (rule === 'color') return D.colors[reviewedSlot.col] === reviewedCar.color;
    return (rule === 'type' ? D.types : D.sizes)[reviewedSlot.row] === reviewedCar[rule];
  }
  function complete(items, placed) { return items.every(item => own(placed, item.id)); }
  function searchDone(value) { return value.found && complete(D.searchItems, value.search); }
  function stageFor(value) {
    if (!searchDone(value)) return 'search';
    if (!complete(D.cars, value.garage)) return 'garage';
    if (!complete(D.legoItems, value.lego)) return 'lego';
    return complete(D.clothesItems, value.clothes) ? 'done' : 'clothes';
  }
  function exposed(value, item) {
    return !D.searchItems.some(cover => cover.covers === item.id && !own(value.search, cover.id));
  }
  function availableItems(value, limit) {
    if (value && value.state) value = value.state;
    if (!object(value)) return [];
    const items = value.stage === 'search' ? D.searchItems : value.stage === 'garage' ? D.cars :
      value.stage === 'lego' ? D.legoItems : value.stage === 'clothes' ? D.clothesItems : [];
    const placed = value.stage === 'garage' ? value.garage : value[value.stage];
    const maximum = Number.isInteger(limit) && limit >= 0 ? limit : 3;
    const ids = items.filter(item => !own(placed || {}, item.id) && (value.stage !== 'search' || exposed(value, item))).map(item => item.id);
    if (value.stage === 'search') {
      if (!value.found && own(value.search, 'dirty-shirt') && own(value.search, 'loose-brick')) ids.push(D.targetId);
      return ids;
    }
    return ids.slice(0, maximum);
  }
  function initial(rule) {
    return {episode: 'tidy', stage: 'search', search: {}, found: false, garage: {}, lego: {}, clothes: {},
      rule: D.rules.includes(rule) ? rule : 'color', realGoal: null, selfReported: false};
  }
  function core(value) { const result = {}; CORE_KEYS.forEach(key => { result[key] = copy(value[key]); }); return result; }
  function validPlacements(value, items) {
    return object(value) && Object.keys(value).every(id => {
      const item = items.find(entry => entry.id === id);
      return item && typeof value[id] === 'string' && item.zones.includes(value[id]);
    });
  }
  function validCore(value) {
    if (!keysAre(value, CORE_KEYS) || value.episode !== 'tidy' || !D.rules.includes(value.rule) ||
        typeof value.found !== 'boolean' || typeof value.selfReported !== 'boolean' ||
        !(value.realGoal === null || D.realGoals.some(goal => goal.id === value.realGoal)) ||
        !validPlacements(value.search, D.searchItems) || !validPlacements(value.lego, D.legoItems) ||
        !validPlacements(value.clothes, D.clothesItems) || !object(value.garage)) return false;
    if (own(value.search, 'loose-brick') && !own(value.search, 'dirty-shirt')) return false;
    if (value.found && (!own(value.search, 'dirty-shirt') || !own(value.search, 'loose-brick'))) return false;
    if (Object.keys(value.garage).some(id => typeof value.garage[id] !== 'string' || !D.cars.some(car => car.id === id) || !slotAccepts(id, value.garage[id], value.rule)) ||
        new Set(Object.values(value.garage)).size !== Object.keys(value.garage).length) return false;
    if (!searchDone(value) && (Object.keys(value.garage).length || Object.keys(value.lego).length || Object.keys(value.clothes).length)) return false;
    if (!complete(D.cars, value.garage) && (Object.keys(value.lego).length || Object.keys(value.clothes).length)) return false;
    if (!complete(D.legoItems, value.lego) && Object.keys(value.clothes).length) return false;
    if (stageFor(value) !== value.stage || (value.selfReported && (value.stage !== 'done' || value.realGoal === null))) return false;
    return true;
  }
  function same(a, b) {
    if (a === b) return true;
    if (!object(a) || !object(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => own(b, key) && same(a[key], b[key]));
  }
  function nextCore(before, action, payload) {
    const next = copy(before), id = payload.id;
    if (action === 'drop') {
      const items = before.stage === 'search' ? D.searchItems : before.stage === 'lego' ? D.legoItems : before.stage === 'clothes' ? D.clothesItems : [];
      const item = items.find(entry => entry.id === id), placed = next[before.stage];
      if (!item || own(placed, id) || !item.zones.includes(payload.zone) || (before.stage === 'search' && !exposed(before, item))) return null;
      placed[id] = payload.zone;
    } else if (action === 'find') {
      if (before.stage !== 'search' || id !== D.targetId || before.found || !own(before.search, 'dirty-shirt') || !own(before.search, 'loose-brick')) return null;
      next.found = true;
    } else if (action === 'park') {
      if (before.stage !== 'garage' || own(before.garage, id) || Object.values(before.garage).includes(payload.slot) || !slotAccepts(id, payload.slot, before.rule)) return null;
      next.garage[id] = payload.slot;
    } else if (action === 'real-goal') {
      if (!D.realGoals.some(goal => goal.id === id) || before.realGoal === id) return null;
      next.realGoal = id; next.selfReported = false;
    } else if (action === 'real-done') {
      if (before.stage !== 'done' || before.realGoal === null || before.selfReported) return null;
      next.selfReported = true;
    } else return null;
    next.stage = stageFor(next);
    return next;
  }
  // A history entry must really be the immediate predecessor of the next one.
  function adjacent(before, after) {
    const attempts = [];
    const map = before.stage === 'garage' ? after.garage : after[before.stage];
    if (before.stage === 'garage') Object.keys(map).forEach(id => { if (!own(before.garage, id)) attempts.push(['park', {id, slot: map[id]}]); });
    else if (['search', 'lego', 'clothes'].includes(before.stage)) Object.keys(map).forEach(id => { if (!own(before[before.stage], id)) attempts.push(['drop', {id, zone: map[id]}]); });
    attempts.push(['find', {id: D.targetId}], ['real-goal', {id: after.realGoal}], ['real-done', {}]);
    return attempts.some(pair => { const next = nextCore(before, pair[0], pair[1]); return next && same(next, after); });
  }
  function create(options, emit) {
    options = object(options) ? options : {};
    let state = initial(options.rule), history = [], messages = [], ruleLocked = false;
    const intro = 'На полу спряталась любимая красная машинка. Убери вещи и найди её!';
    let message = intro;
    function result(accepted, fromStage, text, effect, action, payload) {
      message = text; messages = messages.concat(text).slice(-6);
      const response = {accepted, stageChanged: accepted && fromStage !== state.stage, message: text, effect};
      if (accepted && typeof emit === 'function') emit(Object.assign({type: action, payload: copy(payload || {}), fromStage, stage: state.stage, state: getState()}, response));
      return response;
    }
    function getState() { return Object.assign(copy(state), {history: copy(history), message, messages: messages.slice()}); }
    function reject(fromStage, text) { return result(false, fromStage, text, 'return'); }
    function fresh() { return !ruleLocked && !state.found && !Object.keys(state.search).length && !Object.keys(state.garage).length && !Object.keys(state.lego).length && !Object.keys(state.clothes).length && !history.length && state.realGoal === null; }
    function act(action, payload) {
      if (object(action)) { payload = object(action.payload) ? action.payload : action; action = action.type; }
      payload = object(payload) ? payload : {};
      const fromStage = state.stage;
      if (action === 'undo') {
        if (!history.length) return reject(fromStage, 'Пока нечего возвращать.');
        state = history.pop();
        return result(true, fromStage, 'Вернули последний шаг. Можно попробовать по-другому.', 'undo', action, {});
      }
      if (action === 'rule') {
        if (!fresh()) return reject(fromStage, 'Правило выбираем до начала игры. Для другого правила начни заново.');
        if (!D.rules.includes(payload.rule)) return reject(fromStage, 'Выбери цвет, вид или размер машинок.');
        if (payload.rule === state.rule) return reject(fromStage, 'Это правило уже выбрано.');
        state.rule = payload.rule;
        return result(true, fromStage, 'Выбрали правило для всего гаража.', 'rule', action, {rule: payload.rule});
      }
      const next = nextCore(state, action, payload);
      if (!next) {
        let text = 'Выбери вещь и подходящее ей место.';
        if (action === 'find') text = state.found ? 'Любимая машинка уже найдена.' : 'Машинку закрывают футболка и деталь. Сначала убери их.';
        else if (action === 'park') text = state.stage !== 'garage' ? 'Сначала найди любимую машинку и убери все пять вещей с пола.' : Object.values(state.garage).includes(payload.slot) ? 'Это место занято. Выбери другое подходящее место.' :
          state.rule === 'color' ? 'Сверь цвет машинки с цветом столбца гаража.' : state.rule === 'type' ? 'Сверь вид машинки со значком ряда: гоночная, внедорожник или рабочая.' : 'Сверь размер машинки с размером ряда: маленькая, средняя или большая.';
        else if (action === 'drop') {
          const items = state.stage === 'search' ? D.searchItems : state.stage === 'lego' ? D.legoItems : state.stage === 'clothes' ? D.clothesItems : [];
          const item = items.find(entry => entry.id === payload.id);
          if (item && own(state[state.stage], item.id)) text = 'Эта вещь уже на месте.';
          else if (item && state.stage === 'search' && !exposed(state, item)) text = 'Эту деталь закрывает футболка. Сначала убери верхнюю вещь.';
          else if (item && state.stage === 'lego') text = item.model ? 'Готовую модель сохраним целиком на полке.' : item.studs <= 4 ? 'У детали не больше четырёх пупырышек: ей в маленькие детали.' : 'У детали шесть или больше пупырышек: ей в крупные детали.';
          else if (item && state.stage === 'clothes') text = item.dirty ? 'Грязную одежду положим в корзину для стирки.' : item.kind === 'socks' ? 'Чистым носкам удобно в ящике.' : 'Чистую одежду можно аккуратно убрать в шкаф или ящик.';
          else if (item) text = {'dirty-shirt': 'Футболка грязная: положим её в корзину для стирки.',
            'loose-brick': 'Отдельной детали место в лотке для конструктора.', teddy: 'Мишке удобно ждать игры в ящике для игрушек.',
            'toy-car': 'Машинку поставим в свободный бокс гаража.', storybook: 'Книгу удобно найти на книжной полке.'}[item.id];
        } else if (action === 'real-done') text = state.stage !== 'done' ? 'Сначала закончи игру в комнате.' : state.realGoal === null ? 'Выбери маленькое дело в своей комнате.' : 'Ты уже отметил это дело.';
        else if (action === 'real-goal') text = 'Выбери одно маленькое дело из списка.';
        return reject(fromStage, text);
      }
      history = history.concat(core(state)).slice(-HISTORY_LIMIT); state = next; ruleLocked = true;
      const transitions = {garage: 'Любимая машинка найдена, пол свободен! Припаркуем машинки по одному правилу.', lego: 'Гараж готов! Разложим детали и сохраним готовые модели.', clothes: 'Конструктор на месте! Теперь уберём одежду с пола.', done: 'Комната готова! Можно выбрать маленькое дело в своей комнате.'};
      const text = state.stage !== fromStage ? transitions[state.stage] : action === 'find' ? 'Вот любимая машинка! Теперь уберём остальные вещи с пола.' : action === 'real-done' ? 'Ты сам отметил своё настоящее дело. Спасибо за заботу о комнате!' : action === 'real-goal' ? 'Выбрали маленькое настоящее дело. Отметить его можешь только ты.' : 'Есть! Вещь на своём месте.';
      return result(true, fromStage, text, action === 'drop' ? fromStage + '-place' : action, action, payload);
    }
    function snapshot() { return {kind: KIND, version: VERSION, episode: 'tidy', state: core(state), history: copy(history), ruleLocked}; }
    function restore(saved) {
      const fromStage = state.stage;
      const invalid = () => ({accepted: false, stageChanged: false, message: 'Эта сохранённая игра не подходит к уборке комнаты.', effect: 'noop'});
      if (!keysAre(saved, ['kind', 'version', 'episode', 'state', 'history', 'ruleLocked']) || saved.kind !== KIND || saved.version !== VERSION || saved.episode !== 'tidy' || typeof saved.ruleLocked !== 'boolean' ||
          !validCore(saved.state) || !Array.isArray(saved.history) || saved.history.length > HISTORY_LIMIT || !saved.history.every(validCore)) return invalid();
      const chain = saved.history.concat([saved.state]);
      if (chain.some((entry, index) => index && !adjacent(chain[index - 1], entry))) return invalid();
      if (!saved.ruleLocked && (saved.history.length || !same(saved.state, initial(saved.state.rule)))) return invalid();
      state = copy(saved.state); history = copy(saved.history); ruleLocked = saved.ruleLocked; messages = [];
      return result(true, fromStage, 'Продолжим уборку с того же места.', 'restore', 'restore', {});
    }
    function reset(nextOptions) {
      const fromStage = state.stage;
      state = initial(object(nextOptions) && D.rules.includes(nextOptions.rule) ? nextOptions.rule : state.rule);
      history = []; messages = []; ruleLocked = false;
      return result(true, fromStage, intro, 'reset', 'reset', {});
    }
    return Object.freeze({get state() { return getState(); }, getState, act, snapshot, restore, reset,
      availableItems: limit => availableItems(state, limit), slotAccepts: (car, slot) => slotAccepts(car, slot, state.rule)});
  }
  root.RoomTidyLogic = Object.freeze({create, slotAccepts, availableItems, snapshotVersion: VERSION, historyLimit: HISTORY_LIMIT});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RoomTidyLogic;
})(typeof window !== 'undefined' ? window : globalThis);
