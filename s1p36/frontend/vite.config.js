import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Settings the worker reads in production come from wrangler.toml [vars] and, locally, from an optional .dev.vars file.
function readVars(root) {
  const vars = { MCP_MODE: 'off' };
  try {
    const toml = fs.readFileSync(path.join(root, 'wrangler.toml'), 'utf8');
    const section = toml.split(/^\[vars\]\s*$/m)[1];
    if (section) {
      for (const line of section.split('\n')) {
        if (/^\s*\[/.test(line)) break;
        const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"([^"]*)"/);
        if (m) vars[m[1]] = m[2];
      }
    }
  } catch { /* no wrangler.toml: keep the defaults */ }
  try {
    const dev = fs.readFileSync(path.join(root, '.dev.vars'), 'utf8');
    for (const line of dev.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* optional file */ }
  return vars;
}

// Stands in for the static-asset binding: serves files from public/ (the data folder lives there)
function localAssets(root) {
  const base = path.resolve(root, 'public') + path.sep;
  return {
    async fetch(request) {
      const rel = decodeURIComponent(new URL(request.url).pathname).replace(/^\/+/, '');
      const file = path.resolve(root, 'public', rel);
      if (!file.startsWith(base) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return new Response('Not found', { status: 404 });
      }
      const type = file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
      return new Response(fs.readFileSync(file), { headers: { 'content-type': type } });
    },
  };
}

function ownedRoute(pathname) {
  return pathname.startsWith('/api/') || pathname === '/mcp' || pathname.startsWith('/mcp/');
}

// Runs worker/index.js for /api and /mcp while developing or previewing
function localWorker() {
  const handler = loadWorker => async (req, res, next) => {
    const pathname = (req.url || '').split('?')[0];
    if (!ownedRoute(pathname)) return next();
    try {
      const worker = await loadWorker();
      const root = process.cwd();
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const hasBody = chunks.length > 0 && req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request('http://' + (req.headers.host || 'localhost') + req.url, {
        method: req.method,
        headers: req.headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await worker.fetch(request, { ...readVars(root), ASSETS: localAssets(root) });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: 'The local worker failed: ' + (err && err.message) }));
    }
  };
  return {
    name: 'local-worker',
    configureServer(server) {
      server.middlewares.use(handler(async () => (await server.ssrLoadModule('/worker/index.js')).default));
    },
    configurePreviewServer(server) {
      const file = pathToFileURL(path.resolve(process.cwd(), 'worker/index.js')).href;
      server.middlewares.use(handler(async () => (await import(file)).default));
    },
  };
}

export default defineConfig({
  plugins: [react(), localWorker()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { vendor: ['react', 'react-dom'], charts: ['recharts'] } },
    },
  },
  server: { port: 5173 },
});
