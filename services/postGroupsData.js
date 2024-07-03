const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 서버 URL을 여기에 입력하세요
const BASE_URL = 'https://api.dev.doosoo.xyz:4242'; // 예시 URL, 실제 서버 URL로 변경해야 합니다

function readGroupsData() {
    return new Promise((resolve, reject) => {
        const filePath = path.join(__dirname, './groupData.json');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('파일을 읽는 중 오류가 발생했습니다:', err);
                reject(err);
            } else {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (parseError) {
                    console.error('JSON 파싱 중 오류가 발생했습니다:', parseError);
                    reject(parseError);
                }
            }
        });
    });
}

async function testPostGroup(groupData) {
    try {
        const response = await axios.post(`${BASE_URL}/challenge/group`, groupData);
        console.log(`그룹 "${groupData.groupName}" 생성 성공:`);
        console.log('응답 상태:', response.status);
        console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error(`그룹 "${groupData.groupName}" 생성 실패:`);
        if (error.response) {
            console.error('에러 응답:', error.response.status);
            console.error('에러 데이터:', error.response.data);
        } else if (error.request) {
            console.error('응답을 받지 못했습니다:', error.request);
        } else {
            console.error('에러 메시지:', error.message);
        }
    }
    console.log('-'.repeat(50)); // 구분선 출력
}

async function runTests() {
    const groupsData = await readGroupsData();
    for (const groupData of groupsData) {
        await testPostGroup(groupData);
    }
}

runTests();