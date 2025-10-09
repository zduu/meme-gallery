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

    // 生成文件路径
    const timestamp = Date.now();
    const ext = filename.split('.').pop();
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
