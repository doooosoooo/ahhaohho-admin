// utils/transformers/chatDataTransformer.js
class ChatDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    const transformedData = {
      chatIdx: data.id,
      step: 'challenge',
      chat: this._transformChat(data)
    };

    // 변환된 데이터 로깅
    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    
    return transformedData;
  }
   
  static _transformChat(data) {
    const chatArray = [];
    
    // 모듈 1-15 처리
    for (let i = 1; i <= 15; i++) {
      const moduleType = data[`모듈 선택 ${i}`];
      if (!moduleType) continue;

      const moduleItem = this._transformModule(data, i, moduleType);
      if (moduleItem) {
        chatArray.push(moduleItem);
      }
    }

    // 대화 종료 메시지 추가
    const endMessage = data['모듈 4 대화 종료 매개자 대사'];
    if (endMessage) {
      chatArray.push({
        type: 'text',
        talker: 'ahhaohho',
        hasOpts: false,
        prompts: [{
          text: endMessage,
          media: null
        }]
      });
    }

    return chatArray;
  }

  static _transformModule(data, moduleNum, moduleType) {
    switch (moduleType) {
      case '모듈1 : 버튼 반응형':
        return this._transformButtonType(data, moduleNum);
      case '모듈2 : 인터랙션형':
        return this._transformInteractionType(data, moduleNum);
      case '모듈3 : 타이핑형':
        return this._transformTypingType(data, moduleNum);
      default:
        return null;
    }
  }

  static _transformButtonType(data, moduleNum) {
    const prompts = [];

    // 매개자 데이터 처리
    const mediatorText = data[`버튼 반응형-매개자 대사 1 / 모듈 선택 ${moduleNum}`];
    const mediatorImage = data[`버튼 반응형-매개자 이미지 1 / 모듈 선택 ${moduleNum}`];

    if (mediatorText || mediatorImage) {
      prompts.push({
        text: mediatorText || null,
        media: mediatorImage ? this._transformMediaToDTO(mediatorImage[0]) : null
      });
    }

    // 유저 선택지 처리
    for (let i = 1; i <= 2; i++) {
      const content = data[`버튼 반응형-유저 선택지 내용 ${i} / 모듈 선택 ${moduleNum}`];
      const image = data[`버튼 반응형-유저 선택지 이미지 ${i} / 모듈 선택 ${moduleNum}`];

      if (content || image) {
        prompts.push({
          text: content || null,
          media: image ? this._transformMediaToDTO(image[0]) : null
        });
      }
    }

    return prompts.length > 0 ? {
      type: 'text+image',
      talker: 'ahhaohho',
      hasOpts: true,
      prompts
    } : null;
  }

  static _transformInteractionType(data, moduleNum) {
    const prompts = [];

    const mediatorText = data[`인터랙션형-매개자 대사 / 모듈 선택 ${moduleNum}`];
    if (mediatorText) {
      prompts.push({
        text: mediatorText,
        media: null
      });
    }

    // 선택지 처리 (1-4)
    for (let i = 1; i <= 4; i++) {
      const buttonImage = data[`인터랙션형-유저선택 버튼 이미지 ${i} / 모듈 선택 ${moduleNum}`];
      const responseImage = data[`인터랙션형-선택지 ${i} 응답 이미지 / 모듈 선택 ${moduleNum}`];
      const responseText = data[`인터랙션형-선택지 ${i} 응답 텍스트 / 모듈 선택 ${moduleNum}`];

      if (buttonImage || responseImage || responseText) {
        const prompt = {
          text: null,
          media: {
            title: null,
            image: [
              buttonImage ? this._transformMediaImage(buttonImage[0]) : null,
              responseImage ? this._transformMediaImage(responseImage[0]) : null
            ],
            imageDescription: responseText || null
          }
        };
        prompts.push(prompt);
      }
    }

    return prompts.length > 0 ? {
      type: 'text+image',
      talker: 'ahhaohho',
      hasOpts: true,
      prompts
    } : null;
  }
  
  static _transformTypingType(data, moduleNum) {
    const text = data[`타이핑형-매개자 대사 / 모듈 선택 ${moduleNum}`];
    if (!text) return null;

    return {
      type: 'text',
      talker: 'ahhaohho',
      hasOpts: false,
      prompts: [{
        text,
        media: null
      }]
    };
  }

  static _transformMediaToDTO(mediaData) {
    if (!mediaData) return null;

    return {
      title: null,
      image: [this._transformMediaImage(mediaData)],
      imageDescription: null
    };
  }

  static _transformMediaImage(mediaData) {
    if (!mediaData) return null;

    return {
      type: mediaData.type || null,
      defaultUrl: mediaData.url || null,
      sound: false,
      thumbnail: {
        tiny: mediaData.thumbnails?.small?.url || null,
        small: mediaData.thumbnails?.small?.url || null,
        medium: mediaData.thumbnails?.large?.url || null,
        large: mediaData.thumbnails?.full?.url || null
      }
    };
  }
}

module.exports = ChatDataTransformer;