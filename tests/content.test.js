import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readFile } from './dom.js';

/**
 * Договорът за i18n ключовете (същият в тасковете 10, 20 и 30) — виж
 * `partyup-landing-structure.md` и notes-а на таск 20 за пълния списък.
 */
const CONTRACT_KEYS = [
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

function loadContent(lang) {
  return JSON.parse(readFile(`src/content.${lang}.json`));
}

test('bg и en файловете имат точно едни и същи ключове', () => {
  const bg = loadContent('bg');
  const en = loadContent('en');

  const bgKeys = Object.keys(bg).sort();
  const enKeys = Object.keys(en).sort();

  assert.deepEqual(bgKeys, enKeys, 'ключовете на двата файла се разминават');
});

test('нито една стойност не е празна', () => {
  const bg = loadContent('bg');
  const en = loadContent('en');

  for (const [lang, content] of [['bg', bg], ['en', en]]) {
    for (const [key, value] of Object.entries(content)) {
      assert.ok(
        typeof value === 'string' && value.trim().length > 0,
        `${lang}: ключ "${key}" е празен`,
      );
    }
  }
});

test('всички ключове от договора присъстват', () => {
  const bg = loadContent('bg');
  const en = loadContent('en');

  for (const key of CONTRACT_KEYS) {
    assert.ok(key in bg, `bg: липсва ключ "${key}"`);
    assert.ok(key in en, `en: липсва ключ "${key}"`);
  }
});

test('pitch.punchline е идентичен в двата файла (шегата остава на английски)', () => {
  const bg = loadContent('bg');
  const en = loadContent('en');

  assert.equal(bg['pitch.punchline'], en['pitch.punchline']);
});

test('hero.title е "Party Up" в двата файла', () => {
  const bg = loadContent('bg');
  const en = loadContent('en');

  assert.equal(bg['hero.title'], 'Party Up');
  assert.equal(en['hero.title'], 'Party Up');
});
