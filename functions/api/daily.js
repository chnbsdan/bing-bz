// functions/api/daily.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 处理参数
  const format = url.searchParams.get("format") || "webp";
  const redirect = url.searchParams.get("redirect") === "true";

  // 验证参数
  const allowedFormats = ["webp", "jpeg", "original"];
  if (!allowedFormats.includes(format)) {
    return new Response("Invalid format parameter", { status: 400 });
  }

  try {
    // 从 wallpapers.json 获取最新一张
    const host = url.origin;
    const jsonUrl = `${host}/data/wallpapers.json`;

    const fetchResp = await fetch(new Request(jsonUrl, request));
    if (!fetchResp.ok) {
      return new Response("Failed to load wallpapers.json", { status: 502 });
    }

    let wallpapers = await fetchResp.json();

    if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
      return new Response("No wallpapers found", { status: 404 });
    }

    // 按日期排序，取最新一张
    wallpapers.sort((a, b) => b.date.localeCompare(a.date));
    const latest = wallpapers[0];

    // 根据格式选择图片路径
    let imagePath;
    if (format === "jpeg") {
      imagePath = latest.jpg || latest.webp;
    } else if (format === "original") {
      imagePath = latest.jpg || latest.webp;
    } else {
      // webp
      imagePath = latest.webp || latest.jpg;
    }

    if (!imagePath) {
      return new Response("No image found", { status: 404 });
    }

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
      },
    });
  } catch (error) {
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}
