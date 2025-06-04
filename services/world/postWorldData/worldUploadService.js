// services/worldUploadService.js
const WorldDataTransformer = require('./utils/worldDataTransformer');

class WorldUploadService {
  constructor() {
    this.BASE_URL = 'https://world.ahhaohho.com';
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
  
  async getWorldById(id) {
    if (!id) {
      throw new Error('ID is required to search for a world');
    }
    
    try {
      console.log(`[GET] 월드 조회 요청: worldIdx=${id}`);
      
      // 서버가 응답할 시간을 주기 위해 더 긴 딜레이 추가 (1초 → 3초)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 다양한 API 엔드포인트 시도
      // 1. 일반 쿼리를 사용한 조회
      const searchResponse = await this.axios.get(`${this.BASE_URL}/world?worldIdx=${encodeURIComponent(id)}`, {
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
        console.log(`[GET] 월드 조회 응답 받음 (searchResponse): ID=${id}`);
        
        // 정확한 ID 일치 여부 확인
        const isIdMatch = searchResponse.data.data.worldIdx === id || searchResponse.data.data.id === id;
        
        // 응답에 데이터는 있지만 ID가 일치하지 않는 경우에도 요청한 ID 사용
        const result = { ...searchResponse.data.data };
        
        // worldIdx 필드가 없거나 다른 경우 요청한 ID로 설정
        if (!result.worldIdx || !isIdMatch) {
          result.worldIdx = id;
          console.log(`[GET] 응답에 worldIdx가 없거나 불일치하여 요청한 ID 사용: ${id}`);
        }
        
        return result;
      }
      
      // 2. 직접 ID로 조회 시도 (GET /world/:id)
      try {
        const directResponse = await this.axios.get(`${this.BASE_URL}/world/${encodeURIComponent(id)}`, {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          },
          timeout: 30000,
          httpsAgent: this.httpsAgent
        });
        
        if (directResponse.data) {
          console.log(`[GET] 월드 조회 응답 받음 (directResponse): ID=${id}`);
          
          // 정확한 ID 일치 여부 확인
          const isIdMatch = directResponse.data.worldIdx === id || directResponse.data.id === id;
          
          // 응답 데이터 복사 및 ID 확인
          const result = { ...directResponse.data };
          
          // worldIdx 필드가 없거나 다른 경우 요청한 ID로 설정
          if (!result.worldIdx || !isIdMatch) {
            result.worldIdx = id;
            console.log(`[GET] 직접 조회 응답에 worldIdx가 없거나 불일치하여 요청한 ID 사용: ${id}`);
          }
          
          return result;
        }
      } catch (directError) {
        console.log(`[GET] 직접 ID 조회 실패: ${directError.message}`);
      }
      
      // 원래 응답 계속 처리
      const response = searchResponse;
      
      console.log(`[GET] 월드 조회 응답: 상태=${response.status}, 데이터 길이=${Array.isArray(response.data) ? response.data.length : '객체'}`);
      
      // 결과가 배열인 경우 worldIdx가 정확히 일치하는 항목 필터링 또는 첫 번째 항목 사용
      if (Array.isArray(response.data)) {
        // 정확히 일치하는 항목 검색
        const exactMatch = response.data.find(world => world.worldIdx === id || world.id === id);
        
        if (exactMatch) {
          console.log(`[GET] 정확히 일치하는 월드 찾음: ${exactMatch.worldIdx || id}`);
          
          // worldIdx 필드가 없으면 추가
          const result = { ...exactMatch };
          if (!result.worldIdx) {
            result.worldIdx = id;
            console.log(`[GET] 일치항목에 worldIdx가 없어 요청한 ID 사용: ${id}`);
          }
          
          return result;
        } else if (response.data.length > 0) {
          // 정확히 일치하는 항목이 없지만 결과가 있는 경우, 첫 번째 항목 사용하고 ID 설정
          console.log(`[GET] 정확히 일치하는 월드를 찾지 못했지만 결과 있음. 첫 번째 항목 사용: ${id}`);
          const result = { ...response.data[0] };
          result.worldIdx = id; // 요청한 ID 사용
          return result;
        } else {
          console.log(`[GET] 정확히 일치하는 월드를 찾지 못함 (빈 배열): ${id}`);
          return null;
        }
      }
      
      // 응답이 있는 경우, 응답에 worldIdx가 없더라도 원래 요청한 ID를 사용하도록 추가
      if (response.data) {
        // 응답 데이터 로깅
        console.log(`[GET] 응답 받음. 을 요청한 월드 ID: ${id}`);
        
        // 만약 응답에 worldIdx가 없더라도 요청한 ID로 채워넣기
        const result = { ...response.data };
        if (!result.worldIdx) {
          result.worldIdx = id; // 요청한 ID를 사용
          console.log(`[GET] 응답에 worldIdx가 없으므로 요청한 ID를 사용: ${id}`);
        }
        
        return result;
      }
      
      return null; // response.data가 없으면 null 반환
    } catch (error) {
      console.error(`[GET] 월드 조회 오류: ${error.message}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      
      if (error.response?.status === 404) {
        console.log(`[GET] 404 오류: 월드 ID ${id}가 존재하지 않음`);
      }
      
      return null;
    }
  }

  async uploadSingleWorld(worldData) {
    try {
      if (!worldData || typeof worldData !== 'object') {
        throw new Error('Invalid world data: expected an object');
      }

      const transformedData = WorldDataTransformer.transformRequestData(worldData);
      
      // 디버깅을 위한 로깅 추가 (간략한 로그만 출력)
      console.log('[UPLOAD] 월드 생성 시작:', {
        id: worldData.id,
        title: transformedData.title
      });

      // 월드는 ID 필드가 없으므로 title로 존재 여부 확인
      const worldId = worldData.id || transformedData.title;
      const existingWorld = await this.getWorldById(worldId);
      if (existingWorld) {
        // 응답이 있다면 업데이트로 전환
        console.log(`[UPLOAD] 이미 존재하는 월드임: ${worldId}, 업데이트로 전환합니다`);
        return this.updateSingleWorld(worldData);
      }
      
      // POST 요청 실행
      const response = await this.axios.post(
        `${this.BASE_URL}/world`, 
        transformedData,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-Debug-WorldId': worldId || 'missing', // 디버깅용 헤더 추가
            'Cache-Control': 'no-cache' // 캐시 사용 방지
          },
          timeout: 30000, // 30초 타임아웃 설정
          httpsAgent: this.httpsAgent
        }
      );

      console.log(`[UPLOAD] 월드 생성 성공: worldId=${worldId}, 응답 상태=${response.status}`);
      
      // 생성 후 검증 (확인을 위해 잠시 기다림)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const createdWorld = await this.getWorldById(worldId);
      
      if (createdWorld) {
        // 응답에 worldIdx가 없더라도 원래 ID 사용
        const responseWorldId = createdWorld.worldIdx || worldId;
        console.log(`[UPLOAD] 생성 후 월드 확인 성공: worldId=${responseWorldId}`);
      } else {
        console.warn(`[UPLOAD] 주의: 새로 생성한 월드를 조회할 수 없음: worldId=${worldId}`);
      }
      
      // 응답에 worldIdx가 없을 경우 추가
      const responseData = response.data || {};
      if (!responseData.worldIdx) {
        responseData.worldIdx = worldId;
        console.log(`[UPLOAD] 응답에 worldIdx 추가: ${worldId}`);
      }
      
      return responseData;
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('[UPLOAD] 업로드 오류:', {
        worldId: worldData?.id || worldData?.['월드명'],
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Upload failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async updateSingleWorld(worldData) {
    if (!worldData || typeof worldData !== 'object') {
      throw new Error('Invalid world data: expected an object');
    }
    
    const transformedData = WorldDataTransformer.transformRequestData(worldData);
    console.log('Transformed Update Data:', transformedData);
    
    // worldId로 기존 데이터 검색
    const worldId = worldData.id || transformedData.title;
    const existingWorld = await this.getWorldById(worldId);
    
    if (!existingWorld) {
      console.log(`World with id '${worldId}' not found, creating a new one`);
      // 기존 데이터가 없으면 새로 생성
      return this.uploadSingleWorld(worldData);
    }
    
    console.log(`Found existing world with id '${worldId}'`);
    
    try {
      // PUT 요청으로 기존 데이터 업데이트 (배열 필드 중복 방지)
      const response = await this.axios.put(
        `${this.BASE_URL}/world/${worldId}`, 
        transformedData, 
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          timeout: 30000,
          httpsAgent: this.httpsAgent
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Update HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }

  async uploadMultipleWorlds(worldsData) {
    const dataArray = Array.isArray(worldsData) ? worldsData : [worldsData];
    
    const results = await Promise.all(
      dataArray.map(async (worldData) => {
        try {
          if (!this._isValidWorldData(worldData)) {
            return this._createErrorResult(worldData);
          }
          
          const result = await this.uploadSingleWorld(worldData);
          return this._createSuccessResult(worldData, result);
        } catch (error) {
          return this._createErrorResult(worldData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }
  
  async updateMultipleWorlds(worldsData) {
    const dataArray = Array.isArray(worldsData) ? worldsData : [worldsData];
    
    const results = await Promise.all(
      dataArray.map(async (worldData) => {
        try {
          if (!this._isValidWorldData(worldData)) {
            return this._createErrorResult(worldData);
          }
          
          // 업데이트 함수 사용
          const result = await this.updateSingleWorld(worldData);
          return this._createSuccessResult(worldData, result, true);
        } catch (error) {
          return this._createErrorResult(worldData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }

  _isValidWorldData(worldData) {
    return worldData && 
           typeof worldData === 'object' && 
           worldData["월드명"];
  }

  _createErrorResult(worldData, errorMessage = 'Invalid world data: missing 월드명 or invalid format') {
    return {
      worldId: worldData?.["월드명"] || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(worldData, result, isUpdate = false) {
    return {
      worldId: worldData["월드명"],
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
    let delay = initialDelay;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        
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

module.exports = new WorldUploadService();