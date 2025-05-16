/* global process, __dirname */

const path = require('path');
const { transformSingleFile } = require('./transformToMongo');

async function main() {
  const dataDir = path.join(__dirname, 'contentsRawData');
  
  // 가장 최신 파일 변환 테스트
  const inputFile = path.join(dataDir, 'partsData-updateAt20250509.json');
  const outputFile = path.join(dataDir, 'mongo-partsData-updateAt20250509.json');
  
  console.log(`변환 시작: ${inputFile} -> ${outputFile}`);
  
  try {
    await transformSingleFile(inputFile, outputFile);
    console.log('테스트 변환 성공!');
  } catch (error) {
    console.error('테스트 변환 실패:', error);
  }
}

main().catch(error => console.error('오류 발생:', error));