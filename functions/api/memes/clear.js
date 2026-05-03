import { jsonResponse, requireAdmin } from '../../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 清空所有数据
 * DELETE /api/memes/clear
 */
export async function onRequestDelete(context) {
  try {
    const unauthorized = await requireAdmin(context);
    if (unauthorized) return unauthorized;

    const { MEME_GALLERY_KV } = context.env;
    await MEME_GALLERY_KV.put('memes', JSON.stringify([]));

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
