// scripts/fetch.js - 纯净版，只依赖 axios 和 sharp

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// --- 配置 ---
// 目标地区列表
const REGIONS = [
    'zh-CN', 'en-US', 'ja-JP', 'de-DE', 'fr-FR', 
    'es-ES', 'it-IT', 'pt-BR', 'en-IN', 'fr-CA'
];
const BING_API = 'https://cn.bing.com/HPImageArchive.aspx';
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- 核心函数 ---

/**
 * 获取图片唯一ID (基于 urlbase，这是必应图片的全球唯一标识)
 */
function getImageId(image) {
    if (image.urlbase) {
        // urlbase 格式: /th?id=OHR.xxxxx_1920x1080
        return image.urlbase.replace('/th?id=OHR.', '').replace(/_\d+x\d+$/, '');
    }
    // 备选方案
    const url = image.url || '';
    const match = url.match(/id=OHR\.([^_&]+)/);
    return match ? match[1] : url.split('/').pop().split('_')[0];
}

/**
 * 获取指定地区的图片列表
 */
async function fetchRegionImages(mkt, n = 8) {
    try {
        const url = `${BING_API}?format=js&n=${n}&mkt=${mkt}`;
        const response = await axios.get(url, { timeout: 10000 });
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
 * 下载并保存单张图片
 * 返回 null 表示已存在或下载失败
 */
async function downloadAndSave(imageInfo) {
    const dateStr = imageInfo.startdate;
    const formattedDate = `${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)}`;
    const imageUrl = `https://cn.bing.com${imageInfo.url}`;
    const id = getImageId(imageInfo);
    
    // 文件名: 日期_ID.jpg
    const baseFileName = `${dateStr}_${id}`;
    const jpgPath = path.join(PICTURE_DIR, `${baseFileName}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${baseFileName}.webp`);

    // 如果已存在则跳过
    if (fs.existsSync(jpgPath) && fs.existsSync(webpPath)) {
        return null;
    }

    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 15000
        });
        const imageBuffer = Buffer.from(response.data);

        await Promise.all([
            sharp(imageBuffer).jpeg({ quality: 88, progressive: true }).toFile(jpgPath),
            sharp(imageBuffer).webp({ quality: 82 }).toFile(webpPath)
        ]);

        const result = {
            date: formattedDate,
            dateRaw: dateStr,
            id: id,
            region: imageInfo.region || 'unknown',
            url: imageUrl,
            copyright: imageInfo.copyright || '',
            copyrightLink: imageInfo.copyrightlink || '',
            title: imageInfo.title || '',
            description: imageInfo.description || '',
            jpg: `/picture/${baseFileName}.jpg`,
            webp: `/webp/${baseFileName}.webp`
        };

        console.log(`✅ 已保存: ${formattedDate} [${imageInfo.region}] - ${id}`);
        return result;

    } catch (error) {
        console.error(`❌ 下载失败 ${formattedDate}:`, error.message);
        return null;
    }
}

// --- 主流程 ---

async function main() {
    console.log('🚀 开始抓取必应壁纸...');
    console.log(`📡 目标地区: ${REGIONS.join(', ')}`);

    // 1. 获取所有地区的图片列表
    const regionPromises = REGIONS.map(mkt => fetchRegionImages(mkt, 8));
    const results = await Promise.all(regionPromises);
    const allImages = results.flat();

    if (allImages.length === 0) {
        console.error('❌ 未获取到任何图片');
        return;
    }

    console.log(`📊 原始获取: ${allImages.length} 张`);

    // 2. 按 id 去重 (保留第一次出现的)
    const uniqueMap = new Map();
    for (const img of allImages) {
        const id = getImageId(img);
        if (!uniqueMap.has(id)) {
            uniqueMap.set(id, img);
        }
    }
    const uniqueImages = Array.from(uniqueMap.values());
    console.log(`🔄 去重后: ${uniqueImages.length} 张唯一图片`);

    // 3. 下载并转换
    let successCount = 0;
    for (const img of uniqueImages) {
        const result = await downloadAndSave(img);
        if (result) successCount++;
        // 避免请求过快
        await new Promise(r => setTimeout(r, 200));
    }
    console.log(`💾 成功下载: ${successCount} 张新图片`);

    // 4. 读取已有数据，合并去重
    let existingData = [];
    if (fs.existsSync(DATA_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        } catch (e) {
            console.warn('读取旧数据失败，将重建');
        }
    }

    // 用 id 作为 key，新数据覆盖旧数据
    const dataMap = new Map();
    existingData.forEach(item => dataMap.set(item.id, item));
    // 把新下载成功的图片加入
    for (const img of uniqueImages) {
        const id = getImageId(img);
        const jpgPath = path.join(PICTURE_DIR, `${img.startdate}_${id}.jpg`);
        if (fs.existsSync(jpgPath)) {
            const formattedDate = `${img.startdate.slice(0,4)}-${img.startdate.slice(4,6)}-${img.startdate.slice(6,8)}`;
            dataMap.set(id, {
                date: formattedDate,
                dateRaw: img.startdate,
                id: id,
                region: img.region || 'unknown',
                url: `https://cn.bing.com${img.url}`,
                copyright: img.copyright || '',
                copyrightLink: img.copyrightlink || '',
                title: img.title || '',
                description: img.description || '',
                jpg: `/picture/${img.startdate}_${id}.jpg`,
                webp: `/webp/${img.startdate}_${id}.webp`
            });
        }
    }

    const finalData = Array.from(dataMap.values())
        .sort((a, b) => b.date.localeCompare(a.date));

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log(`📝 元数据已更新，共 ${finalData.length} 条记录`);

    // 5. 统计
    const jpgCount = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length;
    const webpCount = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length;
    console.log(`📁 总计: 原图 ${jpgCount} 张, WebP ${webpCount} 张`);
    console.log('✅ 全部完成!');
}

main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
