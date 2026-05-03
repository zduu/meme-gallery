import { jsonResponse } from '../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 获取所有表情包
 * GET /api/memes
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    return jsonResponse({ success: true, data: memes });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * POST /api/memes - 添加表情包
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { url, name } = body;

    if (!isHttpUrl(url)) {
      return jsonResponse({ success: false, error: '缺少有效图片链接' }, 400);
    }

    const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `add_ratelimit_${clientIP}`;
    const now = Date.now();
    const lastAddTime = await MEME_GALLERY_KV.get(rateLimitKey);
    if (lastAddTime && now - parseInt(lastAddTime, 10) < 1000) {
      return jsonResponse({ success: false, error: '添加过于频繁，请稍后再试' }, 429);
    }

    // 获取现有数据
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    // 创建新表情包
    const newMeme = {
      id: Date.now() + Math.random(),
      url,
      name: normalizeName(name) || generateDefaultName(url, memes.length),
      source: 'link',
      addedAt: new Date().toISOString(),
    };

    // 检查重复
    const exists = memes.some((meme) => meme.url === newMeme.url);
    if (exists) {
      return jsonResponse({ success: false, error: '这个表情包已经存在了' }, 400);
    }

    // 添加到列表开头
    memes.unshift(newMeme);

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));
    await MEME_GALLERY_KV.put(rateLimitKey, now.toString(), { expirationTtl: 60 });

    return jsonResponse({ success: true, data: newMeme });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function generateDefaultName(url, count) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || `表情包-${count + 1}`;
  } catch {
    return `表情包-${count + 1}`;
  }
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value));
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeName(value) {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}
