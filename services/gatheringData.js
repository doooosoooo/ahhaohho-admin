const { loadConfig } = require('../config/config');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AWS = require('aws-sdk');
const { fetchTableData } = require('../middlewares/airtableClient');
const tableNames = require('./tableNames.json');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);
const os = require('os');

let config;

async function uploadFileFromUrlToS3(url, key) {
    if (!config) {
        config = await loadConfig();
    }

    const s3 = new AWS.S3({
        region: config.aws_region,
        accessKeyId: config.aws_accessKeyId,
        secretAccessKey: config.aws_secretAccessKey
    });

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    const contentType = response.headers['content-type'];

    // 비디오 파일인 경우 변환
    if (contentType.startsWith('video/')) {
        const tempInputPath = path.join(os.tmpdir(), `input_${Date.now()}.mp4`);
        const tempOutputPath = path.join(os.tmpdir(), `output_${Date.now()}.mp4`);

        // 임시 파일로 저장
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tempInputPath);
            response.data.pipe(writer);
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
        const fileStream = fs.createReadStream(tempOutputPath);
        const uploadParams = {
            Bucket: config.aws_s3_bucketName,
            Key: key,
            Body: fileStream,
            ContentType: 'video/mp4',
        };

        const result = await s3.upload(uploadParams).promise();

        // 임시 파일 삭제
        fs.unlinkSync(tempInputPath);
        fs.unlinkSync(tempOutputPath);

        return result;
    } else {
        // 비디오 파일이 아닌 경우 기존 로직 수행
        const uploadParams = {
            Bucket: config.aws_s3_bucketName,
            Key: key,
            Body: response.data,
            ContentType: contentType,
        };

        return s3.upload(uploadParams).promise();
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
    if (!config) {
        config = await loadConfig(); // config를 로드
    }

    const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 현재 날짜를 YYYYMMDD 형식으로 변환
    const dataDir = path.join(__dirname, 'contentsRawData');

    // data 폴더가 존재하지 않으면 생성
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    for (const [mainKey, { tableName, viewName }] of Object.entries(tableNames)) {
        try {
            const tableData = await fetchTableData(tableName, viewName);
            
            // URL에서 파일을 다운로드하여 S3에 업로드하고 URL을 교체
            for (let record of tableData) {
                await processRecord(record, mainKey);
            }

            const jsonData = JSON.stringify(tableData, null, 2); // JSON 데이터를 읽기 쉽도록 들여쓰기
            const fileName = `${mainKey}-updateAt${updateDate}.json`; // 파일 이름
            const filePath = path.join(dataDir, fileName); // 파일 경로

            const mainKeyPattern = new RegExp(`${mainKey}-updateAt\\d{8}.json`);

            fs.readdirSync(dataDir).forEach(file => {
                if (mainKeyPattern.test(file)) {
                    fs.unlinkSync(path.join(dataDir, file));
                }
            });

            fs.writeFileSync(filePath, jsonData, 'utf8');
            console.log(`JSON data has been saved to ${filePath}`);
        } catch (error) {
            console.error(`Error fetching data for table ${tableName}:`, error.message);
        }
    }
}

main();
