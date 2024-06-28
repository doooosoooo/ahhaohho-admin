const fs = require('fs');
const axios = require('axios');

// JSON 파일에서 데이터 읽기
function readDataFromFile(filePath) {
    return new Promise(function(resolve, reject) {
        fs.readFile(filePath, 'utf8', function(err, data) {
            if (err) {
                return reject(err);
            }
            try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
            } catch (parseErr) {
                reject(parseErr);
            }
        });
    });
}

// 데이터 가공
function processData(data) {
    return data.map(function(item) {
        const fields = item.fields;

        const preparationTip = {
            image: fields["준비 Tip 1_이미지"] ? fields["준비 Tip 1_이미지"][0].url : null,
            comment: fields["준비 Tip 1_설명"] || null,
        };

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

        return {
            title: fields["*액티비티 타이틀"] || null,
            createrName: fields["Created By"] ? fields["Created By"].name : null,
            thumbnailUrl: fields["*액티비티 썸네일"] ? fields["*액티비티 썸네일"][0].url : null,
            category_main: fields["*메인 장르"] ? fields["*메인 장르"][0] : null,
            category_sub: fields["*서브 장르"] ? fields["*서브 장르"][0] : null,
            activePlan: fields["*활동 설명"] || null,
            materials: fields["준비물 데이터"] || null,
            preparationTip: [preparationTip],
            activeGuide: activeGuide,
        };
    });
}

// API로 데이터 전송
async function sendDataToApi(processedData, apiUrl) {
    try {
        for (const item of processedData) {
            await axios.post(apiUrl, item);
        }
        console.log('Data successfully sent to API');
    } catch (error) {
        console.error('Error sending data to API:', error);
    }
}

async function main() {
    try {
        const data = await readDataFromFile('./contentsRawData/contentsData-updateAt20240627.json'); // JSON 파일 경로를 설정하세요.
        const processedData = processData(data);
        await sendDataToApi(processedData, 'http://api-url'); // 백엔드 API URL을 설정하세요.
    } catch (error) {
        console.error('Error:', error);
    }
}

main();