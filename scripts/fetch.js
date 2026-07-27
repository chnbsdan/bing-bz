// scripts/fetch.js - 完整版（统一 UHD 格式 + 累加到 urls.txt 和 copyrights.txt）

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

const KEEP_DAYS = 60; // 保留最近60天的本地图片

// 确保目录存在
[PICTURE_DIR, WEBP_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ============ 文件操作 ============

function readLines(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

function prependToFile(filePath, newLine) {
    const existing = readLines(filePath);
    if (existing.some(line => line === newLine)) return false;
    const allLines = [newLine, ...existing];
    fs.writeFileSync(filePath, allLines.join('\n') + '\n');
    return true;
}

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

function daysDiff(dateStr) {
    const today = new Date();
    const target = new Date(dateStr);
    return Math.floor((today - target) / (1000 * 60 * 60 * 24));
}

// ============ 链接格式化：统一转成 UHD ============

function formatToUHD(url) {
    if (!url) return url;
    // 如果已经是 UHD，直接返回
    if (url.includes('_UHD.jpg')) return url;
    
    // 替换 _1920x1080 或 _1366x768 等为 _UHD
    let formatted = url.replace(/_\d+x\d+\.jpg/, '_UHD.jpg');
    
    // 去掉 &rf=...&pid=hp 等额外参数
    formatted = formatted.split('&')[0];
    
    return formatted;
}

// ============ API 请求 ============

async function fetchBingWallpaper(offset) {
    const idx = -offset;
    const url = `https://cn.bing.com/HPImageArchive.aspx?format=js&n=1&idx=${idx}&mkt=zh-CN`;
    const expectedDate = getTargetDate(offset);
    
    try {
        const response = await axios.get(url, { timeout: 10000 });
        const image = response.data.images[0];
        
        if (!image) return { valid: false, data: null, date: expectedDate };

        const apiDate = parseApiDate(image.startdate);
        let imageUrl = `https://cn.bing.com${image.url}`;
        
        // ★★★ 统一转成 UHD 格式 ★★★
        imageUrl = formatToUHD(imageUrl);
        
        if (!imageUrl.includes('th?id=OHR.')) {
            console.log(`⏭️ offset=${offset} 图片URL异常，跳过`);
            return { valid: false, data: null, date: expectedDate };
        }

        if (apiDate) {
            const diff = getDateDiff(expectedDate, apiDate);
            if (diff > 1) {
                console.log(`⏭️ offset=${offset} 日期不匹配: 期望 ${expectedDate}, 实际 ${apiDate}, 跳过`);
                return { valid: false, data: null, date: expectedDate };
            }
        }

        if (offset > 0 && apiDate) {
            const today = getTargetDate(0);
            if (apiDate < today) {
                console.log(`⏭️ offset=${offset} 返回的图片日期 ${apiDate} 比今天还早，跳过`);
                return { valid: false, data: null, date: expectedDate };
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
        return { valid: false, data: null, date: expectedDate };
    }
}

// ============ 下载图片 ============

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

// ============ 从 urls.txt 读取历史数据 ============

function loadHistoricalData() {
    const urls = readLines(URLS_FILE);
    const copyrights = readLines(COPYRIGHTS_FILE);
    
    if (urls.length === 0) return [];

    const pairedData = [];
    const maxLen = Math.max(urls.length, copyrights.length);
    
    for (let i = 0; i < maxLen; i++) {
        const url = urls[i] || '';
        const copyright = copyrights[i] || '';
        if (url) {
            pairedData.push({ url, copyright });
        }
    }

    // 从今天开始倒推日期
    const today = new Date();
    const result = pairedData.map((item, index) => {
        const d = new Date(today);
        d.setDate(d.getDate() - index);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        
        const title = item.copyright.split('©')[0].trim() || '';
        const copyrightLink = `https://www.bing.com/search?q=${encodeURIComponent(title)}&form=hpcapt&mkt=zh-cn`;
        
        return {
            date: dateStr,
            copyright: item.copyright,
            copyrightLink: copyrightLink,
            title: title,
            description: '',
            jpg: item.url,
            webp: item.url
        };
    });

    return result;
}

// ============ 清理过期本地图片 ============

function cleanOldImages() {
    if (!fs.existsSync(PICTURE_DIR)) return;
    const jpgFiles = fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg'));
    const webpFiles = fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp'));
    let deleted = 0;

    [...jpgFiles, ...webpFiles].forEach(file => {
        const dateStr = file.replace('.jpg', '').replace('.webp', '');
        const diff = daysDiff(dateStr);
        if (diff > KEEP_DAYS) {
            const filePath = path.join(
                file.endsWith('.jpg') ? PICTURE_DIR : WEBP_DIR,
                file
            );
            try {
                fs.unlinkSync(filePath);
                deleted++;
            } catch (e) {}
        }
    });

    if (deleted > 0) {
        console.log(`🗑️ 已删除 ${deleted} 张过期本地图片（超过 ${KEEP_DAYS} 天）`);
    }
}

// ============ 主流程 ============

async function main() {
    console.log('🚀 开始处理壁纸...');
    console.log(`📅 今天是: ${getTargetDate(0)}`);
    console.log('');

    // ===== 1. 抓取今天和明天的数据 =====
    const offsets = [0, 1];
    const newResults = [];

    for (const offset of offsets) {
        const { valid, data, date } = await fetchBingWallpaper(offset);
        
        if (!valid || !data) {
            continue;
        }

        // 下载图片
        const saved = await downloadWallpaper(data, date);
        if (saved) {
            newResults.push(saved);
            console.log(`✅ ${date}`);
            
            // 累加到 urls.txt 和 copyrights.txt
            const urlAdded = prependToFile(URLS_FILE, data.url);
            const copyrightAdded = prependToFile(COPYRIGHTS_FILE, data.copyright);
            if (urlAdded && copyrightAdded) {
                console.log(`   📝 已添加到 urls.txt 和 copyrights.txt`);
            } else {
                console.log(`   ⏭️ 已存在，跳过添加`);
            }
        }
        await new Promise(r => setTimeout(r, 300));
    }

    // ===== 2. 读取历史数据 =====
    const historicalData = loadHistoricalData();
    console.log(`📂 历史数据: ${historicalData.length} 条`);

    // ===== 3. 合并数据（历史 + 新抓取） =====
    const dataMap = new Map();
    
    historicalData.forEach(item => {
        if (item.date) dataMap.set(item.date, item);
    });
    
    newResults.forEach(item => {
        if (item.date) dataMap.set(item.date, item);
    });

    const finalData = Array.from(dataMap.values())
        .sort((a, b) => b.date.localeCompare(a.date));

    console.log(`📊 合并后共 ${finalData.length} 条记录`);

    // ===== 4. 保存 wallpapers.json =====
    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2));
    console.log(`📝 wallpapers.json 已保存`);

    // ===== 5. 清理过期图片 =====
    cleanOldImages();

    // ===== 6. 统计 =====
    const jpgCount = fs.existsSync(PICTURE_DIR) ? fs.readdirSync(PICTURE_DIR).filter(f => f.endsWith('.jpg')).length : 0;
    const webpCount = fs.existsSync(WEBP_DIR) ? fs.readdirSync(WEBP_DIR).filter(f => f.endsWith('.webp')).length : 0;
    console.log(`📁 本地图片: ${jpgCount} 张 jpg, ${webpCount} 张 webp`);
    console.log('✅ 完成!');
}

// ============ 执行 ============
main().catch(error => {
    console.error('💥 程序异常:', error);
    process.exit(1);
});
