/* global process, __dirname*/
// uploadWorlds.js
const WorldUploadService = require('./worldUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadWorldData() {
  try {
    const filePath = path.join(__dirname, '../rawData/worldData-updateAt20250516.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const worldsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(worldsData) ? worldsData.length : 1} world(s) from file`);
    
    const result = await WorldUploadService.uploadMultipleWorlds(worldsData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

async function loadAndUpdateWorldData() {
  try {
    const filePath = path.join(__dirname, '../rawData/worldData-updateAt20250414.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const worldsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(worldsData) ? worldsData.length : 1} world(s) from file for update`);
    
    // 업데이트 함수 사용
    const result = await WorldUploadService.updateMultipleWorlds(worldsData);
    console.log('Update completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and update process:', error);
    process.exit(1);
  }
}

// 명령행 인수로 기능 선택
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args[0] || 'upload'; // 기본값은 upload
  
  if (mode === 'update') {
    loadAndUpdateWorldData();
  } else {
    loadAndUploadWorldData();
  }
}

module.exports = { loadAndUploadWorldData, loadAndUpdateWorldData };