import { jsonResponse, requireAdmin } from '../../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 删除表情包
 * DELETE /api/memes/[id]
 */
export async function onRequestDelete(context) {
  try {
    const unauthorized = await requireAdmin(context);
    if (unauthorized) return unauthorized;

    const { MEME_GALLERY_KV } = context.env;
    const id = context.params.id;

    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    const index = memes.findIndex((meme) => meme.id === parseFloat(id));
    if (index === -1) {
      return jsonResponse({ success: false, error: '表情包不存在' }, 404);
    }

    const deleted = memes.splice(index, 1)[0];

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return jsonResponse({ success: true, data: deleted });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
