// /.netlify/functions/telegram_reporting.js
// Черновой обработчик: возвращает мок‑данные, если нет ENV.
// В будущем можно ходить в Bot API и парсить посты канала.

export const handler = async (event) => {
  const limit = Math.max(1, Math.min(100, Number(event.queryStringParameters?.limit) || 20));

  // Если когда‑нибудь добавим реальные переменные окружения — можно переключить логику:
  const HAS_ENV = !!(process.env.TG_BOT_TOKEN && process.env.TG_CHANNEL);

  if (!HAS_ENV) {
    const demo = [
      {
        date: new Date().toISOString(),
        text: 'Медикаменты: курс антибиотиков и перевязочные материалы.',
        amount: 128.40, currency: 'USD',
        tags: ['meds'],
        link: null
      },
      {
        date: new Date(Date.now()-864e5).toISOString(),
        text: 'Госпитализация: сутки в стационаре + анализы.',
        amount: 540, currency: 'USD',
        tags: ['hospital'],
        link: 'https://t.me/yourPrivateChannel/123'
      },
      {
        date: new Date(Date.now()-2*864e5).toISOString(),
        text: 'Транспорт: такси до клиники и обратно.',
        amount: 22, currency: 'USD',
        tags: ['transport'],
        link: null
      }
    ].slice(0, limit);

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify(demo)
    };
  }

  // Заглушка для будущей интеграции с Telegram:
  // здесь можно будет вызывать Bot API getUpdates / getChat / getMessages (через бота-админа),
  // нормализовать поля и вернуть тот же массив объектов.
  return {
    statusCode: 200,
    headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' },
    body: JSON.stringify([])
  };
};
