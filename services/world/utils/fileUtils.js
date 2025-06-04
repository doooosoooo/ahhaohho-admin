// utils/fileUtils.js - 파일 관련 유틸리티 함수들
const fs = require('fs').promises;
const path = require('path');

/**
 * 주어진 prefix에 대해 가장 최신의 updateAt 파일을 찾습니다.
 * @param {string} dataDir - 데이터 디렉토리 경로
 * @param {string} prefix - 파일명 prefix (예: 'worldData', 'chatData' 등)
 * @returns {Promise<string>} 최신 파일의 전체 경로
 */
async function findLatestDataFile(dataDir, prefix) {
  try {
    const files = await fs.readdir(dataDir);
    const pattern = new RegExp(`${prefix}-updateAt(\\d{8})\\.json`);
    
    const matchingFiles = files
      .map(file => {
        const match = file.match(pattern);
        return match ? { file, date: match[1] } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.date.localeCompare(a.date)); // 날짜 내림차순 정렬
    
    if (matchingFiles.length === 0) {
      throw new Error(`No data files found for prefix: ${prefix}`);
    }
    
    const latestFile = matchingFiles[0];
    console.log(`Found latest ${prefix} file: ${latestFile.file} (${latestFile.date})`);
    return path.join(dataDir, latestFile.file);
  } catch (error) {
    throw new Error(`Error finding latest data file for ${prefix}: ${error.message}`);
  }
}

/**
 * 최신 데이터 파일을 로드합니다.
 * @param {string} dataDir - 데이터 디렉토리 경로  
 * @param {string} prefix - 파일명 prefix
 * @returns {Promise<Object>} 파싱된 JSON 데이터
 */
async function loadLatestDataFile(dataDir, prefix) {
  try {
    const filePath = await findLatestDataFile(dataDir, prefix);
    const rawData = await fs.readFile(filePath, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    throw new Error(`Error loading latest data file for ${prefix}: ${error.message}`);
  }
}

/**
 * 주어진 prefix에 대해 모든 기존 파일들을 삭제합니다.
 * @param {string} dataDir - 데이터 디렉토리 경로
 * @param {string} prefix - 파일명 prefix
 * @returns {Promise<number>} 삭제된 파일 수
 */
async function deleteOldDataFiles(dataDir, prefix) {
  try {
    const files = await fs.readdir(dataDir);
    const pattern = new RegExp(`${prefix}-updateAt\\d{8}\\.json`);
    let deletedCount = 0;
    
    for (const file of files) {
      if (pattern.test(file)) {
        await fs.unlink(path.join(dataDir, file));
        deletedCount++;
      }
    }
    
    return deletedCount;
  } catch (error) {
    throw new Error(`Error deleting old data files for ${prefix}: ${error.message}`);
  }
}

module.exports = {
  findLatestDataFile,
  loadLatestDataFile,
  deleteOldDataFiles
};