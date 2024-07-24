const path = require('path');
const fs = require('fs');
const {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
} = require('../middlewares/utils');

// materials 데이터를 가공하는 함수
function processMaterialsData(data) {
    return data.map((item, index) => {
        console.log(`Processing item ${index}:`, item);

        try {
            const processedItem = {
                id: item.id,
                material: item["재료명"] || 'Unknown',
                materialImage: item["재료사진"] && item["재료사진"][0] ? item["재료사진"][0].thumbnails.large.url : null,
                materialTips: []
            };
            // Add up to 3 preparation tips
            for (let i = 1; i <= 3; i++) {
                const tipDescription = item[`준비물Tip 설명 ${i}`];
                const tipImages = item[`준비물Tip 이미지 ${i}`];

                if (tipDescription) {
                    if (tipImages && tipImages.length > 0) {
                        // 이미지가 있는 경우
                        tipImages.forEach(tipImage => {
                            processedItem.materialTips.push({
                                imageUrl: tipImage.url || null,
                                tip: tipDescription
                            });
                        });
                    } else {
                        // 이미지가 없는 경우
                        processedItem.materialTips.push({
                            imageUrl: null,
                            tip: tipDescription
                        });
                    }
                }
            }

            console.log(`Processed item ${index}:`, processedItem);
            return processedItem;
        } catch (error) {
            console.log(`Error processing item ${index}, skipping:`, error.message);
            return null;
        }
    }).filter(item => item !== null);
}

async function main() {
    try {
        // materials 데이터 처리
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
        console.log('Raw Materials Data:', JSON.stringify(materialsData, null, 2));

        const processedMaterialsData = processMaterialsData(materialsData);
        console.log('Processed Materials Data:', JSON.stringify(processedMaterialsData, null, 2));

        if (processedMaterialsData.length > 0) {
            console.log(`Sending data to API: https://api.dev.ahhaohho.com/admin/reg_material`);
            const materialResponses = await sendDataToApi(processedMaterialsData, 'https://api.dev.ahhaohho.com/admin/reg_material');

            console.log('Material Responses:', JSON.stringify(materialResponses, null, 2));

            if (Array.isArray(materialResponses)) {
                const materialIdMap = {};
                for (const response of materialResponses) {
                    materialIdMap[response.id] = response._id;
                }

                const idMapPath = path.join(__dirname, 'materialIdMap.json');
                console.log(`Writing ID map to file: ${idMapPath}`);
                fs.writeFileSync(idMapPath, JSON.stringify(materialIdMap));
            } else {
                console.error('Error: Expected an array from sendDataToApi, but got:', materialResponses);
            }
        } else {
            console.log('No valid data to send to the API.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();