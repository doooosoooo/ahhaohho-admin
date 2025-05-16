/*global process, __dirname*/

// scripts/uploadChats.js
const ChatUploadService = require('./chatUploadService');
const fs = require('fs').promises;
const path = require('path');

async function loadAndUploadChatData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const chatDataFile = files
      .filter(file => file.startsWith('chatData-updateAt'))
      .sort()
      .pop();
    
    if (!chatDataFile) {
      throw new Error('No chat data file found');
    }
    
    const filePath = path.join(dataDir, chatDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const chatsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(chatsData) ? chatsData.length : 1} chat(s) from ${chatDataFile}`);
    
    const result = await ChatUploadService.uploadMultipleChats(chatsData);
    console.log('Upload completed:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error in load and upload process:', error);
    process.exit(1);
  }
}

async function loadAndUpdateChatData() {
  try {
    // 최신 파일을 얻기 위해 패턴을 사용하여 파일 찾기
    const dataDir = path.join(__dirname, '../rawData');
    const files = await fs.readdir(dataDir);
    const chatDataFile = files
      .filter(file => file.startsWith('chatData-updateAt'))
      .sort()
      .pop();
    
    if (!chatDataFile) {
      throw new Error('No chat data file found');
    }
    
    const filePath = path.join(dataDir, chatDataFile);
    const rawData = await fs.readFile(filePath, 'utf8');
    const chatsData = JSON.parse(rawData);

    console.log(`Loaded ${Array.isArray(chatsData) ? chatsData.length : 1} chat(s) from ${chatDataFile} for update`);
    
    // 업데이트 함수 사용
    const result = await ChatUploadService.updateMultipleChats(chatsData);
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
    loadAndUpdateChatData();
  } else {
    loadAndUploadChatData();
  }
}

module.exports = { loadAndUploadChatData, loadAndUpdateChatData };