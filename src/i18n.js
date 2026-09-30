/**
 * Смяната на езика по време на изпълнение — ES модул без зависимости.
 *
 * Разделението е нарочно: `applyTranslations` е чиста функция (речник + корен →
 * приложени текстове) и се тества без fetch и без страница, а `setupLanguageSwitch`
 * държи целия страничен ефект (document, localStorage, бутона). Долу в файла стои
 * ЕДИНСТВЕНОТО автоматично закачане, и то зад проверка за `document` — така модулът
 * се внася от тест в Node, без да иска браузър.
 *
 * Конвенцията в разметката: `data-i18n="<ключ>"` за текстов възел,
 * `data-i18n-aria="<ключ>"` за достъпно име. Текстът в HTML-а е БЪЛГАРСКИЯТ — той е
 * езикът по подразбиране, затова липсващ ключ оставя написаното, вместо да го трие.
 */

/** Ключът в localStorage. Сменя ли се, потребителите губят избора си. */
export const STORAGE_KEY = 'partyup.lang';

/** Езикът по подразбиране — страницата е написана на него. */
export const DEFAULT_LANG = 'bg';

/** Двата езика. Превключвателят е ключ, не списък — затова са точно два. */
export const LANGS = ['bg', 'en'];

/** Другият език: бутонът винаги води КЪМ него. */
export function otherLang(lang) {
  return lang === 'en' ? 'bg' : 'en';
}

const warnedKeys = new Set();

/** Предупреждава веднъж за ключ — иначе всяка смяна на език преповтаря същия шум. */
function warnOnce(message) {
  if (warnedKeys.has(message)) return;

  warnedKeys.add(message);
  console.warn(message);
}

/**
 * Прилага речника върху дърво — чистата функция, сърцето на модула.
 *
 * Липсващият ключ НЕ изтрива текста: тихо изпразнена страница заради една липсваща
 * дума е по-лошо от разминат превод. Само `textContent`, никога `innerHTML` — текстът
 * идва от наш JSON файл, но навикът е по-важен от конкретния случай.
 *
 * @param {Record<string, string>} dictionary плоски ключове с точки
 * @param {ParentNode & { querySelectorAll: Function }} root корен за търсене (document или елемент)
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {string[]} ключовете, които речникът не покрива
 */
export function applyTranslations(dictionary, root, { warn = warnOnce } = {}) {
  const dict = dictionary ?? {};
  const missing = [];

  const value = (key) => {
    const text = dict[key];

    if (typeof text === 'string' && text.length > 0) return text;

    missing.push(key);

    return null;
  };

  for (const element of root.querySelectorAll('[data-i18n]')) {
    const text = value(element.getAttribute('data-i18n'));

    if (text !== null) element.textContent = text;
  }

  for (const element of root.querySelectorAll('[data-i18n-aria]')) {
    const text = value(element.getAttribute('data-i18n-aria'));

    if (text !== null) element.setAttribute('aria-label', text);
  }

  if (missing.length > 0) {
    warn(`[i18n] липсващи ключове (текстът в HTML-а остава): ${missing.join(', ')}`);
  }

  return missing;
}

/**
 * Запомненият избор или `null`. ВСЕКИ достъп е в try/catch — частен прозорец хвърля
 * при самото четене, а страницата трябва да работи и там.
 */
export function readStoredLang(storage) {
  try {
    const stored = storage?.getItem(STORAGE_KEY);

    return LANGS.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Запомня избора. Връща дали е успяло — провалът не е грешка, а частен прозорец. */
export function storeLang(lang, storage) {
  try {
    storage?.setItem(STORAGE_KEY, lang);

    return true;
  } catch {
    return false;
  }
}

/**
 * Началният език: запомненият избор → езикът на браузъра → `bg`.
 *
 * Браузърният език може само да ПОТВЪРДИ българския: по договор `bg` е по подразбиране,
 * а английският е съзнателен избор през бутона. Клонът стои, защото правилото е част от
 * контракта — не защото сменя изхода.
 */
export function pickInitialLang({ storage, language = '' } = {}) {
  const stored = readStoredLang(storage);

  if (stored) return stored;
  if (String(language).toLowerCase().startsWith('bg')) return 'bg';

  return DEFAULT_LANG;
}

/**
 * Зарежда `src/content.<lang>.json`. Адресът се решава спрямо модула, не спрямо
 * страницата — под GitHub Pages сайтът живее в поддиректория и относителен път от
 * документа сочи другаде.
 */
export async function loadDictionary(lang, fetchImpl = globalThis.fetch) {
  const url = new URL(`content.${lang}.json`, import.meta.url).href;
  const response = await fetchImpl(url);

  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);

  return response.json();
}

/** localStorage, ако прозорецът го дава — самото четене на свойството може да хвърли. */
function safeStorage(view) {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Закача езика за страницата: избира начален език, зарежда речника, прилага го,
 * обновява `documentElement.lang` и връзва бутона.
 *
 * Връща дръжка, за да е тестваемо отвън: `ready` е първоначалното прилагане, `pending`
 * е последното (бутонът е синхронен, работата не е), `lang` е текущият език.
 */
export function setupLanguageSwitch({
  doc,
  storage = safeStorage(doc?.defaultView),
  language = doc?.defaultView?.navigator?.language ?? '',
  load = loadDictionary,
  warn = warnOnce,
} = {}) {
  let current = pickInitialLang({ storage, language });
  // `current` е ПРИЛОЖЕНИЯТ език, `requested` — последно поисканият. Двете се
  // разминават само докато речникът пътува, и точно там беше дефектът: бутонът
  // четеше `current`, тоест два бързи клика смятаха една и съща посока и вторият
  // беше no-op вместо връщане назад. На локален JSON прозорецът е милисекунди,
  // на телефон в мобилна мрежа — не.
  let requested = current;
  // Коя заявка е последна. Два клика значи два речника в движение; те могат да се
  // върнат разменени, а тогава изпреварената презаписва по-новата.
  let latest = 0;

  async function apply(lang, { remember }) {
    const ticket = ++latest;

    requested = lang;

    let dictionary;

    try {
      dictionary = await load(lang);
    } catch (error) {
      // Речникът не се зареди → страницата остава на каквото има (българския HTML),
      // тоест поисканото се връща на ПРИЛОЖЕНОТО — иначе бутонът сочи език, до който
      // никога не сме стигнали. Само ако не сме изпреварени: по-новият клик решава.
      if (ticket === latest) requested = current;

      warn(`[i18n] речникът за "${lang}" не се зареди: ${error?.message ?? error}`);

      return;
    }

    // Изпреварен от по-нов клик → мълчи. Иначе бавният отговор връща стария език.
    if (ticket !== latest) return;

    current = lang;
    // Без това екранните четци и търсачките четат грешен език — половината смисъл
    // на упражнението е точно този атрибут.
    doc.documentElement.lang = lang;
    applyTranslations(dictionary, doc, { warn });

    if (remember) storeLang(lang, storage);
  }

  let pending = apply(current, { remember: false });

  /** Сменя езика както го прави бутонът: прилага наново И запомня избора. */
  function switchTo(lang) {
    pending = apply(lang, { remember: true });

    return pending;
  }

  const toggle = doc.querySelector('[data-testid="lang-toggle"]');

  if (toggle) {
    toggle.addEventListener('click', () => void switchTo(otherLang(requested)));
  }

  return {
    ready: pending,
    get pending() {
      return pending;
    },
    get lang() {
      return current;
    },
    switchTo,
  };
}

// Единственият страничен ефект на модула. Проверката за `document` е това, което
// позволява файлът да се внася от юнит тест в Node без браузър.
if (typeof document !== 'undefined') {
  setupLanguageSwitch({ doc: document });
}
