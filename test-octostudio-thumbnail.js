// test-octostudio-thumbnail.js
const fs = require('fs');
const path = require('path');
const ChatDataTransformer = require('./services/world/postChatData/utils/chatDataTransformer');

// Load raw data
const rawDataPath = path.join(__dirname, 'services/world/rawData/chatData-updateAt20250602.json');
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

// Find the chat with octostudio file
const targetChatId = 'recuBYCpM0EdHXgPf';
const testChat = rawData.find(chat => chat.id === targetChatId);

if (!testChat) {
  console.error('Chat not found:', targetChatId);
  process.exit(1);
}

console.log('Found chat:', testChat.id);
console.log('Has end message media:', !!testChat['모듈 4 대화 종료 매개자 첨부 미디어']);

if (testChat['모듈 4 대화 종료 매개자 첨부 미디어']) {
  const media = testChat['모듈 4 대화 종료 매개자 첨부 미디어'];
  console.log('Media items:', media.length);
  media.forEach((item, index) => {
    console.log(`Media ${index}:`, {
      media_type: item.media_type,
      filename: item.filename,
      url: item.url
    });
  });
}

// Test transformation
(async () => {
  try {
    console.log('\n===== Testing octostudio transformation =====');
    const transformedData = await ChatDataTransformer.transformRequestData(testChat);
    
    // Look for octo items in the result
    const chatItems = transformedData.chat;
    let octoFound = false;
    
    chatItems.forEach((item, index) => {
      if (item.prompts) {
        item.prompts.forEach((prompt, promptIndex) => {
          if (prompt.octo && prompt.octo.length > 0) {
            octoFound = true;
            console.log(`\nFound octo items in chat item ${index}, prompt ${promptIndex}:`);
            prompt.octo.forEach((octoItem, octoIndex) => {
              console.log(`Octo ${octoIndex}:`, {
                category: octoItem.category,
                title: octoItem.title,
                thumbnail: octoItem.thumbnail,
                url: octoItem.url
              });
            });
          }
        });
      }
    });
    
    if (!octoFound) {
      console.log('No octo items found in transformed data');
    }
    
  } catch (error) {
    console.error('Error during transformation:', error);
  }
})();