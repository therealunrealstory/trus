// Прокси к файлам Telegram по ранее полученному media_path
exports.handler = async (event) => {
  try {
    const path = new URL(event.rawUrl).searchParams.get('path') || '';
    if (!/^[\w\-/.]{5,200}$/.test(path)) return { statusCode: 400, body: 'Bad path' };

    const token = process.env.TELEGRAM_NOWADAYS_BOT_TOKEN;
    if (!token) return { statusCode: 500, body: 'Missing token' };

    const url = `https://api.telegram.org/file/bot${token}/${path}`;
    const r = await fetch(url);
    if (!r.ok) return { statusCode: r.status, body: 'Not found' };

    const buf = Buffer.from(await r.arrayBuffer());
    // content-type может отсутствовать — отдадим как octet-stream
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    return {
      statusCode: 200,
      headers: { 'content-type': ct, 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin':'*' },
      body: buf.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: 'Server error' };
  }
};
