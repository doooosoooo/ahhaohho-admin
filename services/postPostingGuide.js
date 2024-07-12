const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {
    getFileByDatePattern,
    readDataFromFile,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

function processPostGuideData(data) {
    return data.map(function (item) {
        return {
            _id: item.id,
            guides: {
                mediaGuide: item['*미디어 촬영/선택 가이드 텍스트'],
                titleGuide: item['*제목 작성 가이드 텍스트'],
                descGuide: item['설명 작성 가이드 텍스트']
            }
        };
    });
}

async function sendDataToApi(processedData, apiUrl) {
    try {
        for (const item of processedData) {
            const response = await axios.post(apiUrl, item);
            console.log('API Response for item:', item._id, response.data);
        }
    } catch (error) {
        console.error('Error sending data to API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
    }
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const pattern = /postingGuide-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = getFileByDatePattern(dirPath, pattern);
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest file: ${latestFile}`);

        const data = await readDataFromFile(path.join(dirPath, latestFile));

        const processedData = processPostGuideData(data);
        console.log('Processed Data:', JSON.stringify(processedData, null, 2));

        await sendDataToApi(processedData, 'https://api.dev.doosoo.xyz:4242/manager/postGuide');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();