const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

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
                    mediaUrl: {
                        type: tipImages[0].type,
                        defaultUrl: tipImages[0].url,
                    },
                    comment: tipDescription || null,
                });
            }
        }

        // 활동 가이드 데이터를 가공 (최대 9개)
        for (let i = 1; i <= 9; i++) {
            const mediaKey = i === 1 ? '*활동 가이드 1_이미지' : `활동 가이드 ${i}_이미지`;
            const descKey = i === 1 ? '*활동 가이드 1_설명' : `활동 가이드 ${i}_설명`;
            const medias = item[mediaKey];
            const guide = item[descKey];
            const tip = item[`활동 가이드_${i}_팁`];
            const portrait = item[`활동가이드 4:5(세로가긴) 비율로 노출되나요?`];

            if (medias && Array.isArray(medias)) {
                let mediaUrl = {
                    aos: null,
                    ios: null,
                    defaultUrl: null,
                    type: medias[0].type,
                    portrait: portrait,
                };

                if (medias.length === 1) {
                    mediaUrl.defaultUrl = medias[0].url;
                } else {
                    medias.forEach(img => {
                        if (img.filename.includes('aos')) {
                            mediaUrl.aos = img.url;
                        } else if (img.filename.includes('ios')) {
                            mediaUrl.ios = img.url;
                        }
                    });
                }

                activeGuide.push({
                    mediaUrl: mediaUrl,
                    guide: guide || '',
                    tip: tip || null,
                });
            }
        }

        const materials = Array.isArray(item["준비물 데이터"])
            ? item["준비물 데이터"].map(mat => typeof mat === 'object' && mat._id ? mat._id : mat)
            : [];

        // 객체 직접 생성
        return {
            title: item["*액티비티 타이틀"] || '',
            index: item["id"] || null,
            difficulty: item["*난이도"][0] || '',
            createrName: item["액티비티 기획자"] && item["액티비티 기획자"][0],
            thumbnail: item["*액티비티 썸네일"] && item["*액티비티 썸네일"][0]
                ? {
                    defaultUrl: item["*액티비티 썸네일"][0].url,
                    type: item["*액티비티 썸네일"][0].type
                }
                : { defaultUrl: '', type: '' },
            categoryMain: item["*메인 장르"] && item["*메인 장르"][0] ? item["*메인 장르"][0] : '',
            categorySub: item["*서브 장르"] && item["*서브 장르"][0] ? item["*서브 장르"][0] : '',
            activePlan: item["*활동 설명"] || '',
            playtime: item["*예상 소요시간"] ? Number(item["*예상 소요시간"]) : 0,
            materials: materials,
            preparationTip: preparationTip,
            postingGuide: item["P형 포스트 가이드"] && item["P형 포스트 가이드"][0] ? item["P형 포스트 가이드"][0] : '',
            recommendation: Array.isArray(item["추천 활동"]) 
                ? item["추천 활동"].flat()
                : [],
            activeGuide: activeGuide,
        };
    });
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const pattern = /contentsData-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = getFileByDatePattern(dirPath, pattern);
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest file: ${latestFile}`);

        const data = await readDataFromFile(path.join(dirPath, latestFile));

        const processedData = processData(data);
        console.log('Processed Data:', JSON.stringify(processedData, null, 2));

        await sendDataToApi(processedData, 'https://api.dev.ahhaohho.com/admin/reg_content');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();