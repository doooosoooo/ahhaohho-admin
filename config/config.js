require('dotenv').config(); // 최상단에 위치

async function loadConfig() {
    return {
        airtableApiKey: process.env.AIRTABLE_API_KEY,
        airtableBaseId: process.env.AIRTABLE_BASE_ID,
        airtableEndpointUrl: process.env.AIRTABLE_ENDPOINT_URL,
        aws_region: process.env.AWS_REGION,
        aws_accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        aws_secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        aws_s3_bucketName: process.env.AWS_BUCKET_NAME,
    };
}

module.exports = { loadConfig };