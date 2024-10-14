// Remove this line
const mongoose = require('mongoose');
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { loadConfig } = require('../config/config');
const crypto = require('crypto');
const os = require('os');

// MongoDB 설정
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://dsoojung:wjdentnqw12!@cluster-0.7gagbcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-0';

let s3Client;
let config;

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Mongoose 스키마 정의
const contentSchema = new mongoose.Schema({
    thumbnail: {
        type: { type: String },
        defaultUrl: String
    }
});

const Content = mongoose.model('Content', contentSchema, 'contents');

async function connectToMongoDB() {
    try {
        log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false
        });
        log('Connected to MongoDB');
    } catch (error) {
        log(`Error connecting to MongoDB: ${error.message}`);
        throw error;
    }
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

async function downloadFile(fullPath, localPath) {
    if (!s3Client) await initializeS3Client();

    log(`Downloading file: ${fullPath}`);
    const params = {
        Bucket: config.aws_s3_bucketName,
        Key: fullPath
    };
    log(`Download params: ${JSON.stringify(params)}`);

    try {
        const { Body } = await s3Client.send(new GetObjectCommand(params));
        const writeStream = fs.createWriteStream(localPath);
        await new Promise((resolve, reject) => {
            Body.pipe(writeStream)
                .on('finish', resolve)
                .on('error', reject);
        });
        log(`File downloaded successfully: ${fullPath}`);
        return localPath;
    } catch (error) {
        log(`Error downloading file ${fullPath}: ${error.message}`);
        throw error;
    }
}

async function uploadFile(localPath, fullPath) {
    if (!s3Client) await initializeS3Client();

    fullPath = fullPath.replace(/\.mp4\.mp4/, '.mp4');

    log(`Uploading file: ${fullPath}`);
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

    try {
        await s3Client.send(new PutObjectCommand(params));
        log(`File uploaded successfully: ${fullPath}`);
        const cdnUrl = `https://cdn-challenge.ahhaohho.com/${fullPath}`;
        return cdnUrl;
    } catch (error) {
        log(`Error uploading file ${fullPath}: ${error.message}`);
        throw error;
    }
}

async function resizeAndCropVideo(inputPath, outputPath, targetWidth, targetHeight) {
    log(`Resizing and cropping video: ${inputPath}`);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 23',
                '-profile:v baseline',
                '-level:v 2.2',
                '-c:a aac',
                '-b:a 128k',
                '-movflags +faststart',
                '-max_muxing_queue_size 9999',
                `-vf scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,
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
    try {
        log('Starting video processing...');
        await initializeS3Client();
        await connectToMongoDB();
        
        log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: false,
            tlsAllowInvalidHostnames: false
        });
        log('Connected to MongoDB');

        const totalCount = await Content.countDocuments({ 'thumbnail.type': 'video/mp4' });
        log(`Total documents with video thumbnails: ${totalCount}`);

        let processedCount = 0;
        let errorCount = 0;

        const cursor = Content.find({ 'thumbnail.type': 'video/mp4' }).cursor();

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
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

                    doc.thumbnail.defaultUrl = newUrl;
                    await doc.save();
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
        if (error.stack) log(`Error stack: ${error.stack}`);
        if (error.code) log(`Error code: ${error.code}`);
        if (error.name) log(`Error name: ${error.name}`);
        if (error.cause) log(`Error cause: ${JSON.stringify(error.cause)}`);
    } finally {
        await mongoose.disconnect();
        log('MongoDB connection closed');
    }
}

processVideos().then(() => {
    log('Script execution completed.');
}).catch((error) => {
    log(`Script execution failed: ${error.message}`);
});