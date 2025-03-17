/*global process*/

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { loadConfig } = require('../../config/config');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const AWS = require('aws-sdk'); // AWS SDK v2 사용 (더 안정적)
const { fetchTableData } = require('../../middlewares/airtableClient');
const tableNames = require('./tableNames.json');
const https = require('https');

let config;
let s3;

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({  
        rejectUnauthorized: false // 개발 환경용 설정
    }),
    maxContentLength: 200 * 1024 * 1024, // 200MB로 제한 증가
    timeout: 600000 // 10분 타임아웃
});

function log(message, isError = false) {
    // 에러 메시지 또는 중요 단계 메시지만 로깅
    if (isError || process.env.DEBUG === 'true') {
        console.log(`[${new Date().toISOString()}] ${isError ? 'ERROR: ' : ''}${message}`);
    }
}

function logDebug(message) {
    // DEBUG 환경변수가 true일 때만 상세 로그 출력
    if (process.env.DEBUG === 'true') {
        console.log(`[${new Date().toISOString()}] DEBUG: ${message}`);
    }
}

function logSuccess(message) {
    // 간략한 성공 로그만 출력 (테이블 단위)
    console.log(`[${new Date().toISOString()}] SUCCESS: ${message}`);
}

async function initializeS3Client() {
    if (!config) {
        config = await loadConfig();
    }

    // AWS SDK v2 사용 (더 안정적)
    AWS.config.update({
        region: config.aws_region,
        credentials: {
            accessKeyId: config.aws_accessKeyId,
            secretAccessKey: config.aws_secretAccessKey
        },
        maxRetries: 5,
        httpOptions: {
            timeout: 300000 // 5분 타임아웃
        }
    });

    s3 = new AWS.S3();
    logDebug('S3 client initialized successfully with AWS SDK v2.');
    return s3;
}

async function uploadFileFromUrlToS3(url, key) {
    if (!s3) {
        log(`Initializing S3 client for ${key}`, false);
        await initializeS3Client();
    }

    try {
        // 파일 크기 확인 로그
        log(`Starting to process: ${key} from URL: ${url}`, false);
        
        // 파일 크기를 먼저 확인 (catch 블록으로 에러 처리)
        let contentLength = 0;
        let fileSizeMB = 0;
        
        try {
            const headResponse = await axiosInstance.head(url);
            contentLength = parseInt(headResponse.headers['content-length'] || '0');
            fileSizeMB = contentLength / (1024 * 1024);
            log(`File size: ${fileSizeMB.toFixed(2)}MB for ${key}`, false);
        } catch (headError) {
            // HEAD 요청 실패 시 GET 요청으로 진행
            log(`HEAD request failed for ${url}, proceeding with download: ${headError.message}`, false);
        }
        
        // 파일 크기 제한 확인 (알려진 경우만)
        if (contentLength > 0 && fileSizeMB > 150) {
            log(`Skipping large file (>${150}MB): ${key}`, false);
            return { 
                Location: url,
                skipped: true
            };
        }
        
        // 다운로드 시작 로그
        log(`Downloading file: ${key}`, false);
        
        // arraybuffer로 다운로드
        const response = await axiosInstance({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            timeout: 300000, // 5분
            maxContentLength: 200 * 1024 * 1024, // 200MB
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FileTransferBot/1.0)'
            }
        });

        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const fileData = response.data; // arraybuffer 데이터
        
        // 다운로드 후 파일 크기 확인
        const downloadedFileSizeMB = fileData.byteLength / (1024 * 1024);
        log(`Download complete: ${key}, final size: ${downloadedFileSizeMB.toFixed(2)}MB`, false);
        
        // 다운로드 후 파일 크기 제한 검사 (contentLength가 정확하지 않을 수 있음)
        if (downloadedFileSizeMB > 150) {
            log(`Skipping large file after download (>${150}MB): ${key}`, false);
            return { 
                Location: url,
                skipped: true
            };
        }
        
        // 업로드 시작 로그
        log(`Starting S3 upload for: ${key}`, false);
        
        // AWS SDK v2를 사용한 안정적인 업로드
        return await new Promise((resolve, reject) => {
            // 스트림을 생성해서 안정성 향상
            const { Readable } = require('stream');
            const uploadStream = new Readable();

            // Buffer.from 대신 데이터를 직접 사용
            uploadStream.push(fileData);  // Buffer.from() 사용하지 않음
            uploadStream.push(null); // 스트림 종료 표시
            
            const uploadParams = {
                Bucket: config.world_bucketName,
                Key: key,
                Body: uploadStream,
                ContentType: contentType,
                ContentDisposition: 'inline',
                CacheControl: 'max-age=31536000'
            };
            
            // 5번의 재시도를 내장한 AWS SDK v2 업로드 메서드
            const managedUpload = s3.upload(uploadParams, {
                partSize: 10 * 1024 * 1024, // 10MB 파트 크기
                queueSize: 2 // 동시 업로드 수
            });
            
            // 진행상황 이벤트 리스너
            managedUpload.on('httpUploadProgress', (progress) => {
                if (progress.total) {
                    const percentage = Math.round((progress.loaded / progress.total) * 100);
                    if (percentage % 25 === 0) { // 25% 단위로만 로깅
                        logDebug(`Upload progress for ${key}: ${percentage}%`);
                    }
                }
            });
            
            // 업로드 완료 및 오류 처리
            managedUpload.send((err, data) => {
                if (err) {
                    log(`Upload failed for ${key}: ${err.message}`, true);
                    reject(err);
                } else {
                    log(`Successfully uploaded ${key} to S3`, false);
                    resolve({ Location: `https://cdn-world.ahhaohho.com/${key}` });
                }
            });
        }).catch(uploadError => {
            log(`Final upload error for ${key}: ${uploadError.message}`, true);
            return { 
                Location: url,
                uploadFailed: true,
                error: uploadError.message
            };
        });
    } catch (error) {
        if (error.response) {
            log(`HTTP error ${error.response.status} for ${key}: ${url}`, true);
        } else {
            log(`Error processing ${key}: ${error.message}`, true);
        }
        
        return { 
            Location: url,
            error: error.message
        };
    }
}

async function processRecord(record, mainKey, currentIndex, totalRecords) {
    logDebug(`Processing record ${currentIndex + 1}/${totalRecords} for ${mainKey}`);
    let totalFiles = 0;
    let successfulUploads = 0;
    let skippedFiles = 0;
    let failedUploads = 0;

    try {
        for (let key in record) {
            if (Array.isArray(record[key])) {
                for (let i = 0; i < record[key].length; i++) {
                    const file = record[key][i];
                    if (file && file.url) {
                        try {
                            totalFiles++;
                            const url = file.url;
                            const fileName = path.basename(url);
                            const s3Key = `${mainKey}/${fileName}`;

                            // URL에서 S3로 직접 업로드
                            const s3Response = await uploadFileFromUrlToS3(url, s3Key);
                            
                            // 스킵된 파일 처리
                            if (s3Response.skipped) {
                                skippedFiles++;
                                logDebug(`Skipped large file: ${url}`);
                            } else if (s3Response.uploadFailed) {
                                failedUploads++;
                                log(`Failed to upload: ${url}`, true);
                            } else {
                                successfulUploads++;
                                // URL 교체
                                file.url = s3Response.Location;
                            }

                            // 썸네일 URL도 교체 (원본이 스킵되지 않은 경우만)
                            if (file.thumbnails && !s3Response.skipped && !s3Response.uploadFailed) {
                                for (let size in file.thumbnails) {
                                    if (file.thumbnails[size].url) {
                                        try {
                                            totalFiles++;
                                            const thumbUrl = file.thumbnails[size].url;
                                            const thumbFileName = path.basename(thumbUrl);
                                            const thumbS3Key = `${mainKey}/thumbnails/${size}/${thumbFileName}`;

                                            // 썸네일 URL에서 S3로 직접 업로드
                                            const thumbS3Response = await uploadFileFromUrlToS3(thumbUrl, thumbS3Key);
                                            
                                            if (thumbS3Response.skipped) {
                                                skippedFiles++;
                                            } else if (thumbS3Response.uploadFailed) {
                                                failedUploads++;
                                            } else {
                                                successfulUploads++;
                                                // 썸네일 URL 교체
                                                file.thumbnails[size].url = thumbS3Response.Location;
                                            }
                                        } catch (thumbError) {
                                            failedUploads++;
                                            log(`Error processing thumbnail for ${file.url}: ${thumbError.message}`, true);
                                            // 썸네일 처리 실패 시 원본 URL 유지
                                        }
                                    }
                                }
                            }
                        } catch (fileError) {
                            failedUploads++;
                            log(`Error processing file ${file.url}: ${fileError.message}`, true);
                            // 개별 파일 처리 실패 시 다음 파일로 진행
                        }
                    }
                }
            }
        }

        logDebug(`Record ${currentIndex + 1}/${totalRecords} stats - Total: ${totalFiles}, Success: ${successfulUploads}, Skipped: ${skippedFiles}, Failed: ${failedUploads}`);
        return record;
    } catch (error) {
        log(`Error in processRecord for ${mainKey}: ${error.message}`, true);
        // 오류가 발생해도 원본 레코드 반환
        return record;
    }
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
    try {
        await initializeS3Client();

        const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const dataDir = path.join(process.cwd(), './services/world/rawData');

        await fs.mkdir(dataDir, { recursive: true });

        const totalTables = Object.keys(tableNames).length;
        let currentTableIndex = 0;
        let totalProcessedRecords = 0;
        let totalNewRecords = 0;
        let totalFailedTables = 0;

        console.log(`[${new Date().toISOString()}] Starting data processing for ${totalTables} tables...`);

        for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
            currentTableIndex++;
            try {
                console.log(`[${new Date().toISOString()}] Processing table ${currentTableIndex}/${totalTables}: ${tableName}`);
                const tableData = await fetchTableData('world', tableName, viewName);
                logDebug(`Fetched ${tableData.length} records from ${tableName}`);

                // Load existing data
                const existingData = await fetchExistingData(mainKey, dataDir);
                const existingIds = new Set(existingData.map(record => record.id));
                logDebug(`Found ${existingData.length} existing records for ${mainKey}`);

                // Process only new or updated records
                const newRecords = [];
                for (let i = 0; i < tableData.length; i++) {
                    const record = tableData[i];
                    if (!existingIds.has(record.id)) {
                        try {
                            const processedRecord = await processRecord(record, mainKey, i, tableData.length);
                            newRecords.push(processedRecord);
                        } catch (recordError) {
                            log(`Error processing record ${i} in ${tableName}: ${recordError.message}`, true);
                            // 실패한 레코드도 원본 추가
                            newRecords.push(record);
                        }
                    }
                    totalProcessedRecords++;
                }

                totalNewRecords += newRecords.length;
                
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
                logSuccess(`Table ${tableName}: Processed ${newRecords.length} new records, saved to ${fileName}`);
            } catch (error) {
                totalFailedTables++;
                log(`Error processing data for table ${tableName}: ${error.message}`, true);
                console.error(`Error details:`, error);
            }
        }

        console.log(`[${new Date().toISOString()}] Summary: Processed ${totalProcessedRecords} records, added ${totalNewRecords} new records, ${totalFailedTables} tables failed.`);
    } catch (error) {
        log(`An error occurred in main: ${error.message}`, true);
        console.error('Error details:', error);
    }
}

main().catch(error => console.error('An error occurred:', error));