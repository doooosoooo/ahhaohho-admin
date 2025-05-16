/* global process, __dirname */
// scripts/uploadGroups.js
const GroupUploadService = require('./groupUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadGroupData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const groupDataFile = files
      .filter(file => file.startsWith('groupData-updateAt'))
      .sort()
      .pop();
    
    if (!groupDataFile) {
      throw new Error('No group data file found');
    }
    
    const filePath = path.join(dataDir, groupDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const groupsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(groupsData) ? groupsData.length : 1} group(s) from ${groupDataFile}`);
    
    const result = await GroupUploadService.uploadMultipleGroups(groupsData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

async function loadAndUpdateGroupData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const groupDataFile = files
      .filter(file => file.startsWith('groupData-updateAt'))
      .sort()
      .pop();
    
    if (!groupDataFile) {
      throw new Error('No group data file found');
    }
    
    const filePath = path.join(dataDir, groupDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const groupsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(groupsData) ? groupsData.length : 1} group(s) from ${groupDataFile} for update`);
    
    // 업데이트 함수 사용
    const result = await GroupUploadService.updateMultipleGroups(groupsData);
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
    loadAndUpdateGroupData();
  } else {
    loadAndUploadGroupData();
  }
}

module.exports = { loadAndUploadGroupData, loadAndUpdateGroupData };