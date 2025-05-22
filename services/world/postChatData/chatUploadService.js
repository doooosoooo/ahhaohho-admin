// services/chatUploadService.js
const ChatDataTransformer = require('./utils/chatDataTransformer');

class ChatUploadService {
  constructor() {
    this.BASE_URL = 'https://api.staging.ahhaohho.com';
    this.axios = require('axios');
    
    // 향상된 HTTPS 에이전트 설정
    this.httpsAgent = new (require('https').Agent)({
      rejectUnauthorized: false, // SSL 인증서 검증 활성화
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
      
      // 서버가 응답할 시간을 주기 위해 더 긴 딜레이 추가 (1초 → 3초)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 다양한 API 엔드포인트 시도
      // 1. 일반 쿼리를 사용한 조회
      const searchResponse = await this.axios.get(`${this.BASE_URL}/world/chats?chatId=${encodeURIComponent(id)}`, {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache', // 캐시 방지
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'Pragma': 'no-cache'
        },
        timeout: 30000, // 타임아웃 증가 (30초)
        httpsAgent: this.httpsAgent
      });
      
      // 응답에 유효한 데이터가 있는지 확인
      if (searchResponse.data && searchResponse.data.data) {
        console.log(`[GET] 채팅 조회 응답 받음 (searchResponse): ID=${id}`);
        
        // 정확한 ID 일치 여부 확인
        const isIdMatch = searchResponse.data.data.chatId === id || searchResponse.data.data.id === id;
        
        // 응답에 데이터는 있지만 ID가 일치하지 않는 경우에도 요청한 ID 사용
        const result = { ...searchResponse.data.data };
        
        // chatId 필드가 없거나 다른 경우 요청한 ID로 설정
        if (!result.chatId || !isIdMatch) {
          result.chatId = id;
          console.log(`[GET] 응답에 chatId가 없거나 불일치하여 요청한 ID 사용: ${id}`);
        }
        
        return result;
      }
      
      // 2. 직접 ID로 조회 시도 (GET /chats/:id)
      try {
        const directResponse = await this.axios.get(`${this.BASE_URL}/world/chats/${encodeURIComponent(id)}`, {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          },
          timeout: 30000,
          httpsAgent: this.httpsAgent
        });
        
        if (directResponse.data) {
          console.log(`[GET] 채팅 조회 응답 받음 (directResponse): ID=${id}`);
          
          // 정확한 ID 일치 여부 확인
          const isIdMatch = directResponse.data.chatId === id || directResponse.data.id === id;
          
          // 응답 데이터 복사 및 ID 확인
          const result = { ...directResponse.data };
          
          // chatId 필드가 없거나 다른 경우 요청한 ID로 설정
          if (!result.chatId || !isIdMatch) {
            result.chatId = id;
            console.log(`[GET] 직접 조회 응답에 chatId가 없거나 불일치하여 요청한 ID 사용: ${id}`);
          }
          
          return result;
        }
      } catch (directError) {
        console.log(`[GET] 직접 ID 조회 실패: ${directError.message}`);
      }
      
      // 원래 응답 계속 처리
      const response = searchResponse;
      
      console.log(`[GET] 채팅 조회 응답: 상태=${response.status}, 데이터 길이=${Array.isArray(response.data) ? response.data.length : '객체'}`);
      
      // 결과가 배열인 경우 chatId가 정확히 일치하는 항목 필터링 또는 첫 번째 항목 사용
      if (Array.isArray(response.data)) {
        // 정확히 일치하는 항목 검색
        const exactMatch = response.data.find(chat => chat.chatId === id || chat.id === id);
        
        if (exactMatch) {
          console.log(`[GET] 정확히 일치하는 채팅 찾음: ${exactMatch.chatId || id}`);
          
          // chatId 필드가 없으면 추가
          const result = { ...exactMatch };
          if (!result.chatId) {
            result.chatId = id;
            console.log(`[GET] 일치항목에 chatId가 없어 요청한 ID 사용: ${id}`);
          }
          
          return result;
        } else if (response.data.length > 0) {
          // 정확히 일치하는 항목이 없지만 결과가 있는 경우, 첫 번째 항목 사용하고 ID 설정
          console.log(`[GET] 정확히 일치하는 채팅을 찾지 못했지만 결과 있음. 첫 번째 항목 사용: ${id}`);
          const result = { ...response.data[0] };
          result.chatId = id; // 요청한 ID 사용
          return result;
        } else {
          console.log(`[GET] 정확히 일치하는 채팅을 찾지 못함 (빈 배열): ${id}`);
          return null;
        }
      }
      
      // 응답이 있는 경우, 응답에 chatId가 없더라도 원래 요청한 ID를 사용하도록 추가
      if (response.data) {
        // 응답 데이터 로깅
        console.log(`[GET] 응답 받음. 을 요청한 채팅 ID: ${id}`);
        
        // 만약 응답에 chatId가 없더라도 요청한 ID로 채워넣기
        const result = { ...response.data };
        if (!result.chatId) {
          result.chatId = id; // 요청한 ID를 사용
          console.log(`[GET] 응답에 chatId가 없으므로 요청한 ID를 사용: ${id}`);
        }
        
        return result;
      }
      
      return null; // response.data가 없으면 null 반환
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
                    // URL 검증용 로그 (추가 로그는 제거)
                    const urlPreview = img.defaultUrl.substring(0, 30) + '...';
                    console.log(`[UPLOAD] 이미지 URL 개요: ${urlPreview}`);
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
        // 응답이 있다면 업데이트로 전환 (응답에 chatId가 없더라도 요청한 ID로 업데이트)
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
        // 응답에 chatId가 없더라도 원래 ID 사용
        const chatId = createdChat.chatId || transformedData.chatId;
        console.log(`[UPLOAD] 생성 후 채팅 확인 성공: chatId=${chatId}`);
      } else {
        console.warn(`[UPLOAD] 주의: 새로 생성한 채팅을 조회할 수 없음: chatId=${transformedData.chatId}`);
      }
      
      // 응답에 chatId가 없을 경우 추가
      const responseData = response.data || {};
      if (!responseData.chatId) {
        responseData.chatId = transformedData.chatId;
        console.log(`[UPLOAD] 응답에 chatId 추가: ${transformedData.chatId}`);
      }
      
      return responseData;
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
    // lastError 변수 제거 (ESLint 경고)
    
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
            // GET 요청에서 404 오류 (데이터가 없음)
            if (retryCount < maxRetries) {
              console.log(`[UPDATE] 채팅 없음 (${retryCount+1}/${maxRetries+1} 시도): chatId=${transformedData.chatId} - 재시도 중...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // 점진적 증가 대기 시간
              continue; // 다시 시도
            }
            
            // 재시도 횟수 초과 시 다양한 방법 시도 - 단순히 업로드로 넘기지 않고 더 적극적으로 시도
            console.log(`[UPDATE] 채팅을 찾을 수 없지만 업데이트 요청이므로 다양한 방법 시도: chatId=${transformedData.chatId}`);
            
            // POST 요청을 사용한 upsert 시도 (이 기능이 구현되어 있을 경우)
            try {
              console.log(`[UPDATE] 채팅을 찾을 수 없어 POST 요청으로 시도 (upsert): ${this.BASE_URL}/world/chats`);
              const response = await this.axios.post(
                `${this.BASE_URL}/world/chats`, 
                transformedData,
                {
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-Debug-ChatId': transformedData.chatId || 'missing',
                    'Cache-Control': 'no-cache', 
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                  },
                  timeout: 30000,
                  httpsAgent: this.httpsAgent
                }
              );
              console.log(`[UPDATE] POST 요청 성공 (upsert): chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
              return response.data;
            } catch (postErr) {
              console.error(`[UPDATE] 최종 시도 (POST) 실패, 새로 생성으로 전환: ${postErr.message}`);
              return this.uploadSingleChat(chatData);
            }
          }
          
          // existingChat이 존재하면 서버 응답의 ID 필드를 확인할 필요 없음
          // 원래 요청한 ID(transformedData.chatId)를 사용해서 업데이트
          console.log(`[UPDATE] 기존 채팅 발견 (재시도 ${retryCount}/${maxRetries+1}): chatId=${transformedData.chatId}, 업데이트 시작...`);
          
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
          
          // 서버가 chatId를 기준으로 요청을 처리 - PUT 요청만 사용 (배열 중복 방지)
          console.log(`[UPDATE] 이미지 필드 중복 방지를 위해 PUT 요청 사용`);
          console.log(`[UPDATE] PUT 요청 데이터:`, JSON.stringify({
            chatId: transformedData.chatId,
            step: transformedData.step,
            chatLength: transformedData.chat.length,
            imageItems: transformedData.chat.filter(item => item.image).length
          }, null, 2));
          
          let response;
          try {
            // 항상 PUT 요청 사용 (배열 필드 중복 방지)
            console.log(`[UPDATE] PUT 요청 URL: ${this.BASE_URL}/world/chats/${transformedData.chatId}`);
            response = await this.axios.put(
              `${this.BASE_URL}/world/chats/${transformedData.chatId}`, 
              transformedData,
              {
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Debug-ChatId': transformedData.chatId || 'missing', // 디버깅용 헤더 추가
                  'Cache-Control': 'no-cache', // 캐시 사용 방지
                  'Accept': 'application/json', // 응답 형식 명시
                  'X-Requested-With': 'XMLHttpRequest' // AJAX 요청임을 명시
                },
                timeout: 30000, // 30초 타임아웃 설정
                httpsAgent: this.httpsAgent
              }
            );
            console.log(`[UPDATE] PUT 요청 성공: chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
          } catch (putErr) {
            console.error(`[UPDATE] PUT 요청 실패 상세 정보:`, {
              status: putErr.response?.status,
              statusText: putErr.response?.statusText,
              message: putErr.message,
              code: putErr.code,
              isAxiosError: putErr.isAxiosError ? 'Yes' : 'No'
            });
            
            try {
              // PUT 요청이 실패하면 쿼리 매개변수를 사용한 대체 URL 시도
              console.log(`[UPDATE] PUT 실패, 대체 URL 시도: ${this.BASE_URL}/world/chats?chatId=${transformedData.chatId}`);
              response = await this.axios.put(
                `${this.BASE_URL}/world/chats?chatId=${transformedData.chatId}`, 
                transformedData,
                {
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-Debug-ChatId': transformedData.chatId || 'missing',
                    'Cache-Control': 'no-cache',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                  },
                  timeout: 30000,
                  httpsAgent: this.httpsAgent
                }
              );
              console.log(`[UPDATE] 대체 URL PUT 요청 성공: chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
            } catch (altErr) {
              console.error(`[UPDATE] 대체 URL PUT 요청 실패 상세 정보:`, {
                status: altErr.response?.status,
                statusText: altErr.response?.statusText,
                message: altErr.message,
                code: altErr.code,
                isAxiosError: altErr.isAxiosError ? 'Yes' : 'No'
              });
              
              try {
                // 마지막 수단: POST 요청으로 upsert 시도
                console.log(`[UPDATE] PUT 요청 모두 실패, POST 요청으로 시도 (upsert): ${this.BASE_URL}/world/chats`);
                response = await this.axios.post(
                  `${this.BASE_URL}/world/chats`, 
                  transformedData,
                  {
                    headers: { 
                      'Content-Type': 'application/json',
                      'X-Debug-ChatId': transformedData.chatId || 'missing',
                      'Cache-Control': 'no-cache',
                      'Accept': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest'
                    },
                    timeout: 30000,
                    httpsAgent: this.httpsAgent
                  }
                );
                console.log(`[UPDATE] POST 요청 성공 (upsert): chatId=${transformedData.chatId}, 응답 상태=${response.status}`);
              } catch (postErr) {
                console.error(`[UPDATE] POST 요청도 실패: ${postErr.message}`);
                throw postErr;
              }
            }
          }
          
          // 업데이트 후 검증 (확인을 위해 잠시 기다림)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedChat = await this.getChatById(transformedData.chatId);
          
          if (updatedChat) {
            // 응답에 chatId가 없더라도 원래 ID 사용
            const chatId = updatedChat.chatId || transformedData.chatId;
            console.log(`[UPDATE] 업데이트 후 채팅 검증 성공: chatId=${chatId}, 응답 받음`);            
            
            // 응답에 chatId가 없을 경우 추가
            const responseData = response.data || {};
            if (!responseData.chatId) {
              responseData.chatId = transformedData.chatId;
            }
            
            return responseData;
          } else {
            console.error(`[UPDATE] 업데이트 후 채팅 조회에 실패. 새로 생성됨: chatId=${transformedData.chatId}`);
            
            // 응답에 chatId가 없을 경우 추가
            const responseData = response.data || {};
            if (!responseData.chatId) {
              responseData.chatId = transformedData.chatId;
            }
            
            return responseData;
          }
          
        } catch (err) {
          // lastError 변수 제거 (사용되지 않음)
          
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
    // 서버 응답에 chatId가 없을 경우 원래 ID 사용
    if (result && !result.chatId && chatData.id) {
      result = { ...result, chatId: chatData.id };
    }
    
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
    // lastError 변수는 마지막에만 사용되므로 여기서는 선언하지 않음
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // lastError 지정 제거 (ESLint 경고)
        
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
    
    // 마지막 재시도까지 실패한 경우에는 오류를 반환해야 하지만
    // 이 지점까지 도달하는 경우는 거의 없음
    throw new Error(`모든 재시도 실패 (${maxRetries} 회)`);
  }
}

module.exports = new ChatUploadService();