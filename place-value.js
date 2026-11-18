(function (root) {
  'use strict';
  function max() { return root.MathRange ? root.MathRange.MAX : 1000; }

  // A presentation layer over the existing engines. It never changes a task,
  // progression criterion, saved session, or the supplied model.
  function engineReady(K) {
    if (!K || typeof K.empty !== 'function' || typeof K.total !== 'function' ||
        typeof K.move !== 'function' || typeof K.exchange !== 'function' || typeof K.parts !== 'function' ||
        !K.values || K.values.unit !== 1 || K.values.ten !== 10 || K.values.hundred !== 100) {
      throw new TypeError('A compatible existing mathematics engine is required');
    }
  }

  function model(p, K) {
    engineReady(K);
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new TypeError('Expected a quantity model');
    var result = K.empty();
    Object.keys(K.values).forEach(function (type) {
      var n = p[type] === undefined ? 0 : p[type];
      if (!Number.isInteger(n) || n < 0) throw new RangeError('Piece counts must be non-negative integers');
      result[type] = n;
    });
    if (K.total(result) > max()) throw new RangeError('The model exceeds the board limit');
    return result;
  }

  function cloneZones(zones, K) {
    return { a: model(zones.a, K), b: model(zones.b, K), removed: model(zones.removed, K) };
  }

  function groupedText(hundreds, tens, units) {
    var result = [];
    if (hundreds) result.push(hundreds + 'С');
    if (hundreds || tens) result.push(tens + 'Д');
    result.push(units + 'Е');
    return result.join(' + ');
  }

  function expandedText(hundreds, tens, units) {
    var result = [];
    if (hundreds) result.push(String(hundreds * 100));
    if (hundreds || tens) result.push(String(tens * 10));
    result.push(String(units));
    return result.join(' + ');
  }

  function describe(p, K) {
    var current = model(p, K);
    var hundreds = current.hundred, tens = current.ten;
    var looseUnits = Object.keys(K.values).reduce(function (sum, type) {
      return K.values[type] < 10 ? sum + current[type] * K.values[type] : sum;
    }, 0);
    var total = K.total(current);
    var standardHundreds = Math.floor(total / 100);
    var standardTens = Math.floor(total / 10) % 10;
    var standardUnits = total % 10;
    return {
      hundreds: hundreds,
      tens: tens,
      looseUnits: looseUnits,
      total: total,
      actualText: groupedText(hundreds, tens, looseUnits),
      expandedText: expandedText(hundreds, tens, looseUnits),
      canonicalText: total === 1000 ? '1 тысяча · 0С + 0Д + 0Е' : groupedText(standardHundreds, standardTens, standardUnits),
      canonicalExpandedText: total === 1000 ? '1000 + 0 + 0 + 0' : expandedText(standardHundreds, standardTens, standardUnits),
      boundary: total === 1000,
      boundaryText: total === 1000 ? '10 сотен — одна тысяча. В записи 1000 появляется следующий разряд.' : '',
      digits: { thousands: Math.floor(total / 1000), hundreds: standardHundreds % 10, tens: standardTens, units: standardUnits },
      isCanonical: typeof K.canonical === 'function' ? !!K.canonical(current) : tens < 10 && looseUnits < 10
    };
  }

  // This is render-only policy, not evidence of mastery or a new progress field.
  // Each piece remains visible/countable even when aggregate numeric labels hide.
  function visibility(context) {
    var value = typeof context === 'string' ? { context: context } : context || {};
    var explicit = value.context;
    var name = explicit === 'reviewed' || value.solved === true ? 'reviewed' :
      explicit === 'teaching' || value.view === 'workshop' || value.mode === 'learn' ? 'teaching' : 'independent';
    var revealed = name !== 'independent';
    var frame = value.frame || null;
    return {
      context: name,
      showTotal: revealed && !(frame && frame.showTotal === false),
      showRepresentation: revealed && !(frame && frame.showRepresentation === false),
      showCanonical: revealed && !(frame && frame.showCanonical === false),
      showPieceValues: true,
      showLessonRule: revealed
    };
  }

  function assess(p, target, goal, K) {
    if (!Number.isInteger(target) || target < 0 || target > max()) throw new RangeError('Target is outside the board range');
    if (goal !== 'quantity' && goal !== 'canonical') throw new TypeError('Specify quantity or canonical as the exercise goal');
    var description = describe(p, K);
    var quantityCorrect = description.total === target;
    var representationCorrect = description.isCanonical;
    return {
      goal: goal,
      total: description.total,
      quantityCorrect: quantityCorrect,
      representationCorrect: representationCorrect,
      correct: quantityCorrect && (goal === 'quantity' || representationCorrect)
    };
  }

  function unitsOnly(n, K) {
    engineReady(K);
    if (!Number.isInteger(n) || n < 0 || n > max()) throw new RangeError('Expected an integer within the board range');
    // Do not derive a transformation from its result. This helper is used only
    // to display a given starting number with the established 1/10/100 pieces.
    return model(K.parts(n, { unitsOnly: true }), K);
  }

  function quantityName(n, singular, few, many) {
    var mod100 = n % 100, mod10 = n % 10;
    return n + ' ' + (mod100 >= 11 && mod100 <= 14 ? many : mod10 === 1 ? singular : mod10 >= 2 && mod10 <= 4 ? few : many);
  }
  function unitName(n) { return quantityName(n, 'единицу', 'единицы', 'единиц'); }
  function tenName(n) { return quantityName(n, 'десяток', 'десятка', 'десятков'); }
  function hundredName(n) { return quantityName(n, 'сотню', 'сотни', 'сотен'); }

  /*
   * explanation(task, K) -> { initial, transformations, final }
   *
   * Every transformation contains the state AFTER a real engine operation;
   * .before/.after retain its exact quantities. .actionLabel describes the NEXT
   * operation. Root UI keeps the existing persisted step 0/1/2 and can display
   * transformations inside step 1 with a transient frame index. Nothing here
   * reads/writes localStorage, changes the source task, or constrains play paths.
   *
   * .showTotal hides the computed answer during addition/after subtraction;
   * exchange during subtraction may show the already-known original quantity.
   */
  function explanation(task, K) {
    engineReady(K);
    if (!task || typeof task !== 'object') throw new TypeError('Expected an existing arithmetic task');
    var a = task.a, b = task.b, op = task.op === '−' ? '-' : task.op;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > max() || b > max() || (op !== '+' && op !== '-')) {
      throw new RangeError('Unsupported arithmetic task');
    }
    var result = op === '+' ? a + b : a - b;
    if (result < 0 || result > max() || (task.result !== undefined && task.result !== result)) throw new RangeError('The task has an invalid result');
    var zones = { a: unitsOnly(a, K), b: op === '+' ? unitsOnly(b, K) : K.empty(), removed: K.empty() };
    var initialZones = cloneZones(zones, K);
    var conserved = op === '+' ? a + b : a;
    var transformations = [];
    var totalAcross = function (value) { return K.total(value.a) + K.total(value.b) + K.total(value.removed); };
    var expression = function (final) { return a + ' ' + (op === '+' ? '+' : '−') + ' ' + b + ' = ' + (final ? result : '?'); };

    function record(operation, label, caption, action, showTotal, perform) {
      var before = cloneZones(zones, K), actions = [];
      perform(actions);
      var after = cloneZones(zones, K);
      if (totalAcross(before) !== conserved || totalAcross(after) !== conserved) throw new Error('A transformation changed the total quantity');
      transformations.push({
        operation: operation, phase: 'transform', step: 1,
        label: label, caption: caption, actionLabel: '', performedActionLabel: action,
        zones: after, before: before, after: cloneZones(after, K), actions: actions,
        showTotal: showTotal, showRepresentation: true, showCanonical: false,
        expressionText: expression(false)
      });
    }
    function move(from, to, type, count, actions) {
      for (var i = 0; i < count; i++) {
        if (!K.move(zones, from, to, type)) throw new Error('The existing engine rejected a required move');
      }
      if (count) actions.push({ kind: 'move', from: from, to: to, type: type, count: count, value: K.values[type] * count });
    }
    function exchange(action, actions) {
      var before = K.total(zones.a);
      if (!K.exchange(zones.a, action) || K.total(zones.a) !== before) throw new Error('The existing engine rejected or changed the quantity of an exchange');
      actions.push({ kind: 'exchange', zone: 'a', action: action });
    }

    var initialCaption;
    if (op === '+') {
      initialCaption = 'Вот две группы. Добавим вторую к первой, сохраняя все предметы.';
      record('join', 'Добавили вторую группу', 'Теперь все предметы вместе. Посмотри, сколько десятков и отдельных единиц получилось.',
        b < 10 ? 'Добавить ' + unitName(b) : 'Добавить второе число', false, function (actions) {
          ['hundred', 'ten', 'unit'].forEach(function (type) { move('b', 'a', type, zones.b[type], actions); });
        });
      while (zones.a.unit >= 10) {
        record('pack', 'Собрали новый десяток', 'Ровно десять отдельных единиц стали одним десятком. Остальные предметы остались на месте. Количество не изменилось.',
          'Обменять 10 единиц на десяток', false, function (actions) { exchange('pack', actions); });
      }
      while (zones.a.ten >= 10) {
        record('pack100', 'Собрали сотню', 'Ровно десять десятков стали одной сотней. Количество не изменилось.',
          'Обменять 10 десятков на сотню', false, function (actions) { exchange('pack100', actions); });
      }
    } else {
      var remove = unitsOnly(b, K);
      if (zones.a.unit < remove.unit) {
        initialCaption = 'Нужно убрать ' + unitName(remove.unit) + ', а отдельных единиц только ' + zones.a.unit + '. Получим недостающие единицы разменом, ничего не добавляя.';
        if (zones.a.ten === 0) {
          record('split100', 'Разменяли сотню на десятки', 'Одна сотня стала десятью десятками. Общее количество осталось прежним.',
            'Разменять сотню на 10 десятков', true, function (actions) { exchange('split100', actions); });
        }
        record('split', 'Получили отдельные единицы', 'Один десяток стал десятью отдельными единицами. Своих единиц стало больше, но общее количество осталось прежним.',
          'Разменять один десяток на 10 единиц', true, function (actions) { exchange('split', actions); });
      } else initialCaption = 'Нужно убрать второе число. Для этого перенесём нужные десятки и единицы в область убранного.';
      if (zones.a.ten < remove.ten) {
        record('split100', 'Получили нужные десятки', 'Одна сотня стала десятью десятками. Общее количество осталось прежним.',
          'Разменять сотню на 10 десятков', true, function (actions) { exchange('split100', actions); });
      }
      if (remove.hundred) {
        record('remove-hundred', 'Убрали сотни', 'Перенесли ' + hundredName(remove.hundred) + ' в область убранного. Эти предметы больше не входят в остаток.',
          'Убрать ' + hundredName(remove.hundred), false, function (actions) { move('a', 'removed', 'hundred', remove.hundred, actions); });
      }
      if (remove.ten) {
        record('remove-ten', 'Убрали десятки', 'Перенесли ' + tenName(remove.ten) + ' в область убранного. Один десяток означает десять единиц.',
          'Убрать ' + tenName(remove.ten), false, function (actions) { move('a', 'removed', 'ten', remove.ten, actions); });
      }
      if (remove.unit) {
        record('remove-unit', 'Убрали единицы', 'Перенесли ' + unitName(remove.unit) + ' в область убранного. Теперь можно прочитать, что осталось.',
          'Убрать ' + unitName(remove.unit), false, function (actions) { move('a', 'removed', 'unit', remove.unit, actions); });
      }
      if (!b) {
        record('remove-zero', 'Ничего не убирали', 'Ноль означает, что ни один предмет убирать не нужно.',
          'Проверить действие с нулём', false, function () {});
      }
    }
    if (K.total(zones.a) !== result || !K.canonical(zones.a) || (op === '+' ? K.total(zones.b) !== 0 : K.total(zones.removed) !== b)) {
      throw new Error('The explained operations did not reach the valid existing-engine result');
    }
    transformations.forEach(function (frame, index) {
      frame.actionLabel = index + 1 < transformations.length ? transformations[index + 1].performedActionLabel : 'Показать результат';
      if (frame.operation === 'pack' || frame.operation === 'pack100' || frame.operation === 'split' || frame.operation === 'split100') {
        frame.conservationText = describe(frame.before.a, K).actualText + ' = ' + describe(frame.after.a, K).actualText + (frame.showTotal ? ' = ' + K.total(frame.after.a) : '');
      }
    });
    var initial = {
      operation: 'start', phase: 'initial', step: 0,
      label: op === '+' ? 'Какие количества складываем?' : 'Что есть и сколько нужно убрать?',
      caption: initialCaption, actionLabel: transformations[0].performedActionLabel,
      zones: initialZones, before: cloneZones(initialZones, K), after: cloneZones(initialZones, K), actions: [],
      showTotal: true, showRepresentation: true, showCanonical: false,
      expressionText: expression(false)
    };
    var finalZones = cloneZones(zones, K);
    var final = {
      operation: 'result', phase: 'final', step: 2,
      label: 'Что получилось?', caption: 'Ответ: ' + result + '. ' + describe(zones.a, K).actualText + ' = ' + result + '.' + (result === 1000 ? ' ' + describe(zones.a, K).boundaryText : ''),
      actionLabel: 'Попробовать самому',
      zones: finalZones, before: cloneZones(finalZones, K), after: cloneZones(finalZones, K), actions: [],
      showTotal: true, showRepresentation: true, showCanonical: true,
      expressionText: expression(true)
    };
    return { initial: initial, transformations: transformations, final: final };
  }

  root.PlaceValue = { describe: describe, visibility: visibility, assess: assess, unitsOnly: unitsOnly, explanation: explanation };
})(typeof window === 'undefined' ? globalThis : window);
