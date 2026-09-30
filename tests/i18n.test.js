import assert from 'node:assert/strict';
import { test } from 'node:test';

import { JSDOM } from 'jsdom';

import {
  STORAGE_KEY,
  applyTranslations,
  pickInitialLang,
  setupLanguageSwitch,
} from '../src/i18n.js';

/**
 * Спекът на i18n модула. Нарочно НЕ зарежда `index.html`: тества се ПОВЕДЕНИЕ по
 * договора (data-i18n / data-i18n-aria), а не конкретната разметка — юнит тест не
 * бива да пада, защото някой е преместил секция. Затова всеки тест си строи
 * собствен минимален фрагмент и подава собствен речник и localStorage.
 */

/** Минималният фрагмент: бутон за език + един превеждан възел + един БЕЗ превод. */
const FRAGMENT = `
  <button data-testid="lang-toggle" data-i18n-aria="lang.toggle">
    <span data-i18n="lang.short">EN</span>
  </button>
  <h1 data-i18n="hero.title">Party Up</h1>
  <p data-i18n="hero.tagline">Масите дърпат играчите, не обратното.</p>
  <p data-i18n="footer.madeWith">Направено за масата, не за алгоритъма.</p>
`;

/** `footer.madeWith` липсва НАРОЧНО в двата речника — той е случаят „липсващ ключ". */
const DICTIONARIES = {
  bg: {
    'hero.title': 'Party Up',
    'hero.tagline': 'Масите дърпат играчите — ти избираш маса, не късмет.',
    'lang.short': 'EN',
    'lang.toggle': 'Смени езика на английски',
  },
  en: {
    'hero.title': 'Party Up',
    'hero.tagline': 'Tables pull players — you pick a table, not your luck.',
    'lang.short': 'БГ',
    'lang.toggle': 'Switch language to Bulgarian',
  },
};

const load = async (lang) => DICTIONARIES[lang];

function makeDocument() {
  const dom = new JSDOM(`<!doctype html><html lang="bg"><body>${FRAGMENT}</body></html>`);

  return dom.window.document;
}

/** localStorage в паметта — толкова, колкото модулът ползва. */
function memoryStorage(initial = {}) {
  const store = new Map(Object.entries(initial));

  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

/** Частният прозорец: ХВЪРЛЯ при самото четене, не само при запис. */
const hostileStorage = {
  getItem() {
    throw new Error('SecurityError: достъпът до localStorage е отказан');
  },
  setItem() {
    throw new Error('SecurityError: достъпът до localStorage е отказан');
  },
};

/** Тих `warn`, който помни с какво е бил викан — липсващите ключове са шумни по дизайн. */
function recordingWarn() {
  const calls = [];
  const warn = (...args) => void calls.push(args);

  warn.calls = calls;

  return warn;
}

test('(а) прилага текстовете по data-i18n', () => {
  const document = makeDocument();

  applyTranslations(DICTIONARIES.bg, document, { warn: recordingWarn() });

  assert.equal(document.querySelector('h1').textContent, 'Party Up');
  assert.equal(
    document.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.bg['hero.tagline'],
  );
  assert.equal(document.querySelector('[data-i18n="lang.short"]').textContent, 'EN');
});

test('(б) прилага aria-label по data-i18n-aria', () => {
  const document = makeDocument();

  applyTranslations(DICTIONARIES.en, document, { warn: recordingWarn() });

  assert.equal(
    document.querySelector('[data-testid="lang-toggle"]').getAttribute('aria-label'),
    DICTIONARIES.en['lang.toggle'],
  );
});

test('(в) липсващ ключ оставя оригиналния текст непокътнат и предупреждава', () => {
  const document = makeDocument();
  const orphan = document.querySelector('[data-i18n="footer.madeWith"]');
  const before = orphan.textContent;
  const warn = recordingWarn();

  const missing = applyTranslations(DICTIONARIES.bg, document, { warn });

  assert.equal(orphan.textContent, before, 'липсващият ключ е изпразнил текста');
  assert.deepEqual(missing, ['footer.madeWith']);
  assert.equal(warn.calls.length, 1, 'предупреждението трябва да е точно едно');
  assert.match(String(warn.calls[0][0]), /footer\.madeWith/);
});

test('(г) смяната на езика обновява document.documentElement.lang', async () => {
  const document = makeDocument();
  const i18n = setupLanguageSwitch({
    doc: document,
    storage: memoryStorage(),
    load,
    warn: recordingWarn(),
  });

  await i18n.ready;

  assert.equal(document.documentElement.lang, 'bg', 'езикът по подразбиране е bg');
  assert.equal(
    document.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.bg['hero.tagline'],
  );

  document.querySelector('[data-testid="lang-toggle"]').click();
  await i18n.pending;

  assert.equal(document.documentElement.lang, 'en');
  assert.equal(
    document.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.en['hero.tagline'],
  );
  assert.equal(
    document.querySelector('[data-i18n="lang.short"]').textContent,
    'БГ',
    'бутонът показва КЪМ КОЙ език води',
  );
});

test('(д) изборът се запомня и се чете при следващо зареждане', async () => {
  const storage = memoryStorage();
  const first = makeDocument();
  const i18n = setupLanguageSwitch({ doc: first, storage, load, warn: recordingWarn() });

  await i18n.ready;
  first.querySelector('[data-testid="lang-toggle"]').click();
  await i18n.pending;

  assert.equal(storage.getItem(STORAGE_KEY), 'en', 'изборът не е запомнен');

  const second = makeDocument();
  const reloaded = setupLanguageSwitch({ doc: second, storage, load, warn: recordingWarn() });

  await reloaded.ready;

  assert.equal(second.documentElement.lang, 'en');
  assert.equal(
    second.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.en['hero.tagline'],
  );
});

/**
 * Зареждане, което виси, докато тестът не го пусне — така „бавната мрежа" е
 * детерминистична, вместо да се гони със `setTimeout`.
 */
function controllableLoad() {
  const waiting = [];
  const load = (lang) => new Promise((resolve) => waiting.push(() => resolve(DICTIONARIES[lang])));

  load.releaseAll = async () => {
    while (waiting.length > 0) waiting.shift()();
    // Две микрозадачи: една за `await load(...)`, една за продължението след него.
    await Promise.resolve();
    await Promise.resolve();
  };

  return load;
}

test('(е) бърз двоен клик връща предишния език, вместо да е no-op', async () => {
  const document = makeDocument();
  const slow = controllableLoad();
  const i18n = setupLanguageSwitch({
    doc: document,
    storage: memoryStorage(),
    load: slow,
    warn: recordingWarn(),
  });

  await slow.releaseAll();
  await i18n.ready;
  assert.equal(i18n.lang, 'bg');

  const toggle = document.querySelector('[data-testid="lang-toggle"]');

  // Двата клика падат в прозореца на зареждането — вторият трябва да е „обратно към bg",
  // а не пореден „към en", защото посоката се смята от ПОИСКАНИЯ, не от приложения език.
  toggle.click();
  toggle.click();

  await slow.releaseAll();
  await i18n.pending;

  assert.equal(i18n.lang, 'bg', 'вторият клик трябва да върне българския');
  assert.equal(document.documentElement.lang, 'bg');
  assert.equal(
    document.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.bg['hero.tagline'],
  );
});

test('(ж) localStorage, който хвърля, НЕ чупи прилагането на текстовете', async () => {
  const document = makeDocument();

  assert.doesNotThrow(() => pickInitialLang({ storage: hostileStorage, language: 'en-GB' }));
  assert.equal(pickInitialLang({ storage: hostileStorage, language: 'en-GB' }), 'bg');

  const i18n = setupLanguageSwitch({
    doc: document,
    storage: hostileStorage,
    load,
    warn: recordingWarn(),
  });

  await i18n.ready;

  assert.equal(
    document.querySelector('[data-i18n="hero.tagline"]').textContent,
    DICTIONARIES.bg['hero.tagline'],
    'страницата трябва да работи и в частен прозорец',
  );

  document.querySelector('[data-testid="lang-toggle"]').click();
  await i18n.pending;

  assert.equal(document.documentElement.lang, 'en', 'смяната трябва да работи без памет');
});
