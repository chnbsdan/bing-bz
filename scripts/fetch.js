// scripts/fetch.js - 完整版（抓取 + 累加到 urls.txt 和 copyrights.txt）

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

// ============ 配置 ============
const PICTURE_DIR = path.join(__dirname, '../picture');
const WEBP_DIR = path.join(__dirname, '../webp');
const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'wallpapers.json');
const URLS_FILE = path.join(__dirname, '../urls.txt');
const COPYRIGHTS_FILE = path.join(__dirname, '../copyrights.txt');

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ 日期工具 ============

function getTargetDate(offset) {
    const now = new Date();
    now.setDate(now.getDate() + offset);
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseApiDate(startdate) {
    if (!startdate) return null;
    return `${startdate.slice(0,4)}-${startdate.slice(4,6)}-${startdate.slice(6,8)}`;
}

function getDateDiff(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
}

// ============ 文件操作：读取/写入 urls.txt 和 copyrights.txt ============

function readLines(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

function prependToFile(filePath, newLine) {
    const existing = readLines(filePath);
    // 检查是否已存在（防止重复）
    if (existing.some(line => line === newLine)) {
        return false;
    }
    const allLines = [newLine, ...existing];
    fs.writeFileSync(filePath, allLines.join('\n') + '\n');
    return true;
}

// ============ API 请求 ============

async function fetchAndValidateWallpaper(offset) {
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
        
        if (!imageUrl.includes('th?id=OHR.')) {
            console.log(`⏭️ offset=${offset} 图片URL异常，跳过`);
            return { valid: false, data: null, date: expectedDate, apiDate };
        }

        if (apiDate) {
            const diff = getDateDiff(expectedDate, apiDate);
            if (diff > 1) {
                console.log(`⏭️ offset=${offset} 日期不匹配: 期望 ${expectedDate}, 实际 ${apiDate}, 跳过`);
                return { valid: false, data: null, date: expectedDate, apiDate };
            }
        }

        if (offset > 0 && apiDate) {
            const today = getTargetDate(0);
            if (apiDate < today) {
                console.log(`⏭️ offset=${offset} 返回的图片日期 ${apiDate} 比今天还早，跳过`);
                return { valid: false, data: null, date: expectedDate, apiDate };
            }
        }

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

async function downloadWallpaper(wallpaper, dateStr) {
    const jpgPath = path.join(PICTURE_DIR, `${dateStr}.jpg`);
    const webpPath = path.join(WEBP_DIR, `${dateStr}.webp`);

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
    // 只抓取今天 (offset: 0) + 未来1天 (offset: 1) 以防明天图片已准备好
    const offsets = [];
    offsets.push(1);  // 明天（如果有）
    offsets.push(0);  // 今天

    console.log(`📋 计划检查 ${offsets.length} 个日期`);
    console.log(`   未来: ${getTargetDate(1)}`);
    console.log(`   今天: ${getTargetDate(0)}`);
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
            
            // ===== ★★★ 累加到 urls.txt 和 copyrights.txt ★★★ =====
            const urlAdded = prependToFile(URLS_FILE, data.url);
            const copyrightAdded = prependToFile(COPYRIGHTS_FILE, data.copyright);
            if (urlAdded && copyrightAdded) {
                console.log(`   📝 已添加到 urls.txt 和 copyrights.txt`);
            } else {
                console.log(`   ⏭️ 已存在，跳过添加`);
            }
        } else {
            console.log(`⏭️ ${date} 已存在`);
        }

        await new Promise(r => setTimeout(r, 300));
    }

    console.log('');
    console.log(`📊 统计: 有效 ${validCount} 张, 跳过 ${skipCount} 张`);

    // ===== 3. 合并数据到 wallpapers.json =====
    const existingData = loadExistingData();
    const map = new Map();
    existingData.forEach(item => map.set(item.date, item));
    results.forEach(item => map.set(item.date, item));

    const finalData = Array.from(map.values());
    saveData(finalData);

    console.log(`📝 wallpapers.json 已保存，共 ${finalData.length} 条记录`);

    // ===== 4. 统计文件 =====
    const jpgCount = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length;
    const webpCount = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length;
    console.log(`📁 原图: ${jpgCount} 张, WebP: ${webpCount} 张`);

    // ===== 5. 统计 txt 文件 =====
    const urlCount = readLines(URLS_FILE).length;
    const copyrightCount = readLines(COPYRIGHTS_FILE).length;
    console.log(`📁 urls.txt: ${urlCount} 条, copyrights.txt: ${copyrightCount} 条`);

    console.log('');
    console.log('✅ 全部完成!');
}

// ============ 执行 ============
main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
