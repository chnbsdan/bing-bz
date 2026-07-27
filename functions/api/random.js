// functions/api/random.js
export default async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 从当前请求的域名拼接 JSON 地址
  const host = url.origin;
  const jsonUrl = `${host}/data/wallpapers.json`;

  // 直接 fetch JSON
  const fetchResp = await fetch(new Request(jsonUrl, request));
  if (!fetchResp.ok) {
    return new Response("Failed to load wallpapers.json", { status: 502 });
  }

  let wallpapers = await fetchResp.json();

  if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
    return new Response("No wallpapers found", { status: 404 });
  }

  // 过滤出有图片的壁纸
  const validWallpapers = wallpapers.filter(item => item.jpg || item.webp);

  // 随机挑一张
  const randomItem = validWallpapers[Math.floor(Math.random() * validWallpapers.length)];
  const redirect = url.searchParams.get("redirect") === "true";

  // 优先使用 webp，否则用 jpg
  const imagePath = randomItem.webp || randomItem.jpg;
  
  // 如果是 CDN 链接，直接重定向或代理
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    if (redirect) {
      return Response.redirect(imagePath, 302);
    }
    const resp = await fetch(imagePath);
    return new Response(resp.body, {
      headers: {
        "Content-Type": resp.headers.get("Content-Type") || "image/jpeg",
        "Cache-Control": "public, max-age=10800",
      },
    });
  }

  // 本地路径，拼接完整 URL
  const imageUrl = new URL(imagePath, request.url);

  if (redirect) {
    return Response.redirect(imageUrl.toString(), 302);
  }

  // 直接返回图片二进制
  const resp = await fetch(new Request(imageUrl.toString(), request));
  if (!resp.ok) {
    return new Response("Failed to fetch image", { status: 502 });
  }

  return new Response(resp.body, {
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "image/webp",
      "Cache-Control": "public, max-age=10800",
      "bing-cache": "EO-FETCH",
    },
  });
}