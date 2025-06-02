/* global process, __dirname */

// scripts/uploadPostGuides.js
const PostGuideUploadService = require('./postGuideUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadPostGuideData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const postGuideDataFile = files
      .filter(file => file.startsWith('chatData-updateAt'))
      .sort()
      .pop();
    
    if (!postGuideDataFile) {
      throw new Error('No post guide data file found');
    }
    
    const filePath = path.join(dataDir, postGuideDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const postGuidesData = JSON.parse(rawData);

    console.log('Sample data:', postGuidesData[0]); // 첫 번째 데이터 확인
    console.log('Data keys:', Object.keys(postGuidesData[0])); // 데이터 키 확인

    console.log(`Loaded ${Array.isArray(postGuidesData) ? postGuidesData.length : 1} post guide(s) from ${postGuideDataFile}`);
    
    const result = await PostGuideUploadService.uploadMultiplePostGuides(postGuidesData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

async function loadAndUpdatePostGuideData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const postGuideDataFile = files
      .filter(file => file.startsWith('chatData-updateAt'))
      .sort()
      .pop();
    
    if (!postGuideDataFile) {
      throw new Error('No post guide data file found');
    }
    
    const filePath = path.join(dataDir, postGuideDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const postGuidesData = JSON.parse(rawData);

    console.log('Sample data:', postGuidesData[0]); // 첫 번째 데이터 확인
    console.log('Data keys:', Object.keys(postGuidesData[0])); // 데이터 키 확인

    console.log(`Loaded ${Array.isArray(postGuidesData) ? postGuidesData.length : 1} post guide(s) from ${postGuideDataFile} for update`);
    
    // 업데이트 함수 사용
    const result = await PostGuideUploadService.updateMultiplePostGuides(postGuidesData);
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
    loadAndUpdatePostGuideData();
  } else {
    loadAndUploadPostGuideData();
  }
}

module.exports = { loadAndUploadPostGuideData, loadAndUpdatePostGuideData };