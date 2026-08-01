// functions/api/list.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 获取分页参数
  const page = parseInt(url.searchParams.get('page')) || 1;
  const pageSize = parseInt(url.searchParams.get('size')) || 30;

  // 验证参数
  if (page < 1) {
    return new Response(JSON.stringify({
      error: 'page 参数必须大于等于 1'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (pageSize < 1 || pageSize > 100) {
    return new Response(JSON.stringify({
      error: 'size 参数必须在 1-100 之间'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const host = url.origin;
    
    // ★★★ 读取分页文件 ★★★
    const pageFile = `${host}/data/pages/page-${page}.json`;
    const fetchResp = await fetch(new Request(pageFile, request));

    if (!fetchResp.ok) {
      // 如果分页文件不存在，返回 404
      return new Response(JSON.stringify({
        error: `第 ${page} 页不存在`,
        totalPages: 48,  // 你的分页总数
        hint: `可用页码: 1-48`
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const pageData = await fetchResp.json();

    // ★★★ 返回分页数据 ★★★
    return new Response(JSON.stringify({
      code: 0,
      data: {
        items: pageData.items || [],
        page: pageData.page || page,
        pageSize: pageData.pageSize || pageSize,
        total: pageData.total || 0,
        totalPages: pageData.totalPages || 48,
        hasMore: pageData.hasMore || (page < (pageData.totalPages || 48))
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*'
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
