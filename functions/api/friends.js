/**
 * 友情链接存储
 * GET /api/friends         -> { success, data: Link[] }
 * POST /api/friends        -> body: { action: 'add'|'update'|'delete', ... }
 * 
 * Link: { id: number, name: string, url: string, icon?: string, addedAt: string }
 */
export async function onRequestGet(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const json = await MEME_GALLERY_KV.get('friend_links');
    const links = json ? JSON.parse(json) : [];
    return new Response(JSON.stringify({ success: true, data: links }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestPost(context) {
  try {
    const { MEME_GALLERY_KV } = context.env;
    const body = await context.request.json();
    const action = (body.action || '').toLowerCase();

    const json = await MEME_GALLERY_KV.get('friend_links');
    const list = json ? JSON.parse(json) : [];

    if (action === 'add') {
      const name = (body.name || '').trim();
      const url = (body.url || '').trim();
      const icon = (body.icon || '').trim();
      if (!name || !isHttpUrl(url)) {
        return badRequest('参数错误：需要 name 与有效 url');
      }
      const item = {
        id: Date.now() + Math.random(),
        name,
        url,
        icon: icon || undefined,
        addedAt: new Date().toISOString(),
      };
      list.unshift(item);
      await MEME_GALLERY_KV.put('friend_links', JSON.stringify(list));
      return ok({ item });
    }

    if (action === 'update') {
      const id = Number(body.id);
      const name = (body.name || '').trim();
      const url = (body.url || '').trim();
      const icon = (body.icon || '').trim();
      let updated = null;
      const next = list.map((x) => {
        if (Number(x.id) === id) {
          updated = { ...x, name: name || x.name, url: isHttpUrl(url) ? url : x.url, icon: icon || x.icon };
          return updated;
        }
        return x;
      });
      if (!updated) return badRequest('未找到该友链');
      await MEME_GALLERY_KV.put('friend_links', JSON.stringify(next));
      return ok({ item: updated });
    }

    if (action === 'delete') {
      const id = Number(body.id);
      const next = list.filter((x) => Number(x.id) !== id);
      await MEME_GALLERY_KV.put('friend_links', JSON.stringify(next));
      return ok({ id });
    }

    return badRequest('未知操作');
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function isHttpUrl(u) {
  try {
    const x = new URL(String(u));
    return x.protocol === 'http:' || x.protocol === 'https:';
  } catch { return false; }
}

function ok(data) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

