'use strict';

const { readUpdate } = require('../lib/telegram');
const { handleUpdate } = require('../lib/bot');

/**
 * Webhook-эндпоинт для Telegram.
 *
 * Telegram присылает сюда POST с JSON-описанием update.
 * Мы обязаны ответить 200 OK, иначе Telegram будет повторять запрос.
 *
 * URL после деплоя: https://<project>.vercel.app/api/webhook
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Проверяем, что запрос действительно от Telegram (если секрет настроен).
  const expectedSecret = process.env.WEBHOOK_SECRET;
  if (expectedSecret) {
    const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
    if (receivedSecret !== expectedSecret) {
      console.warn('[webhook] rejected request with invalid secret token');
      return res.status(401).json({ ok: false, error: 'Invalid secret token' });
    }
  }

  let update;
  try {
    update = await readUpdate(req);
  } catch (error) {
    console.error('[webhook] failed to parse update body:', error);
    // Тело битое — повторять его бессмысленно, отвечаем 200.
    return res.status(200).json({ ok: true, parsed: false });
  }

  if (!update) {
    return res.status(200).json({ ok: true, empty: true });
  }

  try {
    await handleUpdate(update);
  } catch (error) {
    // Ошибку логируем, но Telegram всё равно получает 200,
    // чтобы он не зациклил повторную доставку того же update.
    console.error('[webhook] failed to handle update:', error);
    return res.status(200).json({ ok: true, handled: false });
  }

  return res.status(200).json({ ok: true, handled: true });
};
