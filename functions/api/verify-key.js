import {
  createAdminSession,
  getAdminKey,
  isUsingDefaultAdminKey,
  jsonResponse,
} from '../_utils/auth.js';

/**
 * Cloudflare Pages Functions - 验证管理密钥
 * POST /api/verify-key
 */
export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { key } = body;

    // 验证密钥
    const isValid = key === getAdminKey(context.env);

    const headers = {};
    let expiresAt = null;

    if (isValid) {
      const session = await createAdminSession(context);
      headers['Set-Cookie'] = session.cookie;
      expiresAt = session.expiresAt;
    }

    return jsonResponse(
      {
        success: true,
        valid: isValid,
        expiresAt,
        warning: isUsingDefaultAdminKey(context.env) && isValid ? '正在使用默认密钥，建议在环境变量中设置自定义 ADMIN_KEY' : null
      },
      200,
      headers
    );
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}
