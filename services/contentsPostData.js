const path = require('path');
const { getFileByDatePattern, readDataFromFile, sendDataToApi, createDirectoryIfNotExists } = require('../middlewares/utils');

// 데이터를 가공하는 함수
function processData(data) {
    return data.map(function(item) {
        const fields = item.fields;

        // 준비 Tip 데이터를 가공
        const preparationTip = {
            image: fields["준비 Tip 1_이미지"] ? fields["준비 Tip 1_이미지"][0].url : null,
            comment: fields["준비 Tip 1_설명"] || null,
        };

        // 활동 가이드 데이터를 가공
        const activeGuide = [];
        for (let i = 1; i <= 6; i++) {
            if (fields[`활동 가이드 ${i}_이미지`]) {
                fields[`활동 가이드 ${i}_이미지`].forEach(function(img) {
                    activeGuide.push({
                        imageUrl: img.url,
                        guide: fields[`활동 가이드 ${i}_설명`] || null,
                        tip: fields[`활동 가이드_${i}_팁`] || null,
                    });
                });
            }
        }

        // materials가 배열이 아니면 배열로 변환
        const materials = Array.isArray(fields["준비물 데이터"]) ? fields["준비물 데이터"] : [];

        // 최종 데이터를 반환
        return {
            title: fields["*액티비티 타이틀"] || null,
            createrName: fields["Created By"] ? fields["Created By"].name : null,
            thumbnailUrl: fields["*액티비티 썸네일"] ? fields["*액티비티 썸네일"][0].url : null,
            category_main: fields["*메인 장르"] ? fields["*메인 장르"][0] : null,
            category_sub: fields["*서브 장르"] ? fields["*서브 장르"][0] : null,
            activePlan: fields["*활동 설명"] || null,
            materials: materials, // materials의 _id를 문자열로 참조
            preparationTip: [preparationTip],
            activeGuide: activeGuide,
        };
    });
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData'); // JSON 파일이 있는 디렉터리 경로
        createDirectoryIfNotExists(dirPath); // 디렉토리 생성
        const pattern = /contentsData-updateAt(\d{8})\.json$/; // 파일명 패턴 (예: contentsData-updateAt20240627.json)
        console.log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = getFileByDatePattern(dirPath, pattern); // 최신 파일 찾기
        const data = await readDataFromFile(path.join(dirPath, latestFile)); // 최신 파일 읽기
        const processedData = processData(data); // 데이터를 가공
        await sendDataToApi(processedData, 'https://api.dev.doosoo.xyz:4242/manager/reg_content'); // 백엔드 API URL을 설정하세요.
    } catch (error) {
        console.error('Error:', error); // 전체 과정 중 에러 발생 시 출력
    }
}

main(); // 메인 함수 실행
