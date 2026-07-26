// scripts/fetch.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// 目录配置
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// 必应API
const BING_API = 'https://cn.bing.com/HPImageArchive.aspx';

/**
 * 获取指定范围的壁纸
 * @param {number} idx - 偏移量 (0=今天, -1=明天, 1=昨天...)
 * @param {number} n - 数量 (最大8)
 */
async function fetchBingImages(idx, n) {
    const url = `${BING_API}?format=js&idx=${idx}&n=${n}&mkt=zh-CN`;
    const response = await axios.get(url);
    return response.data.images || [];
}

/**
 * 下载单张图片并保存为jpg和webp
 */
async function downloadAndConvert(imageInfo) {
    const dateStr = imageInfo.startdate; // 格式: 20260726
    const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    const imageUrl = `https://cn.bing.com${imageInfo.url}`;
    
    const jpgPath = path.join(PICTURE_DIR, `${formattedDate}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${formattedDate}.webp`);

    // 如果已存在则跳过
    if (fs.existsSync(jpgPath) && fs.existsSync(webpPath)) {
        console.log(`⏭️ 跳过已存在: ${formattedDate}`);
        return { date: formattedDate, exists: true };
    }

    try {
        // 下载原图
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer'
        });

        const imageBuffer = Buffer.from(response.data);

        // 保存原图 jpg
        await sharp(imageBuffer)
            .jpeg({ quality: 90, progressive: true })
            .toFile(jpgPath);

        // 保存 webp
        await sharp(imageBuffer)
            .webp({ quality: 85 })
            .toFile(webpPath);

        console.log(`✅ 已保存: ${formattedDate}`);

        return {
            date: formattedDate,
            url: imageUrl,
            copyright: imageInfo.copyright || '',
            copyrightLink: imageInfo.copyrightlink || '',
            title: imageInfo.title || '',
            description: imageInfo.description || '',
            jpg: `/picture/${formattedDate}.jpg`,
            webp: `/webp/${formattedDate}.webp`
        };

    } catch (error) {
        console.error(`❌ 下载失败 ${formattedDate}:`, error.message);
        return null;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 开始抓取必应壁纸...');

    // 1. 分批获取图片数据
    const fetchConfigs = [
        { idx: -1, n: 8 },  // 未来7天 + 明天
        { idx: 0, n: 8 },   // 今天 + 过去7天
        { idx: 8, n: 8 },   // 过去8-15天
        { idx: 16, n: 8 },  // 过去16-23天
        { idx: 24, n: 8 }   // 过去24-31天
    ];

    let allImages = [];
    for (const config of fetchConfigs) {
        try {
            const images = await fetchBingImages(config.idx, config.n);
            allImages = allImages.concat(images);
            console.log(`📥 获取 idx=${config.idx} 成功，${images.length}张`);
        } catch (error) {
            console.error(`❌ 获取 idx=${config.idx} 失败:`, error.message);
        }
    }

    // 去重（按日期）
    const uniqueMap = new Map();
    allImages.forEach(img => {
        if (!uniqueMap.has(img.startdate)) {
            uniqueMap.set(img.startdate, img);
        }
    });
    const uniqueImages = Array.from(uniqueMap.values());
    console.log(`📊 共获取 ${uniqueImages.length} 张不重复壁纸`);

    // 2. 下载并转换
    let results = [];
    for (const image of uniqueImages) {
        const result = await downloadAndConvert(image);
        if (result) results.push(result);
    }

    // 3. 读取已有数据，合并去重
    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {
            console.warn('读取旧数据失败，将重建');
        }
    }

    // 合并：新数据覆盖旧数据
    const dataMap = new Map();
    existingData.forEach(item => dataMap.set(item.date, item));
    results.forEach(item => dataMap.set(item.date, item));

    // 按日期排序（最新在前）
    const finalData = Array.from(dataMap.values())
        .filter(item => item !== null)
        .sort((a, b) => b.date.localeCompare(a.date));

    // 保存数据
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log(`💾 数据已保存，共 ${finalData.length} 条记录`);

    // 4. 输出统计
    const jpgCount = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length;
    const webpCount = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length;
    console.log(`📁 原图: ${jpgCount} 张, WebP: ${webpCount} 张`);
    console.log('✅ 完成!');
}

main().catch(console.error);
