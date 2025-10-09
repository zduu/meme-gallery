/**
 * Cloudflare Pages Functions - 导出数据
 * GET /api/memes/export
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      memes: memes,
    };

    return new Response(JSON.stringify(exportData), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="meme-gallery-${Date.now()}.json"`,
      },
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
