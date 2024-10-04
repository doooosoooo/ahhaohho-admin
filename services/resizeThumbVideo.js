const AWS = require('aws-sdk');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { loadConfig } = require('../config/config');
const crypto = require('crypto');
const os = require('os');

// MongoDB 설정
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dsoojung:wjdentnqw12!@cluster-0.7gagbcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-0';
const DB_NAME = 'challengeDB';
const COLLECTION_NAME = 'contents';

let s3;
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
        s3 = new AWS.S3({
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

async function downloadFile(fullPath, localPath) {
    if (!s3) await initializeS3Client();

    log(`Downloading file: ${fullPath}`);
    return new Promise((resolve, reject) => {
        const params = {
            Bucket: config.aws_s3_bucketName,
            Key: fullPath
        };
        log(`Download params: ${JSON.stringify(params)}`);
        const file = fs.createWriteStream(localPath);

        s3.getObject(params)
            .createReadStream()
            .pipe(file)
            .on('close', () => {
                log(`File downloaded successfully: ${fullPath}`);
                resolve(localPath);
            })
            .on('error', (error) => {
                log(`Error downloading file ${fullPath}: ${error.message}`);
                reject(error);
            });
    });
}

async function uploadFile(localPath, fullPath) {
    if (!s3) await initializeS3Client();

    fullPath = fullPath.replace(/\.mp4\.mp4/, '.mp4');

    log(`Uploading file: ${fullPath}`);
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(localPath);
        const params = {
            Bucket: config.aws_s3_bucketName,
            Key: fullPath,
            Body: fileStream,
            ContentType: 'video/mp4',
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'x-amz-meta-Cache-Control': 'max-age=31536000'
            }
        };
        log(`Upload params: ${JSON.stringify(params)}`);

        s3.upload(params, (err, data) => {
            if (err) {
                log(`Error uploading file ${fullPath}: ${err.message}`);
                reject(err);
            } else {
                log(`File uploaded successfully: ${fullPath}`);
                // S3 URL 대신 CDN URL 생성
                const cdnUrl = `https://cdn-challenge.ahhaohho.com/${fullPath}`;
                resolve(cdnUrl);
            }
        });
    });
}

async function resizeAndCropVideo(inputPath, outputPath, targetWidth, targetHeight) {
    log(`Resizing and cropping video: ${inputPath}`);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 23',
                '-profile:v baseline',  // 'high10'에서 'main'으로 변경
                '-level:v 2.2',     // 레벨도 낮춤
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
                log(`FFmpeg command: ${commandLine}`);
            })
            .on('progress', (progress) => {
                log(`Processing: ${progress.percent}% done`);
            })
            .on('end', () => {
                log(`Video processed successfully: ${outputPath}`);
                resolve();
            })
            .on('error', (error, stdout, stderr) => {
                log(`Error processing video ${inputPath}: ${error.message}`);
                log(`FFmpeg stdout: ${stdout}`);
                log(`FFmpeg stderr: ${stderr}`);
                reject(error);
            })
            .save(outputPath);
    });
}

async function processVideos() {
    const client = new MongoClient(MONGO_URI);

    try {
        log('Starting video processing...');
        await initializeS3Client();
        await client.connect();
        log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const cursor = collection.find({ 'thumbnail.type': 'video/mp4' });
        let totalCount = 0;
        let processedCount = 0;
        let errorCount = 0;

        totalCount = await collection.countDocuments({ 'thumbnail.type': 'video/mp4' });
        log(`Total documents with video thumbnails: ${totalCount}`);

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            log(`Processing document: ${doc._id}`);

            const thumbnail = doc.thumbnail;
            log(`Thumbnail: ${JSON.stringify(thumbnail)}`);

            if (thumbnail && thumbnail.defaultUrl) {
                log(`Processing video: ${thumbnail.defaultUrl}`);

                let fullPath = new URL(thumbnail.defaultUrl).pathname.slice(1);
                fullPath = fullPath.replace(/\.mp4\.mp4/, '.mp4');

                const localInput = path.join(os.tmpdir(), `input_${crypto.randomBytes(6).toString('hex')}.mp4`);
                const localOutput = path.join(os.tmpdir(), `output_${crypto.randomBytes(6).toString('hex')}.mp4`);

                try {
                    await downloadFile(fullPath, localInput);

                    const targetWidth = 1136;
                    const targetHeight = 1418;

                    await resizeAndCropVideo(localInput, localOutput, targetWidth, targetHeight);

                    const newUrl = await uploadFile(localOutput, fullPath);

                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { 'thumbnail.defaultUrl': newUrl } }
                    );
                    log(`Updated MongoDB document with new URL: ${newUrl}`);

                    log(`Successfully processed and updated ${fullPath}`);
                    processedCount++;
                } catch (error) {
                    log(`Error processing ${fullPath}: ${error.message}`);
                    errorCount++;
                } finally {
                    if (fs.existsSync(localInput)) fs.unlinkSync(localInput);
                    if (fs.existsSync(localOutput)) fs.unlinkSync(localOutput);
                }
            } else {
                log(`Skipping document ${doc._id}: Invalid thumbnail structure`);
            }
        }

        log(`Processing completed. Total: ${totalCount}, Processed: ${processedCount}, Errors: ${errorCount}, Skipped: ${totalCount - processedCount - errorCount}`);
    } catch (error) {
        log(`Fatal error: ${error.message}`);
    } finally {
        await client.close();
        log('MongoDB connection closed');
    }
}

processVideos().then(() => {
    log('Script execution completed.');
}).catch((error) => {
    log(`Script execution failed: ${error.message}`);
});