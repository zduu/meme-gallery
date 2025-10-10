/**
 * Cloudflare Pages Functions - 验证管理密钥
 * POST /api/verify-key
 */
export async function onRequestPost(context) {
  try {
    const { ADMIN_KEY } = context.env;
    const body = await context.request.json();
    const { key } = body;

    // 默认密钥（如果未配置 ADMIN_KEY）
    const DEFAULT_ADMIN_KEY = 'meme-gallery-2025';

    // 使用配置的密钥，如果没有配置则使用默认密钥
    const adminKey = ADMIN_KEY || DEFAULT_ADMIN_KEY;

    // 验证密钥
    const isValid = key === adminKey;

    // 如果使用的是默认密钥，添加警告信息
    const isUsingDefault = !ADMIN_KEY;

    return new Response(
      JSON.stringify({
        success: true,
        valid: isValid,
        warning: isUsingDefault && isValid ? '正在使用默认密钥，建议在环境变量中设置自定义 ADMIN_KEY' : null
      }),
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
