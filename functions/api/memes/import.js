/**
 * Cloudflare Pages Functions - 导入数据
 * POST /api/memes/import
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { memes } = body;

    if (!memes || !Array.isArray(memes)) {
      return new Response(
        JSON.stringify({ success: false, error: '数据格式错误' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return new Response(
      JSON.stringify({ success: true, count: memes.length }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
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
