// services/postGuideUploadService.js
const axios = require('axios');
const PostGuideDataTransformer = require('./utils/postGuideDataTransformer');

class PostGuideUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
  }

  async uploadSinglePostGuide(postGuideData) {
    if (!postGuideData || typeof postGuideData !== 'object') {
      throw new Error('Invalid post guide data: expected an object');
    }

    const transformedData = PostGuideDataTransformer.transformRequestData(postGuideData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/challenges/postGuide`, transformedData, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }

  async uploadMultiplePostGuides(postGuidesData) {
    const dataArray = Array.isArray(postGuidesData) ? postGuidesData : [postGuidesData];
    
    const results = await Promise.all(
      dataArray.map(async (postGuideData) => {
        try {
          if (!this._isValidPostGuideData(postGuideData)) {
            return this._createErrorResult(postGuideData);
          }
          
          const result = await this.uploadSinglePostGuide(postGuideData);
          return this._createSuccessResult(postGuideData, result);
        } catch (error) {
          return this._createErrorResult(postGuideData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }

  _isValidPostGuideData(postGuideData) {
    return postGuideData && 
           typeof postGuideData === 'object' && 
           postGuideData["id"];  // id만 필수로 체크
  }

  _createErrorResult(postGuideData, errorMessage = 'Invalid post guide data: missing required fields') {
    return {
      challengeId: postGuideData?.["id"] || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(postGuideData, result) {
    return {
      challengeId: postGuideData["id"],
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

module.exports = new PostGuideUploadService();