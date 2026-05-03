import { jsonResponse, requireAdmin } from '../../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 管理表情包标签
 * POST /api/memes/tags
 */
export async function onRequestPost(context) {
  try {
    const unauthorized = await requireAdmin(context);
    if (unauthorized) return unauthorized;

    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { memeId, tags, name } = body;

    if (!memeId || !Array.isArray(tags)) {
      return jsonResponse({ success: false, error: '缺少必需参数' }, 400);
    }

    if (tags.length > 30 || tags.some((tag) => typeof tag !== 'string' || tag.length > 40)) {
      return jsonResponse({ success: false, error: '标签数据不合法' }, 400);
    }

    // 获取所有 memes
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    // 查找并更新指定的 meme
    const memeIndex = memes.findIndex(m => m.id === memeId);
    if (memeIndex === -1) {
      return jsonResponse({ success: false, error: '表情包不存在' }, 404);
    }

    // 更新标签
    memes[memeIndex].tags = tags.map((tag) => tag.trim()).filter(Boolean);

    // 可选：更新名称
    if (typeof name === 'string' && name.trim()) {
      memes[memeIndex].name = name.trim().slice(0, 200);
    }

    // 保存更新
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return jsonResponse({ success: true, data: memes[memeIndex] });
  } catch (error) {
    console.error('Update tags error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
