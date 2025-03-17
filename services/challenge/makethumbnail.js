/* global process, __dirname */
// Security best practice: Don't disable certificate verification in production
 process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const axios = require('axios');
const { loadConfig } = require('../../config/config');
const crypto = require('crypto');
const os = require('os');

// MongoDB 설정
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dsoojung:wjdentnqw12!@cluster-0.7gagbcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-0';
const DB_NAME = 'challengeDB';
const COLLECTION_NAME = 'contents';

let s3Client;
let config;

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

async function initializeS3Client() {
    try {
        log('Initializing S3 client...');
        if (!config) {
            config = await loadConfig();
            log('Config loaded successfully.');
        }
        s3Client = new S3Client({
            region: config.aws_region,
            credentials: {
                accessKeyId: config.aws_accessKeyId,
                secretAccessKey: config.aws_secretAccessKey
            }
        });
        log('S3 client initialized successfully.');
    } catch (error) {
        log(`Error initializing S3 client: ${error.message}`);
        throw error;
    }
}

async function downloadFile(url, localPath) {
    log(`Downloading file: ${url}`);
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        log(`Error downloading file from ${url}: ${error.message}`);
        throw error;
    }
}

async function uploadFile(localPath, fullPath) {
    if (!s3Client) await initializeS3Client();

    log(`Uploading file: ${fullPath}`);
    try {
        const fileStream = fs.createReadStream(localPath);
        const params = {
            Bucket: config.challenge_bucketName,
            Key: fullPath,
            Body: fileStream,
            ContentType: 'image/jpeg',
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'x-amz-meta-Cache-Control': 'max-age=31536000'
            }
        };

        await s3Client.send(new PutObjectCommand(params));
        log(`File uploaded successfully: ${fullPath}`);
        const cdnUrl = `https://cdn-challenge.ahhaohho.com/${fullPath}`;
        return cdnUrl;
    } catch (error) {
        log(`Error uploading file ${fullPath}: ${error.message}`);
        throw error;
    }
}

async function generateThumbnail(inputPath, outputPath, size) {
    log(`Generating thumbnail: ${size}px`);
    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        const aspectRatio = metadata.width / metadata.height;

        let width, height;
        if (aspectRatio > 1) {
            // Landscape orientation
            width = size;
            height = Math.round(size / aspectRatio);
        } else {
            // Portrait or square orientation
            height = size;
            width = Math.round(size * aspectRatio);
        }

        return image
            .resize({
                width,
                height,
                fit: sharp.fit.inside,
                withoutEnlargement: true
            })
            .toFile(outputPath);
    } catch (error) {
        log(`Error generating thumbnail: ${error.message}`);
        throw error;
    }
}

async function extractVideoFrame(inputPath, outputPath) {
    log(`Extracting video frame: ${inputPath}`);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                count: 1,
                folder: path.dirname(outputPath),
                filename: path.basename(outputPath),
                // 비디오 시작 후 1초 지점의 프레임 추출
                timestamps: ['1%']
            })
            .on('end', () => {
                log(`Frame extracted successfully: ${outputPath}`);
                resolve();
            })
            .on('error', (err) => {
                log(`Error extracting frame: ${err.message}`);
                reject(err);
            });
    });
}

async function processThumbnails() {
    let client;
    try {
        log('Starting thumbnail processing...');
        await initializeS3Client();
        
        log('Connecting to MongoDB...');
        client = new MongoClient(MONGO_URI);
        await client.connect();
        log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // 문서 수 확인
        const totalCount = await collection.countDocuments();
        const mediaCount = await collection.countDocuments({ 'media': { $exists: true } });
        const mediaUrlCount = await collection.countDocuments({ 'media.defaultUrl': { $exists: true } });
        
        log(`Total documents: ${totalCount}`);
        log(`Documents with media field: ${mediaCount}`);
        log(`Documents with media.defaultUrl: ${mediaUrlCount}`);

        // 쿼리 수정: media 필드가 있으면서 썸네일이 없는 문서 검색
        const cursor = collection.find({ 
            'media': { $exists: true },
            'media.defaultUrl': { $exists: true, $ne: null },
            $or: [
                { 'media.thumbnail.tiny': { $exists: false } },
                { 'media.thumbnail.tiny': null }
            ]
        });
        
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            log(`Processing document: ${doc._id}`);
            processedCount++;

            const media = doc.media;
            // defaultUrl이 없는 경우도 처리
            if (!media || !media.defaultUrl) {
                log(`Document ${doc._id} has no media.defaultUrl, skipping`);
                continue;
            }

            log(`Processing media: ${media.defaultUrl}`);

            const localInput = path.join(os.tmpdir(), `input_${crypto.randomBytes(6).toString('hex')}`);
            const localFrame = path.join(os.tmpdir(), `frame_${crypto.randomBytes(6).toString('hex')}.jpg`);

            try {
                await downloadFile(media.defaultUrl, localInput);

                if (media.type === 'video/mp4') {
                    await extractVideoFrame(localInput, localFrame);
                } else {
                    fs.copyFileSync(localInput, localFrame);
                }

                const sizes = {
                    tiny: 100,
                    small: 300,
                    medium: 600,
                    large: 1200
                };

                const thumbnailUrls = {};

                for (const [size, dimension] of Object.entries(sizes)) {
                    const localOutput = path.join(os.tmpdir(), `output_${size}_${crypto.randomBytes(6).toString('hex')}.jpg`);
                    await generateThumbnail(localFrame, localOutput, dimension);

                    const s3Key = `thumbnails/${size}/${doc._id}_${path.basename(localOutput)}`;
                    const cdnUrl = await uploadFile(localOutput, s3Key);
                    thumbnailUrls[size] = cdnUrl;

                    if (fs.existsSync(localOutput)) fs.unlinkSync(localOutput);
                }

                // 각 크기의 썸네일 URL을 스키마에 맞게 직접 설정
                await collection.updateOne(
                    { _id: doc._id },
                    { 
                        $set: { 
                            'media.thumbnail': {
                                tiny: thumbnailUrls.tiny,
                                small: thumbnailUrls.small,
                                medium: thumbnailUrls.medium,
                                large: thumbnailUrls.large
                            }
                        }
                    }
                );
                log(`Updated MongoDB document ${doc._id} with new thumbnail URLs`);
                successCount++;

            } catch (error) {
                log(`Error processing ${doc._id}: ${error.message}`);
                errorCount++;
            } finally {
                if (fs.existsSync(localInput)) fs.unlinkSync(localInput);
                if (fs.existsSync(localFrame)) fs.unlinkSync(localFrame);
            }
        }

        log(`Processing summary: Total=${processedCount}, Success=${successCount}, Errors=${errorCount}`);
    } catch (error) {
        log(`Fatal error: ${error.message}`);
        if (error.stack) log(`Error stack: ${error.stack}`);
    } finally {
        if (client) {
            await client.close();
            log('MongoDB connection closed');
        }
        log('Script execution completed.');
    }
}

// 스크립트 실행
processThumbnails().catch((error) => {
    log(`Script execution failed: ${error.message}`);
    process.exit(1);
});