/* global process */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('dotenv').config();
const mongoose = require('mongoose');
const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const { loadConfig } = require('../../config/config');
const crypto = require('crypto');
const os = require('os');

// MongoDB 설정
const MONGO_URI = process.env.MONGO_URI;

let s3Client;
let config;
const failedDocuments = []; // 실패한 문서 ID 저장

function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

// Mongoose 스키마 정의 - 실제 DB 구조에 맞게 업데이트
const mediaSchema = new mongoose.Schema({
    type: { type: String },
    defaultUrl: String,
    sound: { type: Boolean, default: false },
    thumbnail: {
        tiny: { type: String },
        small: { type: String },
        medium: { type: String },
        large: { type: String }
    }
});

const contentsSchema = new mongoose.Schema({
    title: String,
    media: mediaSchema
}, { collection: 'contents' });

const Content = mongoose.model('Content', contentsSchema);

async function connectToMongoDB() {
    try {
        log('Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, {
            dbName: 'challengeDB',
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
            
            // 설정 디버깅
            log(`AWS Region: ${config.aws_region || 'undefined'}`);
            log(`AWS Bucket: ${config.aws_s3_bucketName || 'undefined'}`);
            
            // 설정이 없거나 불완전한 경우 기본값 설정
            if (!config.aws_region) config.aws_region = 'ap-northeast-2';
            if (!config.aws_s3_bucketName) config.aws_s3_bucketName = 'ahhaohho-challenge';
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

// 재시도 로직이 포함된 다운로드 함수
async function downloadWithRetry(url, localPath, maxRetries = 3) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            await downloadFromUrl(url, localPath);
            return;
        } catch (error) {
            attempts++;
            log(`Download attempt ${attempts} failed for ${url}: ${error.message}`);
            if (attempts >= maxRetries) throw error;
            // 재시도 전에 잠시 대기 (지수 백오프)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
    }
}

async function downloadFromUrl(url, localPath) {
    log(`Downloading from URL: ${url}`);
    try {
        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 30000 // 30초 타임아웃
        });

        const writer = fs.createWriteStream(localPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    } catch (error) {
        log(`Error downloading from URL ${url}: ${error.message}`);
        throw error;
    }
}

// S3 업로드 함수 (커스텀 옵션 지원)
async function uploadFile(localPath, fullPath, customOptions = {}) {
    if (!s3Client) await initializeS3Client();

    fullPath = fullPath.replace(/\.mp4\.mp4/, '.mp4');

    log(`Uploading file: ${fullPath}`);
    try {
        const fileStream = fs.createReadStream(localPath);
        const fileSize = fs.statSync(localPath).size;
        
        // 파일 확장자 기반으로 ContentType 결정
        let contentType = 'video/mp4';
        
        // 디버깅을 위해 파라미터 로깅
        const bucketName = config.aws_s3_bucketName;
        log(`Using bucket: ${bucketName}, File size: ${fileSize} bytes, Content-Type: ${contentType}`);
        
        // 자동재생 관련 메타데이터 추가
        const metadata = {
            'x-amz-meta-Cache-Control': 'max-age=31536000',
            'x-amz-meta-autoplay': 'true',
            'x-amz-meta-playsinline': 'true',
            'x-amz-meta-muted': 'true',
            'x-amz-meta-loop': 'true'
        };
        
        // 커스텀 옵션과 기본 옵션 병합
        const params = {
            Bucket: bucketName,
            Key: fullPath,
            Body: fileStream,
            ContentType: contentType,
            ContentDisposition: customOptions.contentDisposition || 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {...metadata, ...(customOptions.metadata || {})}
        };
        
        await s3Client.send(new PutObjectCommand(params));
        log(`File uploaded successfully: ${fullPath}`);
        
        // CDN URL 생성 및 자동재생 파라미터 추가
        const cdnUrl = `https://cdn-challenge.ahhaohho.com/${fullPath}`;
        const urlWithParams = `${cdnUrl}?autoplay=1&muted=1&loop=1&playsinline=1&t=${Date.now()}`;
        log(`Generated URL with autoplay params: ${urlWithParams}`);
        
        return urlWithParams;
    } catch (error) {
        log(`Error uploading file ${fullPath}: ${error.message}`);
        throw error;
    }
}

// 재시도 로직이 포함된 업로드 함수
async function uploadWithRetry(localPath, fullPath, maxRetries = 3, customOptions = {}) {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            return await uploadFile(localPath, fullPath, customOptions);
        } catch (error) {
            attempts++;
            log(`Upload attempt ${attempts} failed for ${fullPath}: ${error.message}`);
            if (attempts >= maxRetries) throw error;
            // 재시도 전에 잠시 대기 (지수 백오프)
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
        }
    }
}

async function resizeAndCropVideo(inputPath, outputPath, targetWidth, targetHeight) {
    log(`Resizing and cropping video: ${inputPath} to ${targetWidth}x${targetHeight}`);
    
    return new Promise((resolve, reject) => {
        // 먼저 입력 파일의 코덱 및 메타데이터 정보를 확인합니다.
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                log(`Error probing file: ${err.message}`);
                return reject(err);
            }

            const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
            if (!videoStream) {
                log(`No video stream found in the file`);
                return reject(new Error('No video stream found'));
            }
            
            const inputCodec = videoStream.codec_name || 'unknown';
            const pixFmt = videoStream.pix_fmt || 'unknown';
            const duration = videoStream.duration || metadata.format.duration || 0;
            
            log(`Input video metadata: codec=${inputCodec}, pix_fmt=${pixFmt}, duration=${duration}s, resolution=${videoStream.width}x${videoStream.height}`);
            
            // 10비트 색심도 확인
            const is10BitColor = pixFmt && pixFmt.includes('10');
            if (is10BitColor) {
                log(`10-bit color depth detected: ${pixFmt}, will convert to 8-bit`);
            }

            let ffmpegCommand = ffmpeg(inputPath);

            ffmpegCommand
                .outputOptions([
                    '-c:v libx264',  
                    '-preset slower',
                    '-crf 24',
                    '-profile:v baseline',
                    '-level:v 3.0',
                    '-pix_fmt yuv420p',
                    '-movflags +faststart',
                    '-max_muxing_queue_size 9999',
                    `-vf scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1`,
                    '-maxrate 2M',
                    '-bufsize 4M',
                    '-r 24',
                    '-g 48',
                    '-sc_threshold 0',
                    '-keyint_min 48',
                    '-err_detect ignore_err',
                ])
                .outputOption('-threads 0')
                .videoCodec('libx264')
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
                    if (stdout) log(`FFmpeg stdout: ${stdout}`);
                    if (stderr) log(`FFmpeg stderr: ${stderr}`);
                    reject(error);
                })
                .save(outputPath);
        });
    });
}

// HEVC 비디오 파일 처리 실패 시 대체 처리 함수
async function convertHevcWithSimpleCommand(inputPath, outputPath, targetWidth, targetHeight) {
    log(`Attempting alternative conversion for HEVC video: ${inputPath} to ${targetWidth}x${targetHeight}`);
    
    return new Promise((resolve, reject) => {
        // 간단한 명령으로 HEVC 파일 변환 시도
        ffmpeg(inputPath)
            .outputOptions([
                '-c:v libx264',
                '-preset ultrafast', // 가장 빠른 인코딩 사용
                '-crf 28', // 품질 약간 낮춤
                '-pix_fmt yuv420p',
                `-vf scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2`,
            ])
            .on('start', (commandLine) => {
                log(`Alternative FFmpeg command: ${commandLine}`);
            })
            .on('end', () => {
                log(`Alternative conversion successful: ${outputPath}`);
                resolve();
            })
            .on('error', (error) => {
                log(`Alternative conversion failed: ${error.message}`);
                reject(error);
            })
            .save(outputPath);
    });
}

// 썸네일 크기 정의
const THUMBNAIL_SIZES = {
    tiny: { width: 284, height: 355 },
    small: { width: 568, height: 709 },
    medium: { width: 852, height: 1064 },
    large: { width: 1136, height: 1418 }
};

// 비디오에서 이미지 썸네일 추출 함수
async function extractImageThumbnail(inputVideoPath, outputImagePath, time = '00:00:00', width, height) {
    log(`Extracting image thumbnail from ${inputVideoPath} at ${time}, size: ${width}x${height}`);
    
    return new Promise((resolve, reject) => {
        ffmpeg(inputVideoPath)
            .screenshots({
                timestamps: [time],
                filename: path.basename(outputImagePath),
                folder: path.dirname(outputImagePath),
                size: `${width}x${height}`,
                fastSeek: true
            })
            .on('end', () => {
                log(`Image thumbnail extracted successfully: ${outputImagePath}`);
                resolve(outputImagePath);
            })
            .on('error', (error) => {
                log(`Error extracting image thumbnail: ${error.message}`);
                reject(error);
            });
    });
}

// 이미지 파일 S3 업로드 함수
async function uploadImageToS3(imagePath, s3Key) {
    if (!s3Client) await initializeS3Client();
    
    log(`Uploading image: ${s3Key}`);
    try {
        const fileStream = fs.createReadStream(imagePath);
        const fileSize = fs.statSync(imagePath).size;
        
        // 파일 확장자에 따른 ContentType 결정
        const extension = path.extname(imagePath).toLowerCase();
        let contentType = 'image/jpeg'; // 기본값
        
        if (extension === '.png') {
            contentType = 'image/png';
        } else if (extension === '.gif') {
            contentType = 'image/gif';
        } else if (extension === '.webp') {
            contentType = 'image/webp';
        }
        
        const bucketName = config.aws_s3_bucketName;
        log(`Using bucket: ${bucketName}, File size: ${fileSize} bytes, Content-Type: ${contentType}`);
        
        const params = {
            Bucket: bucketName,
            Key: s3Key,
            Body: fileStream,
            ContentType: contentType,
            ContentDisposition: 'inline',
            CacheControl: 'max-age=31536000',
            Metadata: {
                'x-amz-meta-Cache-Control': 'max-age=31536000'
            }
        };
        
        await s3Client.send(new PutObjectCommand(params));
        log(`Image uploaded successfully: ${s3Key}`);
        
        const cdnUrl = `https://cdn-challenge.ahhaohho.com/${s3Key}`;
        return cdnUrl;
    } catch (error) {
        log(`Error uploading image ${s3Key}: ${error.message}`);
        throw error;
    }
}

// 이미지 썸네일 생성 및 업로드 함수
async function generateAndUploadImageThumbnails(inputVideoFile, basePath, docId) {
    const thumbnailUrls = {};
    
    // 모든 썸네일 크기를 명시적으로 처리하기 위해 배열로 정의
    const sizeEntries = Object.entries(THUMBNAIL_SIZES);
    
    // basePath에서 확장자 제거
    const basePathWithoutExt = basePath.replace(/\.[^/.]+$/, "");
    
    // 각 썸네일 크기에 대해 처리
    for (let i = 0; i < sizeEntries.length; i++) {
        const [size, dimensions] = sizeEntries[i];
        log(`Generating ${size} image thumbnail: ${dimensions.width}x${dimensions.height}`);
        
        const outputPath = path.join(os.tmpdir(), `thumbnail_${size}_${crypto.randomBytes(6).toString('hex')}.jpg`);
        
        // 각 크기별로 고유한 S3 키 생성 (JPG 확장자 사용)
        const timestamp = Date.now();
        const s3Key = `${basePathWithoutExt}_${size}_${timestamp}.jpg`;
        log(`Generated unique S3 key for ${size}: ${s3Key}`);
        
        try {
            // 비디오에서 이미지 썸네일 추출 (1초 지점에서 프레임 추출)
            await extractImageThumbnail(inputVideoFile, outputPath, '00:00:01', dimensions.width, dimensions.height);
            
            // 파일 존재 확인
            if (!fs.existsSync(outputPath)) {
                throw new Error(`Generated image thumbnail file does not exist: ${outputPath}`);
            }
            
            const fileSize = fs.statSync(outputPath).size;
            if (fileSize === 0) {
                throw new Error(`Generated image thumbnail file has zero size: ${outputPath}`);
            }
            
            log(`Image thumbnail file size for ${size}: ${fileSize} bytes`);
            
            // S3에 이미지 업로드
            const url = await uploadImageToS3(outputPath, s3Key);
            log(`Successfully uploaded ${size} image thumbnail to S3: ${url}`);
            
            thumbnailUrls[size] = url;
            
            // 임시 파일 정리
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                log(`Cleaned up temporary file: ${outputPath}`);
            }
        } catch (error) {
            log(`Error generating ${size} image thumbnail: ${error.message}`);
            if (error.stack) log(`Error stack: ${error.stack}`);
            // 썸네일 생성 실패해도 계속 진행
        }
    }
    
    // 모든 크기가 처리되었는지 확인
    const expectedSizes = Object.keys(THUMBNAIL_SIZES);
    const processedSizes = Object.keys(thumbnailUrls);
    
    log(`Expected thumbnail sizes: ${expectedSizes.join(', ')}`);
    log(`Processed thumbnail sizes: ${processedSizes.join(', ')}`);
    
    // 누락된 크기 처리
    if (processedSizes.length < expectedSizes.length) {
        log(`Warning: Not all thumbnail sizes were processed successfully`);
        
        // 누락된 크기 찾기
        const missingSizes = expectedSizes.filter(size => !processedSizes.includes(size));
        log(`Missing thumbnail sizes: ${missingSizes.join(', ')}`);
        
        // 대체 URL 사용하기
        for (const missingSize of missingSizes) {
            // 가장 가까운 크기 찾기
            let substituteUrl = null;
            
            // 크기가 대략적으로 비슷한 순서로 대체할 크기 정의
            const substituteSizeMap = {
                'tiny': ['small', 'medium', 'large'],
                'small': ['tiny', 'medium', 'large'],
                'medium': ['small', 'large', 'tiny'],
                'large': ['medium', 'small', 'tiny']
            };
            
            // 대체 크기 탐색
            for (const substituteSize of substituteSizeMap[missingSize]) {
                if (thumbnailUrls[substituteSize]) {
                    substituteUrl = thumbnailUrls[substituteSize];
                    log(`Using ${substituteSize} thumbnail as substitute for ${missingSize}`);
                    break;
                }
            }
            
            // 대체 URL이 있으면 사용
            if (substituteUrl) {
                thumbnailUrls[missingSize] = substituteUrl;
            } else {
                log(`No substitute URL found for ${missingSize} thumbnail`);
            }
        }
    }
    
    // 각 크기별 URL 로깅 (디버깅용)
    for (const [size, url] of Object.entries(thumbnailUrls)) {
        log(`Final ${size} image thumbnail URL: ${url}`);
    }
    
    return thumbnailUrls;
}

// MongoDB 문서 업데이트 함수
async function updateDatabase(doc, newUrl, thumbnailUrls) {
    // 기존 값 백업을 위한 로깅
    log('Current MongoDB document media values:');
    log(`  defaultUrl: ${doc.media.defaultUrl}`);
    log(`  tiny: ${doc.media.thumbnail?.tiny || 'N/A'}`);
    log(`  small: ${doc.media.thumbnail?.small || 'N/A'}`);
    log(`  medium: ${doc.media.thumbnail?.medium || 'N/A'}`);
    log(`  large: ${doc.media.thumbnail?.large || 'N/A'}`);
    
    // 데이터베이스 업데이트 - 기본 URL 업데이트
    doc.media.defaultUrl = newUrl;
    
    // 썸네일 필드가 없으면 생성
    if (!doc.media.thumbnail) {
        doc.media.thumbnail = {
            tiny: '',
            small: '',
            medium: '',
            large: ''
        };
    }
    
    // 썸네일 URL 개별적으로 명시적 업데이트
    // tiny
    if (thumbnailUrls.tiny) {
        doc.media.thumbnail.tiny = thumbnailUrls.tiny;
        log(`Setting tiny thumbnail to: ${thumbnailUrls.tiny}`);
    }
    
    // small
    if (thumbnailUrls.small) {
        doc.media.thumbnail.small = thumbnailUrls.small;
        log(`Setting small thumbnail to: ${thumbnailUrls.small}`);
    }
    
    // medium
    if (thumbnailUrls.medium) {
        doc.media.thumbnail.medium = thumbnailUrls.medium;
        log(`Setting medium thumbnail to: ${thumbnailUrls.medium}`);
    }
    
    // large
    if (thumbnailUrls.large) {
        doc.media.thumbnail.large = thumbnailUrls.large;
        log(`Setting large thumbnail to: ${thumbnailUrls.large}`);
    }
    
    // 변경사항 저장 전 디버깅용 출력
    log('Thumbnail URLs being saved to database:');
    log(`  tiny: ${doc.media.thumbnail.tiny || 'N/A'}`);
    log(`  small: ${doc.media.thumbnail.small || 'N/A'}`);
    log(`  medium: ${doc.media.thumbnail.medium || 'N/A'}`);
    log(`  large: ${doc.media.thumbnail.large || 'N/A'}`);
    
    // 변경사항 저장
    await doc.save();
    log(`Updated MongoDB document with new URLs`);
    
    return doc;
}

async function processVideos() {
    try {
        log('Starting video processing...');
        await initializeS3Client();
        await connectToMongoDB();
        
        // 데이터 구조 확인
        const totalCount = await Content.countDocuments();
        const mediaCount = await Content.countDocuments({ 'media': { $exists: true } });
        const videoCount = await Content.countDocuments({ 'media.type': 'video/mp4' });
        
        log(`Total documents: ${totalCount}`);
        log(`Documents with media field: ${mediaCount}`);
        log(`Documents with media.type = video/mp4: ${videoCount}`);
        
        // 새 데이터 모델에 맞는 쿼리
        const cursor = Content.find({
            'media.type': 'video/mp4',
            'media.defaultUrl': { $exists: true, $ne: null }
        }).cursor();

        let processedCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
            log(`Processing document: ${doc._id}`);

            const media = doc.media;
            if (!media || !media.defaultUrl) {
                log(`Skipping document ${doc._id}: Invalid media structure`);
                skippedCount++;
                continue;
            }

            // URL 유효성 검증
            if (!media.defaultUrl.startsWith('http')) {
                log(`Skipping document ${doc._id}: Invalid URL format - ${media.defaultUrl}`);
                skippedCount++;
                continue;
            }

            log(`Processing video: ${media.defaultUrl}`);

            // URL에서 경로 추출, 또는 새로운 경로 생성
            let basePath;
            try {
                const url = new URL(media.defaultUrl);
                basePath = url.pathname.slice(1);
            } catch (error) {
                // URL 파싱 실패 시 새 경로 생성
                const timestamp = Date.now();
                basePath = `contentsData/${doc._id}_${timestamp}.mp4`;
                log(`Failed to parse URL, using generated path: ${basePath}`);
            }
            
            basePath = basePath.replace(/\.mp4\.mp4/, '.mp4');

            const localInput = path.join(os.tmpdir(), `input_${crypto.randomBytes(6).toString('hex')}.mp4`);
            const localOutput = path.join(os.tmpdir(), `output_${crypto.randomBytes(6).toString('hex')}.mp4`);

            try {
                // URL에서 직접 다운로드 (재시도 로직 포함)
                await downloadWithRetry(media.defaultUrl, localInput, 3);
                
                // 파일 크기 확인
                const fileSize = fs.statSync(localInput).size;
                if (fileSize === 0) {
                    throw new Error('Downloaded file has zero size');
                }
                log(`Downloaded file size: ${fileSize} bytes`);

                // 기본 크기 비디오 처리 (이전과 같은 크기)
                const defaultSize = THUMBNAIL_SIZES.large;
                
                try {
                    await resizeAndCropVideo(localInput, localOutput, defaultSize.width, defaultSize.height);
                    log('Successfully resized video to default size');
                } catch (processingError) {
                    log(`Standard processing failed: ${processingError.message}`);
                    log(`Trying alternative processing method...`);
                    
                    // HEVC 디코더 오류인 경우 대체 방법 시도
                    if (processingError.message.includes('hevc') || 
                        processingError.message.includes('Decoder not found')) {
                        await convertHevcWithSimpleCommand(localInput, localOutput, defaultSize.width, defaultSize.height);
                        log('Successfully used alternative method for default size');
                    } else {
                        throw processingError; // 다른 오류는 상위로 전달
                    }
                }

                // 처리된 파일 크기 확인
                if (!fs.existsSync(localOutput)) {
                    throw new Error('Output file was not created');
                }
                
                const outputSize = fs.statSync(localOutput).size;
                if (outputSize === 0) {
                    throw new Error('Processed file has zero size');
                }
                log(`Processed file size: ${outputSize} bytes`);

                // 타임스탬프를 포함한 고유한 경로 생성
                const timestamp = Date.now();
                const mainS3Key = basePath.replace('.mp4', `_main_${timestamp}.mp4`);
                
                // 자동재생 관련 커스텀 옵션 설정
                const customOptions = {
                    contentDisposition: 'inline',
                    metadata: {
                        'x-amz-meta-type': 'main',
                        'x-amz-meta-width': defaultSize.width.toString(),
                        'x-amz-meta-height': defaultSize.height.toString(),
                        'x-amz-meta-autoplay': 'true',
                        'x-amz-meta-playsinline': 'true',
                        'x-amz-meta-loop': 'true'
                    }
                };
                
                // 기본 URL 업로드
                const newUrl = await uploadWithRetry(localOutput, mainS3Key, 3, customOptions);
                log(`Uploaded main video: ${newUrl}`);
                
                // 중요 변경: 비디오 썸네일 대신 이미지 썸네일 생성
                // 각 크기의 이미지 썸네일 생성 및 업로드 - 원본 비디오에서 추출
                const thumbnailUrls = await generateAndUploadImageThumbnails(localInput, basePath, doc._id);
                
                // 디버깅: 생성된 썸네일 URL 표시
                log(`Generated image thumbnails: ${Object.keys(thumbnailUrls).length}`);
                for (const [size, url] of Object.entries(thumbnailUrls)) {
                    log(`  ${size} image thumbnail: ${url}`);
                }
                
                // 데이터베이스 업데이트 - 기본 URL과 썸네일 모두 업데이트
                // 기존 값 백업을 위한 로깅
                log('Current MongoDB document media values:');
                log(`  defaultUrl: ${doc.media.defaultUrl}`);
                log(`  tiny: ${doc.media.thumbnail?.tiny || 'N/A'}`);
                log(`  small: ${doc.media.thumbnail?.small || 'N/A'}`);
                log(`  medium: ${doc.media.thumbnail?.medium || 'N/A'}`);
                log(`  large: ${doc.media.thumbnail?.large || 'N/A'}`);
                
                // 데이터베이스 업데이트 - 기본 URL 업데이트
                doc.media.defaultUrl = newUrl;
                
                // 썸네일 필드가 없으면 생성
                if (!doc.media.thumbnail) {
                    doc.media.thumbnail = {
                        tiny: '',
                        small: '',
                        medium: '',
                        large: ''
                    };
                }
                
                // 썸네일 URL 개별적으로 명시적 업데이트
                if (thumbnailUrls.tiny) {
                    doc.media.thumbnail.tiny = thumbnailUrls.tiny;
                    log(`Setting tiny thumbnail to: ${thumbnailUrls.tiny}`);
                }
                
                if (thumbnailUrls.small) {
                    doc.media.thumbnail.small = thumbnailUrls.small;
                    log(`Setting small thumbnail to: ${thumbnailUrls.small}`);
                }
                
                if (thumbnailUrls.medium) {
                    doc.media.thumbnail.medium = thumbnailUrls.medium;
                    log(`Setting medium thumbnail to: ${thumbnailUrls.medium}`);
                }
                
                if (thumbnailUrls.large) {
                    doc.media.thumbnail.large = thumbnailUrls.large;
                    log(`Setting large thumbnail to: ${thumbnailUrls.large}`);
                }
                
                // 변경사항 저장 전 디버깅용 출력
                log('Thumbnail URLs being saved to database:');
                log(`  tiny: ${doc.media.thumbnail.tiny || 'N/A'}`);
                log(`  small: ${doc.media.thumbnail.small || 'N/A'}`);
                log(`  medium: ${doc.media.thumbnail.medium || 'N/A'}`);
                log(`  large: ${doc.media.thumbnail.large || 'N/A'}`);
                
                await doc.save();
                log(`Updated MongoDB document with new URLs`);

                log(`Successfully processed and updated ${basePath}`);
                processedCount++;
            } catch (error) {
                log(`Error processing ${doc._id}: ${error.message}`);
                if (error.stack) log(`Error stack: ${error.stack}`);
                failedDocuments.push({
                    id: doc._id.toString(),
                    url: media.defaultUrl,
                    error: error.message
                });
                errorCount++;
            } finally {
                // 임시 파일 정리
                try {
                    if (fs.existsSync(localInput)) fs.unlinkSync(localInput);
                    if (fs.existsSync(localOutput)) fs.unlinkSync(localOutput);
                } catch (cleanupError) {
                    log(`Error cleaning up temporary files: ${cleanupError.message}`);
                }
            }
        }

        log(`Processing completed. Total: ${videoCount}, Processed: ${processedCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
        
        if (failedDocuments.length > 0) {
            log(`Failed documents (${failedDocuments.length}):`);
            failedDocuments.forEach((doc, index) => {
                log(`${index + 1}. ID: ${doc.id}, URL: ${doc.url}, Error: ${doc.error}`);
            });
            
            // 실패한 문서 목록을 파일로 저장
            const failedDocsPath = path.join(os.tmpdir(), `failed_documents_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
            fs.writeFileSync(failedDocsPath, JSON.stringify(failedDocuments, null, 2));
            log(`Failed documents list saved to: ${failedDocsPath}`);
        }
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