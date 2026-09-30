import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPage, readFile } from './dom.js';

/**
 * Спекът на ЧЕРВЕНА ЛИНИЯ #4 — „нула проследяване, нула външни скриптове".
 *
 * Днес правилото е спазено, но само по навик: нищо не пада, ако утре някой добави
 * един ред `@import url(fonts.googleapis…)` или analytics таг. Страницата е визитка,
 * не продукт — всяка външна заявка е нов начин да се счупи пред краулъра, заради
 * когото изобщо съществува. Оттук нататък такъв ред пада в гейта.
 *
 * Тук е и единствената проверка, че `src/styles.css` изобщо е линкнат: счупи ли се
 * онзи `<link>`, страницата е гола, а всички останали спекове остават зелени.
 */

/** Изходните файлове, които страницата сервира — всичко, което браузърът изпълнява. */
const SOURCES = ['index.html', 'src/styles.css', 'src/i18n.js'];

/**
 * Единствените два адреса, които имаме право да произнасяме: собствената страница
 * (og таговете я искат АБСОЛЮТНА) и приложението, към което водим.
 */
const ALLOWED_HOSTS = ['kalojandg.github.io', 'party-up.kaloiand.workers.dev'];

/** Всеки абсолютен адрес в текста, чийто хост не е наш. */
function externalUrls(source) {
  return [...source.matchAll(/https?:\/\/[^\s"'()<>]+/g)]
    .map(([url]) => url)
    .filter((url) => !ALLOWED_HOSTS.includes(new URL(url).host));
}

test('нито един изходен файл не сочи към чужд адрес', () => {
  for (const file of SOURCES) {
    assert.deepEqual(externalUrls(readFile(file)), [], `${file}: външен адрес`);
  }
});

test('стиловете не теглят шрифтове или CSS отвън', () => {
  for (const file of SOURCES) {
    const source = readFile(file);

    assert.doesNotMatch(source, /@import/, `${file}: @import е външна заявка`);
    assert.doesNotMatch(source, /@font-face/, `${file}: шрифтовете са системни, без @font-face`);
  }
});

test('разметката линква собствените си стилове и нищо извън репото', () => {
  const document = loadPage();

  const stylesheet = document.querySelector('link[rel="stylesheet"]');
  assert.ok(stylesheet, 'index.html не линква нито един stylesheet');
  assert.equal(stylesheet.getAttribute('href'), 'src/styles.css');

  // Всичко, което браузърът тегли сам: стилове, скриптове, икони, картинки.
  const referenced = [
    ...document.querySelectorAll('link[href]'),
    ...document.querySelectorAll('script[src]'),
    ...document.querySelectorAll('img[src]'),
  ].map((element) => element.getAttribute('href') ?? element.getAttribute('src'));

  for (const path of referenced) {
    assert.doesNotMatch(path, /^(https?:)?\/\//, `външен ресурс в разметката: ${path}`);
  }
});
