import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPage, readFile } from './dom.js';

/**
 * Спекът на договора между разметката и стиловете.
 *
 * Пази едно-единствено правило, но такова, чието нарушение е НЕВИДИМО за всички
 * останали спекове: `data-testid` е договор с ТЕСТОВЕТЕ, не с дизайна. Стилизира
 * ли се през него, преименуване в някой спек смъква рамката, кръглата форма и
 * 44×44 минималния tap target на бутона — а suite-ът остава зелен, защото тестовете
 * търсят точно същия hook, който стилът ползва. Затова оформлението се закача за
 * класове, а тук се проверява, че класовете наистина ги има в разметката.
 */

/** Стиловете БЕЗ коментарите — тук се проверяват селектори, не проза за тях. */
const CSS = readFile('src/styles.css').replace(/\/\*[\s\S]*?\*\//g, '');

/** Класовете, през които стиловете са длъжни да се закачат. */
const LAYOUT_CLASSES = ['topbar', 'lang-toggle', 'footer', 'page', 'hero', 'pitch', 'spread', 'cta'];

test('стиловете НЕ се закачат за data-testid', () => {
  assert.doesNotMatch(
    CSS,
    /data-testid/,
    'styles.css стилизира през тестов hook — преименуване в спек чупи оформлението тихо',
  );
});

test('всеки клас, за който стиловете се закачат, съществува в разметката', () => {
  const document = loadPage();

  for (const name of LAYOUT_CLASSES) {
    assert.match(CSS, new RegExp(`\\.${name}\\b`), `styles.css не стилизира .${name}`);
    assert.ok(document.querySelector(`.${name}`), `разметката е без клас .${name}`);
  }
});
