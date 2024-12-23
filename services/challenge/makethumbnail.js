process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';


const AWS = require('aws-sdk');
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

async function downloadFile(url, localPath) {
    log(`Downloading file: ${url}`);
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
}

async function uploadFile(localPath, fullPath) {
    if (!s3) await initializeS3Client();

    log(`Uploading file: ${fullPath}`);
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(localPath);
        const params = {
            Bucket: config.aws_s3_bucketName,
            Key: fullPath,
            Body: fileStream,
            ContentType: 'image/jpeg',
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'x-amz-meta-Cache-Control': 'max-age=31536000'
            }
        };

        s3.upload(params, (err, data) => {
            if (err) {
                log(`Error uploading file ${fullPath}: ${err.message}`);
                reject(err);
            } else {
                log(`File uploaded successfully: ${fullPath}`);
                const cdnUrl = `https://cdn-challenge.ahhaohho.com/${fullPath}`;
                resolve(cdnUrl);
            }
        });
    });
}

async function generateThumbnail(inputPath, outputPath, size) {
    log(`Generating thumbnail: ${size}`);
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
}


async function extractVideoFrame(inputPath, outputPath) {
    log(`Extracting video frame: ${inputPath}`);
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .screenshots({
                count: 1,
                folder: path.dirname(outputPath),
                filename: path.basename(outputPath),
            })
            .on('end', () => resolve())
            .on('error', (err) => reject(err));
    });
}


async function processThumbnails() {
    const client = new MongoClient(MONGO_URI);

    try {
        log('Starting thumbnail processing...');
        await initializeS3Client();
        await client.connect();
        log('Connected to MongoDB');

        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        const cursor = collection.find({ 'thumbnail.defaultUrl': { $exists: true } });

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            log(`Processing document: ${doc._id}`);

            const thumbnail = doc.thumbnail;
            if (thumbnail && thumbnail.defaultUrl) {
                log(`Processing thumbnail: ${thumbnail.defaultUrl}`);

                const localInput = path.join(os.tmpdir(), `input_${crypto.randomBytes(6).toString('hex')}`);
                const localFrame = path.join(os.tmpdir(), `frame_${crypto.randomBytes(6).toString('hex')}.jpg`);

                try {
                    await downloadFile(thumbnail.defaultUrl, localInput);

                    if (thumbnail.type === 'video/mp4') {
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

                        fs.unlinkSync(localOutput);
                    }

                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { 'thumbnail.thumbnail': thumbnailUrls } }
                    );
                    log(`Updated MongoDB document with new thumbnail URLs`);

                } catch (error) {
                    log(`Error processing ${thumbnail.defaultUrl}: ${error.message}`);
                } finally {
                    if (fs.existsSync(localInput)) fs.unlinkSync(localInput);
                    if (fs.existsSync(localFrame)) fs.unlinkSync(localFrame);
                }
            } else {
                log(`Skipping document ${doc._id}: Invalid thumbnail structure`);
            }
        }

        log('Processing completed.');
    } catch (error) {
        log(`Fatal error: ${error.message}`);
    } finally {
        await client.close();
        log('MongoDB connection closed');
    }
}

processThumbnails().then(() => {
    log('Script execution completed.');
}).catch((error) => {
    log(`Script execution failed: ${error.message}`);
});