import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPage } from './dom.js';

/**
 * Базовият спек: доказва, че страницата съществува и че тестовата сглобка работи.
 * Нарочно е беден — същинските твърдения (съдържание, език, мета тагове) идват с
 * тасковете, които ги въвеждат. Този файл НЕ се разширява; той е зеленият под,
 * върху който стъпва всичко останало.
 */
test('страницата се зарежда и има заглавие', () => {
  const document = loadPage();

  assert.ok(document.title.length > 0, 'липсва <title>');
});

test('страницата води към живото приложение', () => {
  const document = loadPage();
  const appLink = document.querySelector('[data-testid="app-link"]');

  assert.ok(appLink, 'липсва връзка към приложението (data-testid="app-link")');
  assert.match(appLink.getAttribute('href') ?? '', /^https:\/\/party-up\./);
});
