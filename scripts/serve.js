import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Локален преглед на статичния сайт — колкото да се отвори в браузър.
 * НЕ е част от деплоя: GitHub Pages сервира репото както е.
 *
 * ⚠ Портът е ЕКСКЛУЗИВЕН за този проект (флотът дели машината): 45279 е зает от
 * inventory/hero/spells, 45278 от combat, 45280/45281 от party-up. Тук е 45277.
 */
const PORT = Number(process.env.PORT ?? 45277);
const ROOT = fileURLToPath(new URL('../', import.meta.url));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

createServer((request, response) => {
  const requested = decodeURIComponent((request.url ?? '/').split('?')[0]);
  // normalize + проверка за излизане от корена: сървърът е локален, но да не
  // сервира половината диск при `/../../`.
  const relative = normalize(requested === '/' ? 'index.html' : requested.replace(/^\/+/, ''));
  const file = join(ROOT, relative);

  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Няма такъв файл: ' + relative);
    return;
  }

  response.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(PORT, () => {
  console.log(`Party Up визитката: http://127.0.0.1:${PORT}/`);
});
