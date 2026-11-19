(function (root) {
  'use strict';

  // This controller is an isolated, in-memory prototype. It never reads or writes
  // learning progress, storage, the DOM, audio, timers, or network resources.
  const SNAPSHOT_KIND = 'RoomAdventurePrototype';
  const SNAPSHOT_VERSION = 1;
  const DEFAULT_FLOOR_ITEMS = ['toy-car', 'teddy', 'dirty-shirt'];
  const DEFAULT_FLOOR_PLACES = {
    'toy-car': ['toybox'], teddy: ['toybox'], 'dirty-shirt': ['laundry']
  };
  const FLOOR_WHY = {
    'toy-car': 'Машинке удобнее в ящике для игрушек.',
    teddy: 'Мишка ждёт следующей игры в ящике для игрушек.',
    'dirty-shirt': 'Футболка после спорта по условию нуждается в стирке.'
  };

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  function ids(values) {
    if (!Array.isArray(values)) return [];
    return Array.from(new Set(values.filter(value => typeof value === 'string' && value)));
  }
  function own(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

  function create(data, emit) {
    if (data && data.episode === 'tidy') return root.RoomTidyLogic.create(data, emit);
    data = data || {};
    const sourcePool = data.pool || data.poolQuest ||
      (Array.isArray(data.quests) && data.quests.find(q => q.id === 'life.sport.pool'));
    if (!sourcePool || !Array.isArray(sourcePool.required) || sourcePool.required.length === 0) {
      throw new Error('RoomAdventure needs the reviewed life.sport.pool metadata.');
    }
    const required = ids(sourcePool.required);
    const optional = ids(sourcePool.optional).filter(id => !required.includes(id));
    const packable = required.concat(optional);
    const poolItems = ids(packable.concat(sourcePool.distractors || []));
    const poolWhy = Object.assign({}, sourcePool.why || {});
    const floor = data.floor || {};
    const floorItems = ids(floor.items || floor.itemIds || DEFAULT_FLOOR_ITEMS);
    const accepted = {};
    const floorWhy = Object.assign({}, FLOOR_WHY, floor.why || {});
    floorItems.forEach(id => {
      const allowed = floor.accepted && own(floor.accepted, id) ? floor.accepted[id] : DEFAULT_FLOOR_PLACES[id];
      accepted[id] = ids(allowed);
      if (!accepted[id].length) throw new Error('No reviewed floor destination for ' + id);
    });
    if (!floorItems.length || !required.length) throw new Error('The prototype needs floor and pool items.');

    const intro = 'До бассейна успеем помочь комнате. Освободи дорожку для робота.';
    let state = initialState();

    function initialState() {
      return {
        stage: 'floor', placements: {}, blanket: [false, false], pillow: false,
        packed: [], zip: false, message: intro, messages: [intro]
      };
    }
    function floorDone(value) {
      return floorItems.every(id => accepted[id].includes(value.placements[id]));
    }
    function bedDone(value) { return value.blanket.every(Boolean) && value.pillow; }
    function bagReady(value) { return required.every(id => value.packed.includes(id)); }
    function stageFor(value) {
      if (!floorDone(value)) return 'floor';
      if (!bedDone(value)) return 'bed';
      return value.zip && bagReady(value) ? 'done' : 'bag';
    }
    function remember(message) {
      state.message = message;
      state.messages = state.messages.concat(message).slice(-6);
    }
    function result(acceptedAction, fromStage, message, effect, action, payload) {
      const stageChanged = acceptedAction && fromStage !== state.stage;
      remember(message);
      const response = {accepted: acceptedAction, stageChanged, message, effect};
      if (acceptedAction && typeof emit === 'function') {
        // The stage changes immediately; a renderer can finish the outgoing
        // animation using fromStage before moving its camera to event.stage.
        emit({
          type: action, payload: copy(payload || {}), fromStage,
          stage: state.stage, stageChanged, message, effect, state: copy(state)
        });
      }
      return response;
    }
    function reject(fromStage, message, effect) {
      return result(false, fromStage, message, effect || 'return');
    }
    function act(action, payload) {
      // Accept both act('pack', {id}) and act({type:'pack', id}) so pointer and
      // keyboard adapters can share the same deterministic interaction path.
      if (isObject(action)) {
        payload = isObject(action.payload) ? action.payload : action;
        action = action.type;
      }
      payload = isObject(payload) ? payload : {};
      const fromStage = state.stage;
      if (state.stage === 'done') {
        return reject(fromStage, 'Всё готово! Робот отправился в бассейн.', 'noop');
      }

      if (action === 'dropFloor') {
        if (state.stage !== 'floor') return reject(fromStage, 'Дорожка уже свободна. Продолжим наше дело.', 'noop');
        const id = payload.id, zone = payload.zone;
        if (!floorItems.includes(id)) return reject(fromStage, 'Этой вещи сейчас нет на дорожке.');
        if (own(state.placements, id)) return reject(fromStage, 'Эта вещь уже на своём месте.', 'noop');
        if (!accepted[id].includes(zone)) {
          return reject(fromStage, floorWhy[id] || 'Подумай, для чего нужна эта вещь и где её будет удобно найти.');
        }
        state.placements[id] = zone;
        state.stage = stageFor(state);
        const message = state.stage === 'bed'
          ? 'Дорожка свободна! Поможем кровати: подтяни одеяло и положи подушку.'
          : 'Есть! Роботу стало просторнее.';
        return result(true, fromStage, message, 'floor-place', action, {id, zone});
      }

      if (action === 'corner') {
        if (state.stage !== 'bed') return reject(fromStage, 'Сначала освободим дорожку для робота.', 'noop');
        const index = payload.index;
        if (index !== 0 && index !== 1) return reject(fromStage, 'Потяни за один из двух уголков одеяла.');
        if (state.blanket[index]) return reject(fromStage, 'Этот уголок уже расправлен.', 'noop');
        state.blanket[index] = true;
        state.stage = stageFor(state);
        return result(true, fromStage, bedMessage(), 'blanket-pull', action, {index});
      }

      if (action === 'pillow') {
        if (state.stage !== 'bed') return reject(fromStage, 'Подушка подождёт, пока освободим дорожку.', 'noop');
        if (state.pillow) return reject(fromStage, 'Подушка уже на месте.', 'noop');
        state.pillow = true;
        state.stage = stageFor(state);
        return result(true, fromStage, bedMessage(), 'pillow-place', action, {});
      }

      if (action === 'pack') {
        if (state.stage !== 'bag') return reject(fromStage, 'Сумкой займёмся, когда комната будет готова.', 'noop');
        const id = payload.id;
        if (typeof id !== 'string' || !poolItems.includes(id)) return reject(fromStage, 'Выбери вещь рядом с сумкой.');
        if (state.packed.includes(id)) return reject(fromStage, 'Эта вещь уже в сумке.', 'noop');
        if (!packable.includes(id)) {
          return reject(fromStage, poolWhy[id] || 'Эта вещь не нужна по сегодняшней памятке бассейна.');
        }
        state.packed.push(id);
        const message = bagReady(state)
          ? 'Можно закрывать сумку. Проведи бегунок молнии до конца!'
          : optional.includes(id) ? 'Можно взять и это. Проверим остальное по памятке.' : 'В сумку! Что ещё нужно по памятке?';
        return result(true, fromStage, message, 'bag-pack', action, {id});
      }

      if (action === 'unpack') {
        if (state.stage !== 'bag') return reject(fromStage, 'Сейчас сумка ещё не открыта.', 'noop');
        const id = payload.id;
        if (!state.packed.includes(id)) return reject(fromStage, 'Этой вещи сейчас нет в сумке.', 'noop');
        state.packed = state.packed.filter(value => value !== id);
        return result(true, fromStage, 'Достали. Можно ещё раз свериться с памяткой.', 'bag-unpack', action, {id});
      }

      if (action === 'zip') {
        if (state.stage !== 'bag') return reject(fromStage, 'Сначала подготовим комнату и соберём сумку.', 'noop');
        if (!bagReady(state)) {
          return reject(fromStage, 'В сумке пока не всё из памятки. Загляни в неё и попробуй ещё.');
        }
        state.zip = true;
        state.stage = 'done';
        return result(true, fromStage, 'Комната готова, сумка собрана. Вперёд, в бассейн!', 'zip-close', action, {});
      }

      return reject(fromStage, 'Попробуй передвинуть вещь или потянуть за отмеченную ручку.', 'noop');
    }

    function bedMessage() {
      if (state.stage === 'bag') return 'Кровать готова! Теперь соберём отдельную сумку в бассейн.';
      if (state.blanket.every(Boolean)) return 'Одеяло расправлено. Подушке тоже нужно место.';
      return state.pillow ? 'Подушка на месте. Расправим одеяло.' : 'Одеяло расправляется!';
    }

    function snapshot() {
      return {
        kind: SNAPSHOT_KIND, version: SNAPSHOT_VERSION,
        state: {
          stage: state.stage, placements: copy(state.placements),
          blanket: state.blanket.slice(), pillow: state.pillow,
          packed: state.packed.slice(), zip: state.zip
        }
      };
    }
    function restore(saved) {
      // A widget may keep this optional snapshot in memory. Only compatible,
      // reachable prototype states are accepted; unrelated progress is ignored.
      const invalid = () => ({accepted: false, stageChanged: false,
        message: 'Эта сохранённая игра не подходит к прототипу.', effect: 'noop'});
      if (!isObject(saved) || saved.kind !== SNAPSHOT_KIND || saved.version !== SNAPSHOT_VERSION || !isObject(saved.state)) return invalid();
      const value = saved.state;
      if (!isObject(value.placements) || !Array.isArray(value.blanket) || value.blanket.length !== 2 ||
          value.blanket.some(bit => typeof bit !== 'boolean') || typeof value.pillow !== 'boolean' ||
          !Array.isArray(value.packed) || typeof value.zip !== 'boolean') return invalid();
      if (Object.keys(value.placements).some(id => !floorItems.includes(id) || !accepted[id].includes(value.placements[id]))) return invalid();
      if (value.packed.some(id => typeof id !== 'string' || !packable.includes(id)) || new Set(value.packed).size !== value.packed.length) return invalid();
      if (!floorDone(value) && (value.blanket.some(Boolean) || value.pillow || value.packed.length || value.zip)) return invalid();
      if (!bedDone(value) && (value.packed.length || value.zip)) return invalid();
      if (value.zip && !bagReady(value)) return invalid();
      if (stageFor(value) !== value.stage) return invalid();
      const fromStage = state.stage;
      state = {
        stage: value.stage, placements: copy(value.placements),
        blanket: value.blanket.slice(), pillow: value.pillow,
        packed: value.packed.slice(), zip: value.zip,
        message: '', messages: []
      };
      return result(true, fromStage, 'Продолжим с того же места.', 'restore', 'restore', {});
    }
    function reset() {
      const fromStage = state.stage;
      state = initialState();
      return result(true, fromStage, intro, 'reset', 'reset', {});
    }

    // Both accessors return detached copies. Rendering cannot accidentally
    // advance the game or modify the next accepted drop.
    return Object.freeze({
      get state() { return copy(state); }, getState: () => copy(state),
      act, snapshot, restore, reset
    });
  }

  root.RoomAdventure = Object.freeze({create, snapshotVersion: SNAPSHOT_VERSION});
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RoomAdventure;
})(typeof window !== 'undefined' ? window : globalThis);
