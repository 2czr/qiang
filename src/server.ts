import { createServer, type ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { parse } from 'url';
import next from 'next';

const dev = process.env.COZE_PROJECT_ENV !== 'PROD';
const hostname = process.env.HOST || process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.DEPLOY_RUN_PORT || process.env.PORT || '5000', 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const root = process.cwd();

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

async function serveFile(res: ServerResponse, filePath: string) {
  const normalized = path.normalize(filePath);
  if (!normalized.startsWith(root)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return true;
  }

  try {
    const data = await readFile(normalized);
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(normalized).toLowerCase()] || 'application/octet-stream',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      const pathname = parsedUrl.pathname || '/';

      if (pathname === '/' || pathname === '/campus-anonymous-wall.html') {
        const served = await serveFile(res, path.join(root, 'campus-anonymous-wall.html'));
        if (served) return;
      }

      if (pathname.startsWith('/public/') || pathname.startsWith('/assets/')) {
        const served = await serveFile(res, path.join(root, decodeURIComponent(pathname)));
        if (served) return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });
  server.once('error', err => {
    console.error(err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(
      `> Server listening at http://${hostname}:${port} as ${
        dev ? 'development' : process.env.COZE_PROJECT_ENV
      }`,
    );
  });
});
