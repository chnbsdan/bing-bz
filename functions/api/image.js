// functions/api/image.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 获取参数
  const date = url.searchParams.get('date');
  const format = url.searchParams.get('format') || 'webp';
  const redirect = url.searchParams.get('redirect') === 'true';

  // 验证日期参数
  if (!date) {
    return new Response(JSON.stringify({
      error: '缺少 date 参数',
      example: '/api/image?date=20260731'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 验证日期格式 (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return new Response(JSON.stringify({
      error: '日期格式错误，请使用 YYYYMMDD 格式，如 20260731'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 验证格式参数
  const allowedFormats = ['webp', 'jpeg', 'original'];
  if (!allowedFormats.includes(format)) {
    return new Response(JSON.stringify({
      error: '格式参数错误，支持: webp, jpeg, original'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 从 wallpapers.json 获取数据
    const host = url.origin;
    const jsonUrl = `${host}/data/wallpapers.json`;

    const fetchResp = await fetch(new Request(jsonUrl, request));
    if (!fetchResp.ok) {
      return new Response(JSON.stringify({
        error: '无法加载壁纸数据'
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let wallpapers = await fetchResp.json();

    if (!Array.isArray(wallpapers) || wallpapers.length === 0) {
      return new Response(JSON.stringify({
        error: '暂无壁纸数据'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ★★★ 查找匹配日期的壁纸 ★★★
    const item = wallpapers.find(w => w.date === date);

    if (!item) {
      // 返回最近10个日期供参考
      const recentDates = wallpapers.slice(0, 10).map(w => w.date);
      return new Response(JSON.stringify({
        error: `未找到 ${date} 的壁纸`,
        available_dates: recentDates,
        hint: '可用日期格式: YYYYMMDD'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ★★★ 根据格式选择图片路径 ★★★
    let imagePath;
    if (format === 'jpeg' || format === 'original') {
      imagePath = item.jpg || item.webp;
    } else {
      // webp
      imagePath = item.webp || item.jpg;
    }

    if (!imagePath) {
      return new Response(JSON.stringify({
        error: `日期 ${date} 没有可用的图片`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ★★★ 如果是 CDN 链接 ★★★
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      if (redirect) {
        return Response.redirect(imagePath, 302);
      }
      // 代理图片
      const resp = await fetch(imagePath);
      return new Response(resp.body, {
        headers: {
          'Content-Type': resp.headers.get('Content-Type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=10800',
          'X-Image-Date': item.date,
          'X-Image-Copyright': encodeURIComponent(item.copyright || '')
        }
      });
    }

    // ★★★ 本地路径 ★★★
    const imageUrl = new URL(imagePath, request.url);

    if (redirect) {
      return Response.redirect(imageUrl.toString(), 302);
    }

    const resp = await fetch(new Request(imageUrl.toString(), request));
    if (!resp.ok) {
      return new Response(JSON.stringify({
        error: '获取图片失败'
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(resp.body, {
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'image/webp',
        'Cache-Control': 'public, max-age=10800',
        'X-Image-Date': item.date,
        'X-Image-Copyright': encodeURIComponent(item.copyright || '')
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: '服务器错误',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
