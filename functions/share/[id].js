export async function onRequestGet(context) {
  const { request, env, params } = context;
  const { MEME_GALLERY_KV } = env;

  try {
    const requestUrl = new URL(request.url);
    const idParam = params.id;

    if (!idParam) {
      return new Response('Missing id', { status: 400 });
    }

    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    const targetId = String(idParam);
    const meme = memes.find((item) => String(item.id) === targetId);

    if (!meme) {
      return new Response('Not found', { status: 404 });
    }

    const title = sanitizeText(meme.name || 'Meme');
    const description = '来自 Meme Gallery 的表情包';
    const imageUrl = sanitizeUrl(meme.url);
    const pageUrl = `${requestUrl.origin}/share/${encodeURIComponent(idParam)}`;

    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${pageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <style>
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .container {
      max-width: 720px;
      width: 100%;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.15);
      padding: 32px;
    }
    img {
      max-width: 100%;
      border-radius: 12px;
    }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 16px;
    }
    p {
      color: #475569;
      margin-top: 16px;
    }
    .footer {
      margin-top: 32px;
      font-size: 0.85rem;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <img src="${imageUrl}" alt="${title}">
    <p>如果未自动预览，请复制图片或直接访问上方图片。</p>
    <div class="footer">Meme Gallery 分享页</div>
  </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (error) {
    console.error('Share page error:', error);
    return new Response('Server error', { status: 500 });
  }
}

function sanitizeText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.toString().replace(/"/g, '%22');
  } catch (error) {
    console.error('Invalid image url:', url, error);
    return '';
  }
}
