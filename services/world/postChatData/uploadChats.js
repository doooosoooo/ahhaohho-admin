/*global process, __dirname*/

// scripts/uploadChats.js
const ChatUploadService = require('./chatUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadChatData() {
  try {
    const filePath = path.join(__dirname, '../rawData/chatData-updateAt20250318.json');
    const rawData = await fs.readFile(filePath, 'utf8');
    const chatsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(chatsData) ? chatsData.length : 1} chat(s) from file`);
    
    const result = await ChatUploadService.uploadMultipleChats(chatsData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  loadAndUploadChatData();
}

module.exports = { loadAndUploadChatData };