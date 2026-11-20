(function (root) {
  'use strict';

  const data = root.RoomLevelsData || (typeof require === 'function' ? require('./room-levels-data.js') : null);
  const snapshotVersion = 1;
  const historyLimit = 20;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keysAre = (value, keys) => object(value) && Object.keys(value).length === keys.length &&
    keys.every(key => own(value, key));
  const empty = () => ({placements: {}, selected: []});
  const copy = draft => ({placements: {...draft.placements}, selected: draft.selected.slice()});

  function matches(item, target) {
    if (target.accepts) return target.accepts.includes(item.id);
    return Object.entries(target.match).every(([key, value]) => item[key] === value) &&
      (target.maxStuds === undefined || item.studs <= target.maxStuds);
  }

  function check(stage, draft) {
    if (stage.type === 'selection') {
      const extra = stage.items.find(item => draft.selected.includes(item.id) && !stage.required.includes(item.id));
      if (extra) return 'Проверь карточку «' + extra.label + '». ' + stage.wrong;
      if (stage.required.some(id => !draft.selected.includes(id))) return 'Нужны ещё вещи. Сверь расписание и памятку.';
      return '';
    }

    if (stage.type === 'placement') {
      const wrong = stage.items.find(item => {
        const target = stage.targets.find(entry => entry.id === draft.placements[item.id]);
        return target && !matches(item, target);
      });
      if (wrong) return 'Проверь «' + wrong.label + '». ' + stage.wrong;
    }

    const required = stage.required || stage.items.map(item => item.id);
    const missing = required.filter(id => !own(draft.placements, id)).length;
    if (missing) {
      if (stage.type === 'sequence') return 'У каждого шага должно быть место в плане.';
      if (stage.required) return 'Добавь в сумки остальные нужные вещи. Сверь памятку.';
      return 'На столе ещё есть вещи. Найди место для каждой.';
    }

    if (stage.type === 'sequence') {
      const position = id => stage.targets.find(target => target.id === draft.placements[id]).row;
      const broken = stage.before.find(([earlier, later]) => position(earlier) >= position(later));
      if (broken) return broken[2];
    }
    return '';
  }

  function validDraft(stage, draft) {
    if (!keysAre(draft, ['placements', 'selected']) || !object(draft.placements) || !Array.isArray(draft.selected)) return false;
    const placements = Object.entries(draft.placements);
    const knownItem = id => stage.items.some(item => item.id === id);
    if (stage.type === 'selection') {
      return placements.length === 0 && draft.selected.length <= stage.items.length &&
        new Set(draft.selected).size === draft.selected.length && Array.from(draft.selected).every(knownItem);
    }
    if (draft.selected.length > 0 || placements.length > stage.items.length) return false;
    return placements.every(([id, targetId]) => {
      const target = stage.targets.find(entry => entry.id === targetId);
      if (!knownItem(id) || !target) return false;
      return target.capacity === undefined || placements.filter(([, place]) => place === targetId).length <= target.capacity;
    });
  }

  function create(levelId, variant = 'base') {
    if (typeof levelId !== 'string' || typeof variant !== 'string' || !own(data.levels, levelId)) return null;
    const level = data.levels[levelId];
    const stages = variant === 'base' ? level.stages : level.variants && own(level.variants, variant) && level.variants[variant];
    if (!stages) return null;

    let finished = [];
    let draft = empty();
    let submitted = false;
    let feedback = null;
    let history = [];
    const stageIndex = () => finished.length;
    const stage = () => stages[stageIndex()];
    const complete = () => submitted && stageIndex() === stages.length - 1 && !check(stage(), draft);

    function say(kind, text) {
      feedback = {kind, text};
      return true;
    }

    function update(next) {
      history.push(draft);
      if (history.length > historyLimit) history.shift();
      draft = next;
      feedback = null;
      return true;
    }

    function drop(itemId, targetId) {
      const target = stage().targets.find(entry => entry.id === targetId);
      const previousId = draft.placements[itemId];
      if (!target || target.id === previousId) return false;

      const next = copy(draft);
      if (target.capacity === 1) {
        const occupant = Object.keys(next.placements).find(id => next.placements[id] === target.id);
        if (occupant) {
          if (previousId) next.placements[occupant] = previousId;
          else delete next.placements[occupant];
        }
      }
      next.placements[itemId] = target.id;
      return update(next);
    }

    function act(name, payload = {}) {
      if (name === 'hint') return say('hint', stage().hint);
      if (name === 'next' && submitted && !complete()) {
        finished.push(draft);
        draft = empty();
        submitted = false;
        feedback = null;
        history = [];
        return true;
      }
      if (submitted) return false;
      if (name === 'check') {
        const problem = check(stage(), draft);
        if (problem) return say('error', problem);
        submitted = true;
        return say('success', complete() ? 'Задание выполнено!' : 'Всё верно. Следующий шаг готов.');
      }
      if (name === 'undo' && history.length) {
        draft = history.pop();
        return say('info', 'Последнее действие отменено.');
      }
      const item = payload && stage().items.find(entry => entry.id === payload.itemId);
      if (!item) return false;
      if (stage().type === 'selection') {
        if (name !== 'choose') return false;
        const selected = draft.selected.includes(item.id) ?
          draft.selected.filter(id => id !== item.id) : draft.selected.concat(item.id);
        return update({placements: {}, selected});
      }
      if (name === 'drop') return drop(item.id, payload.targetId);
      if (name === 'remove' && own(draft.placements, item.id)) {
        const next = copy(draft);
        delete next.placements[item.id];
        return update(next);
      }
      return false;
    }

    function snapshot() {
      return {
        version: snapshotVersion, levelId, variant, finished: finished.map(copy),
        draft: copy(draft), submitted, history: history.map(copy)
      };
    }

    function restore(saved) {
      if (!keysAre(saved, ['version', 'levelId', 'variant', 'finished', 'draft', 'submitted', 'history']) ||
          saved.version !== snapshotVersion || saved.levelId !== levelId || saved.variant !== variant ||
          !Array.isArray(saved.finished) || saved.finished.length >= stages.length ||
          typeof saved.submitted !== 'boolean' || !Array.isArray(saved.history) || saved.history.length > historyLimit) return false;
      const current = stages[saved.finished.length];
      if (Array.from(saved.finished).some((record, index) => !validDraft(stages[index], record) || check(stages[index], record)) ||
          !validDraft(current, saved.draft) || (saved.submitted && check(current, saved.draft)) ||
          Array.from(saved.history).some(record => !validDraft(current, record))) return false;
      finished = saved.finished.map(copy);
      draft = copy(saved.draft);
      submitted = saved.submitted;
      history = saved.history.map(copy);
      feedback = submitted ? {kind: 'success', text: complete() ? 'Задание выполнено!' : 'Всё верно. Следующий шаг готов.'} : null;
      return true;
    }

    function reset() {
      finished = [];
      draft = empty();
      submitted = false;
      feedback = null;
      history = [];
    }

    return Object.freeze({
      level, stages, variant, act, snapshot, restore, reset,
      availableItems() {
        return stage().items.filter(item => !own(draft.placements, item.id));
      },
      get state() {
        return {
          stageIndex: stageIndex(), complete: complete(), submitted, ...copy(draft),
          feedback: feedback && {...feedback}, canUndo: !submitted && history.length > 0
        };
      }
    });
  }

  const api = Object.freeze({create, snapshotVersion});
  root.RoomLevelsLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
