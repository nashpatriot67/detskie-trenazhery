(function (root) {
  'use strict';
  var doc = root.document;
  var nav = root.navigator || {};
  var script = doc && doc.currentScript;
  var scriptUrl = script && script.src;
  var protocol = root.location && root.location.protocol;
  if (!doc || !scriptUrl || !nav.serviceWorker || root.isSecureContext === false) return;
  if (protocol !== 'https:' && !(protocol === 'http:' && /^(?:localhost|127\.0\.0\.1)$/.test(root.location.hostname || ''))) return;

  // Browser menus handle installation; no controls are added to the page.
  function registerWorker() {
    try {
      var worker = new root.URL('sw.js', scriptUrl);
      var scope = new root.URL('./', scriptUrl);
      var registration = nav.serviceWorker.register(worker.href, { scope: scope.pathname });
      if (registration && registration.catch) registration.catch(function () {});
    } catch (_) { /* Practice remains available if worker registration fails. */ }
  }

  if (doc.readyState === 'complete') registerWorker();
  else root.addEventListener('load', registerWorker, { once: true });
})(window);
