// services/chatUploadService.js
const ChatDataTransformer = require('./utils/chatDataTransformer');

class ChatUploadService {
  constructor() {
    this.BASE_URL = 'https://world.ahhaohho.com';
    this.axios = require('axios');
    
    // SSL 인증서 검증 비활성화
    this.httpsAgent = new (require('https').Agent)({
      rejectUnauthorized: false
    });
  }
  
  async getChatById(id) {
    if (!id) {
      throw new Error('ID is required to search for a chat');
    }
    
    try {
      // 필드 이름이 chatIdx인 경우를 처리
      const response = await this.axios.get(`${this.BASE_URL}/world/chats?chatIdx=${encodeURIComponent(id)}`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
        httpsAgent: this.httpsAgent
      });
      
      // 결과가 배열인 경우 chatIdx가 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(chat => chat.chatIdx === id);
        return exactMatch || null;
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`Error fetching chat by id: ${error.message}`);
      return null;
    }
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
          timeout: 10000, // 10초 타임아웃 설정
          httpsAgent: this.httpsAgent
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
  
  async updateSingleChat(chatData) {
    try {
      if (!chatData || typeof chatData !== 'object') {
        throw new Error('Invalid chat data: expected an object');
      }

      const transformedData = ChatDataTransformer.transformRequestData(chatData);
      
      // 디버깅을 위한 로깅 추가
      console.log('Updating chat:', {
        id: chatData.id,
        transformedData: JSON.stringify(transformedData, null, 2)
      });
      
      // chatIdx로 기존 데이터 검색
      const existingChat = await this.getChatById(transformedData.chatIdx);
      
      if (!existingChat) {
        console.log(`Chat with chatIdx '${transformedData.chatIdx}' not found, creating a new one`);
        // 기존 데이터가 없으면 새로 생성
        return this.uploadSingleChat(chatData);
      }
      
      console.log(`Found existing chat with chatIdx '${transformedData.chatIdx}', _id: ${existingChat._id}`);
      
      // PATCH 요청으로 기존 데이터 업데이트
      const response = await this.axios.patch(
        `${this.BASE_URL}/world/chats/${existingChat._id}`, 
        transformedData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000, // 10초 타임아웃 설정
          httpsAgent: this.httpsAgent
        }
      );

      return response.data;
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('Update error details:', {
        chatId: chatData?.id,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Update failed: ${error.response?.data?.message || error.message}`);
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
  
  async updateMultipleChats(chatsData) {
    const dataArray = Array.isArray(chatsData) ? chatsData : [chatsData];
    const batchSize = 5; // 동시에 처리할 요청 수 제한
    const results = [];
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(chatData => 
          this.updateSingleChat(chatData)
            .then(result => this._createSuccessResult(chatData, result, true)) // isUpdate=true
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

  _createSuccessResult(chatData, result, isUpdate = false) {
    return {
      chatId: chatData.id,
      status: 'success',
      action: isUpdate ? 'updated' : 'created',
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