// services/worldUploadService.js
const axios = require('axios');
const WorldDataTransformer = require('./utils/worldDataTransformer');

class WorldUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
  }

  async uploadSingleWorld(worldData) {
    if (!worldData || typeof worldData !== 'object') {
      throw new Error('Invalid world data: expected an object');
    }

    const transformedData = WorldDataTransformer.transformRequestData(worldData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world`, transformedData, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
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

  _createSuccessResult(worldData, result) {
    return {
      worldId: worldData["월드명"],
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

module.exports = new WorldUploadService();