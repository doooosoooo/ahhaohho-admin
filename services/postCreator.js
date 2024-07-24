const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

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
            console.log(`Sending data to API: https://api.dev.ahhaohho.com/admin/reg_creator`);
            const creatorResponses = await sendDataToApi(processedCreatorData, 'https://api.dev.ahhaohho.com/admin/reg_creator');

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