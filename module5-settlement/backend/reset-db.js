/**
 * 数据库重置 CLI 工具
 * 
 * 用法:
 *   node reset-db.js        直接重置(需服务器未运行)
 *   node reset-db.js --api  通过 HTTP 接口重置(服务器需运行)
 */

const { execSync } = require('child_process');
const http = require('http');
const path = require('path');

const DB_PATH = path.join(__dirname, 'prisma', 'dev.db');
const API_URL = 'http://localhost:3005/api/reset';

async function resetViaApi() {
  return new Promise((resolve, reject) => {
    const req = http.request(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('✅', json.message || '数据库已通过API重置');
          resolve();
        } catch {
          console.log('✅ 数据库已通过API重置 (状态码', res.statusCode, ')');
          resolve();
        }
      });
    });
    req.on('error', (err) => {
      reject(new Error(`无法连接API服务器(${API_URL}): ${err.message}\n请先启动服务器: npm start`));
    });
    req.end();
  });
}

async function resetDirect() {
  console.log('正在重置数据库...');
  require('./prisma/seed');
  // seed.js 已经会打印结果
}

async function main() {
  const args = process.argv.slice(2);
  try {
    if (args.includes('--api') || args.includes('-a')) {
      await resetViaApi();
    } else {
      // 默认：先尝试 API，失败则直接重置
      try {
        await resetViaApi();
      } catch (apiErr) {
        console.log('API未运行，使用直接重置...');
        await resetDirect();
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

main();
