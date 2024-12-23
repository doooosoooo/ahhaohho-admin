const axios = require('axios');

// 서버 URL을 여기에 입력하세요
const BASE_URL = 'https://api.dev.doosoo.xyz:4242'; // 실제 서버 URL로 변경해야 합니다

async function testGetRoot() {
    try {
        const response = await axios.get(`${BASE_URL}/challange/getRoot`);
        console.log('응답 상태:', response.status);
        console.log('응답 데이터:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('getRoot 요청 실패:');
        if (error.response) {
            // 서버가 2xx 범위를 벗어나는 상태 코드로 응답한 경우
            console.error('에러 응답:', error.response.status);
            console.error('에러 데이터:', error.response.data);
        } else if (error.request) {
            // 요청이 이루어졌으나 응답을 받지 못한 경우
            console.error('응답을 받지 못했습니다:', error.request);
        } else {
            // 요청 설정 중 에러가 발생한 경우
            console.error('에러 메시지:', error.message);
        }
    }
}

// 테스트 실행
testGetRoot();