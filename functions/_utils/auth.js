const DEFAULT_ADMIN_KEY = 'meme-gallery-2025';
const ADMIN_COOKIE = 'meme_gallery_admin';
const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function getAdminKey(env) {
  return env.ADMIN_KEY || DEFAULT_ADMIN_KEY;
}

export function isUsingDefaultAdminKey(env) {
  return !env.ADMIN_KEY;
}

export async function createAdminSession(context) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    iat: now,
    exp: now + ADMIN_SESSION_TTL_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, getAdminKey(context.env));
  const token = `${encodedPayload}.${signature}`;

  return {
    token,
    cookie: buildCookie(token, context.request, ADMIN_SESSION_TTL_SECONDS),
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export async function requireAdmin(context) {
  if (!(await isAdminRequest(context))) {
    return jsonResponse(
      { success: false, error: '需要管理员权限，请先验证管理密钥' },
      401
    );
  }

  return null;
}

export async function isAdminRequest(context) {
  const cookieHeader = context.request.headers.get('Cookie') || '';
  const token = parseCookies(cookieHeader)[ADMIN_COOKIE];
  return !!token && await verifyAdminToken(token, context.env);
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

async function verifyAdminToken(token, env) {
  const parts = String(token).split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = await sign(encodedPayload, getAdminKey(env));
  if (!constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    return payload.v === 1 && Number(payload.exp) > now;
  } catch {
    return false;
  }
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`meme-gallery-admin:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function buildCookie(token, request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${ADMIN_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function parseCookies(header) {
  return header.split(';').reduce((cookies, part) => {
    const index = part.indexOf('=');
    if (index === -1) {
      return cookies;
    }

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

function base64UrlEncode(value) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function constantTimeEqual(left, right) {
  const a = String(left);
  const b = String(right);
  if (!a || !b) {
    return a === b;
  }

  let diff = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= a.charCodeAt(index % a.length) ^ b.charCodeAt(index % b.length);
  }

  return diff === 0;
}
