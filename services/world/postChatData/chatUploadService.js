// services/chatUploadService.js
const ChatDataTransformer = require('./utils/chatDataTransformer');

class ChatUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
    this.axios = require('axios');
    
    // 향상된 HTTPS 에이전트 설정
    this.httpsAgent = new (require('https').Agent)({
      rejectUnauthorized: true, // SSL 인증서 검증 활성화
      secureProtocol: 'TLS_method', // 최신 TLS 버전 사용
      timeout: 30000, // 소켓 타임아웃 증가 (30초)
      keepAlive: true, // 연결 유지
      maxSockets: 5 // 동시 연결 제한
    });
  }
  
  async getChatById(id) {
    if (!id) {
      throw new Error('ID is required to search for a chat');
    }
    
    try {
      // 필드 이름이 chatId인 경우를 처리
      const response = await this.axios.get(`${this.BASE_URL}/world/chats?chatId=${encodeURIComponent(id)}`, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000, // 타임아웃 증가 (15초)
        httpsAgent: this.httpsAgent
      });
      
      // 결과가 배열인 경우 chatId가 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(chat => chat.chatId === id);
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

      // POST 요청 전 chatId 존재 확인
      if (!transformedData.chatId) {
        transformedData.chatId = chatData.id; // chatId 명시적 할당
        console.log(`POST 요청 ChatId 명시적 설정: ${transformedData.chatId}`);
      }
      
      const response = await this.axios.post(
        `${this.BASE_URL}/world/chats`, 
        transformedData,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-Debug-ChatId': transformedData.chatId || 'missing' // 디버깅용 헤더 추가
          },
          timeout: 30000, // 30초 타임아웃 설정
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
      
      // chatId로 기존 데이터 검색
      const existingChat = await this.getChatById(transformedData.chatId);
      
      if (!existingChat) {
        console.log(`Chat with chatId '${transformedData.chatId}' not found, creating a new one`);
        // 기존 데이터가 없으면 새로 생성
        return this.uploadSingleChat(chatData);
      }
      
      console.log(`Found existing chat with chatId '${transformedData.chatId}', _id: ${existingChat._id}`);
      
      // PATCH 요청으로 기존 데이터 업데이트 (chatId가 반드시 포함되도록 확인)
      if (!transformedData.chatId) {
        transformedData.chatId = chatData.id; // chatId 명시적 할당
        console.log(`ChatId 명시적 설정: ${transformedData.chatId}`);
      }
      
      // 서버가 _id를 기준으로 요청을 처리하므로 _id 필드 사용
      const response = await this.axios.patch(
        `${this.BASE_URL}/world/chats/${existingChat._id}`, 
        transformedData,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-Debug-ChatId': transformedData.chatId || 'missing' // 디버깅용 헤더 추가
          },
          timeout: 30000, // 30초 타임아웃 설정
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
    const batchSize = 3; // 동시에 처리할 요청 수 제한 (5에서 3으로 줄임)
    const results = [];
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(chatData => 
          this._retryOperation(() => this.uploadSingleChat(chatData))
            .then(result => this._createSuccessResult(chatData, result))
            .catch(error => this._createErrorResult(chatData, error.message))
        )
      );
      results.push(...batchResults);
      
      // 배치 간 딜레이 증가
      if (i + batchSize < dataArray.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 1초에서 3초로 증가
      }
    }

    return this._createSummary(results);
  }
  
  async updateMultipleChats(chatsData) {
    const dataArray = Array.isArray(chatsData) ? chatsData : [chatsData];
    const batchSize = 3; // 동시에 처리할 요청 수 제한 (5에서 3으로 줄임)
    const results = [];
    
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const batch = dataArray.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(chatData => 
          this._retryOperation(() => this.updateSingleChat(chatData))
            .then(result => this._createSuccessResult(chatData, result, true)) // isUpdate=true
            .catch(error => this._createErrorResult(chatData, error.message))
        )
      );
      results.push(...batchResults);
      
      // 배치 간 딜레이 증가
      if (i + batchSize < dataArray.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 1초에서 3초로 증가
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
  
  // 재시도 로직 구현
  async _retryOperation(operation, maxRetries = 3, initialDelay = 2000) {
    let lastError;
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // TLS 연결 문제 또는 네트워크 관련 오류인 경우에만 재시도
        const isNetworkError = error.message.includes('socket') || 
                              error.message.includes('network') || 
                              error.message.includes('timeout') ||
                              error.message.includes('TLS') || 
                              error.message.includes('connection');
                              
        if (!isNetworkError || attempt === maxRetries) {
          throw error;
        }
        
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 지수 백오프 (각 재시도마다 대기 시간 2배 증가)
        delay *= 2;
      }
    }
    
    throw lastError;
  }
}

module.exports = new ChatUploadService();