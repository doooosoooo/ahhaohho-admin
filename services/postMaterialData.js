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

async function sendDataToApi(processedData, apiUrl) {
    try {
        console.log(`Sending data to API. Total items: ${processedData.length}`);

        // 데이터 정제 함수
        const cleanData = (item) => ({
            id: item.id,
            material: item.material,
            materialImage: item.materialImage,
            materialTips: item.materialTips.map(tip => ({
                imageUrl: tip.imageUrl,
                tip: tip.tip
            }))
        });

        const chunkSize = 10;
        for (let i = 0; i < processedData.length; i += chunkSize) {
            const chunk = processedData.slice(i, i + chunkSize).map(cleanData);
            console.log(`Sending chunk ${Math.floor(i / chunkSize) + 1}. Items: ${chunk.length}`);

            const response = await axios({
                method: 'post',
                url: apiUrl,
                data: { materials: chunk },
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
            console.error('전체 응답:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('서버로부터 응답이 없습니다.');
        } else {
            console.error(`오류 메시지: ${error.message}`);
        }
        throw error;
    }
}

function processMaterialsData(data) {
    let hasErrors = false;
    let errorMessages = [];

    const processedData = data.map((item, index) => {
        try {
            if (!item.id || typeof item.id !== 'string') {
                throw new Error(`Invalid or missing 'id' field`);
            }
            if (!item["재료명"] || typeof item["재료명"] !== 'string') {
                throw new Error(`Invalid or missing '재료명' field`);
            }

            const materialImage = item["재료사진"]?.[0]?.thumbnails?.large?.url || null;

            const processedItem = {
                id: item.id,
                material: item["재료명"],
                materialImage: materialImage,
                materialTips: []
            };

            for (let i = 1; i <= 3; i++) {
                const tipDescription = item[`준비물Tip 설명 ${i}`];
                const tipImages = item[`준비물Tip 이미지 ${i}`];

                if (tipDescription) {
                    if (typeof tipDescription !== 'string') {
                        throw new Error(`Invalid '준비물Tip 설명 ${i}' field`);
                    }

                    if (tipImages && Array.isArray(tipImages)) {
                        tipImages.forEach(tipImage => {
                            if (!tipImage.url || typeof tipImage.url !== 'string') {
                                throw new Error(`Invalid image URL in '준비물Tip 이미지 ${i}'`);
                            }
                            processedItem.materialTips.push({ imageUrl: tipImage.url, tip: tipDescription });
                        });
                    } else {
                        processedItem.materialTips.push({ imageUrl: null, tip: tipDescription });
                    }
                }
            }

            return processedItem;
        } catch (error) {
            errorMessages.push(`Error in item ${index + 1} (ID: ${item.id}): ${error.message}`);
            hasErrors = true;
            return null;
        }
    }).filter(Boolean);

    return { processedData, hasErrors, errorMessages };
}

async function main() {
    try {
        const dirPath = path.resolve(__dirname, './contentsRawData');
        createDirectoryIfNotExists(dirPath);
        const materialsPattern = /materialsData-updateAt(\d{8})\.json$/;
        console.log(`Looking for files in: ${dirPath} with pattern: ${materialsPattern}`);

        const latestMaterialsFile = getFileByDatePattern(dirPath, materialsPattern);
        if (!latestMaterialsFile) {
            throw new Error('No matching files found');
        }
        console.log(`Found latest materials file: ${latestMaterialsFile}`);

        const materialsFilePath = path.join(dirPath, latestMaterialsFile);
        console.log(`Reading file: ${materialsFilePath}`);

        const materialsData = await readDataFromFile(materialsFilePath);
        console.log(`Total number of items in raw data: ${materialsData.length}`);

        const { processedData: processedMaterialsData, hasErrors, errorMessages } = processMaterialsData(materialsData);
        console.log(`Total number of processed items: ${processedMaterialsData.length}`);

        if (hasErrors) {
            console.error('\n==== ERROR MESSAGES ====');
            errorMessages.forEach(msg => console.error(msg));
            console.error('==========================\n');
            console.warn('Some errors occurred during data processing. Check the error messages above.');
            console.log('Continuing with valid items...');
        }

        if (processedMaterialsData.length > 0) {
            console.log(`Sending ${processedMaterialsData.length} items to API: https://develop.ahhaohho.com:4222/creator/register/material`);
            try {
                const result = await sendDataToApi(processedMaterialsData, 'https://develop.ahhaohho.com:4222/creator/register/material');
                console.log('API 전송 결과:', result);
            } catch (apiError) {
                console.error('API 오류:', apiError.message);
                if (apiError.response) {
                    console.error('API 응답:', JSON.stringify(apiError.response.data, null, 2));
                }
            }
        } else {
            console.log('API로 전송할 유효한 데이터가 없습니다.');
        }
    } catch (error) {
        console.error('Critical Error:', error.message);
    }
}

main().catch(error => {
    console.error('Unhandled error in main function:', error);
    process.exit(1);
});