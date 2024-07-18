const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');
const contentRegistryDTO = require('../dtos/contentRegistryDTO');

function processData(data) {
    return data.map(function (item) {
        const preparationTip = [];
        const activeGuide = [];

        // 준비 Tip 데이터를 가공 (최대 3개)
        for (let i = 1; i <= 3; i++) {
            const tipImages = item[`준비 Tip ${i}_이미지`];
            const tipDescription = item[`준비 Tip ${i}_설명`];

            if (tipImages && Array.isArray(tipImages) && tipImages.length > 0) {
                preparationTip.push({
                    imageUrl: tipImages[0].url,  // URL 문자열만 사용
                    comment: tipDescription || null,
                });
            }
        }

        // 활동 가이드 데이터를 가공 (최대 9개)
        for (let i = 1; i <= 9; i++) {
            const imageKey = i === 1 ? '*활동 가이드 1_이미지' : `활동 가이드 ${i}_이미지`;
            const descKey = i === 1 ? '*활동 가이드 1_설명' : `활동 가이드 ${i}_설명`;
            const images = item[imageKey];
            const guide = item[descKey];
            const tip = item[`활동 가이드_${i}_팁`];

            if (images && Array.isArray(images)) {
                let imageUrl = {
                    aos: null,
                    ios: null,
                    defaultUrl: null,
                    type: null,
                };

                if (images.length === 1) {
                    imageUrl.default = images[0].url;
                    imageUrl.type = images[0].type;
                } else {
                    images.forEach(img => {
                        if (img.filename.includes('aos')) {
                            imageUrl.aos = img.url;
                            imageUrl.type = img.type;
                        } else if (img.filename.includes('ios')) {
                            imageUrl.ios = img.url;
                            imageUrl.type = img.type;
                        }
                    });
                }

                activeGuide.push({
                    imageUrl: imageUrl,
                    guide: guide || '',
                    tip: tip || null,
                });
            }
        }

        const materials = Array.isArray(item["준비물 데이터"])
            ? item["준비물 데이터"].map(mat => typeof mat === 'object' && mat._id ? mat._id : mat)
            : [];

        // DTO 객체 생성
        const contentDTO = new contentRegistryDTO({
            title: item["*액티비티 타이틀"] || '',
            contentsId: item["id"] || null, // 변경: airtableId 대신 contentsId 사용
            createrName: item["Created By"] ? item["Created By"].name : '',
            thumbnailUrl: item["*액티비티 썸네일"] && item["*액티비티 썸네일"][0]
                ? {
                    url: item["*액티비티 썸네일"][0].url,
                    type: item["*액티비티 썸네일"][0].type
                }
                : { url: '', type: '' },
            category_main: item["*메인 장르"] && item["*메인 장르"][0] ? item["*메인 장르"][0] : '',
            category_sub: item["*서브 장르"] && item["*서브 장르"][0] ? item["*서브 장르"][0] : '',
            activePlan: item["*활동 설명"] || '',
            playtime_min: item["*예상 소요시간"] ? Number(item["*예상 소요시간"]) : 0,
            materials: materials,
            preparationTip: preparationTip,
            postingGuide: item["P형 포스트 가이드"] && item["P형 포스트 가이드"][0] ? item["P형 포스트 가이드"][0] : '',
            recommendation: Array.isArray(item["추천 활동"]) 
            ? item["추천 활동"].flat()  // 배열을 평탄화
            : [],
            activeGuide: activeGuide,
        });

        // DTO 유효성 검사
        try {
            contentRegistryDTO.validate(contentDTO);
            return contentDTO;
        } catch (validationError) {
            console.log(`Invalid item, skipping:`, validationError.message);
            return null;
        }
    }).filter(item => item !== null); // 유효한 데이터만 필터링
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData'); // JSON 파일이 있는 디렉터리 경로
        createDirectoryIfNotExists(dirPath); // 디렉토리 생성
        const pattern = /contentsData-updateAt(\d{8})\.json$/; // 파일명 패턴 (예: contentsData-updateAt20240627.json)
        console.log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = getFileByDatePattern(dirPath, pattern); // 최신 파일 찾기
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest file: ${latestFile}`);

        const data = await readDataFromFile(path.join(dirPath, latestFile)); // 최신 파일 읽기

        const processedData = processData(data); // 데이터를 가공
        console.log('Processed Data:', JSON.stringify(processedData, null, 2));

        await sendDataToApi(processedData, 'https://api.dev.ahhaohho.com/admin/reg_content'); // 백엔드 API URL을 설정하세요.
    } catch (error) {
        console.error('Error:', error); // 전체 과정 중 에러 발생 시 출력
    }
}

main(); // 메인 함수 실행
