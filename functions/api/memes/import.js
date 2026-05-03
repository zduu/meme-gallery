import { jsonResponse, requireAdmin } from '../../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 导入数据
 * POST /api/memes/import
 */
export async function onRequestPost(context) {
  try {
    const unauthorized = await requireAdmin(context);
    if (unauthorized) return unauthorized;

    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { memes } = body;

    if (!memes || !Array.isArray(memes)) {
      return jsonResponse({ success: false, error: '数据格式错误' }, 400);
    }

    if (memes.length > 5000 || !memes.every(isValidMeme)) {
      return jsonResponse({ success: false, error: '表情包数据不合法' }, 400);
    }

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return jsonResponse({ success: true, count: memes.length });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function isValidMeme(meme) {
  if (!meme || typeof meme !== 'object') {
    return false;
  }

  if (!isHttpUrl(meme.url)) {
    return false;
  }

  if (meme.name && String(meme.name).length > 200) {
    return false;
  }

  if (meme.tags && (!Array.isArray(meme.tags) || meme.tags.length > 30)) {
    return false;
  }

  return true;
}

function isHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
