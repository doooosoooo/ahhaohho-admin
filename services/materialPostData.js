const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

// materials 데이터를 가공하는 함수
function processMaterialsData(data) {
    return data.map(function(item) {
        const fields = item.fields;

        // 최종 데이터를 반환
        return {
            id: item.id,
            material: fields["재료명"] || null,
            materialImage: fields["재료사진"] ? fields["재료사진"][0].url : null,
            material_tips: fields["준비물Tip 이미지 1"] ? fields["준비물Tip 1 설명"].map(tip => ({
                imageUrl: null,
                tip: null,
            })) : []
        };
    });
}

// 메인 함수
async function main() {
    try {
        // materials 데이터 처리
        const dirPath = path.resolve(__dirname, './contentsRawData'); // JSON 파일이 있는 디렉터리 경로
        createDirectoryIfNotExists(dirPath); // 디렉토리 생성
        const materialsPattern = /materialsData-updateAt(\d{8})\.json$/; // 파일명 패턴 (예: materialsData-updateAt20240627.json)
        console.log(`Looking for files in: ${dirPath} with pattern: ${materialsPattern}`);
        const latestMaterialsFile = getFileByDatePattern(dirPath, materialsPattern); // 최신 파일 찾기
        const materialsData = await readDataFromFile(path.join(dirPath, latestMaterialsFile)); // 최신 파일 읽기
        const processedMaterialsData = processMaterialsData(materialsData); // 데이터를 가공
        const materialResponses = await sendDataToApi(processedMaterialsData, 'https://api.dev.doosoo.xyz:4242/manager/reg_material'); // 백엔드 API URL을 설정하세요.

        // 준비물 ID 맵 생성
        const materialIdMap = {};
        for (const response of materialResponses) {
            materialIdMap[response.id] = response._id;
        }

        // ID 맵을 파일로 저장
        fs.writeFileSync(path.join(__dirname, 'materialIdMap.json'), JSON.stringify(materialIdMap));

    } catch (error) {
        console.error('Error:', error); // 전체 과정 중 에러 발생 시 출력
    }
}

main(); // 메인 함수 실행
