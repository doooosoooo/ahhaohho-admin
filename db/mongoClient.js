const { MongoClient } = require('mongodb');
const { loadConfig } = require('../config/config');

let client;
let connection;

async function connectToServer() {
  try {
    const config = await loadConfig();
    
    // MongoDB 연결 문자열 확인
    if (!config.mongodbUri) {
      throw new Error('MongoDB URI is not defined in environment variables');
    }
    
    client = new MongoClient(config.mongodbUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    connection = await client.connect();
    console.log('Connected to MongoDB successfully!');
    return client.db();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    throw err;
  }
}

function getDb() {
  if (!client) {
    throw new Error('Database not initialized. Please call connectToServer first.');
  }
  return client.db();
}

function getConnection() {
  return connection;
}

module.exports = { connectToServer, getDb, getConnection };