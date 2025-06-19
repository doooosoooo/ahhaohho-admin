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
    
    // 데이터 유효성 검증 추가
    if (Array.isArray(chatsData)) {
      const invalidItems = chatsData.filter((item, index) => {
        if (!item || typeof item !== 'object') {
          console.error(`Invalid chat data at index ${index}: not an object`, item);
          return true;
        }
        if (!item.id) {
          console.error(`Invalid chat data at index ${index}: missing id field`, {
            keys: Object.keys(item),
            item: item
          });
          return true;
        }
        return false;
      });
      
      if (invalidItems.length > 0) {
        console.error(`Found ${invalidItems.length} invalid chat items out of ${chatsData.length} total items`);
        throw new Error(`Data validation failed: ${invalidItems.length} items have missing or invalid id fields`);
      }
      
      console.log(`Data validation passed: all ${chatsData.length} items have valid id fields`);
    }
    
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
    
    // 데이터 유효성 검증 추가
    if (Array.isArray(chatsData)) {
      const invalidItems = chatsData.filter((item, index) => {
        if (!item || typeof item !== 'object') {
          console.error(`Invalid chat data at index ${index}: not an object`, item);
          return true;
        }
        if (!item.id) {
          console.error(`Invalid chat data at index ${index}: missing id field`, {
            keys: Object.keys(item),
            item: item
          });
          return true;
        }
        return false;
      });
      
      if (invalidItems.length > 0) {
        console.error(`Found ${invalidItems.length} invalid chat items out of ${chatsData.length} total items`);
        throw new Error(`Data validation failed: ${invalidItems.length} items have missing or invalid id fields`);
      }
      
      console.log(`Data validation passed: all ${chatsData.length} items have valid id fields`);
    }
    
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