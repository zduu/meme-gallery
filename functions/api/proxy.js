/**
 * 受限图片代理：仅允许特定白名单域名（如哔哩哔哩 hdslb.com）
 * GET /api/proxy?url=<encoded>
 */
const PROXY_RULES = [
  // 哔哩哔哩
  { suffixes: ['hdslb.com'], referer: 'https://www.bilibili.com/' },
  // 知乎
  { suffixes: ['zhimg.com'], referer: 'https://www.zhihu.com/' },
  // Pixiv (i.pximg.net 必须带 referer)
  { suffixes: ['pximg.net'], referer: 'https://www.pixiv.net/' },
  // 微博图片
  { suffixes: ['sinaimg.cn'], referer: 'https://weibo.com/' },
  // 字节系图床（掘金常用）
  { suffixes: ['byteimg.com'], referer: 'https://juejin.cn/' },
  // 抖音
  { suffixes: ['douyinpic.com'], referer: 'https://www.douyin.com/' },
  // 米游社
  { suffixes: ['miyoushe.com'], referer: 'https://www.miyoushe.com/' },
];

function matchRule(hostname) {
  hostname = hostname.toLowerCase();
  for (const rule of PROXY_RULES) {
    if (rule.suffixes.some(suf => hostname === suf || hostname.endsWith(`.${suf}`))) {
      return rule;
    }
  }
  return null;
}

export async function onRequestGet(context) {
  try {
    const requestUrl = new URL(context.request.url);
    const target = requestUrl.searchParams.get('url');
    if (!target) {
      return new Response('Missing url', { status: 400 });
    }

    const url = new URL(target);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return new Response('Invalid protocol', { status: 400 });
    }

    const rule = matchRule(url.hostname);
    if (!rule) {
      return new Response('Host not allowed', { status: 403 });
    }

    // 解析可选缩放参数
    const w = toInt(requestUrl.searchParams.get('w'));
    const h = toInt(requestUrl.searchParams.get('h'));
    const q = toInt(requestUrl.searchParams.get('q'));
    const fmt = toStr(requestUrl.searchParams.get('fmt')); // 'auto' | 'webp' | 'avif' | 'jpeg' | ...
    const fit = toStr(requestUrl.searchParams.get('fit')); // 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad'

    const cfOptions = { cacheTtl: 86400, cacheEverything: true };

    // 如果提供了尺寸或格式参数，尝试启用 Cloudflare Image Resizing
    // 平台未开通时会被忽略，不会报错
    const imageOpts = {};
    if (w) imageOpts.width = w;
    if (h) imageOpts.height = h;
    if (q) imageOpts.quality = q;
    if (fmt) imageOpts.format = fmt; // 'auto' 可由边缘根据 UA 选择
    if (fit) imageOpts.fit = fit;
    if (Object.keys(imageOpts).length > 0) {
      // @ts-ignore
      cfOptions.image = imageOpts;
    }

    const upstream = await fetch(url.toString(), {
      headers: {
        // 模拟来源站点 Referer，绕过常见防盗链
        'Referer': rule.referer,
        'User-Agent': context.request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      // 通过 Cloudflare 的缓存
      cf: cfOptions
    });

    if (!upstream.ok) {
      return new Response('Upstream error', { status: upstream.status });
    }

    const headers = new Headers();
    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
    headers.set('Content-Type', contentType);
    headers.set(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800, stale-if-error=604800'
    );
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Vary', 'Accept');
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: 200, headers });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Server error', { status: 500 });
  }
}

function toInt(v) {
  const n = parseInt(v || '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function toStr(v) {
  return v ? String(v) : '';
}
