# Telegram bot on Vercel

Проверка теории: **можно ли хостить Telegram-бота на Vercel**. Ответ — да, но не так, как на VPS: не через long polling, а через **webhook**. Vercel Functions не держат постоянный процесс, зато умеют принимать HTTP-запросы. Telegram сам отправляет апдейты на наш эндпоинт.

```
Пользователь → Telegram → POST https://<project>.vercel.app/api/webhook → Vercel Function
                                                                              ↓
Пользователь ← Telegram ←─────────────── sendMessage ←─────── Telegram Bot API
```

## Что внутри

| Файл | Назначение |
| --- | --- |
| `api/webhook.js` | Принимает update от Telegram, проверяет секрет, отвечает `200 OK` |
| `api/setup.js` | Устанавливает / смотрит / удаляет webhook |
| `api/index.js` | Статус-страница: живой ли деплой, заданы ли переменные |
| `lib/bot.js` | Логика команд и кнопок |
| `lib/telegram.js` | Обёртка над Telegram Bot API, без зависимостей |

Зависимостей нет вообще — используется встроенный `fetch` из Node.js. `npm install` не нужен.

## Быстрый старт

### 1. Получите токен

В Telegram напишите [@BotFather](https://t.me/BotFather) → `/newbot` → придумайте имя и username → скопируйте токен вида `123456789:AA...`.

### 2. Задеплойте на Vercel

Вариант А — через GitHub (репозиторий уже привязан):

1. Запушьте код в `main`.
2. В [Vercel Dashboard](https://vercel.com/new) → **Add New Project** → выберите этот репозиторий.
3. Framework Preset: **Other**. Build Command и Output Directory оставьте пустыми.
4. **Deploy**.

Вариант Б — из терминала:

```bash
npx vercel        # preview
npx vercel --prod # production
```

### 3. Задайте переменные окружения

В Vercel: **Project → Settings → Environment Variables** (для Production и Preview):

| Переменная | Обязательна | Что это |
| --- | --- | --- |
| `BOT_TOKEN` | да | Токен от BotFather |
| `WEBHOOK_SECRET` | желательно | Секрет, который Telegram пришлёт в заголовке `X-Telegram-Bot-Api-Secret-Token`. Только `A-Z a-z 0-9 _ -` |
| `SETUP_SECRET` | для установки | Пароль к `/api/setup`. Без него эндпоинт отключён |

После добавления переменных **передеплойте** проект (Deployments → ⋯ → Redeploy), иначе функции не увидят новые значения.

### 4. Установите webhook

Откройте в браузере:

```
https://<ваш-проект>.vercel.app/api/setup?secret=<SETUP_SECRET>
```

Должно вернуться что-то вроде `{"ok":true,"result":true,"description":"Webhook was set"}`.

Проверить текущее состояние:

```
https://<ваш-проект>.vercel.app/api/setup?secret=<SETUP_SECRET>&action=info
```

Удалить (например, чтобы вернуться к polling локально):

```
https://<ваш-проект>.vercel.app/api/setup?secret=<SETUP_SECRET>&action=delete
```

### 5. Проверьте

Откройте бота в Telegram → `/start` → нажмите «🏓 Проверить связь».

## Команды бота

- `/start` — приветствие и inline-кнопки
- `/help` — список возможностей
- `/time` — время, регион и окружение функции (наглядно видно serverless)
- `/id` — ваш user id и chat id
- `/echo <текст>` — повторяет текст
- любое другое сообщение — эхо (простое доказательство, что webhook живой)

## Локальная разработка

```bash
npm i -g vercel     # если ещё не установлен
cp .env.example .env
# впишите BOT_TOKEN, WEBHOOK_SECRET, SETUP_SECRET
vercel dev
```

Для локального теста Telegram должен достучаться до вашей машины. Проще всего — туннель (ngrok/cloudflared), либо задеплоить preview и установить webhook на preview-домен.

## Что важно знать про ограничения Vercel

Это и есть ответ на исходный вопрос — где теория ломается:

1. **Нет постоянного процесса.** Обычный `bot.polling()` / `telegraf.launch()` на Vercel не заработает: функция запускается только на время запроса. Нужен webhook.
2. **Лимит времени выполнения.** На Hobby по умолчанию ~10–60 секунд на запрос (зависит от плана и настроек). Всё, что дольше, обрывается — тяжёлые задачи (скачивание больших файлов, долгие вычисления) нужно выносить в очередь/воркер.
3. **Cold start.** После простоя первый ответ может быть медленнее на 0.3–2 с. Telegram это переживает, пользователь видит задержку.
4. **Ответ должен быть быстрым.** Telegram ждёт ответ и повторяет запрос при ошибке/таймауте. Поэтому в `api/webhook.js` мы всегда возвращаем `200`, а ошибки только логируем — иначе один и тот же апдейт придёт несколько раз.
5. **Stateless.** Между запросами память не сохраняется. Состояние — только во внешнем хранилище (KV/Redis/Postgres). В примере состояние не нужно.
6. **Файлы и БД.** Файловая система только для чтения (кроме `/tmp`). Для данных — внешние сервисы.
7. **Один webhook на бота.** Нельзя одновременно держать polling на ноутбуке и webhook на Vercel — Telegram доставляет апдейты только в одно место.
8. **Секрет обязателен.** URL webhook — публичный. Без `secret_token` кто угодно может слать вам фейковые апдейты. Здесь проверка включена.
9. **Бесплатного плана хватает** для небольшого бота: лимиты Hobby — 100 GB-hours и 1 млн invocations в месяц (актуальные цифры смотрите в [доках Vercel](https://vercel.com/docs/limits)).

**Вывод:** хостить можно, для простых ботов и ботов на вебхуках — отлично. Для долгих задач, парсинга больших файлов, игр в реальном времени — лучше VPS или отдельный воркер.

## Диагностика

- **Бот молчит.** Откройте `/api/setup?secret=...&action=info`. Если `last_error_message` не пустой — там причина. Если `url` пустой — webhook не установлен.
- **401 при установке webhook.** `secret` в URL не совпадает с `SETUP_SECRET` (или переменная не задана / не передеплоили).
- **Telegram пишет `Wrong response from the webhook: 401`.** `WEBHOOK_SECRET` в Vercel и `secret_token` в Telegram разошлись. Переустановите webhook через `/api/setup`.
- **В логах `BOT_TOKEN is not set`.** Переменная добавлена, но проект не передеплоен.
- **Логи.** Vercel Dashboard → Project → **Logs** (или `vercel logs <deployment-url>`).
