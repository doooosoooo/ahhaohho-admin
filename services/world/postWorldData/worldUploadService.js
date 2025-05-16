// services/worldUploadService.js
const axios = require('axios');
const https = require('https');
const WorldDataTransformer = require('./utils/worldDataTransformer');

// SSL 인증서 검증 비활성화
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class WorldUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
  }
  
  async getWorldByTitle(title) {
    if (!title) {
      throw new Error('Title is required to search for a world');
    }
    
    try {
      const response = await axios.get(`${this.BASE_URL}/world?title=${encodeURIComponent(title)}`, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      
      // 결과가 배열인 경우 제목이 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(world => world.title === title);
        return exactMatch || null;
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`Error fetching world by title: ${error.message}`);
      return null;
    }
  }

  async uploadSingleWorld(worldData) {
    if (!worldData || typeof worldData !== 'object') {
      throw new Error('Invalid world data: expected an object');
    }

    const transformedData = WorldDataTransformer.transformRequestData(worldData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world`, transformedData, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }
  
  async updateSingleWorld(worldData) {
    if (!worldData || typeof worldData !== 'object') {
      throw new Error('Invalid world data: expected an object');
    }
    
    const transformedData = WorldDataTransformer.transformRequestData(worldData);
    console.log('Transformed Update Data:', transformedData);
    
    // 월드명으로 기존 데이터 검색
    const existingWorld = await this.getWorldByTitle(transformedData.title);
    
    if (!existingWorld) {
      console.log(`World with title '${transformedData.title}' not found, creating a new one`);
      // 기존 데이터가 없으면 새로 생성
      return this.uploadSingleWorld(worldData);
    }
    
    console.log(`Found existing world with title '${transformedData.title}', ID: ${existingWorld._id}`);
    
    try {
      // PATCH 요청으로 기존 데이터 업데이트
      const response = await axios.patch(
        `${this.BASE_URL}/world/${existingWorld._id}`, 
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
}

module.exports = new WorldUploadService();