'use strict';

const TELEGRAM_API = 'https://api.telegram.org';

/**
 * Вызов метода Telegram Bot API.
 * Node 18+ / Vercel Node runtime — глобальный fetch уже есть, зависимости не нужны.
 */
async function callTelegram(method, payload) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    throw new Error('BOT_TOKEN is not set');
  }

  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!data.ok) {
    console.error(`[telegram] ${method} failed:`, JSON.stringify(data));
  }

  return data;
}

/** Экранирование текста для parse_mode: 'HTML'. */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Vercel обычно уже распарсил JSON в req.body.
 * На всякий случай поддерживаем строку и «сырое» тело.
 */
async function readUpdate(req) {
  const body = req.body;

  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
    return body;
  }

  if (typeof body === 'string' && body.length > 0) {
    return JSON.parse(body);
  }

  if (Buffer.isBuffer(body)) {
    return JSON.parse(body.toString('utf8'));
  }

  const raw = await readRawBody(req);
  if (!raw) return null;
  return JSON.parse(raw);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = { callTelegram, escapeHtml, readUpdate };
