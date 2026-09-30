import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPage, readBytes, readFile } from './dom.js';

/**
 * Спекът на активите — заключва ДВЕ червени линии наведнъж.
 *
 * ЧЕРВЕНА ЛИНИЯ #2 — „`assets/og.png` не се преоразмерява и не се пре-кодира".
 * Мета таговете ОБЯВЯВАТ 1200×630 и `markup.test.js` пази обявеното, но нищо досега
 * не пазеше самия файл: пре-кодира ли някой картинката на 1000×525, целият suite
 * остава зелен, таговете продължават да лъжат, а LinkedIn рисува гол линк — точно
 * провалът, заради който страницата съществува. Размерите на PNG стоят в IHDR
 * чънка (байтове 16–23), тоест проверката е без зависимост.
 *
 * ЧЕРВЕНА ЛИНИЯ #4 — „нула проследяване, нула външни скриптове".
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
 * Размерът, който платформите за споделяне искат, и размерът, с който логото идва
 * от приложението. И двете са в референцията; и двете днес са верни на диска.
 */
const IMAGE_SIZES = {
  'assets/og.png': [1200, 630],
  'assets/logo.png': [604, 604],
};

/** Ширина и височина от IHDR чънка — първото нещо след 8-байтовия PNG подпис. */
function pngSize(bytes) {
  assert.equal(
    bytes.subarray(1, 4).toString('latin1'),
    'PNG',
    'файлът не е PNG — пре-кодиран ли е в друг формат?',
  );

  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/**
 * Единствените два адреса, които имаме право да произнасяме: собствената страница
 * (og таговете я искат АБСОЛЮТНА) и приложението, към което водим.
 */
const ALLOWED_HOSTS = ['kalojandg.github.io', 'party-up.kaloiand.workers.dev'];

const PAGE_URL = 'https://kalojandg.github.io/party-up-landing/';

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

test('картинката за споделяне е точно 1200×630 НА ДИСКА, не само в мета таговете', () => {
  for (const [path, [width, height]] of Object.entries(IMAGE_SIZES)) {
    assert.deepEqual(pngSize(readBytes(path)), [width, height], `${path}: сменен размер`);
  }
});

test('всеки ресурс, който разметката иска, наистина съществува в репото', () => {
  const document = loadPage();

  // og:image е АБСОЛЮТЕН по договор (краулерът не разбира относителен път), затова
  // се сваля до път в репото — печатна грешка в него е гол линк в LinkedIn.
  const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
  assert.ok(ogImage?.startsWith(PAGE_URL), `og:image не сочи страницата: ${ogImage}`);

  const referenced = [
    ogImage.slice(PAGE_URL.length),
    ...[
      ...document.querySelectorAll('link[href]'),
      ...document.querySelectorAll('script[src]'),
      ...document.querySelectorAll('img[src]'),
    ].map((element) => element.getAttribute('href') ?? element.getAttribute('src')),
  ];

  for (const path of referenced) {
    assert.doesNotThrow(() => readBytes(path), `разметката сочи липсващ файл: ${path}`);
  }
});
