const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
const apiUrl = process.env.BACKEND_URL || 'http://localhost:4000';
const secret = process.env.TELEGRAM_SECRET || '';
const groupId = process.env.TELEGRAM_GROUP_ID && String(process.env.TELEGRAM_GROUP_ID).trim();
console.log('Bot started with group ID:', groupId);

if (!token) {
  console.error('BOT_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const waitEmail = new Set();

bot.getMe().then((me) => {
  bot.botInfo = me;
  console.log('Bot username:', me.username, 'ID:', me.id);
}).catch((err) => {
  console.error('Failed to get bot info', err.message);
});

async function sendInvite(chatId) {
  if (!groupId) {
    console.log('Group ID not configured, skipping invite');
    return;
  }
  console.log('Creating invite link for group', groupId);
  try {
    let link;
    if (bot.createChatInviteLink) {
      link = await bot.createChatInviteLink(groupId, { member_limit: 1 });
    } else if (bot.exportChatInviteLink) {
      const invite = await bot.exportChatInviteLink(groupId);
      link = { invite_link: invite };
    }
    if (link && link.invite_link) {
      await bot.sendMessage(chatId, `Ссылка для вступления в группу: ${link.invite_link}`);
    }
  } catch (e) {
    console.error(
      'Failed to create invite link for',
      groupId,
      e.response?.data || e.message
    );
  }
}

bot.on('new_chat_members', (msg) => {
  const chatId = msg.chat.id;
  (msg.new_chat_members || []).forEach(async (user) => {
    if (bot.botInfo && user.id === bot.botInfo.id) return;
    const name = user.first_name || user.username || 'друг';
    await bot.sendMessage(chatId, `Друзья, поприветствуем ${name}!`);
    try {
      await axios.post(
        `${apiUrl}/telegram/status`,
        { telegramId: user.id, active: true },
        { headers: { 'X-Telegram-Key': secret } }
      );
      await bot.sendMessage(user.id, 'Спасибо! Теперь вы можете пользоваться сайтом.');
    } catch (err) {
      console.error('Status update failed', err.response?.data || err.message);
    }
  });
});

bot.on('left_chat_member', async (msg) => {
  const user = msg.left_chat_member;
  try {
    await axios.post(
      `${apiUrl}/telegram/status`,
      { telegramId: user.id, active: false },
      { headers: { 'X-Telegram-Key': secret } }
    );
  } catch (err) {
    console.error('Status update failed', err.response?.data || err.message);
  }
});

bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  console.log('Start command from', msg.from.id);
  try {
    const res = await axios.get(`${apiUrl}/telegram/${msg.from.id}`, {
      headers: { 'X-Telegram-Key': secret },
    });
    if (res.data && res.data.email) {
      await bot.sendMessage(
        msg.chat.id,
        'ты можешь добавить только один email, хитрая жопка ;)'
      );
      return;
    }
  } catch (err) {
    if (err.response && err.response.status !== 404) {
      console.error('Lookup failed', err.response.data || err.message);
      await bot.sendMessage(msg.chat.id, 'Ошибка сервера. Попробуйте позже.');
      return;
    }
  }
  await bot.sendMessage(msg.chat.id, 'Пожалуйста, отправьте ваш email.');
  waitEmail.add(msg.from.id);
});

bot.on('message', async (msg) => {
  if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
    console.log('Group message:', JSON.stringify({
      chatId: msg.chat.id,
      fromId: msg.from && msg.from.id,
      username: msg.from && msg.from.username,
      messageId: msg.message_id,
      text: msg.text,
    }, null, 2));
    return;
  }
  if (msg.chat.type !== 'private') return;
  if (!waitEmail.has(msg.from.id) || (msg.text || '').startsWith('/')) return;
  waitEmail.delete(msg.from.id);
  const email = msg.text.trim();
  console.log('Received email', email, 'from', msg.from.id);
  try {
    await axios.post(
      `${apiUrl}/telegram`,
      {
        email,
        telegramId: msg.from.id,
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
      },
      { headers: { 'X-Telegram-Key': secret } }
    );
    console.log('Mapping saved for', email);
    await sendInvite(msg.chat.id);
  } catch (err) {
    console.error('Failed to save mapping', err.response?.data || err.message);
    await bot.sendMessage(msg.chat.id, 'Ошибка при сохранении.');
  }
});

