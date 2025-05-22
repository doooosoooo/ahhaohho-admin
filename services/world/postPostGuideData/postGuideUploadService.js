// services/postGuideUploadService.js
const axios = require('axios');
const https = require('https');
const PostGuideDataTransformer = require('./utils/postGuideDataTransformer');

// SSL 인증서 검증 비활성화
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class PostGuideUploadService {
  constructor() {
    this.BASE_URL = 'https://api.staging.ahhaohho.com';
  }
  
  async getPostGuideById(id) {
    if (!id) {
      throw new Error('ID is required to search for a post guide');
    }
    
    try {
      const response = await axios.get(`${this.BASE_URL}/world/challenges/postGuide?id=${encodeURIComponent(id)}`, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      
      // 결과가 배열인 경우 ID가 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(postGuide => postGuide.id === id);
        return exactMatch || null;
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`Error fetching post guide by id: ${error.message}`);
      return null;
    }
  }

  async uploadSinglePostGuide(postGuideData) {
    if (!postGuideData || typeof postGuideData !== 'object') {
      throw new Error('Invalid post guide data: expected an object');
    }

    const transformedData = PostGuideDataTransformer.transformRequestData(postGuideData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/challenges/postGuide`, transformedData, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }
  
  async updateSinglePostGuide(postGuideData) {
    if (!postGuideData || typeof postGuideData !== 'object') {
      throw new Error('Invalid post guide data: expected an object');
    }
    
    const transformedData = PostGuideDataTransformer.transformRequestData(postGuideData);
    console.log('Transformed Update Data:', transformedData);
    
    // ID로 기존 데이터 검색
    const existingPostGuide = await this.getPostGuideById(transformedData.id);
    
    if (!existingPostGuide) {
      console.log(`Post guide with id '${transformedData.id}' not found, creating a new one`);
      // 기존 데이터가 없으면 새로 생성
      return this.uploadSinglePostGuide(postGuideData);
    }
    
    console.log(`Found existing post guide with id '${transformedData.id}', _id: ${existingPostGuide._id}`);
    
    try {
      // PATCH 요청으로 기존 데이터 업데이트
      const response = await axios.patch(
        `${this.BASE_URL}/world/challenges/postGuide/${existingPostGuide._id}`, 
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
  
  async updateMultiplePostGuides(postGuidesData) {
    const dataArray = Array.isArray(postGuidesData) ? postGuidesData : [postGuidesData];
    
    const results = await Promise.all(
      dataArray.map(async (postGuideData) => {
        try {
          if (!this._isValidPostGuideData(postGuideData)) {
            return this._createErrorResult(postGuideData);
          }
          
          // 업데이트 함수 사용
          const result = await this.updateSinglePostGuide(postGuideData);
          return this._createSuccessResult(postGuideData, result, true);
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

  _createSuccessResult(postGuideData, result, isUpdate = false) {
    return {
      challengeId: postGuideData["id"],
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

module.exports = new PostGuideUploadService();