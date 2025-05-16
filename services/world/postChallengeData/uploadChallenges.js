/* global process, __dirname */

// scripts/uploadChallenges.js
const ChallengeUploadService = require('./challengeUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadChallengeData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const challengeDataFile = files
      .filter(file => file.startsWith('challengeData-updateAt'))
      .sort()
      .pop();
    
    if (!challengeDataFile) {
      throw new Error('No challenge data file found');
    }
    
    const filePath = path.join(dataDir, challengeDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const challengesData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(challengesData) ? challengesData.length : 1} challenge(s) from ${challengeDataFile}`);
    
    const result = await ChallengeUploadService.uploadMultipleChallenges(challengesData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

async function loadAndUpdateChallengeData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const challengeDataFile = files
      .filter(file => file.startsWith('challengeData-updateAt'))
      .sort()
      .pop();
    
    if (!challengeDataFile) {
      throw new Error('No challenge data file found');
    }
    
    const filePath = path.join(dataDir, challengeDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const challengesData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(challengesData) ? challengesData.length : 1} challenge(s) from ${challengeDataFile} for update`);
    
    // 업데이트 함수 사용
    const result = await ChallengeUploadService.updateMultipleChallenges(challengesData);
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
    loadAndUpdateChallengeData();
  } else {
    loadAndUploadChallengeData();
  }
}

module.exports = { loadAndUploadChallengeData, loadAndUpdateChallengeData };