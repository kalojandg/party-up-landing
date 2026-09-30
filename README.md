# Party Up — landing

Визитката на [Party Up](https://party-up.kaloiand.workers.dev/): една статична страница на
GitHub Pages — https://kalojandg.github.io/party-up-landing/ — която представя приложението
и води натам.

## Защо е отделно репо

Приложението е частно, а GitHub Pages от частно репо изисква платен план. Освен това
краулерът на LinkedIn не стига до адреси от `*.workers.dev` — проверено два пъти през Post
Inspector при напълно здрав сървър (200 на всичко, включително с `LinkedInBot`
User-Agent). Тази страница живее на достижим адрес и носи og таговете, за да може линкът,
който се споделя, да се разгъне в LinkedIn и в CV.

## Как се пипа

```
npm test         # node --test + jsdom, секунди
npm run serve    # локален преглед на порт 45277
```

Нула build стъпка, нула фреймуърк — нарочно. Деплоят е автоматичен: push към `main`
задейства `.github/workflows/pages.yml`, който пуска тестовете и качва репото към Pages
както е.
