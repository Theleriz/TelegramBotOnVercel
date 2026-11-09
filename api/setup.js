'use strict';

/**
 * Служебный эндпоинт для управления webhook.
 *
 * Примеры:
 *   /api/setup?secret=<SETUP_SECRET>            — установить webhook
 *   /api/setup?secret=<SETUP_SECRET>&action=info   — посмотреть текущий webhook
 *   /api/setup?secret=<SETUP_SECRET>&action=delete — удалить webhook
 *
 * Секрет обязателен: без SETUP_SECRET эндпоинт отключён.
 */
module.exports = async function handler(req, res) {
  const setupSecret = process.env.SETUP_SECRET;
  const token = process.env.BOT_TOKEN;

  if (!setupSecret) {
    return res.status(503).json({
      ok: false,
      error: 'SETUP_SECRET is not configured, endpoint disabled',
    });
  }

  if (!token) {
    return res.status(500).json({ ok: false, error: 'BOT_TOKEN is not configured' });
  }

  const provided = req.query.secret;
  if (provided !== setupSecret) {
    return res.status(401).json({ ok: false, error: 'Invalid setup secret' });
  }

  const action = (req.query.action || 'set').toLowerCase();

  try {
    if (action === 'info') {
      const result = await telegram(token, 'getWebhookInfo', {});
      return res.status(200).json(result);
    }

    if (action === 'delete') {
      const result = await telegram(token, 'deleteWebhook', { drop_pending_updates: true });
      return res.status(200).json(result);
    }

    if (action !== 'set') {
      return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
    }

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (!host) {
      return res.status(500).json({ ok: false, error: 'Cannot detect host' });
    }

    const webhookUrl = `${proto}://${host}/api/webhook`;

    const payload = {
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      drop_pending_updates: true,
      max_connections: 40,
    };

    // secret_token должен состоять только из A-Z, a-z, 0-9, _ и -
    if (process.env.WEBHOOK_SECRET) {
      payload.secret_token = process.env.WEBHOOK_SECRET;
    }

    const result = await telegram(token, 'setWebhook', payload);

    return res.status(200).json({
      ...result,
      webhook_url: webhookUrl,
      hint: 'Откройте бота в Telegram и отправьте /start',
    });
  } catch (error) {
    console.error('[setup] failed:', error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
};

async function telegram(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return response.json();
}
