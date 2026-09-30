import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { JSDOM } from 'jsdom';

const ROOT = new URL('../', import.meta.url);

/**
 * Зарежда `index.html` в DOM — общият помощник на всички спекове, за да не се
 * преписва във всеки файл (и за да е ЕДНО мястото, което знае къде е страницата).
 *
 * ⚠ Разметката се зарежда БЕЗ да се изпълняват скриптовете и БЕЗ да се теглят
 * ресурси, и това НЕ е пропуск: проверено е, че jsdom не изпълнява
 * `<script type="module">` изобщо, а `resources: 'usable'` тръгва да тегли
 * `src/styles.css` и `src/i18n.js` от ЖИВИЯ адрес по мрежата (виж `url` долу).
 * Тоест такава опция хем не върши работа, хем вкарва мрежова зависимост в юнит
 * суит. Тестовете за ПОВЕДЕНИЕ закачат `setupLanguageSwitch` ръчно и подменят
 * само зареждането на речника — виж `page.test.js`.
 */
export function loadPage() {
  const html = readFileSync(fileURLToPath(new URL('index.html', ROOT)), 'utf8');

  const dom = new JSDOM(html, {
    url: 'https://kalojandg.github.io/party-up-landing/',
  });

  return dom.window.document;
}

/** Суровият текст на файл от репото — за проверки, които не искат DOM. */
export function readFile(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, ROOT)), 'utf8');
}

/** Суровите БАЙТОВЕ на файл — за активите, чието съдържание, не текст, е договорът. */
export function readBytes(relativePath) {
  return readFileSync(fileURLToPath(new URL(relativePath, ROOT)));
}
