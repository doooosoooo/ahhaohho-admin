process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function getFileByDatePattern(dirPath, pattern) {
    const files = await fs.readdir(dirPath);
    const matchingFiles = files.filter(file => pattern.test(file));
    if (matchingFiles.length === 0) return null;
    return matchingFiles.sort().pop(); // 가장 최근 파일 반환
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

function processActivityData(data) {
    return data.map((item, index) => {
        log(`Processing activity ${index}:`, item);

        try {
            const difficulties = {
                _id: item["id"],
                level: item["난이도"],
                characteristic: item["특징"],
                duration: item["소요시간"],
                expectedOutput: item["기대하는_output"],
                challengeList: item["P형 챌린지 데이터"]
            };

            log(`Processed activity ${index}:`, difficulties);
            return difficulties;
        } catch (error) {
            log(`Error processing activity ${index}, skipping:`, error.message);
            return null;
        }
    }).filter(item => item !== null);
}

async function sendDataToApi(processedData, apiUrl) {
    try {
        log(`Sending data to API. Total items: ${processedData.length}`);

        const response = await axios({
            method: 'post',
            url: apiUrl,
            data: {difficulties: processedData},
            headers: { 'Content-Type': 'application/json' }
        });

        log('API Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('API 요청 중 오류 발생:', error);
        throw error;
    }
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData');
        await createDirectoryIfNotExists(dirPath);
        const activityPattern = /difficultyData-updateAt(\d{8})\.json$/;
        log(`Looking for files in: ${dirPath} with pattern: ${activityPattern}`);
        const latestActivityFile = await getFileByDatePattern(dirPath, activityPattern);
        if (!latestActivityFile) {
            throw new Error('No matching files found');
        }
        log(`Found latest activity file: ${latestActivityFile}`);

        const activityFilePath = path.join(dirPath, latestActivityFile);
        log(`Reading file: ${activityFilePath}`);
        const activityData = await readDataFromFile(activityFilePath);
        log('Raw Activity Data:', JSON.stringify(activityData, null, 2));

        const processedActivityData = processActivityData(activityData);
        log('Processed Activity Data:', JSON.stringify(processedActivityData, null, 2));

        if (processedActivityData.length > 0) {
            log(`Sending data to API: https://develop.ahhaohho.com:4222/creator/register/difficulty`);
            const activityResponses = await sendDataToApi(processedActivityData, 'https://develop.ahhaohho.com:4222/creator/register/difficulty');

            log('Activity Responses:', JSON.stringify(activityResponses, null, 2));

            if (Array.isArray(activityResponses)) {
                const activityIdMap = {};
                for (const response of activityResponses) {
                    activityIdMap[response.id] = response._id;
                }

                const idMapPath = path.join(__dirname, 'activityIdMap.json');
                log(`Writing ID map to file: ${idMapPath}`);
                await fs.writeFile(idMapPath, JSON.stringify(activityIdMap));
            } else {
                console.error('Error: Expected an array from sendDataToApi, but got:', activityResponses);
            }
        } else {
            log('No valid data to send to the API.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();