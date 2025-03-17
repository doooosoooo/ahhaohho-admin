const { loadConfig } = require('../../config/config');
const process = require('process');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { fetchTableData } = require('../../middlewares/airtableClient');
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

// Upload 클래스 대신 PutObjectCommand만 사용하는 함수
async function uploadFileFromUrlToS3(url, key, retries = 3) {
    if (!s3Client) {
        await initializeS3Client();
    }

    let attempt = 0;
    while (attempt < retries) {
        try {
            log(`Attempt ${attempt + 1}/${retries}: Downloading from ${url}`);
            
            // 파일 다운로드 (스트림 대신 ArrayBuffer로 직접 받기)
            const response = await axios({
                url,
                method: 'GET',
                responseType: 'arraybuffer',  // 중요: 스트림 대신 ArrayBuffer로 받음
                timeout: 180000 // 3분 타임아웃
            });

            const contentType = response.headers['content-type'];
            const buffer = Buffer.from(response.data);
            
            log(`Uploading ${buffer.length} bytes to S3: ${key}`);
            
            // PutObject 명령 사용 (멀티파트 업로드 우회)
            const command = new PutObjectCommand({
                Bucket: config.challenge_bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                ContentDisposition: 'inline',
                CacheControl: 'max-age=31536000',
                Metadata: {
                    'x-amz-meta-Cache-Control': 'max-age=31536000'
                }
            });
            
            await s3Client.send(command);
            log(`Successfully uploaded to S3: ${key}`);
            
            return { Location: `https://cdn-challenge.ahhaohho.com/${key}` };
        } catch (error) {
            attempt++;
            log(`Upload failed (${attempt}/${retries}): ${error.message}`);
            
            if (attempt >= retries) {
                throw error;
            }
            
            // 지수 백오프
            const waitTime = Math.min(1000 * Math.pow(2, attempt), 30000);
            log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
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

                    try {
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
                    } catch (error) {
                        log(`Warning: Failed to process file ${url}: ${error.message}`);
                        // 파일 처리 실패 시에도 계속 진행 (다른 파일/레코드는 처리)
                        // 실패한 파일은 원래 URL 유지
                    }
                }
            }
        }
    }
    return record;
}

async function fetchExistingData(mainKey, dataDir) {
    try {
        const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);
        const files = await fs.readdir(dataDir);
        const existingFile = files.find(file => mainKeyPattern.test(file));

        if (existingFile) {
            const filePath = path.join(dataDir, existingFile);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        log(`Warning: Could not fetch existing data for ${mainKey}: ${error.message}`);
    }
    return [];
}

async function main() {
    try {
        await initializeS3Client();

        const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const dataDir = path.join(process.cwd(), 'contentsRawData');

        await fs.mkdir(dataDir, { recursive: true });

        const totalTables = Object.keys(tableNames).length;
        let currentTableIndex = 0;

        for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
            currentTableIndex++;
            try {
                log(`Processing table ${currentTableIndex}/${totalTables}: ${tableName}`);
                const tableData = await fetchTableData('challenge', tableName, viewName);

                // Load existing data
                const existingData = await fetchExistingData(mainKey, dataDir);
                const existingIds = new Set(existingData.map(record => record.id));

                // Process only new or updated records
                const newRecords = [];
                for (let i = 0; i < tableData.length; i++) {
                    const record = tableData[i];
                    if (!existingIds.has(record.id)) {
                        try {
                            const processedRecord = await processRecord(record, mainKey, i, tableData.length);
                            newRecords.push(processedRecord);
                        } catch (error) {
                            log(`Error processing record ${i} for ${tableName}: ${error.message}`);
                            // 레코드 처리 실패 시에도 계속 진행
                        }
                    }
                }

                log(`Processed ${newRecords.length} new records for ${tableName}`);

                // Combine new records with existing data
                const updatedData = [...existingData, ...newRecords];
                const jsonData = JSON.stringify(updatedData, null, 2);

                const fileName = `${mainKey}-updateAt${updateDate}.json`;
                const filePath = path.join(dataDir, fileName);

                // Delete old file
                try {
                    const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);
                    const files = await fs.readdir(dataDir);
                    for (const file of files) {
                        if (mainKeyPattern.test(file)) {
                            await fs.unlink(path.join(dataDir, file));
                        }
                    }
                } catch (error) {
                    log(`Warning: Could not delete old files for ${mainKey}: ${error.message}`);
                }

                // Save updated data
                await fs.writeFile(filePath, jsonData, 'utf8');
                log(`JSON data has been saved to ${filePath}`);
            } catch (error) {
                console.error(`Error processing data for table ${tableName}:`, error.message);
                // 테이블 처리 실패 시에도 다른 테이블 계속 처리
            }
        }

        log('All operations completed successfully.');
    } catch (error) {
        console.error('A critical error occurred:', error);
    }
}

// 스크립트 실행
main().catch(error => console.error('An error occurred:', error));