/* global process */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { loadConfig } = require('../config/config');
const Airtable = require('airtable');
const https = require('https'); // 추가

let base; // 글로벌 변수로 base 설정

async function initializeChallenge() {
    try {
        const config = await loadConfig();

        if (!config.airtableApiKey || !config.challengeBaseId || !config.airtableEndpointUrl) {
            throw new Error('Missing Airtable configuration values');
        }

        Airtable.configure({
            apiKey: config.airtableApiKey,
            endpointUrl: config.airtableEndpointUrl,
            requestOptions: {  // 이 부분 추가
                agent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        });

        base = Airtable.base(config.challengeBaseId);
        console.log('Airtable Client Initialized');
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

async function initializeParts() {
    try {
        const config = await loadConfig();

        if (!config.airtableApiKey || !config.partsBaseId || !config.airtableEndpointUrl) {
            throw new Error('Missing Airtable configuration values');
        }

        Airtable.configure({
            apiKey: config.airtableApiKey,
            endpointUrl: config.airtableEndpointUrl,
            requestOptions: {  // 이 부분 추가
                agent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        });

        base = Airtable.base(config.partsBaseId);
        console.log('Airtable Client Initialized');
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

async function initializeWorld() {
    try {
        const config = await loadConfig();

        if (!config.airtableApiKey || !config.worldBaseId || !config.airtableEndpointUrl) {
            throw new Error('Missing Airtable configuration values');
        }

        Airtable.configure({
            apiKey: config.airtableApiKey,
            endpointUrl: config.airtableEndpointUrl,
            requestOptions: {  // 이 부분 추가
                agent: new https.Agent({
                    rejectUnauthorized: false
                })
            }
        });

        base = Airtable.base(config.worldBaseId);
        console.log('Airtable Client Initialized');
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

async function fetchTableData(baseName, tableName, viewName, lastUpdateDate = null) {
    try {
        if (baseName === 'challenge') {
            await initializeChallenge();
        } else if (baseName === 'world') {
            await initializeWorld();
        } else if (baseName === 'parts') {
            await initializeParts();
        }

        let selectOptions = { view: viewName };
        
        // 마지막 업데이트 날짜가 있으면 필터링 적용
        if (lastUpdateDate) {
            // ISO 형식의 날짜를 Airtable 포맷으로 변환
            selectOptions.filterByFormula = `IS_AFTER({Last Modified}, "${lastUpdateDate}")`;
            console.log(`Filtering records modified after: ${lastUpdateDate}`);
        }

        const records = await base(tableName).select(selectOptions).all();
        return records.map(record => ({
            id: record.id,  // record ID를 최상위 레벨에 추가
            ...record.fields  // 나머지 필드들
        }));
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
        throw error;
    }
}

module.exports = { fetchTableData };
