// 보안상의 이유로 이 설정은 제거하고 대신 적절한 인증서를 사용하는 것이 좋습니다.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const {
    getFileByDatePattern,
    readDataFromFile,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

// API에 데이터를 전송하는 함수
async function sendDataToApi(processedData, apiUrl) {
    try {
        console.log(`Sending data to API. Total items: ${processedData.length}`);

        // 데이터 정제 함수
        const cleanData = (item) => ({
            _id: item._id,
            creatorName: item.creatorName,
            contents: item.contents
        });

        const chunkSize = 10;
        for (let i = 0; i < processedData.length; i += chunkSize) {
            const chunk = processedData.slice(i, i + chunkSize).map(cleanData);
            console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1}. Items: ${chunk.length}`);

            const response = await axios({
                method: 'post',
                url: apiUrl,
                data: { creators: chunk },
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': 'Bearer YOUR_TOKEN_HERE' // 필요한 경우 토큰 추가
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
            console.error('전체 응답:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('서버로부터 응답이 없습니다.');
        } else {
            console.error(`오류 메시지: ${error.message}`);
        }
        throw error;
    }
}

// creator 데이터를 가공하는 함수
function processCreatorData(data) {
    return data.map((item, index) => {
        console.log(`Processing creator ${index}:`, item);

        try {
            const processedItem = {
                _id: item["id"],
                creatorName: item["기획자명"] || 'Unknown',
                contents: item["P형 액티비티 데이터"] || []
            };

            console.log(`Processed creator ${index}:`, processedItem);
            return processedItem;
        } catch (error) {
            console.log(`Error processing creator ${index}, skipping:`, error.message);
            return null;
        }
    }).filter(item => item !== null);
}

async function main() {
    try {
        // creator 데이터 처리
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const creatorPattern = /creatorsData-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${creatorPattern}`);
        const latestCreatorFile = getFileByDatePattern(dirPath, creatorPattern);
        if (!latestCreatorFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest creator file: ${latestCreatorFile}`);

        const creatorFilePath = path.join(dirPath, latestCreatorFile);
        console.log(`Reading file: ${creatorFilePath}`);
        const creatorData = await readDataFromFile(creatorFilePath);
        console.log('Raw Creator Data:', JSON.stringify(creatorData, null, 2));

        const processedCreatorData = processCreatorData(creatorData);
        console.log('Processed Creator Data:', JSON.stringify(processedCreatorData, null, 2));

        if (processedCreatorData.length > 0) {
            console.log(`Sending data to API: https://develop.ahhaohho.com:4222/creator/register/creatorInfo`);
            const creatorResponses = await sendDataToApi(processedCreatorData, 'https://develop.ahhaohho.com:4222/creator/register/creatorInfo');

            console.log('Creator Responses:', JSON.stringify(creatorResponses, null, 2));

            if (Array.isArray(creatorResponses)) {
                const creatorIdMap = {};
                for (const response of creatorResponses) {
                    creatorIdMap[response.id] = response._id;
                }

                const idMapPath = path.join(__dirname, 'creatorIdMap.json');
                console.log(`Writing ID map to file: ${idMapPath}`);
                fs.writeFileSync(idMapPath, JSON.stringify(creatorIdMap));
            } else {
                console.error('Error: Expected an array from sendDataToApi, but got:', creatorResponses);
            }
        } else {
            console.log('No valid data to send to the API.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
