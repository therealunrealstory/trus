// netlify/functions/telegram_reporting.js
// Черновой обработчик: возвращает пустой фид с корректной структурой.
// В будущем добавим доступ к приватному каналу через переменные окружения.

exports.handler = async (event, context) => {
  try {
    // Параметры (на будущее): ?limit=&cursor=&lang=
    const url = new URL(event.rawUrl || `http://x.local${event.path}${event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters) : ''}`);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit')) || 10));
    const cursor = url.searchParams.get('cursor') || null;

    const payload = {
      items: [
        // Пример минимального элемента (закомментировано, чтобы сейчас был пустой список)
        // {
        //   id: 1,
        //   date: new Date().toISOString(),
        //   text: 'Example expense explanation (demo).',
        //   attachments: [],
        //   tags: ['expense','demo']
        // }
      ],
      next_cursor: null,
      limit,
      cursor
    };

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify(payload)
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      body: JSON.stringify({ items: [], next_cursor: null, error: 'init' })
    };
  }
};
