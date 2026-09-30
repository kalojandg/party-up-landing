import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);

/**
 * Зарежда `index.html` в DOM — общият помощник на всички спекове, за да не се
 * преписва във всеки файл (и за да е ЕДНО мястото, което знае къде е страницата).
 *
 * @param {{ scripts?: boolean }} options `scripts: true` ИЗПЪЛНЯВА скриптовете на
 *   страницата — нужно е само на тестовете за поведение (смяна на език); за
 *   проверки върху разметката оставяй изключено, така е и по-бързо, и по-стабилно.
 */
export function loadPage({ scripts = false } = {}) {
  const html = readFileSync(fileURLToPath(new URL('index.html', ROOT)), 'utf8');

  const dom = new JSDOM(html, {
    url: 'https://kalojandg.github.io/partyup/',
    runScripts: scripts ? 'dangerously' : undefined,
    resources: scripts ? 'usable' : undefined,
  });

  return dom.window.document;
}

/** Суровият текст на файл от репото — за проверки, които не искат DOM. */
export function readFile(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, ROOT)), 'utf8');
}
