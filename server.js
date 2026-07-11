const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const DIR = __dirname;
const HTML_FILE = path.join(DIR, 'index.html');
const DATA_FILE = path.join(DIR, 'db.json');

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '{}');
}

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch(e) { return {}; }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data));
}

const server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/' && req.method === 'GET') {
    try {
      var html = fs.readFileSync(HTML_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch(e) {
      res.writeHead(500);
      res.end('Server error');
    }
    return;
  }

  if (req.url === '/api/data' && req.method === 'GET') {
    var data = readData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.url === '/api/data' && req.method === 'POST') {
    var body = '';
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() {
      try {
        var parsed = JSON.parse(body);
        var current = readData();
        Object.keys(parsed).forEach(function(key) {
          current[key] = parsed[key];
        });
        writeData(current);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.url === '/api/data' && req.method === 'PUT') {
    var putBody = '';
    req.on('data', function(chunk) { putBody += chunk; });
    req.on('end', function() {
      try {
        var putParsed = JSON.parse(putBody);
        writeData(putParsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (req.url === '/api/merge' && req.method === 'POST') {
    var mBody = '';
    req.on('data', function(chunk) { mBody += chunk; });
    req.on('end', function() {
      try {
        var incoming = JSON.parse(mBody);
        var existing = readData();
        Object.keys(incoming).forEach(function(key) {
          if (!existing[key]) existing[key] = incoming[key];
          else if (Array.isArray(incoming[key]) && Array.isArray(existing[key])) {
            incoming[key].forEach(function(item) {
              var found = existing[key].find(function(e) {
                return JSON.stringify(e) === JSON.stringify(item);
              });
              if (!found) existing[key].push(item);
            });
          } else {
            existing[key] = incoming[key];
          }
        });
        writeData(existing);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: existing }));
      } catch(e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', function() {
  console.log('Server running at http://localhost:' + PORT);
  console.log('API: http://localhost:' + PORT + '/api/data');
});
