require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
const apiUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const secret = process.env.TELEGRAM_SECRET || '';

if (!token) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const waitEmail = new Set();

bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Если вы хотите получить доступ к сайту — напишите мне /start');
});

bot.onText(/\/start/, (msg) => {
  if (msg.chat.type !== 'private') return;
  console.log('Start command from', msg.from.id);
  bot.sendMessage(msg.chat.id, 'Пожалуйста, отправьте ваш email.');
  waitEmail.add(msg.from.id);
});

bot.on('message', async (msg) => {
  if (msg.chat.type !== 'private') return;
  if (!waitEmail.has(msg.from.id) || msg.text.startsWith('/')) return;
  waitEmail.delete(msg.from.id);
  const email = msg.text.trim();
  console.log('Received email', email, 'from', msg.from.id);
  try {
    await axios.post(
      `${apiUrl}/telegram`,
      { email, telegramId: msg.from.id },
      { headers: { 'X-Telegram-Key': secret } }
    );
    console.log('Mapping saved for', email);
    await bot.sendMessage(msg.chat.id, 'Спасибо! Теперь вы можете пользоваться сайтом.');
  } catch (err) {
    console.error('Failed to save mapping', err.response?.data || err.message);
    await bot.sendMessage(msg.chat.id, 'Ошибка при сохранении.');
  }
});

