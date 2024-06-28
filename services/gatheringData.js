const fs = require('fs');
const path = require('path');
const { fetchTableData } = require('../middlewares/airtableClient');

async function main() {
    // 테이블 이름을 JSON 파일에서 읽어옴
    const tableNames = require('./tableNames.json'); // 테이블 이름을 포함하는 JSON 파일
    const updateDate = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 현재 날짜를 YYYYMMDD 형식으로 변환
    const dataDir = path.join(__dirname, 'contentsRawData');

    // data 폴더가 존재하지 않으면 생성
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    for (const [mainKey, { tableName, viewName } ] of Object.entries(tableNames)) {
        try {
            const tableData = await fetchTableData(tableName, viewName);
            const jsonData = JSON.stringify(tableData, null, 2);
            const fileName = `${mainKey}-updateAt${updateDate}.json`;
            const filePath = path.join(dataDir, fileName);
            
            fs.writeFile(filePath, jsonData, 'utf8', (err) => {
                if (err) {
                    console.error(`Error writing JSON to file ${filePath}:`, err);
                } else {
                    console.log(`JSON data has been saved to ${filePath}`);
                }
            });
        } catch (error) {
            console.error(`Error fetching data for table ${tableName}:`, error.message);
        }
    }
}

main();
