// Servidor local: sirve /public y ejecuta las funciones de /api igual que Vercel.
// Sin DATABASE_URL usa un Postgres embebido (PGlite), así que no hay que configurar nada.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  decorate(res);

  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    try {
      const mod = await import(pathToFileURL(join(root, 'api', `${name}.js`)).href);
      req.query = Object.fromEntries(url.searchParams);
      req.body = await readBody(req);
      await mod.default(req, res);
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND') return res.status(404).json({ error: 'No existe.' });
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor.' });
    }
    return;
  }

  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(publicDir, rel));
  if (!file.startsWith(publicDir)) return res.status(403).end();
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.status(404).end('Not found');
  }
});

server.listen(port, () => console.log(`Ledger en http://localhost:${port}`));
