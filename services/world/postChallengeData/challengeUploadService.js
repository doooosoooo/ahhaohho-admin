// services/challengeUploadService.js
const axios = require('axios');
const ChallengeDataTransformer = require('./utils/challengeDataTransformer');

class ChallengeUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
  }

  async uploadSingleChallenge(challengeData) {
    if (!challengeData || typeof challengeData !== 'object') {
      throw new Error('Invalid challenge data: expected an object');
    }

    const transformedData = ChallengeDataTransformer.transformRequestData(challengeData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/challenges`, transformedData, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
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

  _createSuccessResult(challengeData, result) {
    return {
      challengeId: challengeData["챌린지명"],
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

module.exports = new ChallengeUploadService();