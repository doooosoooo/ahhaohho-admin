const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");
const { loadConfig } = require('../config/config');

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

async function deleteOldFiles(bucketName, prefix, cutoffDate) {
    const listParams = {
        Bucket: bucketName,
        Prefix: prefix
    };

    try {
        let isTruncated = true;
        let continuationToken = null;

        while (isTruncated) {
            if (continuationToken) {
                listParams.ContinuationToken = continuationToken;
            }

            const listCommand = new ListObjectsV2Command(listParams);
            const listResponse = await s3Client.send(listCommand);

            const contents = listResponse.Contents || [];
            log(`Found ${contents.length} objects in ${prefix}`);

            const objectsToDelete = contents.filter(obj => {
                return new Date(obj.LastModified) < cutoffDate;
            }).map(obj => ({ Key: obj.Key }));

            if (objectsToDelete.length > 0) {
                const deleteParams = {
                    Bucket: bucketName,
                    Delete: { Objects: objectsToDelete }
                };

                const deleteCommand = new DeleteObjectsCommand(deleteParams);
                await s3Client.send(deleteCommand);

                log(`Deleted ${objectsToDelete.length} old files from ${prefix}`);
            } else {
                log(`No files to delete in ${prefix}`);
            }

            isTruncated = listResponse.IsTruncated;
            continuationToken = listResponse.NextContinuationToken;
        }
    } catch (error) {
        console.error(`Error processing files from ${prefix}:`, error);
    }
}

async function cleanupOldFiles(cutoffDate) {
    const bucketName = config.aws_s3_bucketName;
    const prefixes = [
        'materialData/',
        'materialData/thumbnails/small/',
        'materialData/thumbnails/large/',
        'materialData/thumbnails/full/',
        'contentsData/',
        'contentsData/thumbnails/small/',
        'contentsData/thumbnails/large/',
        'contentsData/thumbnails/full/'
    ];

    for (const prefix of prefixes) {
        await deleteOldFiles(bucketName, prefix, cutoffDate);
    }
}

async function main() {
    try {
        await initializeS3Client();

        // 7일 전 날짜 계산 (필요에 따라 조정 가능)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        log(`Starting cleanup of files older than ${cutoffDate.toISOString()}`);

        await cleanupOldFiles(cutoffDate);

        log('Cleanup completed successfully.');
    } catch (error) {
        console.error('An error occurred during the cleanup process:', error);
    }
}

main();