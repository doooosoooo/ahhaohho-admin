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
    // Array of URL and type pairs
    const thumbnailOptions = [
        {
            url: 'https://ahhaohho-challege-img.s3.ap-northeast-2.amazonaws.com/contentsData/BfScylZ7quJiPWq6zzhdehdbsrU6rnAP2WVkrQkVXdw',
            type: 'image/jpeg'
        },
        {
            url: 'https://ahhaohho-challege-img.s3.ap-northeast-2.amazonaws.com/contentsData/UfjU_GepS041uDcHCKG8U0QRJ_2JzxEkV5JrJBNRu50',
            type: 'video/mp4'
        }
    ];

    // Randomly select one of the thumbnail options
    const thumbnailOption = thumbnailOptions[Math.floor(Math.random() * thumbnailOptions.length)];

    return {
        contentsIdx: '6690b04b083f6732711112ba', // Using the provided ObjectId
        userId: randomObjectId(), // Generate a random ObjectId-like string
        nickName: `nick_${randomString(5)}`,
        title: `Title_${randomString(10)}`,
        imageUrl: thumbnailOption,
        comment: `This is a dummy comment for gallery post. ${randomString(20)}`
    };
}

// Function to send dummy data to postGallery endpoint
async function sendDummyDataToPostGallery() {
    const dummyData = createDummyData();
    
    console.log('Sending data:', dummyData);

    try {
        const response = await fetch('https://api.dev.ahhaohho.com/challenge/postGallery', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dummyData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const result = await response.json();
        console.log('Success:', result);
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function to send dummy data
sendDummyDataToPostGallery();