/* global process, __dirname */
// scripts/uploadGroups.js
const GroupUploadService = require('./groupUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadGroupData() {
  try {
    const filePath = path.join(__dirname, '../rawData/groupData-updateAt20250313.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const groupsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(groupsData) ? groupsData.length : 1} group(s) from file`);
    
    const result = await GroupUploadService.uploadMultipleGroups(groupsData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadAndUploadGroupData();
}

module.exports = { loadAndUploadGroupData };