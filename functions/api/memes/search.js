/**
 * Cloudflare Pages Functions - 搜索表情包
 * GET /api/memes/search?q=keyword
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const url = new URL(context.request.url);
    const keyword = url.searchParams.get('q');

    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    if (!keyword || !keyword.trim()) {
      return new Response(JSON.stringify({ success: true, data: memes }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lowerKeyword = keyword.toLowerCase();
    const filtered = memes.filter(
      (meme) =>
        meme.name.toLowerCase().includes(lowerKeyword) ||
        meme.url.toLowerCase().includes(lowerKeyword)
    );

    return new Response(JSON.stringify({ success: true, data: filtered }), {
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
