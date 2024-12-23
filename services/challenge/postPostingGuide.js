process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {
    getFileByDatePattern,
    readDataFromFile,
    createDirectoryIfNotExists
} = require('../../middlewares/utils');

function processPostGuideData(data) {
    const processedData = data.map(function (item) {
        return {
            _id: item.id,
            guides: {
                mediaGuide: item['*미디어 촬영/선택 가이드 텍스트'], 
                titleGuide: item['*제목 작성 가이드 텍스트'],
                descGuide: item['설명 작성 가이드 텍스트']
            }
        };
    });

    // Add the additional data
    processedData.push({
        _id: "nocontents",
        guides: {
            mediaGuide: "생김새나 작동하는 모습이 잘 보이는 사진이나 영상을 올려줘.",
            titleGuide: "핵심 키워드나 특징을 담은 제목을 지어줘. 간결할 수록 좋아.",
            descGuide: "생김새나 작동법, 작업하면서 든 고민이나 새롭게 알게된 것을 적어줘."
        }
    });

    return processedData;
}

async function sendDataToApi(processedData, apiUrl) {
    try {
        console.log(`Sending data to API. Total items: ${processedData.length}`);

        const chunkSize = 10;
        for (let i = 0; i < processedData.length; i += chunkSize) {
            const chunk = processedData.slice(i, i + chunkSize);
            console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1}. Items: ${chunk.length}`);

            const response = await axios.post(apiUrl, { guides: chunk });
            console.log(`Chunk ${Math.floor(i / chunkSize) + 1} sent successfully. Response:`, response.data);
        }

        return { success: true, message: "All data sent successfully" };
    } catch (error) {
        console.error('Error sending data to API:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        throw error;
    }
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const pattern = /postingGuideData-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${pattern}`);
        const latestFile = getFileByDatePattern(dirPath, pattern);
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest file: ${latestFile}`);

        const data = await readDataFromFile(path.join(dirPath, latestFile));

        const processedData = processPostGuideData(data);
        console.log('Processed Data:', JSON.stringify(processedData, null, 2));

        await sendDataToApi(processedData, 'https://develop.ahhaohho.com:4222/creator/register/postingGuide');
    } catch (error) {
        console.error('Error:', error);
    }
}

main();