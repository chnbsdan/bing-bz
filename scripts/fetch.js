// scripts/fetch.js - 简洁版：每天只存一张图

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

const BING_API = 'https://cn.bing.com/HPImageArchive.aspx?format=js&n=1&mkt=zh-CN';
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/**
 * 获取指定日期的壁纸
 * @param {number} idx 0=今天, -1=明天, 1=昨天...
 */
async function fetchWallpaper(idx = 0) {
    const url = `https://cn.bing.com/HPImageArchive.aspx?format=js&n=1&idx=${idx}&mkt=zh-CN`;
    const response = await axios.get(url, { timeout: 10000 });
    const image = response.data.images[0];
    if (!image) return null;
    return {
        date: image.startdate,
        url: `https://cn.bing.com${image.url}`,
        copyright: image.copyright || '',
        copyrightLink: image.copyrightlink || '',
        title: image.title || '',
        description: image.description || ''
    };
}

/**
 * 下载并保存图片
 */
async function downloadWallpaper(wallpaper) {
    const dateStr = wallpaper.date;
    const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    const jpgPath = path.join(PICTURE_DIR, `${formattedDate}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${formattedDate}.webp`);

    // 已存在则跳过
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
        date: formattedDate,
        copyright: wallpaper.copyright,
        copyrightLink: wallpaper.copyrightLink,
        title: wallpaper.title,
        description: wallpaper.description,
        jpg: `/picture/${formattedDate}.jpg`,
        webp: `/webp/${formattedDate}.webp`
    };
}

async function main() {
    console.log('🚀 开始抓取必应壁纸...');

    // 要抓取的天数：未来7天 + 过去30天
    const dates = [];
    for (let i = -7; i <= 30; i++) {
        dates.push(i);
    }

    const results = [];
    for (const idx of dates) {
        try {
            const wallpaper = await fetchWallpaper(idx);
            if (!wallpaper) {
                console.log(`⏭️ idx=${idx} 无数据`);
                continue;
            }
            const saved = await downloadWallpaper(wallpaper);
            if (saved) {
                results.push(saved);
                console.log(`✅ ${saved.date}`);
            } else {
                console.log(`⏭️ ${wallpaper.date} 已存在`);
            }
            // 慢一点，别被ban
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.warn(`⚠️ idx=${idx} 失败:`, err.message);
        }
    }

    // 读取旧数据，合并
    let allData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {}
    }

    // 用日期去重
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
