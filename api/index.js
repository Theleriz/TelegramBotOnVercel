'use strict';

/**
 * Корневая страница: быстрый способ убедиться, что деплой живой
 * и переменные окружения подхватились.
 */
module.exports = function handler(req, res) {
  const checks = [
    ['BOT_TOKEN', Boolean(process.env.BOT_TOKEN)],
    ['WEBHOOK_SECRET', Boolean(process.env.WEBHOOK_SECRET)],
    ['SETUP_SECRET', Boolean(process.env.SETUP_SECRET)],
  ];

  const rows = checks
    .map(([name, ok]) => `<li>${name}: <b class="${ok ? 'ok' : 'bad'}">${ok ? 'задан' : 'НЕ задан'}</b></li>`)
    .join('');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telegram bot on Vercel</title>
  <style>
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 640px; margin: 48px auto; padding: 0 20px; line-height: 1.6; color: #1f2328; }
    code { background: #f0f1f3; padding: 2px 6px; border-radius: 4px; }
    .ok { color: #1a7f37; }
    .bad { color: #cf222e; }
    .card { border: 1px solid #d9dbdf; border-radius: 10px; padding: 16px 20px; margin: 20px 0; }
    li { margin: 4px 0; }
  </style>
</head>
<body>
  <h1>🤖 Telegram bot on Vercel</h1>
  <p>Функция работает. Region: <code>${process.env.VERCEL_REGION || 'local'}</code></p>

  <div class="card">
    <h2>Переменные окружения</h2>
    <ul>${rows}</ul>
  </div>

  <div class="card">
    <h2>Эндпоинты</h2>
    <ul>
      <li><code>POST /api/webhook</code> — сюда пишет Telegram</li>
      <li><code>GET /api/setup?secret=...&amp;action=set|info|delete</code> — управление webhook</li>
    </ul>
  </div>

  <p>Если все переменные заданы — выполните <code>/api/setup?secret=...&amp;action=set</code>, затем отправьте боту <code>/start</code>.</p>
</body>
</html>`);
};
