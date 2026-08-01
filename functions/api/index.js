// functions/api/index.js
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const base = `${url.protocol}//${url.host}`;

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>必应壁纸 API</title>
  <link rel="icon" href="/favicon.ico" type="image/x-icon" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    :root {
      --bg-primary: #0d0d1a;
      --bg-secondary: #1a1a2e;
      --bg-card: rgba(255,255,255,0.03);
      --bg-card-hover: rgba(255,255,255,0.06);
      --text-primary: #fff;
      --text-secondary: rgba(255,255,255,0.6);
      --text-muted: rgba(255,255,255,0.3);
      --border-color: rgba(255,255,255,0.06);
      --border-hover: rgba(79,195,247,0.15);
      --shadow: none;
      --code-bg: rgba(0,0,0,0.3);
      --donate-bg: rgba(255,255,255,0.02);
    }

    [data-theme="light"] {
      --bg-primary: #f0f2f5;
      --bg-secondary: #ffffff;
      --bg-card: rgba(0,0,0,0.02);
      --bg-card-hover: rgba(0,0,0,0.04);
      --text-primary: #1a1a2e;
      --text-secondary: rgba(0,0,0,0.6);
      --text-muted: rgba(0,0,0,0.3);
      --border-color: rgba(0,0,0,0.08);
      --border-hover: rgba(79,195,247,0.3);
      --shadow: 0 2px 12px rgba(0,0,0,0.04);
      --code-bg: rgba(0,0,0,0.04);
      --donate-bg: rgba(0,0,0,0.02);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      min-height: 100vh;
      padding: 30px 20px 60px;
      transition: background 0.3s ease, color 0.3s ease;
    }
    a { color: #4fc3f7; text-decoration: none; }
    a:hover { color: #81d4fa; }

    .container { max-width: 1000px; margin: 0 auto; }

    /* ===== 顶部主题切换 ===== */
    .theme-toggle-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }
    .theme-toggle-btn {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 8px 14px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: 0.2s;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .theme-toggle-btn:hover {
      background: var(--bg-card-hover);
      color: var(--text-primary);
    }

    /* ===== 头部 ===== */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .header-left h1 {
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #4fc3f7, #00e5ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .header-left p {
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }
    .header-left p i { margin-right: 6px; }
    .header-right {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .header-right .badge {
      background: rgba(79,195,247,0.12);
      color: #4fc3f7;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 13px;
      border: 1px solid rgba(79,195,247,0.12);
    }
    .header-right .btn-back {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      color: var(--text-secondary);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: 0.2s;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .header-right .btn-back:hover {
      background: var(--bg-card-hover);
      color: var(--text-primary);
    }

    /* ===== 统计卡片 ===== */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px 18px;
      text-align: center;
      transition: 0.2s;
    }
    .stat-card:hover { border-color: var(--border-hover); }
    .stat-card .num {
      font-size: 26px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }
    .stat-card .num i { color: #4fc3f7; margin-right: 6px; }
    .stat-card .label {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* ===== 区块标题 ===== */
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin: 30px 0 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-title i { color: #4fc3f7; font-size: 20px; }
    .section-title .tag {
      font-size: 12px;
      font-weight: 400;
      background: rgba(79,195,247,0.1);
      color: #4fc3f7;
      padding: 2px 10px;
      border-radius: 12px;
    }

    /* ===== API 卡片 ===== */
    .api-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 14px;
    }
    .api-card {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 18px 20px;
      transition: 0.25s ease;
    }
    .api-card:hover {
      background: var(--bg-card-hover);
      border-color: var(--border-hover);
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }
    .api-card .api-label {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .api-card .api-path {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      font-family: 'SF Mono', 'Fira Code', monospace;
      margin-bottom: 6px;
    }
    .api-card .api-path .method {
      font-size: 11px;
      font-weight: 400;
      background: rgba(79,195,247,0.12);
      color: #4fc3f7;
      padding: 1px 8px;
      border-radius: 4px;
      margin-left: 8px;
      font-family: inherit;
    }
    .api-card .api-desc {
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
    .api-card .api-code {
      margin-top: 10px;
      background: var(--code-bg);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      color: var(--text-secondary);
      overflow-x: auto;
      white-space: nowrap;
      border: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .api-card .api-code .link-part {
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }
    .api-card .api-code .link-part a {
      color: var(--text-secondary);
      transition: 0.2s;
    }
    .api-card .api-code .link-part a:hover {
      color: #4fc3f7;
    }
    .api-card .api-code .copy-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 14px;
      transition: 0.2s;
      font-family: inherit;
      padding: 0 4px;
      flex-shrink: 0;
    }
    .api-card .api-code .copy-btn:hover { color: #4fc3f7; }
    .api-card .api-tags {
      margin-top: 6px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .api-card .api-tags code {
      background: var(--code-bg);
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    /* ===== 参数表格 ===== */
    .params-table-wrap {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px 20px;
      overflow-x: auto;
    }
    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
      margin-top: 0;
    }
    .params-table th {
      text-align: left;
      color: var(--text-muted);
      font-weight: 400;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 6px 10px 6px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .params-table td {
      padding: 8px 10px 8px 0;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
    .params-table td:first-child {
      color: var(--text-primary);
      font-weight: 500;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
    }
    .params-table td .param-desc {
      color: var(--text-muted);
      font-size: 12px;
    }
    .params-table tr:last-child td { border-bottom: none; }

    /* ===== 使用示例 ===== */
    .example-box {
      background: var(--code-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 16px 20px;
      font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 13px;
      color: var(--text-secondary);
      overflow-x: auto;
    }
    .example-box .comment {
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    /* ===== 打赏 ===== */
    .donate-section {
      margin-top: 40px;
      padding: 24px 28px;
      background: var(--donate-bg);
      border: 1px solid var(--border-color);
      border-radius: 14px;
      text-align: center;
    }
    .donate-section .donate-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }
    .donate-section .donate-title i { color: #ff6b6b; margin-right: 8px; }
    .donate-section .donate-desc {
      font-size: 13px;
      color: var(--text-muted);
      margin-bottom: 14px;
    }
    .donate-section .qr-row {
      display: flex;
      justify-content: center;
      gap: 30px;
      flex-wrap: wrap;
    }
    .donate-section .qr-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .donate-section .qr-item img {
      width: 120px;
      height: 120px;
      border-radius: 10px;
      background: #fff;
      padding: 6px;
      border: 1px solid var(--border-color);
    }
    .donate-section .qr-item .qr-label {
      font-size: 12px;
      color: var(--text-muted);
    }
    .donate-section .qr-item .qr-label.wechat { color: #07c160; }
    .donate-section .qr-item .qr-label.alipay { color: #1677ff; }

    /* ===== 页脚 ===== */
    footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 13px;
      color: var(--text-muted);
    }
    footer .footer-links { display: flex; gap: 16px; }
    footer .footer-links a {
      color: var(--text-muted);
      transition: 0.2s;
    }
    footer .footer-links a:hover { color: var(--text-primary); }

    /* ===== Toast ===== */
    .toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: var(--bg-secondary);
      backdrop-filter: blur(8px);
      padding: 10px 24px;
      border-radius: 10px;
      font-size: 14px;
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      opacity: 0;
      transition: all 0.4s ease;
      pointer-events: none;
      z-index: 999;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* ===== 响应式 ===== */
    @media (max-width: 640px) {
      body { padding: 16px 12px 40px; }
      .header-left h1 { font-size: 22px; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .api-grid { grid-template-columns: 1fr; }
      .api-card .api-code { font-size: 11px; white-space: normal; word-break: break-all; }
      .donate-section .qr-item img { width: 90px; height: 90px; }
      .params-table { font-size: 13px; }
      .params-table td, .params-table th { padding: 4px 6px 4px 0; }
      footer { flex-direction: column; text-align: center; }
    }
    @media (max-width: 400px) {
      .stats { grid-template-columns: 1fr; }
      .donate-section .qr-row { gap: 16px; }
      .donate-section .qr-item img { width: 75px; height: 75px; }
    }
  </style>
</head>
<body>

  <div class="container">

    <!-- ===== 主题切换 ===== -->
    <div class="theme-toggle-wrap">
      <button class="theme-toggle-btn" id="themeToggle" title="切换主题">
        <i class="fas fa-moon" id="themeIcon"></i> <span id="themeLabel">深色</span>
      </button>
    </div>

    <!-- ===== 头部 ===== -->
    <div class="header">
      <div class="header-left">
        <h1>📷 必应壁纸 API</h1>
        <p><i class="fas fa-clock"></i> 图片自动更新时间：每天 0:10</p>
      </div>
      <div class="header-right">
        <span class="badge"><i class="fas fa-code"></i> RESTful API</span>
        <a href="/" class="btn-back"><i class="fas fa-arrow-left"></i> 返回首页</a>
      </div>
    </div>

    <!-- ===== 统计 ===== -->
    <div class="stats">
      <div class="stat-card">
        <div class="num"><i class="fas fa-image"></i> <span id="totalCount">--</span></div>
        <div class="label">总图片数</div>
      </div>
      <div class="stat-card">
        <div class="num"><i class="fas fa-calendar-day"></i> <span id="todayDate">--</span></div>
        <div class="label">今日更新</div>
      </div>
      <div class="stat-card">
        <div class="num"><i class="fas fa-clock"></i> <span id="updateTime">--</span></div>
        <div class="label">最后更新</div>
      </div>
    </div>

    <!-- ===== API 列表 ===== -->
    <div class="section-title">
      <i class="fas fa-plug"></i> API 接口
      <span class="tag">全部免费</span>
    </div>

    <div class="api-grid">

      <!-- 当天图像 -->
      <div class="api-card">
        <div class="api-label"><i class="fas fa-sun"></i> 当天图像</div>
        <div class="api-path">/api/daily <span class="method">GET</span></div>
        <div class="api-desc">获取今日必应壁纸</div>
        <div class="api-code">
          <span class="link-part"><a href="${base}/api/daily" target="_blank">${base}/api/daily</a></span>
          <button class="copy-btn" onclick="copyText('${base}/api/daily')"><i class="fas fa-copy"></i></button>
        </div>
        <div class="api-tags">
          <code>?format=webp</code> · <code>?format=jpeg</code> · <code>?format=original</code>
        </div>
      </div>

      <!-- 随机图像 -->
      <div class="api-card">
        <div class="api-label"><i class="fas fa-random"></i> 随机图像</div>
        <div class="api-path">/api/random <span class="method">GET</span></div>
        <div class="api-desc">随机返回一张壁纸</div>
        <div class="api-code">
          <span class="link-part"><a href="${base}/api/random" target="_blank">${base}/api/random</a></span>
          <button class="copy-btn" onclick="copyText('${base}/api/random')"><i class="fas fa-copy"></i></button>
        </div>
        <div class="api-tags">
          <code>?redirect=true</code> 重定向到图片
        </div>
      </div>

      <!-- 指定日期 -->
      <div class="api-card">
        <div class="api-label"><i class="fas fa-calendar-alt"></i> 指定日期</div>
        <div class="api-path">/api/image <span class="method">GET</span></div>
        <div class="api-desc">获取指定日期的壁纸</div>
        <div class="api-code">
          <span class="link-part"><a href="${base}/api/image?date=20260731" target="_blank">${base}/api/image?date=20260731</a></span>
          <button class="copy-btn" onclick="copyText('${base}/api/image?date=20260731')"><i class="fas fa-copy"></i></button>
        </div>
        <div class="api-tags">
          <code>?date=20260731</code> 格式：YYYYMMDD
        </div>
      </div>

      <!-- 壁纸列表 -->
      <div class="api-card">
        <div class="api-label"><i class="fas fa-list"></i> 壁纸列表</div>
        <div class="api-path">/api/list <span class="method">GET</span></div>
        <div class="api-desc">获取所有壁纸列表（分页）</div>
        <div class="api-code">
          <span class="link-part"><a href="${base}/api/list" target="_blank">${base}/api/list</a></span>
          <button class="copy-btn" onclick="copyText('${base}/api/list')"><i class="fas fa-copy"></i></button>
        </div>
        <div class="api-tags">
          <code>?page=1&size=30</code> 分页参数
        </div>
      </div>

    </div>

    <!-- ===== 参数说明 ===== -->
    <div class="section-title" style="margin-top:36px;">
      <i class="fas fa-cog"></i> 参数说明
      <span class="tag">可选</span>
    </div>

    <div class="params-table-wrap">
      <table class="params-table">
        <thead>
          <tr><th>参数</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>date</td>
            <td>指定日期 <span class="param-desc">（格式：YYYYMMDD，如 20260731）</span></td>
          </tr>
          <tr>
            <td>format</td>
            <td>图片格式 <span class="param-desc">（webp / jpeg / original，默认 webp）</span></td>
          </tr>
          <tr>
            <td>redirect</td>
            <td>是否重定向到图片 <span class="param-desc">（true / false，默认 false）</span></td>
          </tr>
          <tr>
            <td>page</td>
            <td>分页页码 <span class="param-desc">（默认 1）</span></td>
          </tr>
          <tr>
            <td>size</td>
            <td>每页数量 <span class="param-desc">（默认 30，最大 100）</span></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ===== 使用示例 ===== -->
    <div class="section-title" style="margin-top:36px;">
      <i class="fas fa-code"></i> 使用示例
      <span class="tag">HTML</span>
    </div>

    <div class="example-box">
      <div class="comment">&lt;!-- 嵌入当天壁纸 --&gt;</div>
      &lt;img src="${base}/api/daily" alt="今日壁纸" /&gt;
      <div class="comment" style="margin-top:10px;">&lt;!-- 嵌入随机壁纸 --&gt;</div>
      &lt;img src="${base}/api/random" alt="随机壁纸" /&gt;
      <div class="comment" style="margin-top:10px;">&lt;!-- 嵌入指定日期壁纸 --&gt;</div>
      &lt;img src="${base}/api/image?date=20260731" alt="壁纸" /&gt;
      <div class="comment" style="margin-top:10px;">&lt;!-- JavaScript 调用 --&gt;</div>
      fetch('${base}/api/random')
        .then(res => res.json())
        .then(data => console.log(data));
    </div>

    <!-- ===== 打赏 ===== -->
    <div class="donate-section">
      <div class="donate-title"><i class="fas fa-heart"></i> 支持作者</div>
      <div class="donate-desc">如果这个 API 对你有帮助，请作者喝杯咖啡吧 ☕</div>
      <div class="qr-row">
        <div class="qr-item">
          <img src="https://img.hangdn.com/hd/wechat.png" alt="微信支付" />
          <span class="qr-label wechat"><i class="fab fa-weixin"></i> 微信支付</span>
        </div>
        <div class="qr-item">
          <img src="https://img.hangdn.com/hd/alipay.png" alt="支付宝" />
          <span class="qr-label alipay"><i class="fab fa-alipay"></i> 支付宝</span>
        </div>
      </div>
    </div>

    <!-- ===== 页脚 ===== -->
    <footer>
      <span>© 2026 必应壁纸 · 图片来自 Bing</span>
      <div class="footer-links">
        <a href="/" title="首页"><i class="fas fa-home"></i></a>
        <a href="https://github.com" target="_blank" title="GitHub"><i class="fab fa-github"></i></a>
        <a href="#" title="反馈"><i class="fas fa-bug"></i></a>
      </div>
    </footer>

  </div>

  <!-- ===== Toast ===== -->
  <div class="toast" id="toast">✅ 已复制</div>

  <script>
    // ============================================================
    // 1. 主题切换
    // ============================================================
    var themeToggle = document.getElementById('themeToggle');
    var themeIcon = document.getElementById('themeIcon');
    var themeLabel = document.getElementById('themeLabel');
    var currentTheme = localStorage.getItem('apiTheme') || 'dark';

    function setTheme(theme) {
      currentTheme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('apiTheme', theme);
      if (theme === 'dark') {
        themeIcon.className = 'fas fa-moon';
        themeLabel.textContent = '深色';
      } else {
        themeIcon.className = 'fas fa-sun';
        themeLabel.textContent = '亮色';
      }
    }

    themeToggle.addEventListener('click', function() {
      setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
    setTheme(currentTheme);

    // ============================================================
    // 2. 加载统计数据（从 /data/wallpapers.json 读取）
    // ============================================================
    async function loadStats() {
      try {
        var res = await fetch('/data/wallpapers.json');
        if (!res.ok) throw new Error('加载失败');
        var data = await res.json();
        
        document.getElementById('totalCount').textContent = data.length || '0';
        
        if (data.length > 0) {
          document.getElementById('todayDate').textContent = data[0].date || '--';
        }
      } catch (err) {
        console.log('统计加载失败:', err);
        document.getElementById('totalCount').textContent = '--';
      }
    }

    // ============================================================
    // 3. 更新时间
    // ============================================================
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('updateTime').textContent = h + ':' + m;

    // ============================================================
    // 4. 复制功能
    // ============================================================
    function copyText(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          showToast('✅ 已复制: ' + text);
        }).catch(function() {
          fallbackCopy(text);
        });
      } else {
        fallbackCopy(text);
      }
    }

    function fallbackCopy(text) {
      var input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand('copy');
        showToast('✅ 已复制: ' + text);
      } catch (e) {
        showToast('⚠️ 复制失败，请手动复制');
      }
      document.body.removeChild(input);
    }

    function showToast(msg) {
      var toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.add('show');
      clearTimeout(toast._timer);
      toast._timer = setTimeout(function() {
        toast.classList.remove('show');
      }, 2000);
    }

    // ============================================================
    // 5. 启动
    // ============================================================
    loadStats();
  </script>

</body>
</html>
  `;

  return new Response(html, {
    headers: { 
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    },
  });
}
