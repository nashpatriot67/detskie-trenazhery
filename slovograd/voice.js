/* Voice helpers for Slovograd. Lesson audio uses the site's recorded female voice.
 * Arbitrary child text uses the device voice only when explicitly requested.
 * No keys, uploads, or background recording.
 * Recognition, when available, is provided by the browser/OS and may use its
 * network service. It produces a text draft, not a spelling/pronunciation grade.
 * Recorded clips stay in memory on this device; dispose() releases their URLs.
 */
(function (root) {
  'use strict';
  let speech = null;
  let recognition = null;
  let recording = null;
  const clipUrls = new Set();
  const MAX_RECORDING_MS = 60000;

  function emit(callback, value) {
    if (typeof callback === 'function') {
      try { callback(value); } catch (_) { /* Always release media even if a UI callback fails. */ }
    }
  }

  function recognitionConstructor() {
    return root.SpeechRecognition || root.webkitSpeechRecognition || null;
  }

  function capabilities() {
    const nav = root.navigator;
    return {
      tts: !!(root.RecordedVoice && typeof root.Audio === 'function'),
      deviceTts: !!(root.speechSynthesis && typeof root.SpeechSynthesisUtterance === 'function'),
      recognition: typeof recognitionConstructor() === 'function',
      recording: !!(nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function' && typeof root.MediaRecorder === 'function')
    };
  }

  function stopSpeech() {
    const previous = speech;
    speech = null;
    if (previous && previous.utterance) {
      previous.utterance.onstart = null;
      previous.utterance.onend = null;
      previous.utterance.onerror = null;
    }
    try { if (root.RecordedVoice) root.RecordedVoice.stop(); } catch (_) {}
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (_) {}
    if (previous) emit(previous.options.onEnd, { cancelled: true });
  }

  function speak(text, options) {
    options = options || {};
    stopSpeech();
    stopListening();
    if (recording) cancelRecording(recording);
    if (!options.device) {
      if (!capabilities().tts) {
        emit(options.onError, 'Аудиозапись сейчас недоступна. Обнови страницу с интернетом или прочитай текст на экране.');
        return false;
      }
      const session = { options };
      speech = session;
      try {
        const started = root.RecordedVoice.speak(text, {
          onStart: function () {
            if (speech === session) emit(options.onStart);
          },
          onEnd: function (result) {
            if (speech !== session) return;
            speech = null;
            emit(options.onEnd, result);
          },
          onError: function (message) {
            if (speech !== session) return;
            speech = null;
            emit(options.onError, message);
          }
        });
        if (!started && speech === session) speech = null;
        return started;
      } catch (_) {
        speech = null;
        emit(options.onError, 'Не удалось включить аудиозапись. Проверь интернет и попробуй ещё раз.');
        return false;
      }
    }
    if (!capabilities().deviceTts) {
      emit(options.onError, 'Голос устройства недоступен. Можно прочитать своё предложение вслух или записать себя.');
      return false;
    }
    const clean = (Array.isArray(text) ? text.join(' ') : String(text == null ? '' : text)).trim();
    if (!clean) { emit(options.onEnd, { cancelled: false }); return false; }
    try {
      const utterance = new root.SpeechSynthesisUtterance(clean);
      utterance.lang = 'ru-RU';
      utterance.rate = 0.85;
      utterance.pitch = 1;
      utterance.volume = 1;
      let voices = [];
      try { voices = root.speechSynthesis.getVoices() || []; } catch (_) {}
      const russianVoices = voices.filter(v => /^ru(?:[-_]|$)/i.test(v.lang || ''));
      const russian = russianVoices.find(v => /milena|katya|irina|svetlana|elena|anna|daria|mariya|female|милена|катя|ирина|светлана|елена|анна|дарья|мария/i.test(v.name || '')) || russianVoices[0];
      if (russian) utterance.voice = russian;
      // If voices have not loaded, lang still lets the system choose Russian.
      const session = { utterance, options };
      speech = session;
      utterance.onstart = function () {
        if (speech === session) emit(options.onStart);
      };
      utterance.onend = function () {
        if (speech !== session) return;
        speech = null;
        emit(options.onEnd, { cancelled: false });
      };
      utterance.onerror = function (event) {
        if (speech !== session) return;
        speech = null;
        if (event && (event.error === 'canceled' || event.error === 'interrupted')) {
          emit(options.onEnd, { cancelled: true });
        } else {
          emit(options.onError, 'Не удалось озвучить текст. Проверь громкость и попробуй нажать ещё раз.');
        }
      };
      root.speechSynthesis.speak(utterance);
      return true;
    } catch (_) {
      speech = null;
      emit(options.onError, 'Не удалось включить озвучку. Можно прочитать задание на экране.');
      return false;
    }
  }

  function recognitionError(code) {
    const messages = {
      'not-allowed': 'Доступ к микрофону не разрешён. Разреши его в настройках браузера или введи ответ с клавиатуры.',
      'service-not-allowed': 'Голосовой ввод недоступен в настройках устройства. Можно использовать диктовку клавиатуры или напечатать ответ.',
      'audio-capture': 'Не удалось включить микрофон. Проверь, что он подключён и не занят другим приложением.',
      'network': 'Сервис распознавания не ответил. Проверь интернет или введи ответ с клавиатуры.',
      'no-speech': 'Не удалось услышать речь. Нажми микрофон и скажи ответ ещё раз.',
      'language-not-supported': 'Распознавание русской речи недоступно на этом устройстве. Можно воспользоваться диктовкой клавиатуры.'
    };
    return messages[code] || 'Голосовой ввод сейчас недоступен. Можно напечатать ответ или попробовать ещё раз.';
  }

  function finishRecognition(session, cancelled, abort) {
    if (!session || session.finished) return;
    session.finished = true;
    if (recognition === session) recognition = null;
    const rec = session.recognizer;
    rec.onstart = null;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    if (abort) {
      try { rec.abort(); } catch (_) {}
    }
    emit(session.options.onEnd, { cancelled: !!cancelled, received: session.received });
  }

  function stopListening() {
    if (recognition) finishRecognition(recognition, true, true);
  }

  function listen(options) {
    options = options || {};
    stopSpeech();
    stopListening();
    if (recording) {
      emit(options.onError, 'Сначала останови запись, затем нажми «Сказать ответ».');
      return false;
    }
    const Constructor = recognitionConstructor();
    if (typeof Constructor !== 'function') {
      emit(options.onError, 'В этом браузере нет распознавания речи. Можно записать и прослушать ответ или воспользоваться микрофоном на клавиатуре.');
      return false;
    }
    let session;
    try {
      const rec = new Constructor();
      session = { recognizer: rec, options, finished: false, received: false };
      recognition = session;
      rec.lang = 'ru-RU';
      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = function () {
        if (session.finished) return;
        emit(options.onStart);
        emit(options.onStatus, 'Слушаю. Скажи ответ и сделай небольшую паузу.');
      };
      rec.onresult = function (event) {
        if (session.finished || session.received) return;
        const results = event && event.results;
        const texts = [];
        for (let i = (event && event.resultIndex) || 0; results && i < results.length; i++) {
          const item = results[i];
          if (item && item.isFinal !== false && item[0] && item[0].transcript) texts.push(item[0].transcript);
        }
        const text = texts.join(' ').trim();
        if (!text) return;
        session.received = true;
        emit(options.onResult, text);
        if (session.finished) return;
        emit(options.onStatus, 'Речь записана текстом. Проверь, правильно ли тебя услышали.');
        // Continuous recognition is off; explicitly stop to release the microphone promptly.
        try { rec.stop(); } catch (_) { finishRecognition(session, false, true); }
      };
      rec.onerror = function (event) {
        if (session.finished) return;
        const error = event && event.error;
        if (error !== 'aborted') emit(options.onError, recognitionError(error));
        finishRecognition(session, error === 'aborted', true);
      };
      rec.onend = function () {
        if (!session.finished && !session.received) emit(options.onStatus, 'Голосовой ввод завершён. Можно попробовать ещё раз или напечатать ответ.');
        finishRecognition(session, false, false);
      };
      emit(options.onStatus, 'Включаю голосовой ввод…');
      rec.start();
      return true;
    } catch (error) {
      emit(options.onError, recognitionError(error && (error.name === 'NotAllowedError' ? 'not-allowed' : error.name)));
      if (session) finishRecognition(session, true, true);
      return false;
    }
  }

  function stopTracks(session) {
    if (session.tracksStopped || !session.stream) return;
    session.tracksStopped = true;
    try {
      new Set(session.stream.getTracks()).forEach(track => {
        try { track.stop(); } catch (_) {}
      });
    } catch (_) {}
  }

  function clearRecordingTimer(session) {
    if (session.timer != null) {
      if (typeof root.clearTimeout === 'function') root.clearTimeout(session.timer);
      session.timer = null;
    }
  }

  function microphoneError(error) {
    const code = error && error.name;
    if (code === 'NotAllowedError' || code === 'PermissionDeniedError') return 'Запись не разрешена. Разреши микрофон в настройках браузера или введи ответ с клавиатуры.';
    if (code === 'NotFoundError' || code === 'DevicesNotFoundError') return 'Микрофон не найден. Можно напечатать ответ или подключить микрофон.';
    if (code === 'NotReadableError' || code === 'TrackStartError') return 'Микрофон сейчас занят. Закрой другое приложение с записью и попробуй снова.';
    if (code === 'SecurityError') return 'Запись требует защищённой страницы HTTPS и разрешения на микрофон.';
    return 'Не удалось начать запись. Можно ответить с клавиатуры и попробовать микрофон позже.';
  }

  function recordingMimeType() {
    if (typeof root.MediaRecorder.isTypeSupported !== 'function') return '';
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (const type of types) {
      try { if (root.MediaRecorder.isTypeSupported(type)) return type; } catch (_) {}
    }
    return '';
  }

  function finishRecording(session, error) {
    if (!session || session.finished) return;
    session.finished = true;
    clearRecordingTimer(session);
    stopTracks(session);
    if (recording === session) recording = null;
    if (error) { emit(session.options.onError, microphoneError(error)); return; }
    if (session.cancelled) return;
    if (!session.chunks.length) {
      emit(session.options.onError, 'Запись получилась пустой. Нажми микрофон и попробуй ещё раз.');
      return;
    }
    try {
      const mimeType = session.recorder.mimeType || session.mimeType || session.chunks[0].type || 'audio/webm';
      const blob = new root.Blob(session.chunks, { type: mimeType });
      if (!blob.size) { emit(session.options.onError, 'Запись получилась пустой. Попробуй ещё раз.'); return; }
      const url = root.URL.createObjectURL(blob);
      clipUrls.add(url);
      emit(session.options.onReady, { url, mimeType });
      emit(session.options.onStatus, 'Запись готова. Послушай, как звучит твой ответ.');
    } catch (_) {
      emit(session.options.onError, 'Не удалось подготовить запись для прослушивания. Можно попробовать ещё раз.');
    }
  }

  function cancelRecording(session) {
    if (!session || session.finished) return;
    session.cancelled = true;
    clearRecordingTimer(session);
    // A pending permission request cannot be cancelled by script. Its late stream
    // is stopped in startRecording() before any MediaRecorder is constructed.
    if (!session.recorder) return;
    try { if (session.recorder.state !== 'inactive') session.recorder.stop(); } catch (_) {}
    stopTracks(session);
    finishRecording(session);
  }

  async function startRecording(options) {
    options = options || {};
    stopSpeech();
    stopListening();
    if (recording) {
      emit(options.onError, recording.cancelled ? 'Предыдущий запрос микрофона ещё завершается. Попробуй через несколько секунд.' : 'Запись уже идёт. Сначала нажми «Остановить запись».');
      return false;
    }
    if (!capabilities().recording) {
      emit(options.onError, 'Запись недоступна в этом браузере. Можно сказать ответ вслух без записи или воспользоваться диктовкой на клавиатуре.');
      return false;
    }
    const session = { options, stream: null, recorder: null, chunks: [], mimeType: '', cancelled: false, finished: false, tracksStopped: false, timer: null };
    recording = session;
    emit(options.onStatus, 'Запрашиваю микрофон. Разреши доступ, чтобы записать ответ.');
    try {
      session.stream = await root.navigator.mediaDevices.getUserMedia({ audio: true });
      if (session.cancelled) {
        finishRecording(session);
        return false;
      }
      session.mimeType = recordingMimeType();
      try {
        session.recorder = session.mimeType ? new root.MediaRecorder(session.stream, { mimeType: session.mimeType }) : new root.MediaRecorder(session.stream);
      } catch (error) {
        // Some Safari versions report support but only accept their default codec.
        if (!session.mimeType) throw error;
        session.mimeType = '';
        session.recorder = new root.MediaRecorder(session.stream);
      }
      const rec = session.recorder;
      rec.ondataavailable = function (event) {
        if (!session.finished && !session.cancelled && event && event.data && event.data.size > 0) session.chunks.push(event.data);
      };
      rec.onstop = function () { finishRecording(session); };
      rec.onerror = function (event) {
        session.cancelled = true;
        finishRecording(session, event && event.error || new Error('recording'));
        try { if (rec.state !== 'inactive') rec.stop(); } catch (_) {}
      };
      rec.start();
      emit(options.onStart);
      emit(options.onStatus, 'Запись идёт. Говори спокойно, затем нажми «Остановить запись».');
      if (typeof root.setTimeout === 'function') {
        session.timer = root.setTimeout(function () {
          if (recording !== session || session.finished || session.cancelled) return;
          emit(options.onStatus, 'Минута записи прошла. Сохраняю твой ответ для прослушивания.');
          stopRecording();
        }, MAX_RECORDING_MS);
      }
      return true;
    } catch (error) {
      if (session.cancelled) finishRecording(session);
      else finishRecording(session, error);
      return false;
    }
  }

  function stopRecording() {
    const session = recording;
    if (!session || session.finished) return false;
    if (!session.recorder) {
      session.cancelled = true;
      emit(session.options.onStatus, 'Запрос записи отменён.');
      return true;
    }
    clearRecordingTimer(session);
    emit(session.options.onStatus, 'Сохраняю запись…');
    try {
      if (session.recorder.state !== 'inactive') session.recorder.stop();
      else finishRecording(session);
      // The recorder still flushes its final data/stop events after tracks stop.
      stopTracks(session);
      return true;
    } catch (error) {
      finishRecording(session, error);
      return false;
    }
  }

  function dispose() {
    stopSpeech();
    stopListening();
    if (recording) cancelRecording(recording);
    clipUrls.forEach(url => {
      try { root.URL.revokeObjectURL(url); } catch (_) {}
    });
    clipUrls.clear();
  }

  root.RusVoice = { capabilities, speak, stopSpeech, listen, stopListening, startRecording, stopRecording, dispose };
  if (typeof root.addEventListener === 'function') root.addEventListener('pagehide', dispose);
})(window);
