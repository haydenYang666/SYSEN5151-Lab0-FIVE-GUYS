#!/usr/bin/env node
/*
 * Generates contracts/generated/internal-stubs.js from contracts/api-v1.yaml (Lab Manual §7.4:
 * "Generate client and server stubs from the contract, not from the existing code").
 *   npm run generate:stubs          write the stub file
 *   node scripts/generate-stubs.js --check   exit 1 if the committed stub file is out of date
 * Output is deterministic (no timestamps) so the --check mode can be run in CI.
 */
'use strict';
var fs = require('fs');
var path = require('path');
var yaml = require('./yaml-subset.js');

var ROOT = path.join(__dirname, '..');
var CONTRACT = path.join(ROOT, 'contracts', 'api-v1.yaml');
var OUT = path.join(ROOT, 'contracts', 'generated', 'internal-stubs.js');

function refName(schema) {
  if (!schema) return null;
  var ref = schema.$ref || (schema.allOf && schema.allOf[0] && schema.allOf[0].$ref);
  return ref ? ref.split('/').pop() : null;
}

function bodySchema(node) {
  return node && node.content && node.content['application/json'] ? refName(node.content['application/json'].schema) : null;
}

function operations(spec) {
  var ops = [];
  Object.keys(spec.paths).sort().forEach(function (p) {
    Object.keys(spec.paths[p]).forEach(function (method) {
      var o = spec.paths[p][method];
      var responses = {};
      Object.keys(o.responses).sort().forEach(function (code) { responses[code] = bodySchema(o.responses[code]); });
      ops.push({
        operationId: o.operationId, method: method.toUpperCase(), path: p,
        receiver: o['x-receiver'], module: o['x-module'],
        flowsIn: o['x-flows-in'] || [], flowsOut: o['x-flows-out'] || [],
        requirements: (o['x-requirements'] || []).map(String),
        request: bodySchema(o.requestBody), responses: responses, summary: o.summary
      });
    });
  });
  return ops;
}

function render(spec) {
  var ops = operations(spec);
  var byModule = {};
  ops.forEach(function (o) { (byModule[o.module] = byModule[o.module] || []).push(o); });
  var out = [];
  out.push('/*');
  out.push(' * GENERATED from contracts/api-v1.yaml (' + spec.info.title + ' ' + spec.info.version + ') -- do not hand-edit.');
  out.push(' * Regenerate after changing the contract (npm run generate:stubs), never the other way around.');
  out.push(' * Signature-only stubs: each first-level function module must export exactly these operations');
  out.push(' * (checked by tests/contract.spec.js).');
  out.push(' */');
  out.push("'use strict';");
  out.push('');
  out.push('function notImplemented(op) { throw new Error(op + \' is implemented in rescutech-orchestrator/functions/, not in the stub\'); }');
  out.push('');
  out.push('var OPERATIONS = ' + JSON.stringify(ops, null, 2) + ';');
  out.push('');
  out.push('var STUBS = {');
  Object.keys(byModule).sort().forEach(function (m, mi, arr) {
    out.push('  ' + JSON.stringify(m) + ': {');
    byModule[m].forEach(function (o, oi, list) {
      var resp = Object.keys(o.responses).map(function (c) { return c + ' ' + o.responses[c]; }).join(', ');
      out.push('    /** ' + o.receiver + ' ' + o.operationId + '(' + o.request + ') -> ' + resp + '. Flows in: ' +
               (o.flowsIn.join(', ') || 'none') + '; flows out: ' + (o.flowsOut.join(', ') || 'none') + '. */');
      out.push('    ' + o.operationId + ': function (' + o.request.charAt(0).toLowerCase() + o.request.slice(1) + ') { return notImplemented(' +
               JSON.stringify(o.operationId) + '); }' + (oi < list.length - 1 ? ',' : ''));
    });
    out.push('  }' + (mi < arr.length - 1 ? ',' : ''));
  });
  out.push('};');
  out.push('');
  out.push('module.exports = { OPERATIONS: OPERATIONS, STUBS: STUBS };');
  out.push('');
  return out.join('\n');
}

function main() {
  var spec = yaml.parse(fs.readFileSync(CONTRACT, 'utf8'));
  var text = render(spec);
  if (process.argv.indexOf('--check') !== -1) {
    var current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== text) { console.error('contracts/generated/internal-stubs.js is out of date: run npm run generate:stubs'); process.exit(1); }
    console.log('Generated stubs are up to date with contracts/api-v1.yaml');
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text);
  console.log('Wrote ' + path.relative(ROOT, OUT) + ' (' + operations(spec).length + ' operations)');
}

if (require.main === module) main();
module.exports = { render: render, operations: operations };
