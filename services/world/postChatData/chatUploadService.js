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
      console.log(`[GET] 채팅 조회 요청: chatId=${id}`);
      
      // 서버가 응답할 시간을 주기 위해 짧은 딜레이 추가
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 필드 이름이 chatId인 경우를 처리
      const response = await this.axios.get(`${this.BASE_URL}/world/chats?chatId=${encodeURIComponent(id)}`, {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache' // 캐시 방지
        },
        timeout: 20000, // 타임아웃 증가 (20초)
        httpsAgent: this.httpsAgent
      });
      
      console.log(`[GET] 채팅 조회 응답: 상태=${response.status}, 데이터 길이=${Array.isArray(response.data) ? response.data.length : '객체'}`);
      
      // 결과가 배열인 경우 chatId가 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(chat => chat.chatId === id);
        if (exactMatch) {
          console.log(`[GET] 정확히 일치하는 채팅 찾음: ${exactMatch.chatId}`);
          return exactMatch;
        } else {
          console.log(`[GET] 정확히 일치하는 채팅을 찾지 못함: ${id}`);
          return null;
        }
      }
      
      if (response.data) {
        console.log(`[GET] 단일 채팅 응답: ${response.data.chatId}`);
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`[GET] 채팅 조회 오류: ${error.message}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      
      if (error.response?.status === 404) {
        console.log(`[GET] 404 오류: 채팅 ID ${id}가 존재하지 않음`);
      }
      
      return null;
    }
  }

  async uploadSingleChat(chatData) {
    try {
      if (!chatData || typeof chatData !== 'object') {
        throw new Error('Invalid chat data: expected an object');
      }

      const transformedData = ChatDataTransformer.transformRequestData(chatData);
      
      // 디버깅을 위한 로깅 추가 (간략한 로그만 출력)
      console.log('[UPLOAD] 채팅 생성 시작:', {
        id: chatData.id,
        chatId: transformedData.chatId,
        steps: transformedData.step
      });

      // 이미지 계산 로직 추가
      let imageCount = 0;
      let mediaItems = 0;
      
      // 이미지 감지 및 개수 확인
      if (transformedData.chat) {
        transformedData.chat.forEach((item, index) => {
          if (item.image && Array.isArray(item.image)) {
            item.image.forEach(imageEntry => {
              if (imageEntry.media && imageEntry.media.image) {
                imageCount += imageEntry.media.image.length || 0;
                mediaItems++;
                
                // 이미지 URL 검증
                imageEntry.media.image.forEach((img, imgIndex) => {
                  if (!img.defaultUrl) {
                    console.warn(`[UPLOAD] 경고: 누락된 이미지 URL - chat[${index}].image.media.image[${imgIndex}]`);
                  } else {
                    // URL 검증용 로그 (개발용)
                    if (process.env.NODE_ENV === 'development') {
                      console.log(`[UPLOAD] 이미지 URL: ${img.defaultUrl.substring(0, 30)}...`);
                      if (img.thumbnail) {
                        console.log(`[UPLOAD] 써네일 tiny: ${img.thumbnail.tiny?.substring(0, 30) || 'null'}...`);
                      }
                    }
                  }
                });
              }
            });
          }
        });
      }
      
      console.log(`[UPLOAD] 이미지 통계: 미디어 항목=${mediaItems}, 이미지 개수=${imageCount}`);

      // 새로운 데이터 생성 전에 이미 존재하는지 한 번 더 확인
      const existingChat = await this.getChatById(transformedData.chatId);
      if (existingChat) {
        console.log(`[UPLOAD] 이미 존재하는 채팅임: ${transformedData.chatId}, 업데이트로 전환합니다`);
        return this.updateSingleChat(chatData);
      }
      
      // POST 요청 전 chatId 존재 확인
      if (!transformedData.chatId) {
        transformedData.chatId = chatData.id; // chatId 명시적 할당
        console.log(`[UPLOAD] POST 요청 ChatId 명시적 설정: ${transformedData.chatId}`);
      }
      
      // POST 요청 실행
      const response = await this.axios.post(
        `${this.BASE_URL}/world/chats`, 
        transformedData,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-Debug-ChatId': transformedData.chatId || 'missing', // 디버깅용 헤더 추가
            'Cache-Control': 'no-cache' // 캐시 사용 방지
          },
          timeout: 30000, // 30초 타임아웃 설정
          httpsAgent: this.httpsAgent
        }
      );

      console.log(`[UPLOAD] 채팅 생성 성공: chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
      
      // 생성 후 검증 (확인을 위해 잠시 기다림)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const createdChat = await this.getChatById(transformedData.chatId);
      
      if (createdChat) {
        console.log(`[UPLOAD] 생성 후 채팅 확인 성공: chatId=${createdChat.chatId}`);
      } else {
        console.warn(`[UPLOAD] 주의: 새로 생성한 채팅을 조회할 수 없음: chatId=${transformedData.chatId}`);
      }
      
      return response.data;
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('[UPLOAD] 업로드 오류:', {
        chatId: chatData?.id,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Upload failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async updateSingleChat(chatData) {
    let retryCount = 0;
    const maxRetries = 3;
    let lastError = null;
    
    try {
      if (!chatData || typeof chatData !== 'object') {
        throw new Error('Invalid chat data: expected an object');
      }

      const transformedData = ChatDataTransformer.transformRequestData(chatData);
      
      // 디버깅을 위한 로깅 추가
      console.log('[UPDATE] 채팅 업데이트 시작:', {
        id: chatData.id,
        chatId: transformedData.chatId
      });
      
      // 중요: 서버에 데이터가 있는지 확인하기 전에 짧은 지연 추가
      // API 서버에서 응답이 완전히 처리될 시간을 확보
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 실제 처리 시작 - 재시도 로직 적용
      while (retryCount <= maxRetries) {
        try {
          // chatId로 기존 데이터 검색
          const existingChat = await this.getChatById(transformedData.chatId);
          
          if (!existingChat) {
            // 404 오류의 경우: 데이터 없음
            if (retryCount < maxRetries) {
              console.log(`[UPDATE] 채팅 없음 (${retryCount+1}/${maxRetries+1} 시도): chatId=${transformedData.chatId} - 재시도 중...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // 점진적 증가 대기 시간
              continue; // 다시 시도
            }
            
            console.log(`[UPDATE] 채팅을 찾을 수 없어 새로 생성합니다: chatId=${transformedData.chatId}`);
            return this.uploadSingleChat(chatData);
          }
          
          console.log(`[UPDATE] 기존 채팅 발견 (재시도 ${retryCount}/${maxRetries+1}): chatId=${existingChat.chatId}, 업데이트 시작...`);
          
          // 업데이트 전에 이미지 데이터 검증
          if (transformedData.chat) {
            for (const item of transformedData.chat) {
              if (item.image && Array.isArray(item.image)) {
                console.log(`[UPDATE] 이미지 데이터 포함: 개수=${item.image.length}`);
              }
            }
          }
          
          // PATCH 요청으로 기존 데이터 업데이트 (chatId 확인)
          if (!transformedData.chatId) {
            transformedData.chatId = chatData.id; // chatId 명시적 할당
            console.log(`[UPDATE] ChatId 명시적 설정: ${transformedData.chatId}`);
          }
          
          // 서버가 chatId를 기준으로 요청을 처리
          const response = await this.axios.patch(
            `${this.BASE_URL}/world/chats/${transformedData.chatId}`, 
            transformedData,
            {
              headers: { 
                'Content-Type': 'application/json',
                'X-Debug-ChatId': transformedData.chatId || 'missing', // 디버깅용 헤더 추가
                'Cache-Control': 'no-cache' // 캐시 사용 방지
              },
              timeout: 30000, // 30초 타임아웃 설정
              httpsAgent: this.httpsAgent
            }
          );
          
          console.log(`[UPDATE] 업데이트 성공: chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
          
          // 업데이트 후 검증 (확인을 위해 잠시 기다림)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedChat = await this.getChatById(transformedData.chatId);
          
          if (updatedChat) {
            console.log(`[UPDATE] 업데이트 후 채팅 검증 성공: chatId=${updatedChat.chatId}, 응답 받음`);            
            return response.data;
          } else {
            console.error(`[UPDATE] 업데이트 후 채팅 조회에 실패. 새로 생성됨: chatId=${transformedData.chatId}`);
            return response.data;
          }
          
        } catch (err) {
          lastError = err;
          
          if (err.response?.status === 404 && retryCount < maxRetries) {
            console.log(`[UPDATE] 404 오류 발생 (${retryCount+1}/${maxRetries+1} 시도): chatId=${transformedData.chatId} - 재시도 중...`);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            continue;
          }
          
          // 재시도 불가능한 오류 발생
          throw err;
        }
      }
      
      // 모든 재시도가 실패한 경우 새로 생성
      if (retryCount > maxRetries) {
        console.log(`[UPDATE] 모든 재시도 실패. 새로 생성 시도: chatId=${transformedData.chatId}`);
        return this.uploadSingleChat(chatData);
      }
      
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('[UPDATE] 업데이트 오류:', {
        chatId: chatData?.id,
        attempt: `${retryCount}/${maxRetries+1}`,
        status: error.response?.status,
        statusText: error.response?.statusText,
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
  
  // 재시도 로직 구현 (404 오류 특별 처리 추가)
  async _retryOperation(operation, maxRetries = 3, initialDelay = 2000) {
    let lastError;
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // 에러 유형 확인
        const status = error.response?.status || 0;
        
        // 404 오류는 특별 처리
        if (status === 404) {
          console.log(`[RETRY] 404 Not Found 오류 발생 (${attempt}/${maxRetries}) - 데이터가 아직 준비되지 않았을 수 있음`);
          
          // 404는 항상 재시도 (최대 재시도 회수까지)
          if (attempt < maxRetries) {
            console.log(`[RETRY] ${delay}ms 후 재시도 예정...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5; // 404의 경우 조금 더 완만한 증가율 적용
            continue;
          }
          
          // 모든 재시도 실패시 예외 발생
          console.error(`[RETRY] 모든 404 재시도 실패 (${maxRetries}/${maxRetries})`);
          throw error;
        }
        
        // 네트워크 문제인 경우에도 재시도
        const isNetworkError = error.message.includes('socket') || 
                              error.message.includes('network') || 
                              error.message.includes('timeout') ||
                              error.message.includes('TLS') || 
                              error.message.includes('connection') ||
                              [500, 502, 503, 504].includes(status); // 서버 오류도 재시도
                              
        if (!isNetworkError || attempt === maxRetries) {
          console.log(`[RETRY] 재시도 불가능한 오류 또는 모든 재시도 소진: ${error.message}`);
          throw error;
        }
        
        console.log(`[RETRY] 시도 ${attempt}/${maxRetries} - ${delay}ms 후 재시도. 오류: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // 지수 백오프 (각 재시도마다 대기 시간 2배 증가)
        delay *= 2;
      }
    }
    
    throw lastError;
  }
}

module.exports = new ChatUploadService();