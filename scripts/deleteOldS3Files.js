const { loadConfig } = require('../config/config');
const { S3Client, ListObjectsV2Command, DeleteObjectsCommand } = require("@aws-sdk/client-s3");

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

/**
 * S3 버킷에서 특정 프리픽스(폴더)의 파일들을 나열합니다.
 * @param {string} prefix - 파일을 나열할 S3 프리픽스(폴더 경로)
 * @param {number} daysOld - 이 일수보다 오래된 파일들만 선택합니다
 * @returns {Array} 조건에 맞는 파일 목록
 */
async function listOldObjects(prefix, daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    let allObjects = [];
    let continuationToken = undefined;
    
    do {
        const command = new ListObjectsV2Command({
            Bucket: config.challenge_bucketName,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });
        
        const response = await s3Client.send(command);
        
        // 날짜 기준으로 오래된 파일 필터링
        const oldObjects = (response.Contents || []).filter(object => 
            new Date(object.LastModified) < cutoffDate
        );
        
        allObjects = [...allObjects, ...oldObjects];
        continuationToken = response.NextContinuationToken;
        
    } while (continuationToken);
    
    return allObjects;
}

/**
 * S3에서 파일들을 삭제합니다.
 * @param {Array} objects - 삭제할 객체 목록
 */
async function deleteObjects(objects) {
    if (objects.length === 0) {
        log('No objects to delete.');
        return;
    }
    
    // S3 DeleteObjects API는 한 번에 최대 1000개의 객체만 처리할 수 있습니다
    const chunkSize = 1000;
    for (let i = 0; i < objects.length; i += chunkSize) {
        const chunk = objects.slice(i, i + chunkSize);
        
        const command = new DeleteObjectsCommand({
            Bucket: config.challenge_bucketName,
            Delete: {
                Objects: chunk.map(obj => ({ Key: obj.Key })),
                Quiet: false
            }
        });
        
        const response = await s3Client.send(command);
        log(`Deleted ${response.Deleted.length} objects. Batch ${i/chunkSize + 1}/${Math.ceil(objects.length/chunkSize)}`);
        
        if (response.Errors && response.Errors.length > 0) {
            log(`Failed to delete ${response.Errors.length} objects:`);
            response.Errors.forEach(error => {
                console.error(`  - ${error.Key}: ${error.Code} - ${error.Message}`);
            });
        }
    }
}

/**
 * 단일 폴더(프리픽스)의 오래된 파일을 정리합니다.
 * @param {string} prefix - 정리할 S3 폴더 경로
 * @param {number} daysOld - 이 일수보다 오래된 파일들만 삭제합니다
 */
async function cleanupPrefix(prefix, daysOld) {
    log(`Cleaning up files older than ${daysOld} days in prefix: ${prefix}`);
    
    const oldObjects = await listOldObjects(prefix, daysOld);
    log(`Found ${oldObjects.length} objects older than ${daysOld} days in ${prefix}`);
    
    if (oldObjects.length > 0) {
        // 삭제하기 전에 파일 목록 표시 (선택 사항)
        oldObjects.slice(0, 5).forEach(obj => {
            log(`  - ${obj.Key} (Last modified: ${obj.LastModified})`);
        });
        if (oldObjects.length > 5) {
            log(`  ... and ${oldObjects.length - 5} more files`);
        }
        
        // 사용자 확인 (필요에 따라 활성화/비활성화)
        // const readline = require('readline').createInterface({
        //     input: process.stdin,
        //     output: process.stdout
        // });
        // await new Promise(resolve => {
        //     readline.question(`Delete these files? (y/n): `, answer => {
        //         readline.close();
        //         if (answer.toLowerCase() === 'y') {
        //             resolve(true);
        //         } else {
        //             log('Cleanup cancelled.');
        //             resolve(false);
        //         }
        //     });
        // });
        
        // 파일 삭제
        await deleteObjects(oldObjects);
        log(`Cleanup completed for prefix: ${prefix}`);
    }
}

/**
 * 메인 함수: 여러 폴더의 오래된 파일을 정리합니다.
 */
async function main() {
    try {
        await initializeS3Client();
        
        // 정리할 프리픽스(폴더)와 각각의 보관 기간(일) 설정
        const prefixesToCleanup = [
            { prefix: 'contentsData/', daysOld: 30 },
            { prefix: 'materialsData/', daysOld: 30 },
            { prefix: 'thumbnails/', daysOld: 30 },
            { prefix: 'processed/', daysOld: 30 },
            // 필요에 따라 더 많은 프리픽스 추가
        ];
        
        for (const { prefix, daysOld } of prefixesToCleanup) {
            await cleanupPrefix(prefix, daysOld);
        }
        
        log('All cleanup operations completed successfully.');
    } catch (error) {
        console.error('An error occurred during cleanup:', error);
    }
}

// 스크립트 실행
main();