#!/usr/bin/env node
// Minimal static server for e2e tests and Lighthouse CI. It applies the rules in
// dist/_headers the way Cloudflare Workers Static Assets does (a path pattern line,
// then indented "Name: value" lines; "*" matches any characters; rules in file order;
// a header set by several matching rules is joined with ", "), so local tests run under
// the same CSP and caching headers as production. Not a production server.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [dirArg = 'dist', portArg = '4173'] = process.argv.slice(2);
const root = resolve(dirArg);
const port = Number(portArg);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

export function parseHeaders(text) {
  const rules = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      const pattern = raw.trim();
      const re = new RegExp(
        '^' +
          pattern
            .split('*')
            .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*') +
          '$',
      );
      current = { pattern, re, headers: [] };
      rules.push(current);
    } else if (current) {
      const i = raw.indexOf(':');
      if (i > 0) current.headers.push([raw.slice(0, i).trim(), raw.slice(i + 1).trim()]);
    }
  }
  return rules;
}

export function headersFor(rules, path) {
  const out = new Map();
  for (const rule of rules) {
    if (!rule.re.test(path)) continue;
    for (const [name, value] of rule.headers) {
      const key = name.toLowerCase();
      out.set(key, out.has(key) ? `${out.get(key)}, ${value}` : value);
    }
  }
  return out;
}

const headersFile = join(root, '_headers');
const rules = existsSync(headersFile) ? parseHeaders(readFileSync(headersFile, 'utf8')) : [];

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = decodeURIComponent(url.pathname);
  let file = normalize(join(root, path === '/' ? 'index.html' : path));
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (path === '/_headers' || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(root, '404.html');
    if (!existsSync(file)) {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
      return;
    }
    res.statusCode = 404;
  }
  for (const [name, value] of headersFor(rules, path)) res.setHeader(name, value);
  res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
});

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(sep).join('/'))) {
  server.listen(port, '127.0.0.1', () => {
    console.log(
      `Serving ${root} with ${rules.length} _headers rule(s) on http://127.0.0.1:${port}`,
    );
  });
}
