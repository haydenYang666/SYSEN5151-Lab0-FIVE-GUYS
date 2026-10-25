/*
 * Contract conformance checks for contracts/api-v1.yaml (Lab Manual §7.4 "Code conforms to the contract rather
 * than the contract describing the code"). Node only:  npm test   (also run in CI)
 *
 *   C.1  The generated stubs are up to date with the contract.
 *   C.2  Each first-level function module exports every contract operation assigned to it (x-receiver/x-module).
 *   C.3  Every internal-flow call made while running UC.1 conforms to the contract: request and response bodies
 *        validate against the schemas, and the returned status code is one the contract declares.
 *   C.4  Every internal flow IO.10–IO.14 crossed a boundary through the contract at least once.
 *   C.5  No first-level function module calls another one directly (internal flows go only through the contract).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var yaml = require('../scripts/yaml-subset.js');
var gen = require('../scripts/generate-stubs.js');
var Routes = require('../rescutech-orchestrator/routes.js');

var ROOT = path.join(__dirname, '..');
var spec = yaml.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'api-v1.yaml'), 'utf8'));
var OPS = gen.operations(spec);
var SCHEMAS = spec.components.schemas;
var INTERNAL_FLOWS = ['IO.10', 'IO.11', 'IO.12', 'IO.13', 'IO.14'];

function resolve(s) {
  if (s && s.$ref) return SCHEMAS[s.$ref.split('/').pop()];
  return s;
}

// Small JSON-schema check covering the keywords the contract uses.
function validate(schema, value, where, errors) {
  var nullable = !!schema.nullable;
  if (schema.allOf) schema = resolve(schema.allOf[0]);
  schema = resolve(schema);
  if (value === null) { if (!nullable && !schema.nullable) errors.push(where + ': null not allowed'); return; }
  var t = schema.type;
  if (t === 'object') {
    if (typeof value !== 'object' || Array.isArray(value)) return errors.push(where + ': expected object');
    (schema.required || []).forEach(function (k) { if (!(k in value)) errors.push(where + ': missing ' + k); });
    Object.keys(schema.properties || {}).forEach(function (k) {
      if (k in value && value[k] !== undefined) validate(schema.properties[k], value[k], where + '.' + k, errors);
    });
  } else if (t === 'array') {
    if (!Array.isArray(value)) return errors.push(where + ': expected array');
    if (schema.items) value.forEach(function (v, i) { validate(schema.items, v, where + '[' + i + ']', errors); });
  } else if (t === 'string') {
    if (typeof value !== 'string') return errors.push(where + ': expected string, got ' + typeof value);
    if (schema.format === 'date-time' && isNaN(Date.parse(value))) errors.push(where + ': not a date-time');
  } else if (t === 'integer') {
    if (typeof value !== 'number' || Math.floor(value) !== value) errors.push(where + ': expected integer');
  } else if (t === 'number') {
    if (typeof value !== 'number') errors.push(where + ': expected number');
  } else if (t === 'boolean') {
    if (typeof value !== 'boolean') errors.push(where + ': expected boolean');
  }
  if (schema.enum && schema.enum.indexOf(value) === -1) errors.push(where + ': ' + JSON.stringify(value) + ' not in ' + schema.enum.join('|'));
  if (typeof schema.minimum === 'number' && typeof value === 'number' && value < schema.minimum) errors.push(where + ': below minimum');
}

function ok(cond, msg) { if (!cond) throw new Error(msg); }

// Drive UC.1 through the public routes while recording every contract call.
function runScenarios() {
  var calls = [];
  function scenario(report, statusFor) {
    var api = Routes.createApi({ onContractCall: function (c) { calls.push(c); } });
    var r = api.handle('POST', '/api/distress-reports', report).body;
    var inc = api.handle('POST', '/api/distress-reports/' + r.report.id + '/incident').body;
    api.handle('POST', '/api/incidents/' + inc.id + '/status-requests');
    api.handle('GET', '/api/teams').body.forEach(function (t) {
      api.handle('PUT', '/api/incidents/' + inc.id + '/team-status/' + t.id, statusFor(t));
    });
    var rec = api.handle('POST', '/api/incidents/' + inc.id + '/recommendation').body;
    if (rec.teamId) {
      api.handle('POST', '/api/recommendations/' + rec.id + '/approval', { by: 'tester' });
      var o = api.handle('POST', '/api/recommendations/' + rec.id + '/dispatch-order').body;
      api.handle('POST', '/api/dispatch-orders/' + o.id + '/acknowledgment', { teamId: o.teamId });
    }
  }
  var full = function (t) { return { available: t.available, zoneKey: t.zoneKey, capabilities: t.capabilities }; };
  scenario({ location: '412 Fall Creek Dr, Fall Creek, Ithaca',
             description: 'Our car is stuck on a snow-blocked road. Two adults inside, one is shivering badly and may have hypothermia.' }, full);
  scenario({ location: 'somewhere near the hill', description: 'Please help us' }, full);                    // undetermined fields
  scenario({ location: 'Dryden', description: 'Water rising in the basement, three people' },
           function (t) { return { available: false, zoneKey: t.zoneKey, capabilities: t.capabilities }; }); // no match (2.1.4)
  scenario({ location: 'Downtown Ithaca', description: 'Two people trapped by snow' },
           function (t) { return t.id === 'RT-A' ? { available: true } : full(t); });                      // incomplete status
  return calls;
}

var CHECKS = [
  { id: 'C.1', name: 'Generated stubs are up to date with contracts/api-v1.yaml', run: function () {
    var current = fs.readFileSync(path.join(ROOT, 'contracts', 'generated', 'internal-stubs.js'), 'utf8');
    ok(current === gen.render(spec), 'run npm run generate:stubs');
  } },
  { id: 'C.2', name: 'Each F.2.x module exports every contract operation assigned to it', run: function () {
    var ctx = { now: function () { return new Date(); }, nextId: function (p) { return p + '-0001'; }, log: function () {} };
    OPS.forEach(function (o) {
      var mod = require(path.join(ROOT, 'rescutech-orchestrator', 'functions', o.module + '.js'));
      ok(mod.id === o.receiver, o.module + ' declares ' + mod.id + ', contract says ' + o.receiver);
      ok(typeof mod.create(ctx)[o.operationId] === 'function', o.receiver + ' does not implement ' + o.operationId);
    });
  } },
  { id: 'C.3', name: 'Every internal-flow call during UC.1 validates against the contract', run: function () {
    var calls = runScenarios(), errors = [];
    ok(calls.length > 0, 'no contract calls recorded');
    calls.forEach(function (c, i) {
      var op = OPS.filter(function (o) { return o.operationId === c.operationId; })[0];
      ok(op, 'call to ' + c.operationId + ' is not in the contract');
      ok(op.receiver === c.receiver, c.operationId + ' called on ' + c.receiver + ', contract says ' + op.receiver);
      var code = String(c.response.status);
      ok(code in op.responses, c.operationId + ' returned undeclared status ' + code);
      validate({ $ref: '#/components/schemas/' + op.request }, c.request, '#' + i + ' ' + c.operationId + ' request', errors);
      validate({ $ref: '#/components/schemas/' + op.responses[code] }, c.response.body, '#' + i + ' ' + c.operationId + ' ' + code, errors);
    });
    ok(errors.length === 0, errors.slice(0, 5).join('; '));
  } },
  { id: 'C.4', name: 'Internal flows IO.10–IO.14 all cross a boundary through the contract', run: function () {
    var seen = {};
    runScenarios().forEach(function (c) {
      var op = OPS.filter(function (o) { return o.operationId === c.operationId; })[0];
      op.flowsIn.concat(op.flowsOut).forEach(function (fl) { seen[fl] = true; });
    });
    var missing = INTERNAL_FLOWS.filter(function (fl) { return !seen[fl]; });
    ok(missing.length === 0, 'not exercised: ' + missing.join(', '));
  } },
  { id: 'C.5', name: 'No F.2.x module calls another F.2.x module directly', run: function () {
    var dir = path.join(ROOT, 'rescutech-orchestrator', 'functions');
    fs.readdirSync(dir).filter(function (n) { return /^f2-\d/.test(n); }).forEach(function (n) {
      var own = 'RescuTechF2' + n.charAt(3);                       // the module's own browser global
      var src = fs.readFileSync(path.join(dir, n), 'utf8').split(own).join('');
      ok(!/require\(['"]\.\/f2-|RescuTechF2\d/.test(src), n + ' reaches into another first-level function');
    });
  } }
];

var failed = 0;
CHECKS.forEach(function (c) {
  try { c.run(); console.log('PASS  ' + c.id + ' — ' + c.name); }
  catch (e) { failed += 1; console.log('FAIL  ' + c.id + ' — ' + c.name + '\n      ' + e.message); }
});
console.log('\n' + (CHECKS.length - failed) + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
