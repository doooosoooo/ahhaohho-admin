const { loadConfig } = require('../config/config');
const Airtable = require('airtable');

let base; // 글로벌 변수로 base 설정

async function initialize() {
    try {
        const config = await loadConfig();
        console.log('Config Loaded : ', config);

        if (!config.airtableApiKey || !config.airtableBaseId || !config.airtableEndpointUrl) {
            throw new Error('Missing Airtable configuration values');
        }

        Airtable.configure({
            apiKey: config.airtableApiKey,
            endpointUrl: config.airtableEndpointUrl
        });

        base = Airtable.base(config.airtableBaseId);
        console.log('Airtable Client Initialized');
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

async function fetchTableData(tableName, viewName) {
    try {
        if (!base) {
            await initialize();
        }

        const records = await base(tableName).select({ view: viewName }).all();
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
