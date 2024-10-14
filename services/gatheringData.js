process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { loadConfig } = require('../config/config');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { fetchTableData } = require('../middlewares/airtableClient');
const tableNames = require('./tableNames.json');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const os = require('os');
const crypto = require('crypto');

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
async function resizeAndCropVideo(inputPath, outputPath, targetWidth, targetHeight) {
    log(`비디오 크기 조정 및 크롭 작업 시작: ${inputPath}`);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 23',
                '-profile:v main',  // 'high10'에서 'main'으로 변경
                '-level:v 2.2',     // 레벨을 낮춤
                '-c:a aac',
                '-b:a 128k',
                '-movflags +faststart',
                '-max_muxing_queue_size 9999',
                `-vf scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,  // 8-bit로 변환
                '-maxrate 2M',
                '-bufsize 4M',
                '-r 30',
                '-g 60',
                '-sc_threshold 0',
                '-keyint_min 60'
            ])
            .outputOption('-threads 0')
            .videoCodec('libx264')
            .audioCodec('aac')
            .on('start', (commandLine) => {
                log(`FFmpeg 명령어: ${commandLine}`);
            })
            .on('progress', (progress) => {
                log(`처리 중: ${progress.percent}% 완료`);
            })
            .on('end', () => {
                log(`비디오 처리 완료: ${outputPath}`);
                resolve();
            })
            .on('error', (error, stdout, stderr) => {
                log(`비디오 처리 오류 발생 ${inputPath}: ${error.message}`);
                log(`FFmpeg stdout: ${stdout}`);
                log(`FFmpeg stderr: ${stderr}`);
                reject(error);
            })
            .save(outputPath);
    });
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

    if (contentType.startsWith('video/')) {
        const tempInputPath = path.join(os.tmpdir(), `input_${crypto.randomBytes(6).toString('hex')}.mp4`);
        const tempOutputPath = path.join(os.tmpdir(), `output_${crypto.randomBytes(6).toString('hex')}.mp4`);

        try {
            // 임시 파일로 저장
            const writer = fsSync.createWriteStream(tempInputPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // FFmpeg를 사용하여 비디오 변환
            const targetWidth = 1136;
            const targetHeight = 1418;
            await resizeAndCropVideo(tempInputPath, tempOutputPath, targetWidth, targetHeight);

            // 변환된 파일을 S3에 업로드
            const fileStream = fsSync.createReadStream(tempOutputPath);
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: config.aws_s3_bucketName,
                    Key: key,
                    Body: fileStream,
                    ContentType: 'video/mp4',
                    ContentDisposition: 'inline',
                    CacheControl: 'max-age=31536000',
                    Metadata: {
                        'x-amz-meta-Cache-Control': 'max-age=31536000'
                    }
                },
            });

            await upload.done();

            return { Location: `https://cdn-challenge.ahhaohho.com/${key}` };
        } catch (error) {
            console.error('Error processing video:', error);
            throw error;
        } finally {
            // 임시 파일 삭제
            await fs.unlink(tempInputPath).catch(() => {});
            await fs.unlink(tempOutputPath).catch(() => {});
        }
    } else {
        // 비디오 파일이 아닌 경우
        const upload = new Upload({
            client: s3Client,
            params: {
                Bucket: config.aws_s3_bucketName,
                Key: key,
                Body: response.data,
                ContentType: contentType,
            },
        });

        await upload.done();

        return { Location: `https://cdn-challenge.ahhaohho.com/${key}` };
    }
}

async function processRecord(record, mainKey) {
    for (let key in record) {
        if (Array.isArray(record[key])) {
            for (let file of record[key]) {
                if (file && file.url) {
                    const url = file.url;
                    const fileName = path.basename(url);
                    const s3Key = `${mainKey}/${fileName}`;

                    // URL에서 S3로 직접 업로드 (비디오 처리 포함)
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

    for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
        try {
            const tableData = await fetchTableData(tableName, viewName);

            // Load existing data
            const existingData = await fetchExistingData(mainKey, dataDir);
            const existingIds = new Set(existingData.map(record => record.id));

            // Process only new or updated records
            const newRecords = [];
            for (let record of tableData) {
                if (!existingIds.has(record.id)) {
                    const processedRecord = await processRecord(record, mainKey);
                    newRecords.push(processedRecord);
                }
            }

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