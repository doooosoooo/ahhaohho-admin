const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const BASE_URL = 'https://api.dev.ahhaohho.com';

async function readGroupsData() {
    try {
        const filePath = path.join(__dirname, './contentsRawData/groupsData-updateAt20240723.json');
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('파일을 읽거나 파싱하는 중 오류가 발생했습니다:', error);
        throw error;
    }
}

function transformGroupData(rawData) {
    return rawData.map((item, index) => ({
        showNumber: index + 1,
        groupName: item["큐레이션 리스트 제목"],
        list: item["P형 챌린지 데이터"]
    }));
}

async function postGroup(groupData) {
    try {
        const response = await axios.post(`${BASE_URL}/admin/group`, groupData);
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
    console.log('-'.repeat(50));
}

async function main() {
    try {
        const rawGroupsData = await readGroupsData();
        const transformedGroupsData = transformGroupData(rawGroupsData);
        
        console.log('변환된 그룹 데이터:', JSON.stringify(transformedGroupsData, null, 2));

        for (const groupData of transformedGroupsData) {
            await postGroup(groupData);
        }
    } catch (error) {
        console.error('프로그램 실행 중 오류가 발생했습니다:', error);
    }
}

main();