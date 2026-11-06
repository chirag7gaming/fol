'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { pack, unpack } = require('./lib/fol');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const MAX_BODY = 8 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function toBase64(u8) {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
}

function fromBase64(s) {
  return new Uint8Array(Buffer.from(s, 'base64'));
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        const err = new Error('Payload too large');
        err.status = 413;
        req.destroy();
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    return res.end();
  }

  if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST only' });

  let body;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw.toString('utf-8') || '{}');
  } catch (err) {
    return sendJson(res, err.status || 400, { error: err.message });
  }

  try {
    if (body.action === 'pack') {
      if (!Array.isArray(body.files) || body.files.length === 0) {
        return sendJson(res, 400, { error: 'files must be a non-empty array of { path, contentBase64 }' });
      }
      const entries = body.files.map((f) => {
        if (typeof f.path !== 'string' || typeof f.contentBase64 !== 'string') {
          throw new Error('Each file must be { path: string, contentBase64: string }');
        }
        return { path: f.path, data: fromBase64(f.contentBase64) };
      });
      return sendJson(res, 200, { fileBase64: toBase64(pack(entries)) });
    }

    if (body.action === 'unpack') {
      if (typeof body.fileBase64 !== 'string') {
        return sendJson(res, 400, { error: 'fileBase64 is required' });
      }
      const files = unpack(fromBase64(body.fileBase64)).map((e) => ({
        path: e.path,
        contentBase64: toBase64(e.data),
        size: e.data.byteLength
      }));
      return sendJson(res, 200, { files });
    }

    return sendJson(res, 400, { error: 'action must be "pack" or "unpack"' });
  } catch (err) {
    return sendJson(res, 400, { error: err.message });
  }
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/archive-fol') return handleApi(req, res);
  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log('fol server listening on http://localhost:' + PORT);
});