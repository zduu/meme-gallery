/**
 * 受限图片代理：仅允许特定白名单域名（如哔哩哔哩 hdslb.com）
 * GET /api/proxy?url=<encoded>
 */
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

    const allowedHosts = new Set([
      'i0.hdslb.com', 'i1.hdslb.com', 'i2.hdslb.com', 'i3.hdslb.com',
    ]);
    const hostname = url.hostname.toLowerCase();
    if (![...allowedHosts].some((h) => hostname === h || hostname.endsWith(h.replace(/^.*?\./, '')))) {
      return new Response('Host not allowed', { status: 403 });
    }

    const upstream = await fetch(url.toString(), {
      headers: {
        // 模拟来自 bilibili 站内访问，绕过 Referer 防盗链
        'Referer': 'https://www.bilibili.com/',
        'User-Agent': context.request.headers.get('User-Agent') || 'Mozilla/5.0',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
      },
      // 通过 Cloudflare 的缓存
      cf: {
        cacheTtl: 86400,
        cacheEverything: true,
      }
    });

    if (!upstream.ok) {
      return new Response('Upstream error', { status: upstream.status });
    }

    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=86400');
    headers.set('Access-Control-Allow-Origin', '*');
    // 仅传递必要头
    const contentType = upstream.headers.get('Content-Type') || 'application/octet-stream';
    const body = await upstream.arrayBuffer();
    return new Response(body, { status: 200, headers: { 'Content-Type': contentType, 'Cache-Control': headers.get('Cache-Control') } });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Server error', { status: 500 });
  }
}

