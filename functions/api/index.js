// functions/api/index.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const html = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>图片 API 服务</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      max-width: 720px;
      margin: 2rem auto;
      padding: 1rem;
      line-height: 1.6;
      background: #0d0d1a;
      color: #e0e0e0;
    }
    h1 { color: #4fc3f7; }
    code { background: rgba(255,255,255,0.06); padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.9em; }
    .endpoint { 
      margin-bottom: 1.5rem; 
      background: rgba(255,255,255,0.03);
      padding: 1rem 1.2rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .endpoint h2 { color: #81d4fa; font-size: 1.1rem; margin-bottom: 0.5rem; }
    ul { list-style: none; padding: 0; }
    li { padding: 0.2rem 0; color: rgba(255,255,255,0.6); }
    a { color: #4fc3f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .back-home {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.5rem 1.2rem;
      background: rgba(79, 195, 247, 0.12);
      border: 1px solid rgba(79, 195, 247, 0.2);
      border-radius: 6px;
      color: #4fc3f7;
      font-size: 0.9rem;
      transition: 0.2s;
    }
    .back-home:hover {
      background: rgba(79, 195, 247, 0.2);
      text-decoration: none;
    }
    footer {
      margin-top: 2rem;
      color: rgba(255,255,255,0.2);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <h1>📷 图片 API 服务</h1>
  <p>基于 <strong>data/wallpapers.json</strong> 提供图片接口。</p>

  <div class="endpoint">
    <h2>/api/random</h2>
    <ul>
      <li><code>${base}/api/random</code> → 随机图片（默认 <strong>不重定向</strong>）</li>
      <li><code>${base}/api/random?redirect=true</code> → 随机图片（使用重定向）</li>
    </ul>
  </div>

  <div class="endpoint">
    <h2>/api/daily</h2>
    <ul>
      <li><code>${base}/api/daily</code> → 今日图像（默认 WebP，不重定向）</li>
      <li><code>${base}/api/daily?format=jpeg</code> → 压缩 JPEG</li>
      <li><code>${base}/api/daily?format=original</code> → 原始 JPEG</li>
      <li><code>${base}/api/daily?redirect=true</code> → 今日图像（使用重定向）</li>
    </ul>
  </div>

  <a href="/" class="back-home">🏠 返回首页</a>

  <footer>Powered by Cloudflare Pages Functions</footer>
</body>
</html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
