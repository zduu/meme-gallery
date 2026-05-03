import { isAdminRequest, jsonResponse } from '../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 上传图片到 GitHub
 * POST /api/upload
 */
export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV, GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH } = context.env;
    const body = await context.request.json();
    const { file, filename, name } = body;

    if (!file || !filename) {
      return jsonResponse({ success: false, error: '缺少文件数据' }, 400);
    }

    if (!isValidBase64(file)) {
      return jsonResponse({ success: false, error: '文件数据格式错误' }, 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if (getBase64Bytes(file) > maxSize) {
      return jsonResponse({ success: false, error: '文件太大，请选择小于 10MB 的图片' }, 400);
    }

    // 检查环境变量
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      return jsonResponse({
        success: false,
        error: '未配置 GitHub 存储，请在 Cloudflare Dashboard 中设置环境变量 GITHUB_TOKEN 和 GITHUB_REPO'
      }, 500);
    }

    // GitHub API 频率限制检查。游客允许上传，但使用更严格的 per-IP 限流。
    const clientIP = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    const isAdmin = await isAdminRequest(context);
    const now = Date.now();
    const limits = isAdmin
      ? { minInterval: 3000, hourlyMax: 120, dailyMax: 500 }
      : { minInterval: 5000, hourlyMax: 15, dailyMax: 30 };

    const rateLimit = await checkUploadRateLimit(MEME_GALLERY_KV, clientIP, limits, now);
    if (!rateLimit.allowed) {
      return jsonResponse({
        success: false,
        error: rateLimit.error
      }, 429);
    }

    // 生成文件路径
    const timestamp = Date.now();
    const ext = filename.split('.').pop().toLowerCase();

    // 验证文件扩展名
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExts.includes(ext)) {
      return jsonResponse({
        success: false,
        error: `不支持的文件格式，仅支持: ${allowedExts.join(', ')}`
      }, 400);
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
        return jsonResponse({
          success: false,
          error: 'GitHub API 频率限制，请稍后再试'
        }, 429);
      }

      return jsonResponse({
        success: false,
        error: `GitHub 上传失败: ${errorData.message || '未知错误'}`
      }, 500);
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
      source: 'upload',
      addedAt: new Date().toISOString(),
      github_path: githubPath,
      github_sha: githubData.content.sha
    };

    memes.unshift(newMeme);
    await MEME_GALLERY_KV.put('memes', JSON.stringify(memes));

    await commitUploadRateLimit(MEME_GALLERY_KV, rateLimit, now);

    return jsonResponse({ success: true, data: newMeme });
  } catch (error) {
    console.error('Upload error:', error);
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

function isValidBase64(value) {
  return typeof value === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function getBase64Bytes(value) {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

async function checkUploadRateLimit(kv, clientIP, limits, now) {
  const safeIP = clientIP || 'unknown';
  const lastKey = `upload_ratelimit_last_${safeIP}`;
  const hourKey = `upload_ratelimit_hour_${safeIP}_${Math.floor(now / 3600000)}`;
  const dayKey = `upload_ratelimit_day_${safeIP}_${new Date(now).toISOString().slice(0, 10)}`;

  const [lastUploadTime, hourlyCount, dailyCount] = await Promise.all([
    kv.get(lastKey),
    kv.get(hourKey),
    kv.get(dayKey),
  ]);

  if (lastUploadTime) {
    const timeSinceLastUpload = now - parseInt(lastUploadTime, 10);
    if (timeSinceLastUpload < limits.minInterval) {
      const waitTime = Math.ceil((limits.minInterval - timeSinceLastUpload) / 1000);
      return {
        allowed: false,
        error: `上传过于频繁，请等待 ${waitTime} 秒后再试`,
      };
    }
  }

  const nextHourlyCount = parseInt(hourlyCount || '0', 10) + 1;
  if (nextHourlyCount > limits.hourlyMax) {
    return {
      allowed: false,
      error: `本小时上传次数已达上限（${limits.hourlyMax} 次），请稍后再试`,
    };
  }

  const nextDailyCount = parseInt(dailyCount || '0', 10) + 1;
  if (nextDailyCount > limits.dailyMax) {
    return {
      allowed: false,
      error: `今日上传次数已达上限（${limits.dailyMax} 次），请明天再试`,
    };
  }

  return {
    allowed: true,
    lastKey,
    hourKey,
    dayKey,
    nextHourlyCount,
    nextDailyCount,
  };
}

async function commitUploadRateLimit(kv, rateLimit, now) {
  await Promise.all([
    kv.put(rateLimit.lastKey, now.toString(), { expirationTtl: 24 * 60 * 60 }),
    kv.put(rateLimit.hourKey, String(rateLimit.nextHourlyCount), { expirationTtl: 2 * 60 * 60 }),
    kv.put(rateLimit.dayKey, String(rateLimit.nextDailyCount), { expirationTtl: 2 * 24 * 60 * 60 }),
  ]);
}
