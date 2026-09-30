import assert from 'node:assert/strict';
import { test } from 'node:test';

import { setupLanguageSwitch } from '../src/i18n.js';
import { loadPage, readFile } from './dom.js';

/**
 * ИНТЕГРАЦИОННИЯТ спек: единственото място, което вижда разметката, двата речника и
 * i18n модула ЕДНОВРЕМЕННО.
 *
 * Останалите спекове доказват всеки своята зона срещу ДОГОВОРА за ключовете. Тук се
 * доказва, че договорът е бил спазен от всички: ключ, който го има в разметката, но не
 * и в речника, е мълчаливо непреведен възел на живо, а не грешка по време на тест.
 * Обратното — ключ в речника, който никой не ползва — е фосил, който следващият човек
 * ще превежда напразно.
 *
 * ⚠ ЗАЩО НЕ `loadPage({ scripts: true })`: jsdom НЕ изпълнява `<script type="module">`
 * (проверено — `aria-label` остава статичният от HTML-а), а `resources: 'usable'`
 * тръгва да тегли `src/styles.css` и `src/i18n.js` от ЖИВИЯ адрес по мрежата. Тоест
 * този вариант хем не върши работа, хем вкарва мрежова зависимост в юнит суит. Затова
 * страницата се зарежда БЕЗ ресурси, а модулът се закача РЪЧНО — както предвижда
 * бележката на таска: подменя се зареждането на речника, не се мени `src/i18n.js`.
 * Реални са и разметката, и модулът, и речниците; подправен е само `fetch`-ът.
 */

/** Речниците — прочетени от диска, не преписани. Разминат превод трябва да ПАДА тук. */
const DICTIONARIES = {
  bg: JSON.parse(readFile('src/content.bg.json')),
  en: JSON.parse(readFile('src/content.en.json')),
};

const APP_URL = 'https://party-up.kaloiand.workers.dev/';
const PAGE_URL = 'https://kalojandg.github.io/party-up-landing/';

/** Мястото на `fetch`: същият договор (`lang → речник`), само че от диска. */
const load = async (lang) => structuredClone(DICTIONARIES[lang]);

/** localStorage в паметта, за да не си говорят тестовете през общо състояние. */
function memoryStorage() {
  const store = new Map();

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

/** Тих `warn`, който помни с какво е викан — липсващ ключ трябва да е видим, не удобен. */
function recordingWarn() {
  const calls = [];
  const warn = (...args) => void calls.push(args.join(' '));

  warn.calls = calls;

  return warn;
}

/** Многоредовият HTML прави текста надупчен с нови редове — сравнява се смисълът. */
const squish = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/** Всички i18n ключове, които разметката наистина ползва, по вид. */
function markupKeys(document) {
  const byAttribute = (attribute) =>
    [...document.querySelectorAll(`[${attribute}]`)].map((element) => ({
      key: element.getAttribute(attribute),
      element,
    }));

  const text = byAttribute('data-i18n');
  const aria = byAttribute('data-i18n-aria');

  return { text, aria, all: [...text, ...aria].map(({ key }) => key) };
}

/**
 * Страницата с ЗАКАЧЕН модул — тоест това, което потребителят вижда.
 *
 * Проверката за `<script type="module" src="src/i18n.js">` стои тук нарочно: тестът
 * закача модула ръчно, така че единственото, което пази истинското закачане в
 * `index.html`, е точно това твърдение.
 */
async function openPage() {
  const document = loadPage();

  const script = document.querySelector('script[type="module"]');

  assert.ok(script, 'index.html трябва да зарежда i18n модула като ES модул');
  assert.equal(script.getAttribute('src'), 'src/i18n.js');

  const warn = recordingWarn();
  const i18n = setupLanguageSwitch({ doc: document, storage: memoryStorage(), load, warn });

  await i18n.ready;

  return { document, i18n, warn };
}

/** Всеки преводим възел носи ТОЧНО стойността от речника — текст и достъпно име. */
function assertPageSpeaks(document, dictionary, lang) {
  const { text, aria } = markupKeys(document);

  for (const { key, element } of text) {
    assert.equal(
      squish(element.textContent),
      squish(dictionary[key]),
      `[${lang}] ${key} не показва текста от речника`,
    );
  }

  for (const { key, element } of aria) {
    assert.equal(
      squish(element.getAttribute('aria-label')),
      squish(dictionary[key]),
      `[${lang}] ${key} не показва достъпното име от речника`,
    );
  }
}

test('(а) всеки i18n ключ от разметката съществува в ДВАТА речника', () => {
  const document = loadPage();
  const used = markupKeys(document).all;

  assert.ok(used.length > 0, 'разметката е без нито един i18n ключ');

  for (const [lang, dictionary] of Object.entries(DICTIONARIES)) {
    const missing = used.filter((key) => !(key in dictionary));

    assert.deepEqual(missing, [], `content.${lang}.json не покрива: ${missing.join(', ')}`);
  }
});

test('(б) всеки ключ от речниците се ползва поне веднъж в разметката', () => {
  const document = loadPage();
  const used = new Set(markupKeys(document).all);

  for (const [lang, dictionary] of Object.entries(DICTIONARIES)) {
    const orphans = Object.keys(dictionary).filter((key) => !used.has(key));

    assert.deepEqual(orphans, [], `сирашки ключове в content.${lang}.json: ${orphans.join(', ')}`);
  }
});

test('(в) при bg страницата говори български и обявява lang="bg"', async () => {
  const { document, warn } = await openPage();

  assert.equal(document.documentElement.lang, 'bg', 'езикът по подразбиране е bg');
  assertPageSpeaks(document, DICTIONARIES.bg, 'bg');

  assert.deepEqual(warn.calls, [], `речникът не покри разметката: ${warn.calls.join(' | ')}`);
});

test('(г) бутонът сменя на английски — и текстовете, и lang атрибутът', async () => {
  const { document, i18n } = await openPage();

  document.querySelector('[data-testid="lang-toggle"]').click();
  await i18n.pending;

  assert.equal(document.documentElement.lang, 'en');
  assertPageSpeaks(document, DICTIONARIES.en, 'en');

  assert.equal(
    squish(document.querySelector('[data-i18n="lang.short"]').textContent),
    'БГ',
    'бутонът показва КЪМ КОЙ език води, не текущия',
  );
});

test('(д) og:url и og:image са абсолютни и сочат party-up-landing', () => {
  const document = loadPage();

  const meta = (key) =>
    document.querySelector(`meta[property="${key}"]`)?.getAttribute('content') ?? null;

  assert.equal(meta('og:url'), PAGE_URL);
  assert.equal(meta('og:image'), `${PAGE_URL}assets/og.png`);

  for (const key of ['og:url', 'og:image']) {
    assert.match(meta(key) ?? '', /^https:\/\/kalojandg\.github\.io\/party-up-landing\//, key);
  }
});

test('(е) връзката към приложението сочи живия адрес', () => {
  const document = loadPage();
  const appLink = document.querySelector('a[data-testid="app-link"]');

  assert.ok(appLink, 'липсва връзка с data-testid="app-link"');
  assert.equal(appLink.getAttribute('href'), APP_URL);
});

/**
 * Допълнението към договора, което пак само този спек може да види: статичният текст в
 * `index.html` е обещан като БЪЛГАРСКИЯ (за да е четима страницата и без скрипт), а
 * модулът нарочно НЕ пипа възел, чийто ключ липсва. Значи разминат ли се HTML-ът и
 * `content.bg.json`, страницата казва едно без скрипт и друго с него — тихо, без нито
 * един червен тест. Точно този клас разминаване чупи и достъпното име на бутона.
 */
test('(ж) статичният текст в разметката е същият като в content.bg.json', () => {
  const document = loadPage();

  assertPageSpeaks(document, DICTIONARIES.bg, 'bg (без скрипт)');
});
