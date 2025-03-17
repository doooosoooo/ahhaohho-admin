/* global process, __dirname */


// scripts/uploadPostGuides.js
const PostGuideUploadService = require('./postGuideUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadPostGuideData() {
  try {
    const filePath = path.join(__dirname, '../rawData/chatData-updateAt20250313.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const postGuidesData = JSON.parse(rawData);

    console.log('Sample data:', postGuidesData[0]); // 첫 번째 데이터 확인
    console.log('Data keys:', Object.keys(postGuidesData[0])); // 데이터 키 확인

    console.log(`Loaded ${Array.isArray(postGuidesData) ? postGuidesData.length : 1} post guide(s) from file`);
    
    const result = await PostGuideUploadService.uploadMultiplePostGuides(postGuidesData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadAndUploadPostGuideData();
}

module.exports = { loadAndUploadPostGuideData };