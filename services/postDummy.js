// Function to generate random string
function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Function to generate a random ObjectId-like string
function randomObjectId() {
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
    return timestamp + randomString(16);
}

// Function to create dummy data
function createDummyData() {
    return {
        contentsIdx: '6690b04b083f6732711112ba', // Using the provided ObjectId
        userId: randomObjectId(), // Generate a random ObjectId-like string
        nickName: `nick_${randomString(5)}`,
        title: `Title_${randomString(10)}`,
        imageUrl: 'https://ahhaohho-challege-img.s3.ap-northeast-2.amazonaws.com/contentsData/thumbnails/small/fl6HFOM2S9dfeAj-UhQagvRFwLbgOtoX7n_AIBtV7kQ',
        comment: `This is a dummy comment for gallery post. ${randomString(20)}`
    };
}

// Function to create dummy file
function createDummyFile() {
    // Create a dummy File object
    const dummyContent = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // Dummy JPEG file header
    return new File([dummyContent], `dummy_image_${randomString(5)}.jpg`, { type: 'image/jpeg' });
}

// Function to send dummy data to postGallery endpoint
async function sendDummyDataToPostGallery() {
    const dummyData = createDummyData();
    const formData = new FormData();

    // Append dummy data to formData
    Object.keys(dummyData).forEach(key => {
        formData.append(key, dummyData[key]);
    });

    // Append dummy files (1 to 5 files)
    const fileCount = Math.floor(Math.random() * 5) + 1;
    for (let i = 0; i < fileCount; i++) {
        formData.append('files', createDummyFile());
    }

    try {
        const response = await fetch('https://api.dev.ahhaohho.com/challenge/postGallery', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Success:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function to send dummy data
sendDummyDataToPostGallery();