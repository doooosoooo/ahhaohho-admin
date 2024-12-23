/* global process */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const axios = require('axios');
const fs = require('fs');
const { loadConfig } = require('../config/config');

async function getFieldNames(tableId) {
    const config = await loadConfig();
    
    try {
        const response = await axios.get(
            `https://api.airtable.com/v0/meta/bases/${config.worldBaseId}/tables`,
            {
                headers: {
                    'Authorization': `Bearer ${config.airtableApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        // 특정 테이블의 정보 찾기
        const tableInfo = response.data.tables.find(table => table.id === tableId);
        
        if (!tableInfo) {
            throw new Error('Table not found');
        }

        // 필드 정보를 JSON 형태로 구성
        const fieldsJson = tableInfo.fields.map(field => ({
            name: field.name,
            type: field.type,
            id: field.id
        }));

        // JSON 파일로 저장
        fs.writeFileSync('fields.json', JSON.stringify(fieldsJson, null, 2));

        // 콘솔에도 예쁘게 출력
        console.log('Fields JSON:', JSON.stringify(fieldsJson, null, 2));

        return fieldsJson;

    } catch (error) {
        console.error('Error fetching field metadata:', error);
        throw error;
    }
}

// 사용 예시
async function main() {
    try {
        const tableId = 'tbl25aq9EnkHP8TB7';
        await getFieldNames(tableId);
    } catch (error) {
        console.error('Error in main:', error);
    }
}

main();