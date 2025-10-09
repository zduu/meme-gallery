/**
 * Cloudflare Pages Functions - 上传图片到 GitHub
 * POST /api/upload
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = context.env;
    const body = await context.request.json();
    const { file, filename, name, source } = body;

    if (!file || !filename) {
      return new Response(
        JSON.stringify({ success: false, error: '缺少文件数据' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    // GitHub API 频率限制检查
    const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `upload_ratelimit_${clientIP}`;
    const now = Date.now();

    // 获取上次上传时间
    const lastUploadTime = await MEME_GALLERY_KV.get(rateLimitKey);
    if (lastUploadTime) {
      const timeSinceLastUpload = now - parseInt(lastUploadTime);
      const minInterval = 3000; // 最小间隔 3 秒

      if (timeSinceLastUpload < minInterval) {
        const waitTime = Math.ceil((minInterval - timeSinceLastUpload) / 1000);
        return new Response(
          JSON.stringify({
            success: false,
            error: `上传过于频繁，请等待 ${waitTime} 秒后再试`
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 生成文件路径
    const timestamp = Date.now();
    const ext = filename.split('.').pop().toLowerCase();

    // 验证文件扩展名
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExts.includes(ext)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `不支持的文件格式，仅支持: ${allowedExts.join(', ')}`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const githubFilename = `meme-${timestamp}.${ext}`;
    const githubPath = `images/${githubFilename}`;
    const branch = GITHUB_BRANCH || 'main';

    // 上传到 GitHub
    const githubApiUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/${githubPath}`;
    const githubResponse = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Meme-Gallery-App'
      },
      body: JSON.stringify({
        message: `Add meme: ${name || filename}`,
        content: file,
        branch: branch
      })
    });

    if (!githubResponse.ok) {
      const errorData = await githubResponse.json();
      console.error('GitHub API Error:', errorData);

      // GitHub API 特定错误处理
      if (githubResponse.status === 403) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'GitHub API 频率限制，请稍后再试'
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: `GitHub 上传失败: ${errorData.message || '未知错误'}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const githubData = await githubResponse.json();
    const imageUrl = githubData.content.download_url;

    // 保存到 KV
    const memesJson = await MEME_GALLERY_KV.get('memes');
    const memes = memesJson ? JSON.parse(memesJson) : [];

    const newMeme = {
      id: Date.now() + Math.random(),
      url: imageUrl,
      name: name || filename.replace(/\.[^/.]+$/, ''),
      source: source || 'upload',
      addedAt: new Date().toISOString(),
      github_path: githubPath,
      github_sha: githubData.content.sha
    };

    memes.unshift(newMeme);
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    // 记录上传时间（设置 TTL 为 1 小时）
    await MEME_GALLERY_KV.put(rateLimitKey, now.toString(), { expirationTtl: 3600 });

    return new Response(
      JSON.stringify({ success: true, data: newMeme }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
