// services/chatUploadService.js
const ChatDataTransformer = require('./utils/chatDataTransformer');

class ChatUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
    this.axios = require('axios');
  }

  async uploadSingleChat(chatData) {
    try {
      if (!chatData || typeof chatData !== 'object') {
        throw new Error('Invalid chat data: expected an object');
      }

      const transformedData = ChatDataTransformer.transformRequestData(chatData);
      
      // 디버깅을 위한 로깅 추가
      console.log('Uploading chat:', {
        id: chatData.id,
        transformedData: JSON.stringify(transformedData, null, 2)
      });

      const response = await this.axios.post(
        `${this.BASE_URL}/world/chats`, 
        transformedData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10초 타임아웃 설정
        }
      );

      return response.data;
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('Upload error details:', {
        chatId: chatData?.id,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Upload failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async uploadMultipleChats(chatsData) {
    const dataArray = Array.isArray(chatsData) ? chatsData : [chatsData];
    const batchSize = 5; // 동시에 처리할 요청 수 제한
    const results = [];
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(chatData => 
          this.uploadSingleChat(chatData)
            .then(result => this._createSuccessResult(chatData, result))
            .catch(error => this._createErrorResult(chatData, error.message))
        )
      );
      results.push(...batchResults);
      
      // 배치 간 짧은 딜레이
      if (i + batchSize < dataArray.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return this._createSummary(results);
  }

  _createErrorResult(chatData, errorMessage) {
    return {
      chatId: chatData?.id || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(chatData, result) {
    return {
      chatId: chatData.id,
      status: 'success',
      response: result
    };
  }

  _createSummary(results) {
    return {
      success: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'error').length,
      details: results
    };
  }
}

module.exports = new ChatUploadService();