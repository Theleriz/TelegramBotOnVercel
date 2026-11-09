'use strict';

const { callTelegram, escapeHtml } = require('./telegram');

const BOT_VERSION = '1.0.0';

const WELCOME_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '🏓 Проверить связь', callback_data: 'ping' },
      { text: '🕒 Время на сервере', callback_data: 'time' },
    ],
  ],
};

function uptimeInfo() {
  const region = process.env.VERCEL_REGION || 'local';
  const env = process.env.VERCEL_ENV || 'development';
  const now = new Date();
  return [
    `🖥 <b>Регион:</b> <code>${escapeHtml(region)}</code>`,
    `🌍 <b>Окружение:</b> <code>${escapeHtml(env)}</code>`,
    `🕒 <b>UTC:</b> <code>${now.toISOString()}</code>`,
    `📦 <b>Версия бота:</b> <code>${BOT_VERSION}</code>`,
  ].join('\n');
}

function helpText() {
  return [
    '<b>Что я умею</b>',
    '',
    '/start — приветствие и кнопки',
    '/help — это сообщение',
    '/time — время и регион, где выполняется функция',
    '/id — ваш Telegram ID и ID чата',
    '/echo &lt;текст&gt; — повторю текст',
    '',
    'Любое обычное сообщение я тоже верну обратно — так видно, что webhook работает.',
    '',
    '<i>Работаю на Vercel Functions: процесс живёт только на время обработки запроса от Telegram.</i>',
  ].join('\n');
}

/**
 * Обрабатывает один update от Telegram и отправляет ответ.
 * Возвращать ничего не нужно: handler в api/webhook.js отвечает Telegram пустым 200.
 */
async function handleUpdate(update) {
  if (!update || typeof update !== 'object') return;

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const message = update.message || update.edited_message;
  if (!message || !message.chat) return;

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const command = text.startsWith('/') ? text.split(/\s+/)[0].split('@')[0].toLowerCase() : '';
  const args = text.startsWith('/') ? text.split(/\s+/).slice(1).join(' ') : '';

  switch (command) {
    case '/start':
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: [
          '👋 <b>Привет!</b>',
          '',
          'Я простой телеграм-бот, который живёт на Vercel.',
          'Нажми кнопку ниже — это проверит полный круг: Telegram → Vercel → Telegram.',
        ].join('\n'),
        reply_markup: WELCOME_KEYBOARD,
      });
      return;

    case '/help':
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: helpText(),
      });
      return;

    case '/time':
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: `🕒 <b>Серверное время</b>\n\n${uptimeInfo()}`,
      });
      return;

    case '/id':
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: [
          '🆔 <b>Ваши идентификаторы</b>',
          '',
          `User ID: <code>${escapeHtml(message.from?.id ?? 'unknown')}</code>`,
          `Chat ID: <code>${escapeHtml(chatId)}</code>`,
          `Тип чата: <code>${escapeHtml(message.chat.type)}</code>`,
        ].join('\n'),
      });
      return;

    case '/echo':
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: args
          ? `🔁 ${escapeHtml(args)}`
          : 'Напишите так: <code>/echo привет</code>',
      });
      return;

    default:
      await callTelegram('sendMessage', {
        chat_id: chatId,
        parse_mode: 'HTML',
        text: text
          ? `📨 Получил: <b>${escapeHtml(text)}</b>\n\nКоманды: /help`
          : 'Пока я понимаю только текст 🙂 Команды: /help',
      });
  }
}

async function handleCallbackQuery(query) {
  const data = query.data;
  let text;

  if (data === 'ping') {
    text = `🏓 <b>Pong!</b>\n\nЗапрос дошёл до Vercel и вернулся.\n\n${uptimeInfo()}`;
  } else if (data === 'time') {
    text = `🕒 <b>Время на сервере</b>\n\n${uptimeInfo()}`;
  } else {
    text = 'Неизвестная кнопка 🤔';
  }

  // Обязательно подтверждаем нажатие, иначе у клиента крутится «часики».
  await callTelegram('answerCallbackQuery', {
    callback_query_id: query.id,
    text: 'Готово',
  });

  if (query.message) {
    await callTelegram('editMessageText', {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      parse_mode: 'HTML',
      text,
      reply_markup: WELCOME_KEYBOARD,
    });
  }
}

module.exports = { handleUpdate };
