// test-real-data.js
const fs = require('fs');
const path = require('path');
const ChatDataTransformer = require('./services/world/postChatData/utils/chatDataTransformer');

// Load real data from JSON file
const rawDataPath = path.join(__dirname, 'services/world/rawData/chatData-updateAt20250516.json');
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

// Get the first chat item with interaction type
const findInteractionModule = (data) => {
  for (let i = 1; i <= 15; i++) {
    if (data[`모듈 선택 ${i}`] === '모듈2 : 인터랙션형') {
      return i;
    }
  }
  return null;
};

// Test transformation with real data
console.log('===== Testing with real data =====');
const testChat = rawData[0]; // Get first chat from data
console.log(`Testing chat ID: ${testChat.id}`);

// Find an interaction module
const moduleIndex = findInteractionModule(testChat);
if (moduleIndex) {
  console.log(`Found interaction module at index ${moduleIndex}`);
  
  // Check if images exist
  const buttonImage = testChat[`인터랙션형-유저선택 버튼 이미지 1 / 모듈 선택 ${moduleIndex}`];
  const responseImage = testChat[`인터랙션형-선택지 1 응답 이미지 / 모듈 선택 ${moduleIndex}`];
  
  console.log('Button image exists:', !!buttonImage);
  console.log('Response image exists:', !!responseImage);
  
  if (buttonImage) {
    console.log('Button image URL:', buttonImage[0]?.url);
    console.log('Button image thumbnails:');
    console.log('- Small:', buttonImage[0]?.thumbnails?.small?.url);
    console.log('- Large:', buttonImage[0]?.thumbnails?.large?.url);
    console.log('- Full:', buttonImage[0]?.thumbnails?.full?.url);
  }
  
  // Test transformation directly
  console.log('\n===== Testing image transformation =====');
  if (buttonImage) {
    const transformedImage = ChatDataTransformer._transformMediaImage(buttonImage[0]);
    console.log('Transformed image:', JSON.stringify(transformedImage, null, 2));
  }
  
  // Test user interaction response
  console.log('\n===== Testing user interaction response =====');
  const userInteractionResponse = ChatDataTransformer._transformUserInteractionResponse(testChat, moduleIndex);
  console.log('User interaction response:', JSON.stringify(userInteractionResponse, null, 2));
  
  // Check transformed data for media and images
  if (userInteractionResponse && userInteractionResponse.prompts && userInteractionResponse.prompts.length > 0) {
    const media = userInteractionResponse.prompts[0].media;
    console.log(`Number of media items: ${media?.length || 0}`);
    
    if (media && media.length > 0) {
      console.log(`Media item 0 has ${media[0].image?.length || 0} images`);
      
      if (media[0].image && media[0].image.length > 0) {
        console.log('First image defaultUrl:', media[0].image[0]?.defaultUrl);
        console.log('First image thumbnail.tiny:', media[0].image[0]?.thumbnail?.tiny);
      }
      
      if (media[0].image && media[0].image.length > 1) {
        console.log('Second image defaultUrl:', media[0].image[1]?.defaultUrl);
        console.log('Second image thumbnail.tiny:', media[0].image[1]?.thumbnail?.tiny);
      }
    }
  }
} else {
  console.log('No interaction module found in the test chat');
}

// Test full transformation
console.log('\n===== Testing full data transformation =====');
try {
  const transformedData = ChatDataTransformer.transformRequestData(testChat);
  console.log('ChatId:', transformedData.chatId);
  console.log('Chat array length:', transformedData.chat.length);
  
  // Find and check media items
  let mediaItemCount = 0;
  transformedData.chat.forEach((item, index) => {
    if (item.prompts) {
      item.prompts.forEach(prompt => {
        if (prompt.media) {
          mediaItemCount++;
          console.log(`Media found in item ${index}, talker: ${item.talker}`);
          console.log(`Media content:`, JSON.stringify(prompt.media, null, 2));
        }
      });
    }
  });
  
  console.log(`Total media items found in transformed data: ${mediaItemCount}`);
} catch (error) {
  console.error('Error in full transformation:', error.message);
}