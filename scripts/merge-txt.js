// scripts/merge-txt.js
// 用途：将 urls.txt 和 copyrights.txt 合并成 wallpapers.json
// 每次运行会读取两个 txt 文件，按顺序合并，并去重

const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const URLS_FILE = path.join(__dirname, '../urls.txt');
const COPYRIGHTS_FILE = path.join(__dirname, '../copyrights.txt');
const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'wallpapers.json');

// 确保 data 目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============ 读取文件 ============
function readLines(filePath) {
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ 文件不存在: ${filePath}`);
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));
}

console.log('📖 读取 urls.txt...');
const urls = readLines(URLS_FILE);

console.log('📖 读取 copyrights.txt...');
const copyrights = readLines(COPYRIGHTS_FILE);

if (urls.length === 0) {
    console.error('❌ urls.txt 为空，无法生成');
    process.exit(1);
}

if (copyrights.length < urls.length) {
    console.warn(`⚠️ 版权信息数量 (${copyrights.length}) 少于链接数量 (${urls.length})，缺失的将留空`);
}

// ============ 从文件名提取日期（按顺序倒推） ============
// 从第一个链接的文件名中提取日期
function extractDateFromUrl(url) {
    // 格式: https://cn.bing.com/th?id=OHR.xxx_EN-US1234567890_UHD.jpg
    // 从 id 中提取，或者用文件修改时间
    const match = url.match(/OHR\.([^_]+)/);
    if (match) {
        return match[1];
    }
    return null;
}

// 由于链接里没有直接日期，我们用顺序倒推
// 默认从 2026-07-26 开始（昨天的日期），你可以改成你想要的起始日期
const START_DATE = '2026-07-26';

function generateDates(count) {
    const dates = [];
    const start = new Date(START_DATE + 'T00:00:00');
    for (let i = 0; i < count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
    }
    return dates;
}

// ============ 生成数据 ============
const dates = generateDates(urls.length);

const wallpapers = urls.map((url, index) => {
    const copyright = copyrights[index] || '';
    const title = copyright.split('©')[0].trim() || '';
    return {
        date: dates[index] || '',
        title: title,
        copyright: copyright,
        jpg: url,
        webp: url
    };
});

// 按日期排序（最新在前）
wallpapers.sort((a, b) => b.date.localeCompare(a.date));

// ============ 读取已有的 wallpapers.json（去重合并） ============
let existingData = [];
if (fs.existsSync(OUTPUT_FILE)) {
    try {
        const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        existingData = JSON.parse(content);
        if (!Array.isArray(existingData)) {
            existingData = [];
        }
        console.log(`📂 读取已有数据: ${existingData.length} 条`);
    } catch (e) {
        console.warn('⚠️ 读取已有 wallpapers.json 失败，将覆盖');
    }
}

// 用日期去重（保留最新的数据）
const dataMap = new Map();

// 先加入已有数据
existingData.forEach(item => {
    if (item.date) {
        dataMap.set(item.date, item);
    }
});

// 新数据覆盖（新数据优先）
wallpapers.forEach(item => {
    if (item.date) {
        dataMap.set(item.date, item);
    }
});

// 转为数组并按日期排序（最新在前）
const finalData = Array.from(dataMap.values())
    .sort((a, b) => b.date.localeCompare(a.date));

// ============ 保存 ============
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
console.log(`✅ 合并完成！共 ${finalData.length} 条记录`);
console.log(`📁 输出文件: ${OUTPUT_FILE}`);

// 统计
const urlCount = fs.existsSync(URLS_FILE) ? readLines(URLS_FILE).length : 0;
console.log(`📊 urls.txt: ${urlCount} 条, wallpapers.json: ${finalData.length} 条`);
