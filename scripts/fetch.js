// scripts/fetch.js - 修正日期偏移

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * 根据偏移量计算目标日期
 * 修正：offset 和日期的对应关系
 *   offset=0  → 今天 (7月26日)
 *   offset=-1 → 明天 (7月27日)
 *   offset=1  → 昨天 (7月25日)
 */
function getTargetDate(offset) {
    const now = new Date();
    // 注意：必应API的idx，正数=过去，负数=未来
    // 但我们传参时：正数偏移表示未来几天，负数表示过去几天
    // 所以这里要反过来
    const daysToAdd = -offset;  // 关键修正：取反
    now.setDate(now.getDate() + daysToAdd);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 获取指定偏移量的壁纸
 * @param {number} offset 正数=未来, 负数=过去
 */
async function fetchWallpaper(offset) {
    // 必应API的idx：正数=过去，负数=未来
    // 所以传参时取反
    const idx = -offset;
    const url = `https://cn.bing.com/HPImageArchive.aspx?format=js&n=1&idx=${idx}&mkt=zh-CN`;
    const response = await axios.get(url, { timeout: 10000 });
    const image = response.data.images[0];
    if (!image) return null;
    return {
        url: `https://cn.bing.com${image.url}`,
        copyright: image.copyright || '',
        copyrightLink: image.copyrightlink || '',
        title: image.title || '',
        description: image.description || ''
    };
}

async function downloadWallpaper(wallpaper, dateStr) {
    const jpgPath = path.join(PICTURE_DIR, `${dateStr}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${dateStr}.webp`);

    if (fs.existsSync(jpgPath) && fs.existsSync(webpPath)) {
        return null;
    }

    const response = await axios({
        url: wallpaper.url,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 15000
    });
    const buffer = Buffer.from(response.data);

    await Promise.all([
        sharp(buffer).jpeg({ quality: 88 }).toFile(jpgPath),
        sharp(buffer).webp({ quality: 82 }).toFile(webpPath)
    ]);

    return {
        date: dateStr,
        copyright: wallpaper.copyright,
        copyrightLink: wallpaper.copyrightLink,
        title: wallpaper.title,
        description: wallpaper.description,
        jpg: `/picture/${dateStr}.jpg`,
        webp: `/webp/${dateStr}.webp`
    };
}

async function main() {
    console.log('🚀 开始抓取必应壁纸...');
    console.log(`📅 今天是: ${getTargetDate(0)}`);

    // 未来7天 (offset: 1~7) + 今天 (offset: 0) + 过去30天 (offset: -1 ~ -30)
    const offsets = [];
    for (let i = 7; i >= 1; i--) offsets.push(i);
    offsets.push(0);
    for (let i = -1; i >= -30; i--) offsets.push(i);

    const results = [];
    for (const offset of offsets) {
        try {
            const dateStr = getTargetDate(offset);
            const wallpaper = await fetchWallpaper(offset);
            if (!wallpaper) {
                console.log(`⏭️ offset=${offset} 无数据`);
                continue;
            }
            const saved = await downloadWallpaper(wallpaper, dateStr);
            if (saved) {
                results.push(saved);
                console.log(`✅ ${dateStr} (offset=${offset})`);
            } else {
                console.log(`⏭️ ${dateStr} 已存在`);
            }
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.warn(`⚠️ offset=${offset} 失败:`, err.message);
        }
    }

    // 合并数据
    let allData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {}
    }

    const map = new Map();
    allData.forEach(item => map.set(item.date, item));
    results.forEach(item => map.set(item.date, item));

    const finalData = Array.from(map.values())
        .sort((a, b) => b.date.localeCompare(a.date));

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));

    console.log(`📝 共 ${finalData.length} 条记录`);
    console.log('✅ 完成!');
}

main().catch(console.error);
