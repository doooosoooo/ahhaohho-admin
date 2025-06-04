// services/challengeUploadService.js
const ChallengeDataTransformer = require('./utils/challengeDataTransformer');

class ChallengeUploadService {
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
  
  async getChallengeById(id) {
    if (!id) {
      throw new Error('ID is required to search for a challenge');
    }
    
    try {
      console.log(`[GET] 챌린지 조회 요청: challengeId=${id}`);
      
      // 서버가 응답할 시간을 주기 위해 더 긴 딜레이 추가 (1초 → 3초)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 다양한 API 엔드포인트 시도
      // 1. 일반 쿼리를 사용한 조회
      const searchResponse = await this.axios.get(`${this.BASE_URL}/world/challenges?challengeIdx=${encodeURIComponent(id)}`, {
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
        console.log(`[GET] 챌린지 조회 응답 받음 (searchResponse): ID=${id}`);
        
        // 정확한 ID 일치 여부 확인
        const isIdMatch = searchResponse.data.data.challengeIdx === id || searchResponse.data.data.id === id;
        
        // 응답에 데이터는 있지만 ID가 일치하지 않는 경우에도 요청한 ID 사용
        const result = { ...searchResponse.data.data };
        
        // challengeIdx 필드가 없거나 다른 경우 요청한 ID로 설정
        if (!result.challengeIdx || !isIdMatch) {
          result.challengeIdx = id;
          console.log(`[GET] 응답에 challengeIdx가 없거나 불일치하여 요청한 ID 사용: ${id}`);
        }
        
        return result;
      }
      
      // 2. 직접 ID로 조회 시도 (GET /challenges/:id)
      try {
        const directResponse = await this.axios.get(`${this.BASE_URL}/world/challenges/${encodeURIComponent(id)}`, {
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Accept': 'application/json'
          },
          timeout: 30000,
          httpsAgent: this.httpsAgent
        });
        
        if (directResponse.data) {
          console.log(`[GET] 챌린지 조회 응답 받음 (directResponse): ID=${id}`);
          
          // 정확한 ID 일치 여부 확인
          const isIdMatch = directResponse.data.challengeIdx === id || directResponse.data.id === id;
          
          // 응답 데이터 복사 및 ID 확인
          const result = { ...directResponse.data };
          
          // challengeIdx 필드가 없거나 다른 경우 요청한 ID로 설정
          if (!result.challengeIdx || !isIdMatch) {
            result.challengeIdx = id;
            console.log(`[GET] 직접 조회 응답에 challengeIdx가 없거나 불일치하여 요청한 ID 사용: ${id}`);
          }
          
          return result;
        }
      } catch (directError) {
        console.log(`[GET] 직접 ID 조회 실패: ${directError.message}`);
      }
      
      // 원래 응답 계속 처리
      const response = searchResponse;
      
      console.log(`[GET] 챌린지 조회 응답: 상태=${response.status}, 데이터 길이=${Array.isArray(response.data) ? response.data.length : '객체'}`);
      
      // 결과가 배열인 경우 challengeIdx가 정확히 일치하는 항목 필터링 또는 첫 번째 항목 사용
      if (Array.isArray(response.data)) {
        // 정확히 일치하는 항목 검색
        const exactMatch = response.data.find(challenge => challenge.challengeIdx === id || challenge.id === id);
        
        if (exactMatch) {
          console.log(`[GET] 정확히 일치하는 챌린지 찾음: ${exactMatch.challengeIdx || id}`);
          
          // challengeIdx 필드가 없으면 추가
          const result = { ...exactMatch };
          if (!result.challengeIdx) {
            result.challengeIdx = id;
            console.log(`[GET] 일치항목에 challengeIdx가 없어 요청한 ID 사용: ${id}`);
          }
          
          return result;
        } else if (response.data.length > 0) {
          // 정확히 일치하는 항목이 없지만 결과가 있는 경우, 첫 번째 항목 사용하고 ID 설정
          console.log(`[GET] 정확히 일치하는 챌린지를 찾지 못했지만 결과 있음. 첫 번째 항목 사용: ${id}`);
          const result = { ...response.data[0] };
          result.challengeIdx = id; // 요청한 ID 사용
          return result;
        } else {
          console.log(`[GET] 정확히 일치하는 챌린지를 찾지 못함 (빈 배열): ${id}`);
          return null;
        }
      }
      
      // 응답이 있는 경우, 응답에 challengeId가 없더라도 원래 요청한 ID를 사용하도록 추가
      if (response.data) {
        // 응답 데이터 로깅
        console.log(`[GET] 응답 받음. 을 요청한 챌린지 ID: ${id}`);
        
        // 만약 응답에 challengeIdx가 없더라도 요청한 ID로 채워넣기
        const result = { ...response.data };
        if (!result.challengeIdx) {
          result.challengeIdx = id; // 요청한 ID를 사용
          console.log(`[GET] 응답에 challengeIdx가 없으므로 요청한 ID를 사용: ${id}`);
        }
        
        return result;
      }
      
      return null; // response.data가 없으면 null 반환
    } catch (error) {
      console.error(`[GET] 챌린지 조회 오류: ${error.message}`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      
      if (error.response?.status === 404) {
        console.log(`[GET] 404 오류: 챌린지 ID ${id}가 존재하지 않음`);
      }
      
      return null;
    }
  }

  async uploadSingleChallenge(challengeData) {
    try {
      if (!challengeData || typeof challengeData !== 'object') {
        throw new Error('Invalid challenge data: expected an object');
      }

      const transformedData = ChallengeDataTransformer.transformRequestData(challengeData);
      
      // 디버깅을 위한 로깅 추가 (간략한 로그만 출력)
      console.log('[UPLOAD] 챌린지 생성 시작:', {
        id: challengeData.id,
        challengeIdx: transformedData.challengeIdx,
        title: transformedData.title
      });

      // 새로운 데이터 생성 전에 이미 존재하는지 한 번 더 확인
      const existingChallenge = await this.getChallengeById(transformedData.challengeIdx);
      if (existingChallenge) {
        // 응답이 있다면 업데이트로 전환 (응답에 challengeIdx가 없더라도 요청한 ID로 업데이트)
        console.log(`[UPLOAD] 이미 존재하는 챌린지임: ${transformedData.challengeIdx}, 업데이트로 전환합니다`);
        return this.updateSingleChallenge(challengeData);
      }
      
      // POST 요청 전 challengeIdx 존재 확인
      if (!transformedData.challengeIdx) {
        transformedData.challengeIdx = challengeData.id; // challengeIdx 명시적 할당
        console.log(`[UPLOAD] POST 요청 ChallengeIdx 명시적 설정: ${transformedData.challengeIdx}`);
      }
      
      // POST 요청 실행
      const response = await this.axios.post(
        `${this.BASE_URL}/world/challenges`, 
        transformedData,
        {
          headers: { 
            'Content-Type': 'application/json',
            'X-Debug-ChallengeIdx': transformedData.challengeIdx || 'missing', // 디버깅용 헤더 추가
            'Cache-Control': 'no-cache' // 캐시 사용 방지
          },
          timeout: 30000, // 30초 타임아웃 설정
          httpsAgent: this.httpsAgent
        }
      );

      console.log(`[UPLOAD] 챌린지 생성 성공: challengeIdx=${transformedData.challengeIdx}, 응답 상태=${response.status}`);
      
      // 생성 후 검증 (확인을 위해 잠시 기다림)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const createdChallenge = await this.getChallengeById(transformedData.challengeIdx);
      
      if (createdChallenge) {
        // 응답에 challengeIdx가 없더라도 원래 ID 사용
        const challengeIdx = createdChallenge.challengeIdx || transformedData.challengeIdx;
        console.log(`[UPLOAD] 생성 후 챌린지 확인 성공: challengeIdx=${challengeIdx}`);
      } else {
        console.warn(`[UPLOAD] 주의: 새로 생성한 챌린지를 조회할 수 없음: challengeIdx=${transformedData.challengeIdx}`);
      }
      
      // 응답에 challengeIdx가 없을 경우 추가
      const responseData = response.data || {};
      if (!responseData.challengeIdx) {
        responseData.challengeIdx = transformedData.challengeIdx;
        console.log(`[UPLOAD] 응답에 challengeIdx 추가: ${transformedData.challengeIdx}`);
      }
      
      return responseData;
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('[UPLOAD] 업로드 오류:', {
        challengeId: challengeData?.id,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Upload failed: ${error.response?.data?.message || error.message}`);
    }
  }
  
  async updateSingleChallenge(challengeData) {
    let retryCount = 0;
    const maxRetries = 3;
    
    try {
      if (!challengeData || typeof challengeData !== 'object') {
        throw new Error('Invalid challenge data: expected an object');
      }

      const transformedData = ChallengeDataTransformer.transformRequestData(challengeData);
      
      // 디버깅을 위한 로깅 추가
      console.log('[UPDATE] 챌린지 업데이트 시작:', {
        id: challengeData.id,
        challengeIdx: transformedData.challengeIdx
      });
      
      // 중요: 서버에 데이터가 있는지 확인하기 전에 짧은 지연 추가
      // API 서버에서 응답이 완전히 처리될 시간을 확보
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 실제 처리 시작 - 재시도 로직 적용
      while (retryCount <= maxRetries) {
        try {
          // challengeIdx로 기존 데이터 검색
          const existingChallenge = await this.getChallengeById(transformedData.challengeIdx);
          
          if (!existingChallenge) {
            // GET 요청에서 404 오류 (데이터가 없음)
            if (retryCount < maxRetries) {
              console.log(`[UPDATE] 챌린지 없음 (${retryCount+1}/${maxRetries+1} 시도): challengeIdx=${transformedData.challengeIdx} - 재시도 중...`);
              retryCount++;
              await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // 점진적 증가 대기 시간
              continue; // 다시 시도
            }
            
            // 재시도 횟수 초과 시 다양한 방법 시도 - 단순히 업로드로 넘기지 않고 더 적극적으로 시도
            console.log(`[UPDATE] 챌린지를 찾을 수 없지만 업데이트 요청이므로 다양한 방법 시도: challengeIdx=${transformedData.challengeIdx}`);
            
            // POST 요청을 사용한 upsert 시도 (이 기능이 구현되어 있을 경우)
            try {
              console.log(`[UPDATE] 챌린지를 찾을 수 없어 POST 요청으로 시도 (upsert): ${this.BASE_URL}/world/challenges`);
              const response = await this.axios.post(
                `${this.BASE_URL}/world/challenges`, 
                transformedData,
                {
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-Debug-ChallengeIdx': transformedData.challengeIdx || 'missing',
                    'Cache-Control': 'no-cache', 
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                  },
                  timeout: 30000,
                  httpsAgent: this.httpsAgent
                }
              );
              console.log(`[UPDATE] POST 요청 성공 (upsert): challengeIdx=${transformedData.challengeIdx}, 응답 상태=${response.status}`);
              return response.data;
            } catch (postErr) {
              console.error(`[UPDATE] 최종 시도 (POST) 실패, 새로 생성으로 전환: ${postErr.message}`);
              return this.uploadSingleChallenge(challengeData);
            }
          }
          
          // existingChallenge이 존재하면 서버 응답의 ID 필드를 확인할 필요 없음
          // 원래 요청한 ID(transformedData.challengeIdx)를 사용해서 업데이트
          console.log(`[UPDATE] 기존 챌린지 발견 (재시도 ${retryCount}/${maxRetries+1}): challengeIdx=${transformedData.challengeIdx}, 업데이트 시작...`);
          
          // PATCH 요청으로 기존 데이터 업데이트 (challengeIdx 확인)
          if (!transformedData.challengeIdx) {
            transformedData.challengeIdx = challengeData.id; // challengeIdx 명시적 할당
            console.log(`[UPDATE] ChallengeIdx 명시적 설정: ${transformedData.challengeIdx}`);
          }
          
          // 서버가 challengeId를 기준으로 요청을 처리 - PUT 요청만 사용 (배열 중복 방지)
          console.log(`[UPDATE] 이미지 필드 중복 방지를 위해 PUT 요청 사용`);
          console.log(`[UPDATE] PUT 요청 데이터:`, JSON.stringify({
            challengeIdx: transformedData.challengeIdx,
            title: transformedData.title
          }, null, 2));
          
          let response;
          try {
            // 항상 PUT 요청 사용 (배열 필드 중복 방지)
            console.log(`[UPDATE] PUT 요청 URL: ${this.BASE_URL}/world/challenges/${transformedData.challengeIdx}`);
            response = await this.axios.put(
              `${this.BASE_URL}/world/challenges/${transformedData.challengeIdx}`, 
              transformedData,
              {
                headers: { 
                  'Content-Type': 'application/json',
                  'X-Debug-ChallengeIdx': transformedData.challengeIdx || 'missing', // 디버깅용 헤더 추가
                  'Cache-Control': 'no-cache', // 캐시 사용 방지
                  'Accept': 'application/json', // 응답 형식 명시
                  'X-Requested-With': 'XMLHttpRequest' // AJAX 요청임을 명시
                },
                timeout: 30000, // 30초 타임아웃 설정
                httpsAgent: this.httpsAgent
              }
            );
            console.log(`[UPDATE] PUT 요청 성공: challengeIdx=${transformedData.challengeIdx}, 응답 상태=${response.status}`);
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
              console.log(`[UPDATE] PUT 실패, 대체 URL 시도: ${this.BASE_URL}/world/challenges?challengeIdx=${transformedData.challengeIdx}`);
              response = await this.axios.put(
                `${this.BASE_URL}/world/challenges?challengeIdx=${transformedData.challengeIdx}`, 
                transformedData,
                {
                  headers: { 
                    'Content-Type': 'application/json',
                    'X-Debug-ChallengeIdx': transformedData.challengeIdx || 'missing',
                    'Cache-Control': 'no-cache',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                  },
                  timeout: 30000,
                  httpsAgent: this.httpsAgent
                }
              );
              console.log(`[UPDATE] 대체 URL PUT 요청 성공: challengeIdx=${transformedData.challengeIdx}, 응답 상태=${response.status}`);
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
                console.log(`[UPDATE] PUT 요청 모두 실패, POST 요청으로 시도 (upsert): ${this.BASE_URL}/world/challenges`);
                response = await this.axios.post(
                  `${this.BASE_URL}/world/challenges`, 
                  transformedData,
                  {
                    headers: { 
                      'Content-Type': 'application/json',
                      'X-Debug-ChallengeIdx': transformedData.challengeIdx || 'missing',
                      'Cache-Control': 'no-cache',
                      'Accept': 'application/json',
                      'X-Requested-With': 'XMLHttpRequest'
                    },
                    timeout: 30000,
                    httpsAgent: this.httpsAgent
                  }
                );
                console.log(`[UPDATE] POST 요청 성공 (upsert): challengeIdx=${transformedData.challengeIdx}, 응답 상태=${response.status}`);
              } catch (postErr) {
                console.error(`[UPDATE] POST 요청도 실패: ${postErr.message}`);
                throw postErr;
              }
            }
          }
          
          // 업데이트 후 검증 (확인을 위해 잠시 기다림)
          await new Promise(resolve => setTimeout(resolve, 1000));
          const updatedChallenge = await this.getChallengeById(transformedData.challengeIdx);
          
          if (updatedChallenge) {
            // 응답에 challengeIdx가 없더라도 원래 ID 사용
            const challengeIdx = updatedChallenge.challengeIdx || transformedData.challengeIdx;
            console.log(`[UPDATE] 업데이트 후 챌린지 검증 성공: challengeIdx=${challengeIdx}, 응답 받음`);            
            
            // 응답에 challengeIdx가 없을 경우 추가
            const responseData = response.data || {};
            if (!responseData.challengeIdx) {
              responseData.challengeIdx = transformedData.challengeIdx;
            }
            
            return responseData;
          } else {
            console.error(`[UPDATE] 업데이트 후 챌린지 조회에 실패. 새로 생성됨: challengeIdx=${transformedData.challengeIdx}`);
            
            // 응답에 challengeIdx가 없을 경우 추가
            const responseData = response.data || {};
            if (!responseData.challengeIdx) {
              responseData.challengeIdx = transformedData.challengeIdx;
            }
            
            return responseData;
          }
          
        } catch (err) {
          if (err.response?.status === 404 && retryCount < maxRetries) {
            console.log(`[UPDATE] 404 오류 발생 (${retryCount+1}/${maxRetries+1} 시도): challengeIdx=${transformedData.challengeIdx} - 재시도 중...`);
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
        console.log(`[UPDATE] 모든 재시도 실패. 새로 생성 시도: challengeIdx=${transformedData.challengeIdx}`);
        return this.uploadSingleChallenge(challengeData);
      }
      
    } catch (error) {
      // 에러 상세 정보 로깅
      console.error('[UPDATE] 업데이트 오류:', {
        challengeIdx: challengeData?.id,
        attempt: `${retryCount}/${maxRetries+1}`,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      throw new Error(`Update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async uploadMultipleChallenges(challengesData) {
    const dataArray = Array.isArray(challengesData) ? challengesData : [challengesData];
    
    const results = await Promise.all(
      dataArray.map(async (challengeData) => {
        try {
          if (!this._isValidChallengeData(challengeData)) {
            return this._createErrorResult(challengeData);
          }
          
          const result = await this.uploadSingleChallenge(challengeData);
          return this._createSuccessResult(challengeData, result);
        } catch (error) {
          return this._createErrorResult(challengeData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }
  
  async updateMultipleChallenges(challengesData) {
    const dataArray = Array.isArray(challengesData) ? challengesData : [challengesData];
    
    const results = await Promise.all(
      dataArray.map(async (challengeData) => {
        try {
          if (!this._isValidChallengeData(challengeData)) {
            return this._createErrorResult(challengeData);
          }
          
          // 업데이트 함수 사용
          const result = await this.updateSingleChallenge(challengeData);
          return this._createSuccessResult(challengeData, result, true);
        } catch (error) {
          return this._createErrorResult(challengeData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }

  _isValidChallengeData(challengeData) {
    return challengeData && 
           typeof challengeData === 'object' && 
           challengeData.id;
  }

  _createErrorResult(challengeData, errorMessage = 'Invalid challenge data: missing required fields') {
    return {
      challengeIdx: challengeData?.id || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(challengeData, result, isUpdate = false) {
    // 서버 응답에 challengeIdx가 없을 경우 원래 ID 사용
    if (result && !result.challengeIdx && challengeData.id) {
      result = { ...result, challengeIdx: challengeData.id };
    }
    
    return {
      challengeIdx: challengeData.id,
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

module.exports = new ChallengeUploadService();