/*  Gel-Calculator - Personalized fuel calculator for endurance athletes.
    Copyright (C) 2026  Eike Christian Karbe

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>. */

/**
 * Tiny dependency-free static server for the Next.js export in ./out.
 *
 * Serves the export under the same base path as GitHub Pages
 * (`/gel-calculator`), so the smoke tests load the real build:
 *   /gel-calculator            -> out/index.html
 *   /gel-calculator/           -> out/index.html
 *   /gel-calculator/foo/       -> out/foo/index.html
 *   /gel-calculator/foo.js     -> out/foo.js
 *   /gel-calculator/foo        -> out/foo.html (if out/foo is not a file)
 * Everything else answers 404 (with out/404.html as the body when present).
 *
 * Usage: `node scripts/serve-static.mjs` (port from env PORT, default 4173).
 */

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_PATH = '/gel-calculator';
const DEFAULT_PORT = 4173;
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out');

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
};

/**
 * Content type for a file path, based on its extension.
 * @param {string} filePath
 * @returns {string}
 */
function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Stat a path, returning null when it does not exist.
 * @param {string} filePath
 * @returns {Promise<import('node:fs').Stats | null>}
 */
async function statOrNull(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

/**
 * Map a request pathname to a file inside OUT_DIR, or null when nothing matches.
 * Rejects anything outside the base path and any path that escapes OUT_DIR.
 * @param {string} pathname URL pathname (still percent-encoded)
 * @returns {Promise<string | null>}
 */
async function resolveFile(pathname) {
  if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) return null;

  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(BASE_PATH.length));
  } catch {
    return null;
  }
  if (relative.includes('\0')) return null;

  const target = path.resolve(OUT_DIR, `.${path.posix.normalize(`/${relative}`)}`);
  if (target !== OUT_DIR && !target.startsWith(`${OUT_DIR}${path.sep}`)) return null;

  const info = await statOrNull(target);
  if (info?.isFile()) return target;
  if (info?.isDirectory()) {
    const index = path.join(target, 'index.html');
    if ((await statOrNull(index))?.isFile()) return index;
  }

  // Next.js exports `/route` as `route.html`; GitHub Pages serves it at `/route`.
  if (target !== OUT_DIR && !path.extname(target) && !pathname.endsWith('/')) {
    const html = `${target}.html`;
    if ((await statOrNull(html))?.isFile()) return html;
  }
  return null;
}

/**
 * Send a file with the right content type (body omitted for HEAD).
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} filePath
 * @returns {Promise<void>}
 */
async function sendFile(req, res, status, filePath) {
  const info = await stat(filePath);
  res.writeHead(status, {
    'Content-Type': contentTypeFor(filePath),
    'Content-Length': info.size,
    'Cache-Control': 'no-store',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath)
    .on('error', () => res.destroy())
    .pipe(res);
}

/**
 * Send a plain-text response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {string} body
 * @param {Record<string, string>} [headers]
 */
function sendText(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

/**
 * Request handler: GET/HEAD only, base path only, 404 for everything else.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @returns {Promise<void>}
 */
async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const file = await resolveFile(pathname);
  if (file) {
    await sendFile(req, res, 200, file);
    return;
  }

  const notFoundPage = path.join(OUT_DIR, '404.html');
  if ((await statOrNull(notFoundPage))?.isFile()) {
    await sendFile(req, res, 404, notFoundPage);
    return;
  }
  sendText(res, 404, 'Not Found');
}

if (!existsSync(OUT_DIR)) {
  console.error(`serve-static: ${OUT_DIR} does not exist. Run "npm run build" first.`);
  process.exit(1);
}

const port = Number.parseInt(process.env.PORT ?? '', 10) || DEFAULT_PORT;

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('serve-static:', error);
    if (res.headersSent) res.destroy();
    else sendText(res, 500, 'Internal Server Error');
  });
});

server.listen(port, () => {
  console.log(`serve-static: serving ${OUT_DIR} at http://localhost:${port}${BASE_PATH}/`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
