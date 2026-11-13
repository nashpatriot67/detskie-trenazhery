(function (root) {
  'use strict';

  var audio = null;
  var active = null;
  var requestId = 0;
  var own = Object.prototype.hasOwnProperty;
  var messages = {
    missing: 'Для этого фрагмента ещё нет готовой озвучки.',
    unavailable: 'В этом браузере воспроизведение аудио недоступно.',
    hidden: 'Открой страницу тренажёра и нажми кнопку озвучки ещё раз.',
    playback: 'Не удалось включить озвучку. Проверь звук и нажми кнопку ещё раз.'
  };

  function normalize(text) {
    var result = String(text == null ? '' : text);
    if (result.normalize) result = result.normalize('NFC');
    return result.replace(/\s+/g, ' ').trim();
  }

  function call(callback, value) {
    if (typeof callback === 'function') {
      try { callback(value); } catch (ignore) { /* A UI callback must not interrupt cleanup. */ }
    }
  }

  function hidden() {
    return !!(root.document && (root.document.hidden || root.document.visibilityState === 'hidden'));
  }

  function validPath(path) {
    return typeof path === 'string' && path === path.trim() &&
      !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(path) &&
      !/[\\\s]/.test(path) && /\.mp3(?:[?#][^\s]*)?$/i.test(path);
  }

  function source(path) {
    if (!validPath(path)) return null;
    var base = root.VOICE_AUDIO_BASE || root.VOICE_BASE_URL;
    if (!base) return path;
    try {
      var URLClass = root.URL || (typeof URL !== 'undefined' ? URL : null);
      if (!URLClass) return null;
      var result = new URLClass(path, base);
      return /^(?:https?:)$/.test(result.protocol) ? result.href : null;
    } catch (ignore) { return null; }
  }

  function clipsFor(text, manifest) {
    if (!text) return null;
    if (own.call(manifest, text)) return validPath(manifest[text]) ? [manifest[text]] : null;

    // A lesson may be several recorded sentences. Match complete sentences only,
    // preferring the longest available recording; never assemble words or letters.
    var keys = Object.keys(manifest).filter(function (key) {
      return key && validPath(manifest[key]);
    }).sort(function (a, b) { return b.length - a.length; });
    var memo = Object.create(null);
    function match(offset) {
      if (offset === text.length) return [];
      if (own.call(memo, offset)) return memo[offset];
      var remaining = text.slice(offset);
      if (own.call(manifest, remaining) && validPath(manifest[remaining])) {
        return [manifest[remaining]];
      }
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (!/[.!?…][\u00bb\u201d"')\]]*$/.test(key)) continue;
        if (remaining.slice(0, key.length + 1) !== key + ' ') continue;
        var rest = match(offset + key.length + 1);
        if (rest) return (memo[offset] = [manifest[key]].concat(rest));
      }
      memo[offset] = null;
      return null;
    }
    return match(0);
  }

  function queueFor(input) {
    var manifest = root.VOICE_MANIFEST;
    if (!manifest || typeof manifest !== 'object') return null;
    var texts = Array.isArray(input) ? input : [input];
    if (!texts.length) return null;
    var queue = [];
    for (var i = 0; i < texts.length; i += 1) {
      var clips = clipsFor(normalize(texts[i]), manifest);
      if (!clips) return null;
      for (var j = 0; j < clips.length; j += 1) {
        var url = source(clips[j]);
        if (!url) return null;
        queue.push(url);
      }
    }
    return queue.length ? queue : null;
  }

  function silence() {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    try { audio.pause(); } catch (ignore) {}
    try { audio.currentTime = 0; } catch (ignore) {}
  }

  function finish(session, error, cancelled) {
    if (active !== session || session.done) return;
    session.done = true;
    active = null;
    silence();
    if (error) call(session.options.onError, error);
    else call(session.options.onEnd, { cancelled: !!cancelled });
  }

  function cancel() {
    if (active) finish(active, null, true);
    else silence();
  }

  function stop() {
    requestId += 1;
    cancel();
  }

  function current(session, clip) {
    return active === session && !session.done && session.clip === clip;
  }

  function playClip(session) {
    if (active !== session || session.done) return false;
    if (hidden()) { finish(session, null, true); return false; }
    var clip = ++session.clip;
    audio.onended = function () {
      if (!current(session, clip)) return;
      session.index += 1;
      if (session.index === session.queue.length) finish(session, null, false);
      else playClip(session);
    };
    audio.onerror = function () {
      if (current(session, clip)) finish(session, messages.playback, false);
    };
    try {
      audio.src = session.queue[session.index];
      // Keep this call synchronous: iPhone browsers require the first play to
      // happen directly inside the child's button press.
      var result = audio.play();
      if (result && typeof result.then === 'function') {
        result.then(null, function () {
          if (current(session, clip)) finish(session, messages.playback, false);
        });
      }
      return active === session || session.done;
    } catch (ignore) {
      if (current(session, clip)) finish(session, messages.playback, false);
      return false;
    }
  }

  function speak(input, options) {
    options = options || {};
    var request = ++requestId;
    cancel();
    // A cancellation callback may itself start a new request. The latest call
    // owns playback, so an older call must not overwrite that new session.
    if (request !== requestId) return false;
    var queue = queueFor(input);
    if (!queue) { call(options.onError, messages.missing); return false; }
    if (hidden()) { call(options.onError, messages.hidden); return false; }
    if (!audio) {
      try {
        if (typeof root.Audio !== 'function') throw new Error('Audio unavailable');
        audio = new root.Audio();
        audio.preload = 'auto';
        audio.playsInline = true;
      } catch (ignore) {
        audio = null;
        call(options.onError, messages.unavailable);
        return false;
      }
    }
    var session = { queue: queue, index: 0, clip: 0, done: false, options: options };
    active = session;
    return playClip(session);
  }

  root.RecordedVoice = {
    normalize: normalize,
    has: function (text) { return !!queueFor(text); },
    speak: speak,
    stop: stop
  };
  if (root.addEventListener) root.addEventListener('pagehide', stop);
  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('visibilitychange', function () { if (hidden()) stop(); });
  }
})(typeof window !== 'undefined' ? window : globalThis);
