===========================================================
PART 1: DIRECT TESTING OF _transformMediaImage METHOD
===========================================================
=== Testing with normal thumbnail data ===
Current Transformer Result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
    "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
    "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
    "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
  }
}

Old Transformer Result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
    "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
    "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
    "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
  }
}

Differences between current and old transformers:
No differences found for normal data.

=== Testing with empty thumbnail URLs ===
Current Transformer Result with empty thumbs:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

Old Transformer Result with empty thumbs:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

Differences with empty thumbnails:
No differences found for empty thumbnail data.

=== Testing with missing thumbnail properties ===
Current Transformer Result with missing thumbs:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

Old Transformer Result with missing thumbs:
{
  "type": "image/jpeg",
  "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

Differences with missing thumbnails:
No differences found for missing thumbnail data.

=== Testing with null/undefined input ===
Current Transformer with null input: null
Old Transformer with null input: null
Current Transformer with undefined input: null
Old Transformer with undefined input: null

=== Testing how each transformer handles falsy values in thumbnails ===

--- Testing with falsy value: null ---
Current transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}
Old transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

--- Testing with falsy value: undefined ---
Current transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}
Old transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

--- Testing with falsy value: "" ---
Current transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}
Old transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

--- Testing with falsy value: false ---
Current transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}
Old transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

--- Testing with falsy value: 0 ---
Current transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}
Old transformer result:
{
  "type": "image/jpeg",
  "defaultUrl": "https://example.com/image.jpg",
  "sound": false,
  "thumbnail": {
    "tiny": null,
    "small": null,
    "medium": null,
    "large": null
  }
}

===========================================================
PART 2: TESTING INTEGRATION WITH _transformMediaToDTO METHOD
===========================================================

=== Testing how _transformMediaToDTO uses _transformMediaImage ===
Current Transformer _transformMediaToDTO with normal data:
[
  {
    "title": null,
    "image": [
      {
        "type": "image/jpeg",
        "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
        "sound": false,
        "thumbnail": {
          "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
          "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
          "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
          "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
        }
      }
    ],
    "imageDescription": null
  }
]

Old Transformer _transformMediaToDTO with normal data:
[
  {
    "title": null,
    "image": [
      {
        "type": "image/jpeg",
        "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
        "sound": false,
        "thumbnail": {
          "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
          "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
          "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
          "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
        }
      }
    ],
    "imageDescription": null
  }
]

Current Transformer _transformMediaToDTO with empty thumbs:
[
  {
    "title": null,
    "image": [
      {
        "type": "image/jpeg",
        "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
        "sound": false,
        "thumbnail": {
          "tiny": null,
          "small": null,
          "medium": null,
          "large": null
        }
      }
    ],
    "imageDescription": null
  }
]

Old Transformer _transformMediaToDTO with empty thumbs:
[
  {
    "title": null,
    "image": [
      {
        "type": "image/jpeg",
        "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
        "sound": false,
        "thumbnail": {
          "tiny": null,
          "small": null,
          "medium": null,
          "large": null
        }
      }
    ],
    "imageDescription": null
  }
]

===========================================================
PART 3: TESTING IN CONTEXT OF REAL USAGE
===========================================================

=== Testing _transformUserInteractionResponse with both transformers ===
Current Transformer _transformUserInteractionResponse result:
{
  "type": "text+image",
  "talker": "prompt",
  "prompts": [
    {
      "text": null,
      "media": [
        {
          "title": "Option 1",
          "image": [
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
                "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
                "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
                "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
              }
            },
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": null,
                "small": null,
                "medium": null,
                "large": null
              }
            }
          ],
          "imageDescription": "Response for option 1"
        },
        {
          "title": "Option 2",
          "image": [
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": null,
                "small": null,
                "medium": null,
                "large": null
              }
            },
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": null,
                "small": null,
                "medium": null,
                "large": null
              }
            }
          ],
          "imageDescription": "Response for option 2"
        }
      ]
    }
  ]
}

Old Transformer _transformUserInteractionResponse result:
{
  "type": "text+image",
  "talker": "prompt",
  "prompts": [
    {
      "text": null,
      "media": [
        {
          "title": "Option 1",
          "image": [
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
                "small": "https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36",
                "medium": "https://cdn-world.ahhaohho.com/chatData/thumbnails/large/LMNOPQRSTUV?w=512&h=640",
                "large": "https://cdn-world.ahhaohho.com/chatData/thumbnails/full/WXYZ123456?w=780&h=975"
              }
            },
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": null,
                "small": null,
                "medium": null,
                "large": null
              }
            }
          ],
          "imageDescription": "Response for option 1"
        },
        {
          "title": "Option 2",
          "image": [
            {
              "type": "image/jpeg",
              "defaultUrl": "https://cdn-world.ahhaohho.com/chatData/1234567890",
              "sound": false,
              "thumbnail": {
                "tiny": null,
                "small": null,
                "medium": null,
                "large": null
              }
            }
          ],
          "imageDescription": "Response for option 2"
        }
      ]
    }
  ]
}

=== Differences in image array structure ===
Current media array length: 2
Old media array length: 2

First media item comparison:
Current first media image array length: 2
Old first media image array length: 2

Detailed image array comparison:

Image at index 0:
Current: https://cdn-world.ahhaohho.com/chatData/1234567890
Old: https://cdn-world.ahhaohho.com/chatData/1234567890
Thumbnail comparison:
Current tiny: https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36
Old tiny: https://cdn-world.ahhaohho.com/chatData/thumbnails/small/ABCDEFGHIJK?w=29&h=36

Image at index 1:
Current: https://cdn-world.ahhaohho.com/chatData/1234567890
Old: https://cdn-world.ahhaohho.com/chatData/1234567890
Thumbnail comparison:
Current tiny: null
Old tiny: null
