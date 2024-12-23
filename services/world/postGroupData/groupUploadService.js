// services/groupUploadService.js
const axios = require('axios');
const GroupDataTransformer = require('./utils/groupDataTransformer');

class GroupUploadService {
  constructor() {
    this.BASE_URL = 'https://develop.ahhaohho.com:4222';
  }

  async uploadSingleGroup(groupData) {
    if (!groupData || typeof groupData !== 'object') {
      throw new Error('Invalid group data: expected an object');
    }

    const transformedData = GroupDataTransformer.transformRequestData(groupData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/groups`, transformedData, {
        headers: { 'Content-Type': 'application/json' }
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }

  async uploadMultipleGroups(groupsData) {
    const dataArray = Array.isArray(groupsData) ? groupsData : [groupsData];
    
    const results = await Promise.all(
      dataArray.map(async (groupData) => {
        try {
          if (!this._isValidGroupData(groupData)) {
            return this._createErrorResult(groupData);
          }
          
          const result = await this.uploadSingleGroup(groupData);
          return this._createSuccessResult(groupData, result);
        } catch (error) {
          return this._createErrorResult(groupData, error.message);
        }
      })
    );

    return this._createSummary(results);
  }

  _isValidGroupData(groupData) {
    return groupData && 
           typeof groupData === 'object' && 
           groupData["그룹명"];
  }

  _createErrorResult(groupData, errorMessage = 'Invalid group data: missing 그룹명 or invalid format') {
    return {
      groupId: groupData?.["그룹명"] || 'unknown',
      status: 'error',
      error: errorMessage
    };
  }

  _createSuccessResult(groupData, result) {
    return {
      groupId: groupData["그룹명"],
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

module.exports = new GroupUploadService();