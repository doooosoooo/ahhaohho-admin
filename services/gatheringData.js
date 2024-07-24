const { loadConfig } = require('../config/config');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const axios = require('axios');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { fetchTableData } = require('../middlewares/airtableClient');
const tableNames = require('./tableNames.json');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const os = require('os');

let config;
let s3Client;

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
        const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
        const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

        try {
            // 임시 파일로 저장
            const writer = fsSync.createWriteStream(tempInputPath);
            response.data.pipe(writer);
            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // FFmpeg를 사용하여 비디오 변환
            await new Promise((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-crf 23',
                        '-preset medium',
                        '-c:a aac',
                        '-b:a 128k'
                    ])
                    .output(tempOutputPath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            // 변환된 파일을 S3에 업로드
            const fileStream = fsSync.createReadStream(tempOutputPath);
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: config.aws_s3_bucketName,
                    Key: key,
                    Body: fileStream,
                    ContentType: 'video/mp4',
                },
            });

            await upload.done();

            return { Location: `https://${config.aws_s3_bucketName}.s3.${config.aws_region}.amazonaws.com/${key}` };
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

        return { Location: `https://${config.aws_s3_bucketName}.s3.${config.aws_region}.amazonaws.com/${key}` };
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
}

async function main() {
    await initializeS3Client();

    const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const dataDir = path.join(__dirname, 'contentsRawData');

    // data 폴더가 존재하지 않으면 생성
    await fs.mkdir(dataDir, { recursive: true });

    for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
        try {
            const tableData = await fetchTableData(tableName, viewName);
            
            // URL에서 파일을 다운로드하여 S3에 업로드하고 URL을 교체
            for (let record of tableData) {
                await processRecord(record, mainKey);
            }

            const jsonData = JSON.stringify(tableData, null, 2);
            const fileName = `${mainKey}-updateAt${updateDate}.json`;
            const filePath = path.join(dataDir, fileName);

            const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);

            const files = await fs.readdir(dataDir);
            for (const file of files) {
                if (mainKeyPattern.test(file)) {
                    await fs.unlink(path.join(dataDir, file));
                }
            }

            await fs.writeFile(filePath, jsonData, 'utf8');
            console.log(`JSON data has been saved to ${filePath}`);
        } catch (error) {
            console.error(`Error fetching data for table ${tableName}:`, error.message);
        }
    }
}

main().catch(error => console.error('An error occurred:', error));