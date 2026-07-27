// functions/api/random.js - 直接返回 CDN 链接
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const redirect = url.searchParams.get("redirect") === "true";
  const host = url.origin;

  try {
    // 从 wallpapers.json 读取全部数据
    const jsonUrl = `${host}/data/wallpapers.json`;
    const resp = await fetch(new Request(jsonUrl, request));
    if (!resp.ok) {
      return new Response('Failed to load wallpapers.json', { status: 502 });
    }

    const wallpapers = await resp.json();
    if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
      return new Response('No wallpapers found', { status: 404 });
    }

    // ★★★ 随机选一张，直接用它的 webp 链接（CDN 或本地） ★★★
    const randomItem = wallpapers[Math.floor(Math.random() * wallpapers.length)];
    const imagePath = randomItem.webp || randomItem.jpg;

    if (!imagePath) {
      return new Response('No image found', { status: 404 });
    }

    // 如果是 CDN 链接，直接重定向或代理
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (redirect) {
        return Response.redirect(imagePath, 302);
      }
      const imgResp = await fetch(imagePath);
      return new Response(imgResp.body, {
        headers: {
          'Content-Type': imgResp.headers.get('Content-Type') || 'image/webp',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // 本地路径，拼接域名
    const imageUrl = new URL(imagePath, request.url);

    if (redirect) {
      return Response.redirect(imageUrl.toString(), 302);
    }

    const imgResp = await fetch(new Request(imageUrl.toString(), request));
    if (!imgResp.ok) {
      return new Response('Image not found', { status: 404 });
    }

    return new Response(imgResp.body, {
      headers: {
        'Content-Type': imgResp.headers.get('Content-Type') || 'image/webp',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
