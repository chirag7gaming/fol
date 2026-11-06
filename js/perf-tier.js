(function () {
  'use strict';

  var cores = navigator.hardwareConcurrency || 2;
  var mem = navigator.deviceMemory || 4;
  var tier = cores >= 8 && mem >= 8 ? 'high'
           : cores >= 4 && mem >= 4 ? 'mid'
           : 'low';

  document.documentElement.setAttribute('data-perf-tier', tier);
})();