/**
 * Cloudflare Pages Functions - 导出数据
 * GET /api/memes/export
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    // 将所有上传的图片转换为链接格式
    const processedMemes = memes.map(meme => {
      // 如果是上传到 GitHub 的图片，转换为链接格式
      if (meme.source === 'upload') {
        return {
          id: meme.id,
          url: meme.url,  // GitHub 图片链接
          name: meme.name,
          source: 'link',  // 转换为链接类型
          addedAt: meme.addedAt,
          // 移除 GitHub 特定字段，导入后不需要这些信息
          // github_path 和 github_sha 不导出
        };
      }
      // 链接类型保持不变
      return {
        id: meme.id,
        url: meme.url,
        name: meme.name,
        source: meme.source || 'link',
        addedAt: meme.addedAt,
      };
    });

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      memes: processedMemes,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
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
