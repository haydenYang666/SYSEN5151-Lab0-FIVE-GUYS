/*
 * RescuTech walking-skeleton server. No dependencies (Node 18+).
 *   npm start   ->  http://localhost:3000
 * Serves the front end and the REST API in routes.js. Data and model participants are stubs.
 */
'use strict';
var http = require('http');
var fs = require('fs');
var path = require('path');
var Routes = require('./routes.js');

var ROOT = path.join(__dirname, '..');
var PORT = Number(process.env.PORT) || 3000;
var api = Routes.createApi();
var TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
              '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

http.createServer(function (req, res) {
  var url = req.url.split('?')[0];
  if (url.indexOf('/api/') === 0) {
    var chunks = [];
    req.on('data', function (c) { chunks.push(c); });
    req.on('end', function () {
      var body = null;
      if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch (e) { return send(res, 400, { error: 'Invalid JSON' }); } }
      var out = api.handle(req.method, url, body);
      send(res, out.status, out.body);
    });
    return;
  }
  if (url === '/') { res.writeHead(302, { Location: '/frontend/index.html' }); return res.end(); }
  var file = url;
  var full = path.normalize(path.join(ROOT, file));
  if (full.indexOf(ROOT) !== 0) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(full, function (err, data) {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, TYPES[path.extname(full)] || 'application/octet-stream');
  });
}).listen(PORT, function () {
  console.log('RescuTech walking skeleton running at http://localhost:' + PORT);
});
