const fs = require('fs').promises;
const path = require('path');
const AWS = require('aws-sdk');
const { loadConfig } = require('../../config/config');

async function uploadDirectoryToS3AndSaveUrls(localPath, s3Prefix, outputJsonPath) {
    const config = await loadConfig();

    const s3 = new AWS.S3({
        region: config.aws_region,
        accessKeyId: config.aws_accessKeyId,
        secretAccessKey: config.aws_secretAccessKey
    });

    const urlMap = {};

    async function uploadFile(filePath) {
        const fileContent = await fs.readFile(filePath);
        const relativeFilePath = path.relative(localPath, filePath);
        const s3Key = path.join(s3Prefix, relativeFilePath).replace(/\\/g, '/');

        const contentType = getContentType(filePath);

        const uploadParams = {
            Bucket: config.aws_s3_bucketName,
            Key: s3Key,
            Body: fileContent,
            ContentType: contentType,
        };

        const result = await s3.upload(uploadParams).promise();
        urlMap[relativeFilePath] = result.Location;
        return result;
    }

    async function processDirectory(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const uploadPromises = [];

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                uploadPromises.push(...await processDirectory(fullPath));
            } else {
                uploadPromises.push(uploadFile(fullPath));
            }
        }

        return uploadPromises;
    }

    try {
        await fs.access(localPath);
    } catch (error) {
        throw new Error(`Directory not found: ${localPath}`);
    }

    const uploadPromises = await processDirectory(localPath);
    await Promise.all(uploadPromises);

    // JSON 파일로 URL 맵 저장
    await fs.writeFile(outputJsonPath, JSON.stringify(urlMap, null, 2));

    return urlMap;
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
        '.svg': 'image/svg+xml',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.json': 'application/json',
        '.mp4': 'video/mp4',
    };
    return contentTypes[ext] || 'application/octet-stream';
}

// 사용 예시
uploadDirectoryToS3AndSaveUrls('./services/uisrc', 'uisrc', './s3_urls.json')
    .then(urlMap => {
        console.log('Upload successful. URLs saved to: ./s3_urls.json');
        console.log('URL Map:', urlMap);
    })
    .catch(err => console.error('Upload failed:', err));