// scripts/fetch.js
// 完全重写：模拟 bing.ioliu.cn 的多地区抓取策略

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// --- 配置 ---
// 目标地区列表 (对应必应API的 mkt 参数)
const REGIONS = [
    'zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 
    'es-ES', 'it-IT', 'pt-BR', 'en-IN', 'fr-CA'
];
const BING_API = 'https://cn.bing.com/HPImageArchive.aspx';
// 图片存储目录
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- 工具函数 ---

/**
 * 从必应API获取指定地区的图片列表
 * @param {string} mkt - 地区代码，如 'zh-CN'
 * @param {number} n - 获取数量，最大8
 * @returns {Promise<Array>} 图片信息数组
 */
async function fetchRegionImages(mkt, n = 8) {
    try {
        const url = `${BING_API}?format=js&n=${n}&mkt=${mkt}`;
        const response = await axios.get(url, { timeout: 10000 });
        // 为每张图片标记来源地区
        return (response.data.images || []).map(img => ({
            ...img,
            region: mkt
        }));
    } catch (error) {
        console.warn(`⚠️ 获取地区 ${mkt} 失败:`, error.message);
        return [];
    }
}

/**
 * 下载单张图片并保存为 jpg 和 webp
 */
async function downloadAndConvert(imageInfo) {
    // 使用 startdate 作为文件名，如果同一天有多个地区，用地区后缀区分
    const dateStr = imageInfo.startdate; // 格式: 20260726
    const region = imageInfo.region || 'zh-CN';
    const baseFileName = `${dateStr}_${region}`;
    const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    
    const imageUrl = `https://cn.bing.com${imageInfo.url}`;
    
    const jpgPath = path.join(PICTURE_DIR, `${baseFileName}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${baseFileName}.webp`);

    // 如果已存在则跳过
    if (fs.existsSync(jpgPath) && fs.existsSync(webpPath)) {
        return null; // 返回 null 表示跳过
    }

    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 15000
        });
        const imageBuffer = Buffer.from(response.data);

        // 并发处理 jpg 和 webp
        await Promise.all([
            sharp(imageBuffer).jpeg({ quality: 88, progressive: true }).toFile(jpgPath),
            sharp(imageBuffer).webp({ quality: 82 }).toFile(webpPath)
        ]);

        console.log(`✅ 已保存: ${baseFileName} (${formattedDate})`);

        return {
            date: formattedDate,
            dateRaw: dateStr,
            region: region,
            url: imageUrl,
            copyright: imageInfo.copyright || '',
            copyrightLink: imageInfo.copyrightlink || '',
            title: imageInfo.title || '',
            description: imageInfo.description || '',
            jpg: `/picture/${baseFileName}.jpg`,
            webp: `/webp/${baseFileName}.webp`
        };

    } catch (error) {
        console.error(`❌ 下载失败 ${baseFileName}:`, error.message);
        return null;
    }
}

// --- 主流程 ---

async function main() {
    console.log('🚀 开始多地区抓取必应壁纸...');

    // 1. 并发获取所有地区的图片列表
    const regionPromises = REGIONS.map(mkt => fetchRegionImages(mkt, 8));
    const results = await Promise.all(regionPromises);
    const allImages = results.flat();

    if (allImages.length === 0) {
        console.error('❌ 未获取到任何图片，请检查网络或API');
        return;
    }

    console.log(`📊 共获取到 ${allImages.length} 张壁纸信息（来自 ${REGIONS.length} 个地区）`);

    // 2. 下载并转换所有图片
    const downloadPromises = allImages.map(img => downloadAndConvert(img));
    const downloadResults = await Promise.all(downloadPromises);
    const newData = downloadResults.filter(item => item !== null);

    console.log(`💾 成功下载并转换 ${newData.length} 张新图片`);

    // 3. 合并到总数据文件
    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {
            console.warn('读取旧数据失败，将重建');
        }
    }

    // 使用 Map 去重 (基于 date + region)
    const dataMap = new Map();
    existingData.forEach(item => dataMap.set(`${item.date}_${item.region}`, item));
    newData.forEach(item => dataMap.set(`${item.date}_${item.region}`, item));

    // 按日期排序（最新在前，同日期按地区排序）
    const finalData = Array.from(dataMap.values())
        .sort((a, b) => b.date.localeCompare(a.date) || a.region.localeCompare(b.region));

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log(`📝 元数据已更新，共 ${finalData.length} 条记录`);

    // 4. 统计
    const jpgCount = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length;
    const webpCount = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length;
    console.log(`📁 总计: 原图 ${jpgCount} 张, WebP ${webpCount} 张`);
    console.log('✅ 全部完成!');
}

// 执行
main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
