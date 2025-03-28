/* global process, __dirname */

// scripts/uploadChallenges.js
const ChallengeUploadService = require('./challengeUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadChallengeData() {
  try {
    const filePath = path.join(__dirname, '../rawData/challengeData-updateAt20250318.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const challengesData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(challengesData) ? challengesData.length : 1} challenge(s) from file`);
    
    const result = await ChallengeUploadService.uploadMultipleChallenges(challengesData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadAndUploadChallengeData();
}

module.exports = { loadAndUploadChallengeData };