/**
 * Cloudflare Pages Functions - 清空所有数据
 * DELETE /api/memes/clear
 */
export async function onRequestDelete(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    await MEME_GALLERY_KV.put('memes', JSON.stringify([]));

    return new Response(JSON.stringify({ success: true }), {
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
