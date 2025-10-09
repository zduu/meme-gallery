/**
 * Cloudflare Pages Functions - 验证管理密钥
 * POST /api/verify-key
 */
export async function onRequestPost(context) {
  try {
    const { ADMIN_KEY } = context.env;
    const body = await context.request.json();
    const { key } = body;

    // 检查是否配置了管理密钥
    if (!ADMIN_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: '未配置管理密钥，请在 Cloudflare Pages 环境变量中设置 ADMIN_KEY'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 验证密钥
    const isValid = key === ADMIN_KEY;

    return new Response(
      JSON.stringify({ success: true, valid: isValid }),
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
