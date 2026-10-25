/*
 * Minimal reader for the plain block-YAML subset used by contracts/api-v1.yaml.
 * Keeps the repository dependency-free (ADR 0001). Supports: nested block mappings, block sequences
 * ("- item" and "- key: value"), inline sequences "[a, b]", single/double-quoted strings, numbers,
 * booleans, null and "#" comments. It does not support anchors, multi-line strings or inline mappings;
 * the contract is written to avoid them, and tests/contract.spec.js cross-checks the parse.
 */
'use strict';

function stripComment(line) {
  var inS = false, inD = false;
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function scalar(s) {
  s = s.trim();
  if (s === '') return null;
  if ((s[0] === "'" && s[s.length - 1] === "'") || (s[0] === '"' && s[s.length - 1] === '"')) return s.slice(1, -1);
  if (s[0] === '[' && s[s.length - 1] === ']') {
    var inner = s.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map(scalar);
  }
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
}

function splitKey(text) {
  // "key: value" -> [key, value]; respects quoted keys such as '201':
  var m = text.match(/^('[^']*'|"[^"]*"|[^:'"]+):(\s+(.*))?$/);
  if (!m) return null;
  return [scalar(m[1]), m[3] === undefined ? undefined : m[3]];
}

function parse(src) {
  var lines = [];
  src.split(/\r?\n/).forEach(function (raw) {
    var t = stripComment(raw).replace(/\s+$/, '');
    if (t.trim() === '') return;
    lines.push({ indent: t.match(/^ */)[0].length, text: t.trim() });
  });
  var pos = 0;

  function block(indent) {
    if (pos >= lines.length) return null;
    return lines[pos].text.indexOf('- ') === 0 || lines[pos].text === '-' ? seq(lines[pos].indent) : map(lines[pos].indent);
  }

  function valueAfterKey(rest, keyIndent) {
    if (rest !== undefined && rest !== '') return scalar(rest);
    if (pos < lines.length && lines[pos].indent > keyIndent) return block(lines[pos].indent);
    if (pos < lines.length && lines[pos].indent === keyIndent && lines[pos].text.indexOf('- ') === 0) return seq(keyIndent);
    return null;
  }

  function map(indent) {
    var obj = {};
    while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.indexOf('- ') !== 0) {
      var kv = splitKey(lines[pos].text);
      if (!kv) throw new Error('yaml-subset: cannot parse line ' + (pos + 1) + ': ' + lines[pos].text);
      pos += 1;
      obj[kv[0]] = valueAfterKey(kv[1], indent);
    }
    return obj;
  }

  function seq(indent) {
    var arr = [];
    while (pos < lines.length && lines[pos].indent === indent && lines[pos].text.indexOf('- ') === 0) {
      var item = lines[pos].text.slice(2).trim();
      var kv = splitKey(item);
      if (kv) {
        // "- key: value" starts a mapping whose further keys sit at indent + 2
        lines[pos] = { indent: indent + 2, text: item };
        arr.push(map(indent + 2));
      } else {
        pos += 1;
        arr.push(scalar(item));
      }
    }
    return arr;
  }

  return block(0);
}

module.exports = { parse: parse };
