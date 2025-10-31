#!/usr/bin/env node
// Minimal static file server for CI smokes
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const args = new Map(process.argv.slice(2).map((a) => {
  const [k, v] = a.split('=');
  return [k.replace(/^--/, ''), v ?? ''];
}));

const root = resolve(args.get('dir') || 'test/browser/smoke/dist');
const port = parseInt(args.get('port') || '8787', 10);

export function contentType(file) {
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.map': 'application/json',
    '.json': 'application/json'
  };
  return map[extname(file)] || 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  // Parse path and normalize relative to root to prevent path traversal
  let reqPath = (req.url || '/').split('?')[0] || '/';
  // Remove any leading slashes so join/resolve do not discard root
  reqPath = reqPath.replace(/^\/+/, '');
  if (reqPath === '') reqPath = 'index.html';
  const filePath = resolve(root, reqPath);
  // Ensure resolved path is within root
  if (!filePath.startsWith(root + '/') && filePath !== root && !filePath.startsWith(root + '\\')) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404); res.end('Not found'); return;
    }
    res.writeHead(200, { 'content-type': contentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch (e) {
    // Do not leak internal errors to clients; log server-side instead
    try { console.error('[serve-static] error:', e?.stack || e); } catch {}
    res.writeHead(500); res.end('Internal Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-static] listening on http://127.0.0.1:${port} (root=${root})`);
});
