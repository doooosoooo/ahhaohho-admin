// test-image-transform.js
const CurrentTransformer = require('./services/world/postChatData/utils/chatDataTransformer');
const OldTransformer = require('./services/world/postChatData/utils/chatDataTransformer.old');

// Create a sample image data object that mimics the real data format
const sampleImageData = {
  type: 'image/jpeg',
  url: 'https://cdn-world.ahhaohho.com/chatData/1234567890',
  thumbnails: {
    small: {
      url: 'https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36',
      width: 29,
      height: 36,
      dimensions_method: 'probe',
      media_type: 'image'
    },
    large: {
      url: 'https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640',
      width: 512,
      height: 640,
      dimensions_method: 'probe',
      media_type: 'image'
    },
    full: {
      url: 'https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975',
      width: 780,
      height: 975,
      dimensions_method: 'probe',
      media_type: 'image'
    }
  },
  dimensions_method: 'probe',
  media_type: 'image'
};

// Create another sample with empty thumbnail URLs
const emptyThumbsImageData = {
  type: 'image/jpeg',
  url: 'https://cdn-world.ahhaohho.com/chatData/1234567890',
  thumbnails: {
    small: {
      url: '',
      width: 29,
      height: 36,
      dimensions_method: 'probe',
      media_type: 'image'
    },
    large: {
      url: null,
      width: 512,
      height: 640,
      dimensions_method: 'probe',
      media_type: 'image'
    },
    full: {
      url: undefined,
      width: 780,
      height: 975,
      dimensions_method: 'probe',
      media_type: 'image'
    }
  },
  dimensions_method: 'probe',
  media_type: 'image'
};

// Create another sample with missing thumbnail URLs
const missingThumbsImageData = {
  type: 'image/jpeg',
  url: 'https://cdn-world.ahhaohho.com/chatData/1234567890',
  thumbnails: {
    small: {},
    large: {
      width: 512,
      height: 640
    },
    full: null
  },
  dimensions_method: 'probe',
  media_type: 'image'
};

// Part 1: Direct test of the _transformMediaImage method
console.log("===========================================================");
console.log("PART 1: DIRECT TESTING OF _transformMediaImage METHOD");
console.log("===========================================================");

// Test with normal data
console.log("=== Testing with normal thumbnail data ===");
const currentResult = CurrentTransformer._transformMediaImage(sampleImageData);
const oldResult = OldTransformer._transformMediaImage(sampleImageData);

console.log("Current Transformer Result:");
console.log(JSON.stringify(currentResult, null, 2));
console.log("\nOld Transformer Result:");
console.log(JSON.stringify(oldResult, null, 2));

// Compare the results
console.log("\nDifferences between current and old transformers:");
const differences = compareResults(currentResult, oldResult);
if (differences.length === 0) {
  console.log("No differences found for normal data.");
} else {
  differences.forEach(diff => console.log(diff));
}

// Test with empty thumbnail URLs
console.log("\n=== Testing with empty thumbnail URLs ===");
const currentEmptyResult = CurrentTransformer._transformMediaImage(emptyThumbsImageData);
const oldEmptyResult = OldTransformer._transformMediaImage(emptyThumbsImageData);

console.log("Current Transformer Result with empty thumbs:");
console.log(JSON.stringify(currentEmptyResult, null, 2));
console.log("\nOld Transformer Result with empty thumbs:");
console.log(JSON.stringify(oldEmptyResult, null, 2));

// Compare the empty results
console.log("\nDifferences with empty thumbnails:");
const emptyDifferences = compareResults(currentEmptyResult, oldEmptyResult);
if (emptyDifferences.length === 0) {
  console.log("No differences found for empty thumbnail data.");
} else {
  emptyDifferences.forEach(diff => console.log(diff));
}

// Test with missing thumbnail URLs
console.log("\n=== Testing with missing thumbnail properties ===");
const currentMissingResult = CurrentTransformer._transformMediaImage(missingThumbsImageData);
const oldMissingResult = OldTransformer._transformMediaImage(missingThumbsImageData);

console.log("Current Transformer Result with missing thumbs:");
console.log(JSON.stringify(currentMissingResult, null, 2));
console.log("\nOld Transformer Result with missing thumbs:");
console.log(JSON.stringify(oldMissingResult, null, 2));

// Compare the missing results
console.log("\nDifferences with missing thumbnails:");
const missingDifferences = compareResults(currentMissingResult, oldMissingResult);
if (missingDifferences.length === 0) {
  console.log("No differences found for missing thumbnail data.");
} else {
  missingDifferences.forEach(diff => console.log(diff));
}

// Test with undefined/null data
console.log("\n=== Testing with null/undefined input ===");
console.log("Current Transformer with null input:", CurrentTransformer._transformMediaImage(null));
console.log("Old Transformer with null input:", OldTransformer._transformMediaImage(null));
console.log("Current Transformer with undefined input:", CurrentTransformer._transformMediaImage(undefined));
console.log("Old Transformer with undefined input:", OldTransformer._transformMediaImage(undefined));

// Additional test - show how each transformer handles falsy values in thumbnails
console.log("\n=== Testing how each transformer handles falsy values in thumbnails ===");

// Custom test with various falsy values
const falsyValues = [null, undefined, '', false, 0];
falsyValues.forEach(falsyValue => {
  console.log(`\n--- Testing with falsy value: ${falsyValue === '' ? '""' : falsyValue} ---`);
  const testData = {
    type: 'image/jpeg',
    url: 'https://example.com/image.jpg',
    thumbnails: {
      small: { url: falsyValue },
      large: { url: falsyValue },
      full: { url: falsyValue }
    }
  };
  
  console.log("Current transformer result:");
  console.log(JSON.stringify(CurrentTransformer._transformMediaImage(testData), null, 2));
  
  console.log("Old transformer result:");
  console.log(JSON.stringify(OldTransformer._transformMediaImage(testData), null, 2));
});

// Part 2: Test _transformMediaToDTO method which uses _transformMediaImage
console.log("\n===========================================================");
console.log("PART 2: TESTING INTEGRATION WITH _transformMediaToDTO METHOD");
console.log("===========================================================");

// Test how _transformMediaToDTO uses _transformMediaImage
console.log("\n=== Testing how _transformMediaToDTO uses _transformMediaImage ===");

console.log("Current Transformer _transformMediaToDTO with normal data:");
console.log(JSON.stringify(CurrentTransformer._transformMediaToDTO(sampleImageData), null, 2));

console.log("\nOld Transformer _transformMediaToDTO with normal data:");
console.log(JSON.stringify(OldTransformer._transformMediaToDTO(sampleImageData), null, 2));

console.log("\nCurrent Transformer _transformMediaToDTO with empty thumbs:");
console.log(JSON.stringify(CurrentTransformer._transformMediaToDTO(emptyThumbsImageData), null, 2));

console.log("\nOld Transformer _transformMediaToDTO with empty thumbs:");
console.log(JSON.stringify(OldTransformer._transformMediaToDTO(emptyThumbsImageData), null, 2));

// Part 3: Test in context of the _transformUserInteractionResponse method
console.log("\n===========================================================");
console.log("PART 3: TESTING IN CONTEXT OF REAL USAGE");
console.log("===========================================================");

// Create a mock data object similar to what would be passed to _transformUserInteractionResponse
const mockChatData = {
  "id": "testChat123",
  "모듈 선택 1": "모듈2 : 인터랙션형",
  "인터랙션형-유저선택 버튼 이미지 1 설명 텍스트 / 모듈 선택 1": "Option 1",
  "인터랙션형-유저선택 버튼 이미지 1 / 모듈 선택 1": [sampleImageData],
  "인터랙션형-선택지 1 응답 이미지 / 모듈 선택 1": [emptyThumbsImageData],
  "인터랙션형-선택지 1 응답 텍스트 / 모듈 선택 1": "Response for option 1",
  
  "인터랙션형-유저선택 버튼 이미지 2 설명 텍스트 / 모듈 선택 1": "Option 2",
  "인터랙션형-유저선택 버튼 이미지 2 / 모듈 선택 1": [missingThumbsImageData],
  "인터랙션형-선택지 2 응답 이미지 / 모듈 선택 1": null,
  "인터랙션형-선택지 2 응답 텍스트 / 모듈 선택 1": "Response for option 2"
};

console.log("\n=== Testing _transformUserInteractionResponse with both transformers ===");
const currentIntResponse = CurrentTransformer._transformUserInteractionResponse(mockChatData, 1);
const oldIntResponse = OldTransformer._transformUserInteractionResponse(mockChatData, 1);

console.log("Current Transformer _transformUserInteractionResponse result:");
console.log(JSON.stringify(currentIntResponse, null, 2));

console.log("\nOld Transformer _transformUserInteractionResponse result:");
console.log(JSON.stringify(oldIntResponse, null, 2));

// Compare the structure of the image arrays
console.log("\n=== Differences in image array structure ===");

if (currentIntResponse && oldIntResponse) {
  // Check prompts structure
  const currentPrompts = currentIntResponse.prompts || [];
  const oldPrompts = oldIntResponse.prompts || [];
  
  if (currentPrompts.length > 0 && oldPrompts.length > 0) {
    const currentMedia = currentPrompts[0].media || [];
    const oldMedia = oldPrompts[0].media || [];
    
    console.log(`Current media array length: ${currentMedia.length}`);
    console.log(`Old media array length: ${oldMedia.length}`);
    
    if (currentMedia.length > 0 && oldMedia.length > 0) {
      // Check first media item
      console.log("\nFirst media item comparison:");
      console.log(`Current first media image array length: ${currentMedia[0].image?.length || 0}`);
      console.log(`Old first media image array length: ${oldMedia[0].image?.length || 0}`);
      
      if (currentMedia[0].image && oldMedia[0].image) {
        // Deep comparison of image arrays
        console.log("\nDetailed image array comparison:");
        const maxLength = Math.max(currentMedia[0].image.length, oldMedia[0].image.length);
        
        for (let i = 0; i < maxLength; i++) {
          const currentImg = currentMedia[0].image[i];
          const oldImg = oldMedia[0].image[i];
          
          console.log(`\nImage at index ${i}:`);
          if (currentImg && oldImg) {
            console.log(`Current: ${currentImg.defaultUrl}`);
            console.log(`Old: ${oldImg.defaultUrl}`);
            
            // Check thumbnails
            console.log("Thumbnail comparison:");
            if (currentImg.thumbnail && oldImg.thumbnail) {
              console.log(`Current tiny: ${currentImg.thumbnail.tiny}`);
              console.log(`Old tiny: ${oldImg.thumbnail.tiny}`);
            } else {
              console.log("Missing thumbnail in one of the versions");
            }
          } else if (currentImg) {
            console.log("Only exists in current version");
          } else if (oldImg) {
            console.log("Only exists in old version");
          }
        }
      }
    }
  }
}

// Helper function to compare results
function compareResults(current, old) {
  const differences = [];
  
  // Check if both are null or undefined
  if (!current && !old) {
    return differences;
  }
  
  // Check if one is null/undefined and the other isn't
  if (!current) {
    differences.push("Current result is null/undefined but old result is not");
    return differences;
  }
  if (!old) {
    differences.push("Old result is null/undefined but current result is not");
    return differences;
  }
  
  // Compare properties
  if (current.type !== old.type) {
    differences.push(`Type differs: current=${current.type}, old=${old.type}`);
  }
  
  if (current.defaultUrl !== old.defaultUrl) {
    differences.push(`DefaultUrl differs: current=${current.defaultUrl}, old=${old.defaultUrl}`);
  }
  
  if (current.sound !== old.sound) {
    differences.push(`Sound differs: current=${current.sound}, old=${old.sound}`);
  }
  
  // Compare thumbnails
  if (current.thumbnail && old.thumbnail) {
    const currentThumbs = current.thumbnail;
    const oldThumbs = old.thumbnail;
    
    if (currentThumbs.tiny !== oldThumbs.tiny) {
      differences.push(`Tiny thumbnail differs: current=${currentThumbs.tiny}, old=${oldThumbs.tiny}`);
    }
    
    if (currentThumbs.small !== oldThumbs.small) {
      differences.push(`Small thumbnail differs: current=${currentThumbs.small}, old=${oldThumbs.small}`);
    }
    
    if (currentThumbs.medium !== oldThumbs.medium) {
      differences.push(`Medium thumbnail differs: current=${currentThumbs.medium}, old=${oldThumbs.medium}`);
    }
    
    if (currentThumbs.large !== oldThumbs.large) {
      differences.push(`Large thumbnail differs: current=${currentThumbs.large}, old=${oldThumbs.large}`);
    }
  } else if (!current.thumbnail && old.thumbnail) {
    differences.push("Current has no thumbnail but old does");
  } else if (current.thumbnail && !old.thumbnail) {
    differences.push("Old has no thumbnail but current does");
  }
  
  return differences;
}