const fs = require('fs');
const path = require('path');
const axios = require('axios'); // axios 추가


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
    try {
        // 데이터 크기 로깅
        console.log(`Sending data to API. Total items: ${processedData.length}`);
        console.log(`Data size: ${JSON.stringify(processedData).length} characters`);

        // 데이터를 더 작은 청크로 나누기 (예: 50개씩)
        const chunkSize = 50;
        for (let i = 0; i < processedData.length; i += chunkSize) {
            const chunk = processedData.slice(i, i + chunkSize);
            console.log(`Sending chunk ${i / chunkSize + 1}. Items: ${chunk.length}`);

            const response = await axios.post(apiUrl, { materials: chunk });
            console.log(`Chunk ${i / chunkSize + 1} sent successfully. Response:`, response.data);
        }

        return { success: true, message: "All data sent successfully" };
    } catch (error) {
        console.error('API 요청 중 오류 발생:');
        if (error.response) {
            console.error(`상태 코드: ${error.response.status}`);
            console.error(`오류 메시지: ${error.response.data.message || '알 수 없는 오류'}`);
            console.error('전체 응답:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            console.error('서버로부터 응답이 없습니다.');
        } else {
            console.error(`오류 메시지: ${error.message}`);
        }
        throw error;
    }
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
