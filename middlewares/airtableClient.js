const { loadConfig } = require('../config/config');
const Airtable = require('airtable');

async function initialize() {
    try {
        const config = await loadConfig();
        console.log('Airtable Config:', config);

        Airtable.configure({ apiKey: config.airtableApiKey, endpointUrl: config.airtableEndpointUrl });

        const base = Airtable.base(config.airtableBaseId);
        console.log('Airtable Client Initialized');
        
        return base;
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
    }
}

async function fetchTableData(tableName, viewName) {
    try {
        const base = await initialize();

        const records = await base(tableName).select({view : viewName}).all();
        return records;
    } catch (error) {
        console.error('Error fetching data from Airtable:', error);
        throw error;
    }
}

module.exports = { fetchTableData };