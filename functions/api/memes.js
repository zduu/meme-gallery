/**
 * Cloudflare Pages Functions - 获取所有表情包
 * GET /api/memes
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    return new Response(JSON.stringify({ success: true, data: memes }), {
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

/**
 * POST /api/memes - 添加表情包
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const { url, name } = body;

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少图片链接' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 获取现有数据
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    // 创建新表情包
    const newMeme = {
      id: Date.now() + Math.random(),
      url: url,
      name: name || generateDefaultName(url, memes.length),
      addedAt: new Date().toISOString(),
    };

    // 检查重复
    const exists = memes.some((meme) => meme.url === newMeme.url);
    if (exists) {
      return new Response(
        JSON.stringify({ success: false, error: '这个表情包已经存在了' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 添加到列表开头
    memes.unshift(newMeme);

    // 保存到 KV
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    return new Response(JSON.stringify({ success: true, data: newMeme }), {
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

function generateDefaultName(url, count) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || `表情包-${count + 1}`;
  } catch {
    return `表情包-${count + 1}`;
  }
}
