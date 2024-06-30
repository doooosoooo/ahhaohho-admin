const fs = require('fs');
const path = require('path');

// 특정 패턴에 맞는 파일 찾기
function getFileByDatePattern(dir, pattern) {
    if (!fs.existsSync(dir)) {
        throw new Error(`Directory not found: ${dir}`);
    }

    const files = fs.readdirSync(dir);
    const regex = new RegExp(pattern);
    const matchedFiles = files.filter(file => regex.test(file));

    if (matchedFiles.length === 0) {
        console.error('Files in directory:', files); // 디렉토리 내 파일 목록 출력
        throw new Error('No files matched the pattern');
    }

    matchedFiles.sort((a, b) => {
        const aDate = a.match(regex)[1];
        const bDate = b.match(regex)[1];
        return new Date(bDate) - new Date(aDate);
    });
    return matchedFiles[0];
}

// JSON 파일에서 데이터를 읽는 함수
function readDataFromFile(filePath) {
    return new Promise(function(resolve, reject) {
        fs.readFile(filePath, 'utf8', function(err, data) {
            if (err) {
                return reject(err); // 파일 읽기 중 에러 발생 시 거부
            }
            try {
                const jsonData = JSON.parse(data); // JSON 데이터를 파싱
                resolve(jsonData); // 파싱된 데이터를 반환
            } catch (parseErr) {
                reject(parseErr); // 파싱 중 에러 발생 시 거부
            }
        });
    });
}

// API로 데이터를 전송하는 함수
async function sendDataToApi(processedData, apiUrl) {
    const axios = require('axios');
    const responses = [];
    try {
        for (const item of processedData) {
            const response = await axios.post(apiUrl, item); // 각 데이터를 API로 전송
            responses.push(response.data);
        }
        console.log('Data successfully sent to API');
    } catch (error) {
        console.error('Error sending data to API:', error); // 데이터 전송 중 에러 발생 시 출력
    }
    return responses;
}

// 디렉토리 생성 함수
function createDirectoryIfNotExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

module.exports = {
    getFileByDatePattern,
    readDataFromFile,
    sendDataToApi,
    createDirectoryIfNotExists
};
