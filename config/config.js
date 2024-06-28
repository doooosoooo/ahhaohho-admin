require('dotenv').config();

async function loadConfig() {
    const airtableApiKey = process.env.AIRTABLE_API_KEY;
    const airtableBaseId = process.env.AIRTABLE_BASE_ID;
    const airtableEndpointUrl = process.env.AIRTABLE_ENDPOINT_URL;

    return {
        airtableApiKey,
        airtableBaseId,
        airtableEndpointUrl,
    };
}

module.exports = { loadConfig };