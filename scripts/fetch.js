// scripts/fetch.js - 完整验证版

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// ============ 配置 ============
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ 日期工具 ============

/**
 * 根据偏移量计算目标日期
 * @param {number} offset 正数=未来, 0=今天, 负数=过去
 * @returns {string} YYYY-MM-DD
 */
function getTargetDate(offset) {
    const now = new Date();
    // 修正：offset 正数表示未来，所以直接加
    now.setDate(now.getDate() + offset);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 解析 API 返回的日期字符串
 * @param {string} startdate - API返回的日期，格式: 20260726
 * @returns {string} YYYY-MM-DD
 */
function parseApiDate(startdate) {
    if (!startdate) return null;
    return `${startdate.slice(0,4)}-${startdate.slice(4,6)}-${startdate.slice(6,8)}`;
}

/**
 * 计算两个日期的相差天数
 */
function getDateDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
}

// ============ API 请求 ============

/**
 * 获取指定偏移量的壁纸，并验证有效性
 * @param {number} offset 正数=未来, 0=今天, 负数=过去
 * @returns {Promise<{ valid: boolean, data: object|null, date: string, apiDate: string|null }>}
 */
async function fetchAndValidateWallpaper(offset) {
    // 必应API的idx：正数=过去，负数=未来，所以取反
    const idx = -offset;
    const url = `https://cn.bing.com/HPImageArchive.aspx?format=js&n=1&idx=${idx}&mkt=zh-CN`;
    const expectedDate = getTargetDate(offset);
    
    try {
        const response = await axios.get(url, { timeout: 10000 });
        const image = response.data.images[0];
        
        if (!image) {
            return { valid: false, data: null, date: expectedDate, apiDate: null };
        }

        const apiDate = parseApiDate(image.startdate);
        const imageUrl = `https://cn.bing.com${image.url}`;
        
        // 验证：图片URL是否有效（必应图片URL通常包含 /th?id=OHR.）
        if (!imageUrl.includes('th?id=OHR.')) {
            console.log(`⏭️ offset=${offset} 图片URL异常，跳过`);
            return { valid: false, data: null, date: expectedDate, apiDate };
        }

        // 验证：日期是否匹配（相差不超过1天）
        if (apiDate) {
            const diff = getDateDiff(expectedDate, apiDate);
            if (diff > 1) {
                console.log(`⏭️ offset=${offset} 日期不匹配: 期望 ${expectedDate}, 实际 ${apiDate}, 跳过`);
                return { valid: false, data: null, date: expectedDate, apiDate };
            }
        }

        // 对于未来日期（offset > 0），额外验证图片是否真的属于未来
        // 如果API返回的日期比期望日期早很多，说明是占位图
        if (offset > 0 && apiDate) {
            const today = getTargetDate(0);
            if (apiDate < today) {
                console.log(`⏭️ offset=${offset} 返回的图片日期 ${apiDate} 比今天还早，跳过`);
                return { valid: false, data: null, date: expectedDate, apiDate };
            }
        }

        // 有效
        return {
            valid: true,
            data: {
                url: imageUrl,
                copyright: image.copyright || '',
                copyrightLink: image.copyrightlink || '',
                title: image.title || '',
                description: image.description || ''
            },
            date: expectedDate,
            apiDate: apiDate
        };

    } catch (error) {
        console.warn(`⚠️ 请求失败 offset=${offset}:`, error.message);
        return { valid: false, data: null, date: expectedDate, apiDate: null };
    }
}

// ============ 下载与保存 ============

/**
 * 下载并保存壁纸
 * @param {object} wallpaper - 壁纸数据
 * @param {string} dateStr - 日期 YYYY-MM-DD
 * @returns {Promise<object|null>} 保存成功返回数据对象，否则返回null
 */
async function downloadWallpaper(wallpaper, dateStr) {
    const jpgPath = path.join(PICTURE_DIR, `${dateStr}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${dateStr}.webp`);

    // 如果已存在则跳过
    if (fs.existsSync(jpgPath) && fs.existsSync(webpPath)) {
        return null;
    }

    try {
        const response = await axios({
            url: wallpaper.url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 15000
        });
        const buffer = Buffer.from(response.data);

        // 并发保存 jpg 和 webp
        await Promise.all([
            sharp(buffer).jpeg({ quality: 88, progressive: true }).toFile(jpgPath),
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

    } catch (error) {
        console.error(`❌ 下载失败 ${dateStr}:`, error.message);
        return null;
    }
}

// ============ 数据持久化 ============

/**
 * 读取已有数据
 */
function loadExistingData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    try {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.warn('⚠️ 读取旧数据失败，将重建');
        return [];
    }
}

/**
 * 保存数据
 */
function saveData(data) {
    const sorted = data.sort((a, b) => b.date.localeCompare(a.date));
    fs.writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2));
}

// ============ 主流程 ============

async function main() {
    console.log('🚀 开始验证并抓取必应壁纸...');
    console.log(`📅 今天是: ${getTargetDate(0)}`);
    console.log('');

    // ===== 1. 确定抓取范围 =====
    // 未来3天 (offset: 1, 2, 3) + 今天 (offset: 0) + 过去30天 (offset: -1 ~ -30)
    const offsets = [];
    for (let i = 3; i >= 1; i--) offsets.push(i);
    offsets.push(0);
    for (let i = -1; i >= -30; i--) offsets.push(i);

    console.log(`📋 计划检查 ${offsets.length} 个日期`);
    console.log(`   未来: 3天 (${getTargetDate(1)} ~ ${getTargetDate(3)})`);
    console.log(`   今天: ${getTargetDate(0)}`);
    console.log(`   过去: 30天 (${getTargetDate(-1)} ~ ${getTargetDate(-30)})`);
    console.log('');

    // ===== 2. 逐个获取并验证 =====
    const results = [];
    let validCount = 0;
    let skipCount = 0;

    for (const offset of offsets) {
        const { valid, data, date, apiDate } = await fetchAndValidateWallpaper(offset);
        
        if (!valid || !data) {
            skipCount++;
            continue;
        }

        // 下载图片
        const saved = await downloadWallpaper(data, date);
        if (saved) {
            results.push(saved);
            validCount++;
            const apiInfo = apiDate ? `(API日期: ${apiDate})` : '';
            console.log(`✅ ${date} ${apiInfo}`);
        } else {
            console.log(`⏭️ ${date} 已存在`);
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 300));
    }

    console.log('');
    console.log(`📊 统计: 有效 ${validCount} 张, 跳过 ${skipCount} 张`);

    // ===== 3. 合并数据 =====
    const existingData = loadExistingData();
    const map = new Map();
    existingData.forEach(item => map.set(item.date, item));
    results.forEach(item => map.set(item.date, item));

    const finalData = Array.from(map.values());
    saveData(finalData);

    console.log(`📝 数据已保存，共 ${finalData.length} 条记录`);

    // ===== 4. 统计文件 =====
    const jpgCount = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length;
    const webpCount = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length;
    console.log(`📁 原图: ${jpgCount} 张, WebP: ${webpCount} 张`);

    console.log('');
    console.log('✅ 全部完成!');
}

// ============ 执行 ============
main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
