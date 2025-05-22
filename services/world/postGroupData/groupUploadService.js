// services/groupUploadService.js
const axios = require('axios');
const https = require('https');
const GroupDataTransformer = require('./utils/groupDataTransformer');

// SSL 인증서 검증 비활성화
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

class GroupUploadService {
  constructor() {
    this.BASE_URL = 'https://api.staging.ahhaohho.com:4222';
  }
  
  async getGroupByTitle(title) {
    if (!title) {
      throw new Error('Title is required to search for a group');
    }
    
    try {
      const response = await axios.get(`${this.BASE_URL}/world/groups?title=${encodeURIComponent(title)}`, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      
      // 결과가 배열인 경우 제목이 정확히 일치하는 항목만 필터링
      if (Array.isArray(response.data)) {
        const exactMatch = response.data.find(group => group.title === title);
        return exactMatch || null;
      }
      
      return response.data || null;
    } catch (error) {
      console.error(`Error fetching group by title: ${error.message}`);
      return null;
    }
  }

  async uploadSingleGroup(groupData) {
    if (!groupData || typeof groupData !== 'object') {
      throw new Error('Invalid group data: expected an object');
    }

    const transformedData = GroupDataTransformer.transformRequestData(groupData);
    console.log('Transformed Data:', transformedData);

    try {
      const response = await axios.post(`${this.BASE_URL}/world/groups`, transformedData, {
        headers: { 'Content-Type': 'application/json' },
        httpsAgent
      });
      return response.data;
    } catch (error) {
      throw new Error(`HTTP error! status: ${error.response?.status || 'unknown'}`);
    }
  }
  
  async updateSingleGroup(groupData) {
    if (!groupData || typeof groupData !== 'object') {
      throw new Error('Invalid group data: expected an object');
    }
    
    const transformedData = GroupDataTransformer.transformRequestData(groupData);
    console.log('Transformed Update Data:', transformedData);
    
    // 그룹명으로 기존 데이터 검색
    const existingGroup = await this.getGroupByTitle(transformedData.title);
    
    if (!existingGroup) {
      console.log(`Group with title '${transformedData.title}' not found, creating a new one`);
      // 기존 데이터가 없으면 새로 생성
      return this.uploadSingleGroup(groupData);
    }
    
    console.log(`Found existing group with title '${transformedData.title}', ID: ${existingGroup._id}`);
    
    try {
      // PATCH 요청으로 기존 데이터 업데이트
      const response = await axios.patch(
        `${this.BASE_URL}/world/groups/${existingGroup._id}`, 
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
  
  async updateMultipleGroups(groupsData) {
    const dataArray = Array.isArray(groupsData) ? groupsData : [groupsData];
    
    const results = await Promise.all(
      dataArray.map(async (groupData) => {
        try {
          if (!this._isValidGroupData(groupData)) {
            return this._createErrorResult(groupData);
          }
          
          // 업데이트 함수 사용
          const result = await this.updateSingleGroup(groupData);
          return this._createSuccessResult(groupData, result, true);
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

  _createSuccessResult(groupData, result, isUpdate = false) {
    return {
      groupId: groupData["그룹명"],
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

module.exports = new GroupUploadService();