const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const uri = "mongodb+srv://dsoojung:wjdentnqw12!@cluster-0.7gagbcd.mongodb.net/?retryWrites=true&w=majority&appName=Cluster-0";
const dbName = "challengeDB";
const collectionName = "contents";

async function connectToDatabase() {
    const client = new MongoClient(uri);
    await client.connect();
    return { client, db: client.db(dbName) };
}

async function getLatestFile(dirPath) {
    const files = await fs.readdir(dirPath);
    const pattern = /contentsData-updateAt(\d{8})\.json$/;
    const matchingFiles = files.filter(file => pattern.test(file));
    if (matchingFiles.length === 0) return null;
    return matchingFiles.sort().pop();
}

async function readJsonFile(filePath) {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
}

function processLevel(level) {
    const numLevel = parseInt(level, 10);
    if (isNaN(numLevel) || numLevel < 1 || numLevel > 5) {
        console.warn(`Invalid level value: ${level}`);
        return 1;
    }
    return numLevel <= 2 ? 1 : (numLevel === 3 ? 2 : 3);
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function updateOrDeleteInDatabase(db, data) {
    const collection = db.collection(collectionName);
    let updatedCount = 0;
    let deletedCount = 0;
    let notFoundCount = 0;
    let noChangeCount = 0;

    for (const item of data) {
        if (!item.id) {
            console.warn(`Item missing id: ${JSON.stringify(item)}`);
            continue;
        }

        if (item["데이터 검수 완료"] !== true) {
            const deleteResult = await collection.deleteOne({ index: item.id });
            if (deleteResult.deletedCount > 0) {
                deletedCount++;
                console.log(`Deleted item with id: ${item.id}`);
            } else {
                notFoundCount++;
                console.log(`Item not found for deletion with id: ${item.id}`);
            }
            continue;
        }

        const newLevel = processLevel(item['난이도']);
        const newTitle = toTitleCase(item['*액티비티 타이틀']);
        
        try {
            const updateResult = await collection.updateOne(
                { index: item.id },
                { 
                    $set: { 
                        level: newLevel,
                        title: newTitle
                    },
                    $unset: { '*액티비티 타이틀': "" }
                }
            );

            if (updateResult.matchedCount === 0) {
                notFoundCount++;
                console.log(`Item not found for update with id: ${item.id}`);
            } else if (updateResult.modifiedCount > 0) {
                updatedCount++;
                console.log(`Updated item with id: ${item.id}. New level: ${newLevel}, New title: ${newTitle}`);
            } else {
                noChangeCount++;
                console.log(`No changes for item with id: ${item.id}. Level: ${newLevel}, Title: ${newTitle}`);
            }
        } catch (error) {
            console.error(`Error updating item with id: ${item.id}`, error);
        }
    }

    return { updatedCount, deletedCount, notFoundCount, noChangeCount };
}

async function main() {
    let client;
    try {
        const { client: dbClient, db } = await connectToDatabase();
        client = dbClient;
        console.log("Connected to database");

        const dirPath = path.resolve(__dirname, './contentsRawData');
        const latestFile = await getLatestFile(dirPath);
        if (!latestFile) {
            throw new Error('No matching files found');
        }
        console.log(`Processing file: ${latestFile}`);

        const data = await readJsonFile(path.join(dirPath, latestFile));
        console.log(`Read ${data.length} items from file`);

        const { updatedCount, deletedCount, notFoundCount, noChangeCount } = await updateOrDeleteInDatabase(db, data);
        console.log(`Updated ${updatedCount} items, deleted ${deletedCount} items, ${notFoundCount} items not found, ${noChangeCount} items unchanged`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (client) {
            await client.close();
            console.log("Database connection closed");
        }
    }
}

main();