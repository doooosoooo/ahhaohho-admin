/* global process, __dirname */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { loadConfig } = require('../../config/config');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

let config;

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function initializeConfig() {
    if (!config) {
        config = await loadConfig();
    }
    log('Configuration loaded successfully.');
}

function validateField(value, fieldName) {
    if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required field: ${fieldName}`);
    }
    return value;
}

function getMediaUrl(media) {
    // 미디어가 없거나 URL이 없는 경우
    if (!media || !media.url) {
        return null;
    }

    // 비디오 타입인 경우
    if (media.type === 'video/mp4') {
        // 비디오는 기본 URL 반환
        return media.url;
    } 
    // 이미지 타입인 경우
    else if (media.type === 'image/jpeg' || media.type === 'image/png') {
        // 썸네일이 있는 경우
        if (media.thumbnails) {
            // 썸네일 정보가 포함된 객체 반환
            return {
                defaultUrl: media.url,
                type: media.type,
                thumbnail: {
                    tiny: media.thumbnails.small?.url || media.thumbnails.tiny?.url || '',
                    small: media.thumbnails.large?.url || '',
                    medium: media.thumbnails.large?.url || '',
                    large: media.thumbnails.full?.url || ''                }
            };
        }
        // 썸네일이 없는 경우 URL만 반환
        return media.url;
    }
    // 기타 타입인 경우
    return null;
}
async function processItem(item) {
    try {
        log(`Processing item: ${item.id}`);
        
        const preparationTip = [];
        const activeGuide = [];
        const recommendation = Array.isArray(item["추천 활동"]) ? item["추천 활동"] : [];

        // 준비 Tip 처리
        for (let i = 1; i <= 3; i++) {
            const tipImages = item[`준비 Tip ${i}_이미지`];
            const tipDescription = item[`준비 Tip ${i}_설명`];
            if (tipImages && Array.isArray(tipImages) && tipImages.length > 0) {
                preparationTip.push({
                    mediaUrl: {
                        type: tipImages[0].type,
                        defaultUrl: getMediaUrl(tipImages[0]),
                    },
                    comment: tipDescription || null,
                });
            }
        }

        // 난이도 처리
        let level = parseInt(item["난이도"], 10);
        if (isNaN(level) || level < 1 || level > 5) {
            console.warn(`Invalid level value for item ${item.id}: ${level}`);
            level = 1;
        } else {
            level = level <= 2 ? 1 : (level === 3 ? 2 : 3);
        }
        

        // 활동 가이드 처리 부분도 수정
        // 활동 가이드 처리
        for (let i = 1; i <= 9; i++) {
            const mediaKey = i === 1 ? '*활동 가이드 1_이미지' : `활동 가이드 ${i}_이미지`;
            const descKey = i === 1 ? '*활동 가이드 1_설명' : `활동 가이드 ${i}_설명`;
            const medias = item[mediaKey];
            const guide = item[descKey];
            const sound = item[`활동가이드${i}_소리출력`];
            const tip = item[`활동 가이드_${i}_팁`];
            const portrait = item[`활동가이드 4:5(세로가긴) 비율로 노출되나요?`];

            if (medias && Array.isArray(medias) && medias.length > 0) {
                let mediaUrl = {
                    aos: null,
                    ios: null,
                    defaultUrl: null,
                    type: medias[0].type,
                    portrait: portrait,
                    sound: sound,
                    thumbnail: {
                        tiny: '',
                        small: '',
                        medium: '',
                        large: '',
                        full: ''
                    }
                };

                for (const media of medias) {
                    const mediaResult = getMediaUrl(media);
                    
                    if (mediaResult) {
                        // 객체인 경우 (이미지 + 썸네일)
                        if (typeof mediaResult === 'object') {
                            if (media.filename?.toLowerCase().includes('aos')) {
                                mediaUrl.aos = mediaResult.defaultUrl;
                                mediaUrl.thumbnail = mediaResult.thumbnail;
                            } else if (media.filename?.toLowerCase().includes('ios')) {
                                mediaUrl.ios = mediaResult.defaultUrl;
                                mediaUrl.thumbnail = mediaResult.thumbnail;
                            } else {
                                mediaUrl.defaultUrl = mediaResult.defaultUrl;
                                mediaUrl.thumbnail = mediaResult.thumbnail;
                            }
                        } 
                        // 문자열인 경우 (비디오 또는 썸네일 없는 이미지)
                        else {
                            if (media.filename?.toLowerCase().includes('aos')) {
                                mediaUrl.aos = mediaResult;
                            } else if (media.filename?.toLowerCase().includes('ios')) {
                                mediaUrl.ios = mediaResult;
                            } else {
                                mediaUrl.defaultUrl = mediaResult;
                            }
                        }
                    }
                }

                if (!mediaUrl.defaultUrl) {
                    mediaUrl.defaultUrl = mediaUrl.aos || mediaUrl.ios;
                }

                if (mediaUrl.defaultUrl) {
                    activeGuide.push({
                        mediaUrl: mediaUrl,
                        guide: guide || '',
                        tip: tip || null,
                    });
                } else {
                    console.warn(`Warning: No valid media URL for activeGuide[${i-1}] in item ${item.id}`);
                }
            }
        }

        // 썸네일 처리
        let thumbnail = null;
        if (item["*액티비티 썸네일"] && Array.isArray(item["*액티비티 썸네일"]) && item["*액티비티 썸네일"][0]) {
            const thumbnailItem = item["*액티비티 썸네일"][0];
            const mediaUrlResult = getMediaUrl(thumbnailItem);
            
            // getMediaUrl의 반환값이 객체인 경우 (이미지 + 썸네일이 있는 경우)
            if (mediaUrlResult && typeof mediaUrlResult === 'object') {
                thumbnail = {
                    defaultUrl: mediaUrlResult.defaultUrl,
                    type: thumbnailItem.type,
                    sound: item["\b썸네일_소리출력"] || false,
                    thumbnail: mediaUrlResult.thumbnail
                };
            } 
            // getMediaUrl의 반환값이 문자열인 경우 (비디오 또는, 썸네일 없는 이미지)
            else if (mediaUrlResult) {
                thumbnail = {
                    defaultUrl: mediaUrlResult,
                    type: thumbnailItem.type,
                    sound: item["\b썸네일_소리출력"] || false,
                    thumbnail: {
                        tiny: '',
                        small: '',
                        medium: '',
                        large: ''            }
                };
            }
        }


        const activePlan = item["*활동 설명"] || "이 활동에 대한 설명이 곧 제공될 예정입니다. 기대해 주세요!";

        return {
            title: validateField(item["*액티비티 타이틀"], 'title'),
            index: validateField(item["id"], 'index'),
            level: level, // validateField를 제거하고 직접 숫자 값을 사용합니다.
            sound: item["\b썸네일_소리출력"] || '',
            createrName: validateField(Array.isArray(item["액티비티 기획자"]) ? item["액티비티 기획자"][0] : null, 'createrName'),
            thumbnail: validateField(thumbnail, 'thumbnail'),
            categoryMain: validateField(Array.isArray(item["*메인 장르"]) ? item["*메인 장르"][0] : '', 'categoryMain'),
            categorySub: validateField(Array.isArray(item["*서브 장르"]) ? item["*서브 장르"][0] : '', 'categorySub'),
            activePlan: validateField(activePlan, 'activePlan'),
            essentialInfo: item["* 필수 항목 안내 문구(퓨처랩)"] || '기본 필수 정보',
            leadSentence: validateField(item["* 활동 시작 발문(퓨처랩)"], 'leadSentence'),
            aiPrompt: validateField(item["*챌린지 설명(콘텐츠 맵)"], 'aiPrompt'),
            playtime: validateField(item["*예상 소요시간"] ? Number(item["*예상 소요시간"]) : 0, 'playtime'),
            materials: validateField(Array.isArray(item["준비물 데이터"]) ? item["준비물 데이터"] : [], 'materials'),
            preparationTip: preparationTip,
            postingGuide: validateField(Array.isArray(item["P형 포스트 가이드"]) ? item["P형 포스트 가이드"][0] : '', 'postingGuide'),
            recommendation: recommendation,
            activeGuide: validateField(activeGuide, 'activeGuide'),
        };
    } catch (error) {
        console.error(`Error processing item ${item.id}: ${error.message}`);
        return null;
    }
}

async function processDataInChunks(data, chunkSize = 10) {
    const results = [];
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const processedChunk = await Promise.all(chunk.map(processItem));
        const filteredChunk = processedChunk.filter(Boolean);
        results.push(...filteredChunk);
        log(`Processed ${results.length} out of ${data.length} items`);
    }
    return results;
}

async function sendUpdatedDataToApi(processedData, apiUrl) {
    try {
        log(`Sending updated data to API. Total items: ${processedData.length}`);

        for (let i = 0; i < processedData.length; i++) {
            log(`Sending item ${i + 1}/${processedData.length}: ${processedData[i].index}`);
            
            try {
                await axios.post(apiUrl, { contents: [processedData[i]] });
                log(`Item ${processedData[i].index} sent successfully`);
            } catch (error) {
                console.error(`Error sending item ${processedData[i].index}:`, error.response?.data || error.message);
            }
        }

        log('Data sending process completed');

        return { success: true, message: `Updated ${processedData.length} items` };
    } catch (error) {
        console.error('API 요청 중 오류 발생:', error);
        throw error;
    }
}

async function getFileByDatePattern(dirPath, pattern) {
    const files = await fs.readdir(dirPath);
    const matchingFiles = files.filter(file => pattern.test(file));
    if (matchingFiles.length === 0) return null;
    return matchingFiles.sort().pop();
}

async function readDataFromFile(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

async function createDirectoryIfNotExists(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
        } else {
            throw error;
        }
    }
}


async function main() {
    try {
        await initializeConfig();

        const dirPath = path.resolve(__dirname, './contentsRawData');
        await createDirectoryIfNotExists(dirPath);
        const pattern = /contentsData-updateAt(\d{8})\.json$/;
        log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = await getFileByDatePattern(dirPath, pattern);
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        log(`Found latest file: ${latestFile}`);

        const data = await readDataFromFile(path.join(dirPath, latestFile));
        log(`Read ${data.length} items from file`);

        const processedData = await processDataInChunks(data);
        log(`Successfully processed ${processedData.length} items`);

        const apiUrl = 'https://develop.ahhaohho.com:4222/creator/register/challenge';
        await sendUpdatedDataToApi(processedData, apiUrl);
    } catch (error) {
        console.error('Error in main function:', error);
    }
}

main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});