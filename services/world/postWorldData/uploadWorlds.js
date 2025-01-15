/* global process, __dirname*/
// uploadWorlds.js
const WorldUploadService = require('./worldUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadWorldData() {
  try {
    const filePath = path.join(__dirname, '../rawData/worldData-updateAt20250110.json');
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

if (require.main === module) {
  loadAndUploadWorldData();
}

module.exports = { loadAndUploadWorldData };