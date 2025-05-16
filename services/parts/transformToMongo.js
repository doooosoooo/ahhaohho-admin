/* global process, __dirname */

const fs = require('fs').promises;
const path = require('path');

/**
 * 파일 데이터를 MongoDB 형식으로 변환하는 함수
 * @param {string} inputFilePath - 변환할 JSON 파일 경로
 * @param {string} outputFilePath - 출력할 JSON 파일 경로
 */
async function transformToMongo(inputFilePath, outputFilePath) {
  try {
    // 파일 읽기
    const data = await fs.readFile(inputFilePath, 'utf8');
    const jsonData = JSON.parse(data);
    
    // MongoDB 형식으로 변환
    const transformedData = jsonData.map(record => {
      // 기본 필드 추출
      const name = record.파츠명 || record.name || '';
      const type = record.종류 || record.type || 'object';
      const group = record.그룹 || record.group || 'spatial';
      const category = record.카테고리 || record.category || null;
      const color = record.색상 || record.color || null;
      const sequence = record.순서 || record.sequence || 0;
      const tracking = record.추적 || record.tracking || false;
      
      // Assets 배열에서 이미지 URL 가져오기 (있는 경우)
      let assetUrl = '';
      
      // 1. Assets 필드 확인
      if (record.Assets && Array.isArray(record.Assets) && record.Assets.length > 0) {
        if (record.Assets[0].url) {
          assetUrl = record.Assets[0].url;
        }
      }
      
      // 2. assetUrl 필드가 이미 있는 경우
      if (record.assetUrl && !assetUrl) {
        assetUrl = record.assetUrl;
      }
      
      // 3. url 필드가 있는 경우
      if (record.url && !assetUrl) {
        assetUrl = record.url;
      }
      
      // 4. 이미지 필드가 있는 경우
      if (record.이미지 && Array.isArray(record.이미지) && record.이미지.length > 0) {
        if (record.이미지[0].url) {
          assetUrl = record.이미지[0].url;
        }
      }
      
      // MongoDB 형식으로 변환된 객체 생성
      return {
        name: name,
        spec: {
          group: group,
          type: type,
          color: color,
          category: category
        },
        sequence: Number(sequence) || 0,
        tracking: tracking,
        assetUrl: assetUrl
      };
    });
    
    // 변환된 데이터 저장
    await fs.writeFile(outputFilePath, JSON.stringify(transformedData, null, 2), 'utf8');
    console.log(`변환 완료: ${outputFilePath}`);
    
    return transformedData;
  } catch (error) {
    console.error('데이터 변환 중 오류 발생:', error);
    throw error;
  }
}

/**
 * 특정 디렉토리의 모든 partsData 파일을 변환
 * @param {string} inputDir - 입력 디렉토리
 * @param {string} outputDir - 출력 디렉토리
 */
async function transformAllFiles(inputDir, outputDir) {
  try {
    // 디렉토리 확인 및 생성
    await fs.mkdir(outputDir, { recursive: true });
    
    // 파일 목록 가져오기
    const files = await fs.readdir(inputDir);
    const partsDataFiles = files.filter(file => file.startsWith('partsData-updateAt'));
    
    if (partsDataFiles.length === 0) {
      console.log('변환할 partsData 파일이 없습니다.');
      return;
    }
    
    // 각 파일 변환
    for (const file of partsDataFiles) {
      const inputFilePath = path.join(inputDir, file);
      const outputFilePath = path.join(outputDir, `mongo-${file}`);
      
      await transformToMongo(inputFilePath, outputFilePath);
      console.log(`${file} 변환 완료`);
    }
    
    console.log('모든 파일 변환 완료');
  } catch (error) {
    console.error('변환 작업 중 오류 발생:', error);
  }
}

/**
 * 단일 파일 변환 실행
 */
async function transformSingleFile(inputFilePath, outputFilePath) {
  try {
    await transformToMongo(inputFilePath, outputFilePath);
    console.log('변환 성공!');
  } catch (error) {
    console.error('변환 실패:', error);
  }
}

// 명령줄 인자로 실행하는 경우
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // 기본 경로 사용
    const dataDir = path.join(__dirname, 'contentsRawData');
    const outputDir = path.join(__dirname, 'contentsRawData', 'mongo');
    
    transformAllFiles(dataDir, outputDir)
      .then(() => console.log('변환 작업 완료'))
      .catch(err => console.error('변환 작업 실패:', err));
  } else if (args.length === 1) {
    // 입력 파일만 제공된 경우
    const inputFile = args[0];
    const outputFile = inputFile.replace('.json', '-mongo.json');
    
    transformSingleFile(inputFile, outputFile)
      .then(() => console.log(`변환 완료: ${outputFile}`))
      .catch(err => console.error('변환 실패:', err));
  } else if (args.length >= 2) {
    // 입력 및 출력 파일 모두 제공된 경우
    const inputFile = args[0];
    const outputFile = args[1];
    
    transformSingleFile(inputFile, outputFile)
      .then(() => console.log(`변환 완료: ${outputFile}`))
      .catch(err => console.error('변환 실패:', err));
  }
}

module.exports = {
  transformToMongo,
  transformAllFiles,
  transformSingleFile
};