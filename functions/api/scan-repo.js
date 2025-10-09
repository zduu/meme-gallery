/**
 * Cloudflare Pages Functions - 扫描 GitHub 仓库图片文件
 * POST /api/scan-repo
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = context.env;

    // 检查环境变量
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '未配置 GitHub 存储，请在 Cloudflare Dashboard 中设置环境变量 GITHUB_TOKEN 和 GITHUB_REPO'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const branch = GITHUB_BRANCH || 'main';
    const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const foundImages = [];

    // 获取仓库目录树
    const treeUrl = `https://api.github.com/repos/${GITHUB_REPO}/git/trees/${branch}?recursive=1`;
    const treeResponse = await fetch(treeUrl, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Meme-Gallery-App'
      }
    });

    if (!treeResponse.ok) {
      const errorData = await treeResponse.json();
      return new Response(
        JSON.stringify({
          success: false,
          error: `无法访问仓库: ${errorData.message || '未知错误'}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const treeData = await treeResponse.json();

    // 过滤出图片文件
    for (const item of treeData.tree) {
      if (item.type === 'blob') {
        const lowerPath = item.path.toLowerCase();
        const hasImageExt = supportedExts.some(ext => lowerPath.endsWith(ext));

        if (hasImageExt) {
          // 生成图片 URL
          const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${branch}/${item.path}`;

          // 提取文件名（不含扩展名）
          const filename = item.path.split('/').pop();
          const name = filename.replace(/\.[^/.]+$/, '');

          foundImages.push({
            url: imageUrl,
            name: name,
            path: item.path,
            sha: item.sha
          });
        }
      }
    }

    // 获取现有 memes
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const existingMemes = memesJson ? JSON.parse(memesJson) : [];

    // 找出现有的 URL
    const existingUrls = new Set(existingMemes.map(m => m.url));

    // 过滤出新图片
    const newImages = foundImages.filter(img => !existingUrls.has(img.url));

    // 添加新图片到 KV
    const newMemes = newImages.map((img, index) => ({
      id: Date.now() + index + Math.random(),
      url: img.url,
      name: img.name,
      source: 'upload',  // 仓库图片归类为本地上传/仓库分类
      addedAt: new Date().toISOString(),
      github_path: img.path,
      github_sha: img.sha
    }));

    if (newMemes.length > 0) {
      const updatedMemes = [...newMemes, ...existingMemes];
      await MEME_GALLERY_KV.put('memes', JSON.stringify(updatedMemes));
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          total: foundImages.length,
          new: newMemes.length,
          existing: foundImages.length - newMemes.length,
          images: newMemes
        }
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scan repo error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
