/**
 * Cloudflare Pages Functions - 管理表情包标签
 * POST /api/memes/tags
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { memeId, tags, name } = body;

    if (!memeId || !Array.isArray(tags)) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少必需参数' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取所有 memes
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    // 查找并更新指定的 meme
    const memeIndex = memes.findIndex(m => m.id === memeId);
    if (memeIndex === -1) {
      return new Response(
        JSON.stringify({ success: false, error: '表情包不存在' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 更新标签
    memes[memeIndex].tags = tags;

    // 可选：更新名称
    if (typeof name === 'string' && name.trim()) {
      memes[memeIndex].name = name.trim();
    }

    // 保存更新
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return new Response(
      JSON.stringify({ success: true, data: memes[memeIndex] }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Update tags error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
