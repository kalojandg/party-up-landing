import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPage } from './dom.js';

/**
 * Спекът на разметката: пази ДОГОВОРА между index.html и останалите зони.
 *
 * Две неща се заключват тук, защото счупят ли се, страницата губи смисъла си:
 *   1. i18n ключовете — `src/content.*.json` се пишат срещу тях, затова липсващ
 *      ключ в разметката е мълчалив непреведен възел, не грешка по време на тест;
 *   2. мета таговете — краулерът на LinkedIn не стига до `*.workers.dev`, така че
 *      тази страница е единственият адрес, който носи картичката. Относителен
 *      `og:image` или липсващ размер значи гол линк вместо визитка.
 */

/** Договорът за ключовете — дословно същият в тасковете за превода и за i18n логиката. */
const I18N_KEYS = [
  'hero.title',
  'hero.tagline',
  'pitch.question',
  'pitch.punchline',
  'pitch.body',
  'spread.title',
  'spread.body',
  'cta.open',
  'lang.toggle',
  'lang.short',
  'footer.madeWith',
];

const APP_URL = 'https://party-up.kaloiand.workers.dev/';
const PAGE_URL = 'https://kalojandg.github.io/party-up-landing/';

/** Съдържанието на `<meta>` по property (og) или name (twitter) — единият от двата. */
function meta(document, key) {
  const element =
    document.querySelector(`meta[property="${key}"]`) ?? document.querySelector(`meta[name="${key}"]`);

  return element?.getAttribute('content') ?? null;
}

test('всеки ключ от договора присъства в разметката', () => {
  const document = loadPage();

  const present = new Set(
    [...document.querySelectorAll('[data-i18n], [data-i18n-aria]')].flatMap((element) =>
      [element.getAttribute('data-i18n'), element.getAttribute('data-i18n-aria')].filter(Boolean),
    ),
  );

  const missing = I18N_KEYS.filter((key) => !present.has(key));

  assert.deepEqual(missing, [], `липсват i18n ключове: ${missing.join(', ')}`);
});

test('og:url и og:image са абсолютни и сочат към страницата', () => {
  const document = loadPage();

  assert.equal(meta(document, 'og:url'), PAGE_URL);
  assert.equal(meta(document, 'og:image'), `${PAGE_URL}assets/og.png`);

  for (const key of ['og:url', 'og:image']) {
    assert.match(meta(document, key) ?? '', /^https:\/\//, `${key} трябва да е абсолютен URL`);
  }
});

test('размерът на картичката е обявен като 1200×630', () => {
  const document = loadPage();

  assert.equal(meta(document, 'og:image:width'), '1200');
  assert.equal(meta(document, 'og:image:height'), '630');
});

test('twitter:card иска голяма картичка', () => {
  const document = loadPage();

  assert.equal(meta(document, 'twitter:card'), 'summary_large_image');
});

test('връзката към приложението сочи живия адрес', () => {
  const document = loadPage();
  const appLink = document.querySelector('a[data-testid="app-link"]');

  assert.ok(appLink, 'липсва връзка с data-testid="app-link"');
  assert.equal(appLink.getAttribute('href'), APP_URL);
});

test('punchline обявява собствения си език', () => {
  const document = loadPage();
  const punchline = document.querySelector('[data-i18n="pitch.punchline"]');

  assert.ok(punchline, 'липсва punchline абзацът');
  // Редът нарочно остава на английски и в българската версия — без този атрибут
  // екранният четец го чете с фонетиката на документа, тоест с българска.
  assert.equal(punchline.getAttribute('lang'), 'en');
});

test('логото носи alt и запазени размери, за да не скача оформлението', () => {
  const document = loadPage();
  const logo = document.querySelector('img[src="assets/logo.png"]');

  assert.ok(logo, 'липсва логото (assets/logo.png)');
  assert.ok((logo.getAttribute('alt') ?? '').length > 0, 'логото е без alt');
  assert.ok(Number(logo.getAttribute('width')) > 0, 'логото е без width');
  assert.ok(Number(logo.getAttribute('height')) > 0, 'логото е без height');
});
