/**
 * Cloudflare Pages Functions - 删除表情包
 * DELETE /api/memes/[id]
 */
export async function onRequestDelete(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const id = context.params.id;

    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    const index = memes.findIndex((meme) => meme.id === parseFloat(id));
    if (index === -1) {
      return new Response(
        JSON.stringify({ success: false, error: '表情包不存在' }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const deleted = memes.splice(index, 1)[0];

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return new Response(JSON.stringify({ success: true, data: deleted }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
