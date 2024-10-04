process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    createDirectoryIfNotExists
} = require('../middlewares/utils');
const axios = require('axios');

async function sendDataToApi(processedData, apiUrl) {
    try {
        console.log(`Sending data to API. Total items: ${processedData.length}`);

        // 데이터 정제 함수
        const cleanData = (item) => ({
            index: item.index, // 'id' 대신 'index'를 사용합니다.
            title: item.title,
            difficulty: item.difficulty,
            sound: item.sound,
            createrName: item.createrName,
            thumbnail: item.thumbnail,
            categoryMain: item.categoryMain,
            categorySub: item.categorySub,
            activePlan: item.activePlan,
            essentialInfo: item.essentialInfo,
            leadSentence: item.leadSentence,
            playtime: item.playtime,
            materials: item.materials,
            preparationTip: item.preparationTip,
            postingGuide: item.postingGuide,
            recommendation: item.recommendation,
            activeGuide: item.activeGuide
        });

        const chunkSize = 10;
        for (let i = 0; i < processedData.length; i += chunkSize) {
            const chunk = processedData.slice(i, i + chunkSize).map(cleanData);
            console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1}. Items: ${chunk.length}`);

            const validatedChunk = chunk.map(item => {
                if (!item.difficulty || !['1', '2', '3', '4', '5'].includes(item.difficulty)) {
                    console.warn(`Invalid difficulty for item ${item.id}, setting to default '1'`);
                    return { ...item, difficulty: '1' };
                }
                return item;
            });

            const response = await axios({
                method: 'post',
                url: apiUrl,
                data: { contents: validatedChunk },
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': 'Bearer YOUR_TOKEN_HERE'
                }
            });
            console.log(`Chunk ${Math.floor(i / chunkSize) + 1} sent successfully. Response:`, response.data);
        }

        return { success: true, message: "All data sent successfully" };
    } catch (error) {
        console.error('API 요청 중 오류 발생:');
        if (error.response) {
            console.error(`상태 코드: ${error.response.status}`);
            console.error(`오류 메시지: ${error.response.data.message || '알 수 없는 오류'}`);
            if (error.response.data.errors) {
                console.error('상세 오류:');
                error.response.data.errors.forEach((err, index) => {
                    console.error(`  ${index + 1}. ${err.message}`);
                });
            }
        } else if (error.request) {
            console.error('서버로부터 응답이 없습니다.');
        } else {
            console.error(`오류 메시지: ${error.message}`);
        }
        throw error;
    }
}

function safeJsonStringify(obj) {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (cache.has(value)) {
                return '[Circular]';
            }
            cache.add(value);
        }
        return value;
    }, 2);
}

function validateField(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required field: ${fieldName}`);
    }
    return value;
}

function processItem(item) {
    try {
        const preparationTip = [];
        const activeGuide = [];

        // 'recommendation' 필드 추출, 기본값은 빈 배열로 설정
        const recommendation = Array.isArray(item["추천 활동"]) ? item["추천 활동"] : [];

        // 준비 Tip 데이터를 가공 (최대 3개)
        for (let i = 1; i <= 3; i++) {
            const tipImages = item[`준비 Tip ${i}_이미지`];
            const tipDescription = item[`준비 Tip ${i}_설명`];

            if (tipImages && Array.isArray(tipImages) && tipImages.length > 0) {
                preparationTip.push({
                    mediaUrl: {
                        type: tipImages[0].type,
                        defaultUrl: tipImages[0].thumbnails?.large?.url || null,
                    },
                    comment: tipDescription || null,
                });
            }
        }

        let difficulty = '';
        if (Array.isArray(item["*난이도"]) && item["*난이도"].length > 0) {
            difficulty = item["*난이도"][0];
        } else if (typeof item["*난이도"] === 'string') {
            difficulty = item["*난이도"];
        }

        // difficulty가 유효한 값인지 확인 (예: '1', '2', '3', '4', '5' 중 하나)
        if (!['1', '2', '3', '4', '5'].includes(difficulty)) {
            console.warn(`Invalid difficulty value for item ${item.id}: ${difficulty}`);
            difficulty = '1'; // 기본값 설정
        }

        // 활동 가이드 데이터를 가공 (최대 9개)
        for (let i = 1; i <= 9; i++) {
            const mediaKey = i === 1 ? '*활동 가이드 1_이미지' : `활동 가이드 ${i}_이미지`;
            const descKey = i === 1 ? '*활동 가이드 1_설명' : `활동 가이드 ${i}_설명`;
            const medias = item[mediaKey];
            const guide = item[descKey];
            const sound = item[`활동가이드${i}_소리출력`];
            const tip = item[`활동 가이드_${i}_팁`];
            const portrait = item[`활동가이드 4:5(세로가긴) 비율로 노출되나요?`];

            if (medias && Array.isArray(medias)) {
                let mediaUrl = {
                    aos: null,
                    ios: null,
                    defaultUrl: null,
                    type: medias[0]?.type || null,
                    portrait: portrait,
                    sound: sound,
                };

                if (medias.length === 1) {
                    mediaUrl.defaultUrl = medias[0].url;
                } else {
                    medias.forEach(img => {
                        if (img.filename?.includes('aos') && img.type?.includes('image')) {
                            mediaUrl.aos = img.thumbnails?.large?.url || null;
                        } else if (img.filename?.includes('ios') && img.type?.includes('image')) {
                            mediaUrl.ios = img.thumbnails?.large?.url || null;
                        } else if (img.filename?.includes('aos') && img.type?.includes('video')) {
                            mediaUrl.defaultUrl = img.url || null;
                        } else if (img.filename?.includes('ios') && img.type?.includes('video')) {
                            mediaUrl.defaultUrl = img.url || null;
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

        return {
            title: validateField(item["*액티비티 타이틀"], 'title'),
            index: validateField(item["id"], 'index'),
            difficulty: validateField(difficulty, 'difficulty'),
            sound: item["\b썸네일_소리출력"] || '',
            createrName: validateField(Array.isArray(item["액티비티 기획자"]) ? item["액티비티 기획자"][0] : null, 'createrName'),
            thumbnail: validateField(item["*액티비티 썸네일"] && Array.isArray(item["*액티비티 썸네일"]) && item["*액티비티 썸네일"][0]
                ? {
                    defaultUrl: item["*액티비티 썸네일"][0].url,
                    type: item["*액티비티 썸네일"][0].type
                }
                : null, 'thumbnail'),
            categoryMain: validateField(Array.isArray(item["*메인 장르"]) ? item["*메인 장르"][0] : '', 'categoryMain'),
            categorySub: validateField(Array.isArray(item["*서브 장르"]) ? item["*서브 장르"][0] : '', 'categorySub'),
            activePlan: validateField(item["*활동 설명"], 'activePlan'),
            essentialInfo: item["* 필수 항목 안내 문구"] || '기본 필수 정보', // 기본값 설정
            leadSentence: validateField(item["* 활동 시작 발문"], 'leadSentence'),
            playtime: validateField(item["*예상 소요시간"] ? Number(item["*예상 소요시간"]) : 0, 'playtime'),
            materials: validateField(materials, 'materials'),
            preparationTip: preparationTip,
            postingGuide: validateField(Array.isArray(item["P형 포스트 가이드"]) ? item["P형 포스트 가이드"][0] : '', 'postingGuide'),
            recommendation: recommendation, // 'recommendation' 필드 추가
            activeGuide: validateField(activeGuide, 'activeGuide'),
        };
    } catch (error) {
        console.error(`Error processing item: ${error.message}`);
        console.error(`Problematic item: ${safeJsonStringify(item)}`);
        return null;
    }
}


async function processDataInChunks(data, chunkSize = 10) {
    const results = [];
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const processedChunk = chunk.map(processItem).filter(Boolean);
        results.push(...processedChunk);
        console.log(`Processed ${results.length} out of ${data.length} items`);
    }
    return results;
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
        console.log(`Read ${data.length} items from file`);

        const processedData = await processDataInChunks(data);
        console.log(`Successfully processed ${processedData.length} items`);

        const apiUrl = 'https://develop.ahhaohho.com:4222/creator/register/challenge';
        await sendDataToApi(processedData, apiUrl);
        console.log('Data sent to API successfully');
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});