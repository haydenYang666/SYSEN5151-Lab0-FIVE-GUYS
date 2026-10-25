/*
 * Shared helpers for the first-level function modules F.2.1–F.2.5 (rescutech-orchestrator/functions/).
 * GuardError is the error a module throws when a requirement guard blocks an action (409 at the REST layer).
 */
(function (root) {
  'use strict';

  function GuardError(rule, message) {
    this.name = 'GuardError';
    this.rule = rule;
    this.message = message;
  }
  GuardError.prototype = Object.create(Error.prototype);

  function iso(d) { return d ? new Date(d).toISOString() : null; }

  var api = { GuardError: GuardError, iso: iso };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RescuTechCommon = api;
})(this);
