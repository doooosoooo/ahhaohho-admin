const { loadConfig } = require('../config/config');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { fetchTableData } = require('../middlewares/airtableClient');
const tableNames = require('./tableNames.json');

let config;
let s3Client;

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function initializeS3Client() {
    if (!config) {
        config = await loadConfig();
    }
    s3Client = new S3Client({
        region: config.aws_region,
        credentials: {
            accessKeyId: config.aws_accessKeyId,
            secretAccessKey: config.aws_secretAccessKey
        }
    });
    log('S3 client initialized successfully.');
}

async function uploadFileFromUrlToS3(url, key) {
    if (!s3Client) {
        await initializeS3Client();
    }

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    const contentType = response.headers['content-type'];

    const upload = new Upload({
        client: s3Client,
        params: {
            Bucket: config.aws_s3_bucketName,
            Key: key,
            Body: response.data,
            ContentType: contentType,
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'x-amz-meta-Cache-Control': 'max-age=31536000'
            }
        },
    });

    await upload.done();

    return { Location: `https://cdn-challenge.ahhaohho.com/${key}` };
}

async function processRecord(record, mainKey, currentIndex, totalRecords) {
    log(`Processing record ${currentIndex + 1}/${totalRecords} for ${mainKey}`);
    for (let key in record) {
        if (Array.isArray(record[key])) {
            for (let file of record[key]) {
                if (file && file.url) {
                    const url = file.url;
                    const fileName = path.basename(url);
                    const s3Key = `${mainKey}/${fileName}`;

                    // URL에서 S3로 직접 업로드
                    const s3Response = await uploadFileFromUrlToS3(url, s3Key);

                    // URL 교체
                    file.url = s3Response.Location;

                    // 썸네일 URL도 교체
                    if (file.thumbnails) {
                        for (let size in file.thumbnails) {
                            if (file.thumbnails[size].url) {
                                const thumbUrl = file.thumbnails[size].url;
                                const thumbFileName = path.basename(thumbUrl);
                                const thumbS3Key = `${mainKey}/thumbnails/${size}/${thumbFileName}`;

                                // 썸네일 URL에서 S3로 직접 업로드
                                const thumbS3Response = await uploadFileFromUrlToS3(thumbUrl, thumbS3Key);

                                // 썸네일 URL 교체
                                file.thumbnails[size].url = thumbS3Response.Location;
                            }
                        }
                    }
                }
            }
        }
    }
    return record;
}

async function fetchExistingData(mainKey, dataDir) {
    const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);
    const files = await fs.readdir(dataDir);
    const existingFile = files.find(file => mainKeyPattern.test(file));

    if (existingFile) {
        const filePath = path.join(dataDir, existingFile);
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

async function main() {
    await initializeS3Client();

    const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const dataDir = path.join(__dirname, 'contentsRawData');

    await fs.mkdir(dataDir, { recursive: true });

    const totalTables = Object.keys(tableNames).length;
    let currentTableIndex = 0;

    for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
        currentTableIndex++;
        try {
            log(`Processing table ${currentTableIndex}/${totalTables}: ${tableName}`);
            const tableData = await fetchTableData(tableName, viewName);

            // Load existing data
            const existingData = await fetchExistingData(mainKey, dataDir);
            const existingIds = new Set(existingData.map(record => record.id));

            // Process only new or updated records
            const newRecords = [];
            for (let i = 0; i < tableData.length; i++) {
                const record = tableData[i];
                if (!existingIds.has(record.id)) {
                    const processedRecord = await processRecord(record, mainKey, i, tableData.length);
                    newRecords.push(processedRecord);
                }
            }

            log(`Processed ${newRecords.length} new records for ${tableName}`);

            // Combine new records with existing data
            const updatedData = [...existingData, ...newRecords];
            const jsonData = JSON.stringify(updatedData, null, 2);

            const fileName = `${mainKey}-updateAt${updateDate}.json`;
            const filePath = path.join(dataDir, fileName);

            // Delete old file
            const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);
            const files = await fs.readdir(dataDir);
            for (const file of files) {
                if (mainKeyPattern.test(file)) {
                    await fs.unlink(path.join(dataDir, file));
                }
            }

            // Save updated data
            await fs.writeFile(filePath, jsonData, 'utf8');
            log(`JSON data has been saved to ${filePath}`);
        } catch (error) {
            console.error(`Error processing data for table ${tableName}:`, error.message);
        }
    }

    log('All operations completed successfully.');
}

main().catch(error => console.error('An error occurred:', error));