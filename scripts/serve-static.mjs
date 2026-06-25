#!/usr/bin/env node
// Minimal static file server for repository unit tests.
import http from 'node:http';
import { existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { resolve, join, extname, relative, isAbsolute, posix } from 'node:path';

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.split('=');
    return [k.replace(/^--/, ''), v ?? ''];
  })
);

const root = resolve(args.get('dir') || '.');
const port = parseInt(args.get('port') || '8787', 10);

export const CONTENT_TYPE_MAP = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.map', 'application/json'],
  ['.json', 'application/json']
]);

export function contentType(file) {
  const ext = extname(file).toLowerCase();
  return CONTENT_TYPE_MAP.get(ext) || 'application/octet-stream';
}

export function isPathWithinRoot(rootDir, filePath) {
  const rel = relative(rootDir, filePath);
  return !(isAbsolute(rel) || rel.startsWith('..'));
}

export function resolveRequestPath(rootDir, requestUrl) {
  const urlPath = (requestUrl || '/').split('?')[0];
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    decoded = urlPath || '/';
  }
  const slashNormalized = decoded.replace(/\\+/g, '/');
  if (slashNormalized.includes('\0')) {
    return { ok: false, reason: 'forbidden', url: urlPath, rel: '' };
  }

  const rawSegments = slashNormalized.split('/').filter(Boolean);
  if (
    rawSegments.some((segment) => segment === '.' || segment === '..' || segment.includes('\0'))
  ) {
    return { ok: false, reason: 'forbidden', url: urlPath, rel: rawSegments.join('/') };
  }

  const normalized = posix.normalize(`/${slashNormalized}`);
  const rel = normalized.replace(/^\/+/, '') || 'index.html';
  const segments = rel.split('/').filter(Boolean);
  const filePath = join(rootDir, ...segments);
  if (!isPathWithinRoot(rootDir, filePath)) {
    return { ok: false, reason: 'forbidden', url: urlPath, rel };
  }
  return { ok: true, url: urlPath, rel, filePath };
}

const server = http.createServer((req, res) => {
  const resolved = resolveRequestPath(root, req.url || '/');
  if (!resolved.ok) {
    try {
      console.error('[serve-static] deny traversal');
    } catch {
      /* empty */
    }
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const { filePath } = resolved;
  try {
    console.error('[serve-static] request accepted');
  } catch {
    /* empty */
  }
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': contentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch (e) {
    // Do not leak internal errors to clients; log server-side instead
    try {
      console.error('[serve-static] error:', e?.stack || e);
    } catch {
      /* empty */
    }
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

// Only start the server when executed directly as a script, not when imported
if (import.meta.main || (process.argv[1] && /serve-static\.mjs$/.test(process.argv[1]))) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`[serve-static] listening on http://127.0.0.1:${port} (root=${root})`);
  });
}
