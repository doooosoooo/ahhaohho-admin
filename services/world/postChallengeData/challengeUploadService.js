// services/challengeUploadService.js
const axios = require('axios');
const https = require('https');
const ChallengeDataTransformer = require('./utils/challengeDataTransformer');

// SSL 인증서 검증 비활성화
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class ChallengeUploadService {
  constructor() {
    this.BASE_URL = 'https://api.staging.ahhaohho.com';
  }
  
  async getChallengeByTitle(title) {
    if (!title) {
      throw new Error('Title is required to search for a challenge');
    }
    
    try {
      const response = await axios.get(`${this.BASE_URL}/world/challenges?title=${encodeURIComponent(title)}`, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      
      // 결과가 배열인 경우 제목이 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(challenge => challenge.title === title);
        return exactMatch || null;
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`Error fetching challenge by title: ${error.message}`);
      return null;
    }
  }

  async uploadSingleChallenge(challengeData) {
    if (!challengeData || typeof challengeData !== 'object') {
      throw new Error('Invalid challenge data: expected an object');
    }

    const transformedData = ChallengeDataTransformer.transformRequestData(challengeData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/challenges`, transformedData, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }
  
  async updateSingleChallenge(challengeData) {
    if (!challengeData || typeof challengeData !== 'object') {
      throw new Error('Invalid challenge data: expected an object');
    }
    
    const transformedData = ChallengeDataTransformer.transformRequestData(challengeData);
    console.log('Transformed Update Data:', transformedData);
    
    // 챌린지명으로 기존 데이터 검색
    const existingChallenge = await this.getChallengeByTitle(transformedData.title);
    
    if (!existingChallenge) {
      console.log(`Challenge with title '${transformedData.title}' not found, creating a new one`);
      // 기존 데이터가 없으면 새로 생성
      return this.uploadSingleChallenge(challengeData);
    }
    
    console.log(`Found existing challenge with title '${transformedData.title}', ID: ${existingChallenge._id}`);
    
    try {
      // PATCH 요청으로 기존 데이터 업데이트
      const response = await axios.patch(
        `${this.BASE_URL}/world/challenges/${existingChallenge._id}`, 
        transformedData, 
        { 
          headers: { 'Content-Type': 'application/json' },
          httpsAgent
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Update HTTP error! status: ${error.response?.status || 'unknown'}`);
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
           challengeData["챌린지명"] &&
           challengeData["챌린지 소개 텍스트"];
  }

  _createErrorResult(challengeData, errorMessage = 'Invalid challenge data: missing required fields') {
    return {
      challengeId: challengeData?.["챌린지명"] || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(challengeData, result, isUpdate = false) {
    return {
      challengeId: challengeData["챌린지명"],
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