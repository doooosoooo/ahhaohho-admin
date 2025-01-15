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

    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    return transformedData;
  }

  static _transformChat(data) {
    const chatArray = [];
    
    for (let i = 1; i <= 15; i++) {
      const moduleType = data[`모듈 선택 ${i}`];
      if (!moduleType) continue;

      // 매개자 대화 처리
      const mediatorItem = this._transformMediatorDialogue(data, i, moduleType);
      if (mediatorItem) {
        chatArray.push(mediatorItem);
      }

      // 유저 응답 처리
      const userItem = this._transformUserResponse(data, i, moduleType);
      if (userItem) {
        chatArray.push(userItem);
      }
    }

    // 대화 종료 메시지 추가 (매개자)
    const endMessage = data['모듈 4 대화 종료 매개자 대사'];
    if (endMessage) {
      chatArray.push(this._createMediatorMessage(endMessage));
    }

    return chatArray;
  }

  static _transformMediatorDialogue(data, moduleNum, moduleType) {
    switch (moduleType) {
      case '모듈1 : 버튼 반응형':
        return this._transformMediatorButtonType(data, moduleNum);
      case '모듈2 : 인터랙션형':
        return this._transformMediatorInteractionType(data, moduleNum);
      case '모듈3 : 타이핑형':
        return this._transformTypingTypeMediator(data, moduleNum);
      default:
        return null;
    }
  }

  static _transformUserResponse(data, moduleNum, moduleType) {
    switch (moduleType) {
      case '모듈1 : 버튼 반응형':
        return this._transformUserButtonResponse(data, moduleNum);
      case '모듈2 : 인터랙션형':
        return this._transformUserInteractionResponse(data, moduleNum);
      case '모듈3 : 타이핑형':
        return this._transformTypingType();
      default:
        return null;
    }
  }

  static _transformMediatorButtonType(data, moduleNum) {
    const mediatorText = data[`버튼 반응형-매개자 대사 1 / 모듈 선택 ${moduleNum}`];
    const mediatorImage = data[`버튼 반응형-매개자 이미지 1 / 모듈 선택 ${moduleNum}`];

    if (!mediatorText && !mediatorImage) return null;

    const media = mediatorImage ? this._transformMediaToDTO(mediatorImage[0]) : null;
    
    return {
      type: media ? 'text+image' : 'text',
      talker: 'ahhaohho',
      hasOpts: false,
      prompts: [{
        text: mediatorText || null,
        media
      }]
    };
  }

static _transformUserButtonResponse(data, moduleNum) {
    const prompts = [];
    let hasImage = false;
    let hasText = false;

    for (let i = 1; i <= 2; i++) {
      const content = data[`버튼 반응형-유저 선택지 내용 ${i} / 모듈 선택 ${moduleNum}`];
      const image = data[`버튼 반응형-유저 선택지 이미지 ${i} / 모듈 선택 ${moduleNum}`];

      if (content || image) {
        const media = image ? this._transformMediaToDTO(image[0]) : null;
        if (media) hasImage = true;
        if (content) hasText = true;
        prompts.push({
          text: content || null,
          media
        });
      }
    }

    if (prompts.length === 0) return null;

    let type = 'text';
    if (hasImage && hasText) {
      type = 'text+image';
    } else if (hasImage && !hasText) {
      type = 'image';
    }

    return {
      type,
      talker: 'user',
      hasOpts: true,
      prompts
    };
}

  static _transformMediatorInteractionType(data, moduleNum) {
    const mediatorText = data[`인터랙션형-매개자 대사 / 모듈 선택 ${moduleNum}`];
    if (!mediatorText) return null;

    return {
      type: 'text',
      talker: 'ahhaohho',
      hasOpts: false,
      prompts: [{
        text: mediatorText,
        media: null
      }]
    };
  }

  static _transformUserInteractionResponse(data, moduleNum) {
    const medias = [];

    for (let i = 1; i <= 4; i++) {
      const buttonTitle = data[`인터랙션형-유저선택 버튼 이미지 ${i} 설명 텍스트 / 모듈 선택 ${moduleNum}`];
      const buttonImage = data[`인터랙션형-유저선택 버튼 이미지 ${i} / 모듈 선택 ${moduleNum}`];
      const responseImage = data[`인터랙션형-선택지 ${i} 응답 이미지 / 모듈 선택 ${moduleNum}`];
      const responseText = data[`인터랙션형-선택지 ${i} 응답 텍스트 / 모듈 선택 ${moduleNum}`];

      if (buttonImage || responseImage || responseText) {
        medias.push(  // 외부 배열
          {           // 단일 미디어 객체
            title: buttonTitle || null,  // buttonTitle 추가
            image: [
              buttonImage ? this._transformMediaImage(buttonImage[0]) : null,
              responseImage ? this._transformMediaImage(responseImage[0]) : null
            ].filter(img => img !== null),
            imageDescription: responseText || null
          }
        );
      }
    }

    return medias.length > 0 ? {
      type: 'text+image',
      talker: 'prompt',
      prompts: [{
        text: null,
        media: medias
      }]
    } : null;
  }

  static _createMediatorMessage(text) {
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
  
  static _transformTypingType() {    
    return {
      type: 'userTyping',
      talker: 'user',
      hasOpts: false,
      prompts: [{
        text: null,
        media: null
      }]
    };
  }

  static _transformTypingTypeMediator(data, moduleNum) {
    const text = data[`타이핑형-매개자 대사 / 모듈 선택 ${moduleNum}`];
    
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

    return [{  // 배열로 감싸서 반환
      title: null,
      image: [this._transformMediaImage(mediaData)].filter(img => img !== null),
      imageDescription: null
    }];
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