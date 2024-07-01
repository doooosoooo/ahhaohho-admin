const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');
const MaterialRegistryDTO = require('../dtos/materialRegistryDTO');

// materials 데이터를 가공하는 함수
function processMaterialsData(data) {
    return data.map((item, index) => {
        console.log(`Processing item ${index}:`, item);

        try {
            const materialDTO = new MaterialRegistryDTO({
                id: item.id, // Airtable의 record ID
                material: item["재료명"] || 'Unknown',
                materialImage: item["재료사진"] && item["재료사진"][0] ? item["재료사진"][0].url : null,
                material_tips: []
            });

            // Add up to 3 preparation tips
            for (let i = 1; i <= 3; i++) {
                const tipDescription = item[`준비물Tip ${i} 설명`];
                const tipImages = item[`준비물Tip 이미지 ${i}`];
                
                if (tipDescription && tipImages) {
                    tipImages.forEach(tipImage => {
                        materialDTO.material_tips.push({
                            imageUrl: tipImage.url || null,
                            tip: tipDescription || null
                        });
                    });
                }
            }

            // DTO 유효성 검사
            MaterialRegistryDTO.validate(materialDTO);
            console.log(`Processed item ${index}:`, materialDTO);
            return materialDTO;
        } catch (validationError) {
            console.log(`Invalid item ${index}, skipping:`, validationError.message);
            return null;
        }
    }).filter(item => item !== null);
}

async function main() {
    try {
        // materials 데이터 처리
        const dirPath = path.resolve(__dirname, './contentsRawData'); // JSON 파일이 있는 디렉터리 경로
        createDirectoryIfNotExists(dirPath); // 디렉토리 생성
        const materialsPattern = /materialsData-updateAt(\d{8})\.json$/; // 파일명 패턴 (예: materialsData-updateAt20240627.json)
        console.log(`Looking for files in: ${dirPath} with pattern: ${materialsPattern}`);
        const latestMaterialsFile = getFileByDatePattern(dirPath, materialsPattern); // 최신 파일 찾기
        if (!latestMaterialsFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest materials file: ${latestMaterialsFile}`);

        const materialsFilePath = path.join(dirPath, latestMaterialsFile);
        console.log(`Reading file: ${materialsFilePath}`);
        const materialsData = await readDataFromFile(materialsFilePath); // 최신 파일 읽기
        console.log('Raw Materials Data:', JSON.stringify(materialsData, null, 2));

        const processedMaterialsData = processMaterialsData(materialsData); // 데이터를 가공
        console.log('Processed Materials Data:', JSON.stringify(processedMaterialsData, null, 2));

        if (processedMaterialsData.length > 0) {
            console.log(`Sending data to API: https://api.dev.doosoo.xyz:4242/manager/reg_material`);
            const materialResponses = await sendDataToApi(processedMaterialsData, 'https://api.dev.doosoo.xyz:4242/manager/reg_material'); // 백엔드 API URL을 설정하세요.

            // 반환된 데이터 로그 출력
            console.log('Material Responses:', JSON.stringify(materialResponses, null, 2));

            // 준비물 ID 맵 생성
            if (Array.isArray(materialResponses)) {
                const materialIdMap = {};
                for (const response of materialResponses) {
                    materialIdMap[response.id] = response._id;
                }

                // ID 맵을 파일로 저장
                const idMapPath = path.join(__dirname, 'materialIdMap.json');
                console.log(`Writing ID map to file: ${idMapPath}`);
                fs.writeFileSync(idMapPath, JSON.stringify(materialIdMap));
            } else {
                console.error('Error: Expected an array from sendDataToApi, but got:', materialResponses);
            }
        } else {
            console.log('No valid data to send to the API.');
        }

    } catch (error) {
        console.error('Error:', error); // 전체 과정 중 에러 발생 시 출력
    }
}

main(); // 메인 함수 실행
