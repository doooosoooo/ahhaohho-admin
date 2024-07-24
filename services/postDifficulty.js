const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

// 액티비티 데이터를 가공하는 함수
function processActivityData(data) {
    return data.map((item, index) => {
        console.log(`Processing activity ${index}:`, item);

        try {
            const processedItem = {
                _id: item["id"],
                difficulty: item["난이도"],
                characteristic: item["특징"],
                duration: item["소요시간"],
                level: item["수준"],
                expectedOutput: item["기대하는_output"],
                challengeList: item["P형 액티비티 콘티"]
            };

            console.log(`Processed activity ${index}:`, processedItem);
            return processedItem;
        } catch (error) {
            console.log(`Error processing activity ${index}, skipping:`, error.message);
            return null;
        }
    }).filter(item => item !== null);
}

async function main() {
    try {
        // 액티비티 데이터 처리
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const activityPattern = /difficultyData-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${activityPattern}`);
        const latestActivityFile = getFileByDatePattern(dirPath, activityPattern);
        if (!latestActivityFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest activity file: ${latestActivityFile}`);

        const activityFilePath = path.join(dirPath, latestActivityFile);
        console.log(`Reading file: ${activityFilePath}`);
        const activityData = await readDataFromFile(activityFilePath);
        console.log('Raw Activity Data:', JSON.stringify(activityData, null, 2));

        const processedActivityData = processActivityData(activityData);
        console.log('Processed Activity Data:', JSON.stringify(processedActivityData, null, 2));

        if (processedActivityData.length > 0) {
            console.log(`Sending data to API: https://api.dev.ahhaohho.com/admin/reg_difficulty`);
            const activityResponses = await sendDataToApi(processedActivityData, 'https://api.dev.ahhaohho.com/admin/reg_difficulty');

            console.log('Activity Responses:', JSON.stringify(activityResponses, null, 2));

            if (Array.isArray(activityResponses)) {
                const activityIdMap = {};
                for (const response of activityResponses) {
                    activityIdMap[response.id] = response._id;
                }

                const idMapPath = path.join(__dirname, 'activityIdMap.json');
                console.log(`Writing ID map to file: ${idMapPath}`);
                fs.writeFileSync(idMapPath, JSON.stringify(activityIdMap));
            } else {
                console.error('Error: Expected an array from sendDataToApi, but got:', activityResponses);
            }
        } else {
            console.log('No valid data to send to the API.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();