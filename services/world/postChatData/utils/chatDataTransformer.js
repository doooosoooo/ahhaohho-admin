// utils/transformers/chatDataTransformer.js
class ChatDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    // 일반적인 변환 처리
    const transformedData = {
      chatIdx: data.id,
      step: 'challenge',
      chat: this._transformChat(data)
    };
    
    // 모든 변환이 끝난 후, 백슬래시 메시지 후처리 적용
    transformedData.chat = this._processBackslashesInFinalChat(transformedData.chat);

    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    return transformedData;
  }

  // 최종 chat 배열에 대한 백슬래시 후처리
  static _processBackslashesInFinalChat(chatArray) {
    const result = [];
    
    for (const message of chatArray) {
      // 각 메시지의 prompts 배열 확인
      if (message.prompts && message.prompts.length > 0) {
        // 각 프롬프트의 텍스트 확인
        const prompt = message.prompts[0];
        
        // 텍스트가 있고 백슬래시를 포함하는 경우에만 처리
        if (prompt.text && (prompt.text.includes('\\') || prompt.text.includes('＼'))) {
          // 일반 백슬래시와 전각 백슬래시 모두 처리
          const parts = prompt.text.split(/[\\＼]/).map(part => part.trim()).filter(part => part);
          
          if (parts.length > 1) {
            // 첫 번째 부분은 원래 메시지의 미디어와 함께 사용
            const firstMessage = {
              ...message,
              prompts: [{
                ...prompt,
                text: parts[0]
              }]
            };
            result.push(firstMessage);
            
            // 나머지 부분은 별도의 메시지로 추가 (미디어 없음)
            for (let i = 1; i < parts.length; i++) {
              const newMessage = {
                ...message,
                prompts: [{
                  text: parts[i],
                  media: null
                }]
              };
              result.push(newMessage);
            }
          } else {
            // 백슬래시가 있지만 분리된 부분이 하나뿐인 경우 (빈 부분이 필터링됨)
            result.push(message);
          }
        } else {
          // 백슬래시가 없는 경우 그대로 추가
          result.push(message);
        }
      } else {
        // prompts 배열이 없거나 비어있는 경우 그대로 추가
        result.push(message);
      }
    }
    
    return result;
  }

  static _transformChat(data) {
    const chatArray = [];
    
    for (let i = 1; i <= 15; i++) {
      const moduleType = data[`모듈 선택 ${i}`];
      if (!moduleType) continue;

      // 매개자 대화 처리
      const mediatorItems = this._transformMediatorDialogue(data, i, moduleType);
      if (mediatorItems) {
        // 배열인 경우 모든 항목 추가, 객체인 경우 단일 항목으로 추가
        if (Array.isArray(mediatorItems)) {
          chatArray.push(...mediatorItems);
        } else {
          chatArray.push(mediatorItems);
        }
      }

      // 유저 응답 처리
      const userItems = this._transformUserResponse(data, i, moduleType);
      if (userItems) {
        // 배열인 경우 모든 항목 추가, 객체인 경우 단일 항목으로 추가
        if (Array.isArray(userItems)) {
          chatArray.push(...userItems);
        } else {
          chatArray.push(userItems);
        }
      }
    }

    // 대화 종료 메시지 추가 (매개자)
    const endMessage = data['모듈 4 대화 종료 매개자 대사'];
    if (endMessage) {
      // 종료 메시지는 talker가 'prompt'여야 함
      const endMessageItems = this._processTextWithBackslash(endMessage, 'endChat');
      if (Array.isArray(endMessageItems)) {
        chatArray.push(...endMessageItems);
      } else {
        chatArray.push(endMessageItems);
      }
    }

    return chatArray;
  }

  // 기존 백슬래시 처리 함수 - 일부 모듈에서 사용
  static _processTextWithBackslash(text, talker) {
    if (!text) return null;
    
    // 일반 백슬래시(\\)와 전각 백슬래시(＼) 모두 처리
    const fullWidthBackslash = '＼'; // 유니코드 FF3C
    const hasBackslash = text.includes('\\') || text.includes(fullWidthBackslash);
    
    if (hasBackslash) {
      // 먼저 일반 백슬래시로 나누기
      let parts = text.split('\\');
      
      // 각 부분에 대해 전각 백슬래시로 추가 분리
      const finalParts = [];
      for (const part of parts) {
        const subParts = part.split(fullWidthBackslash);
        finalParts.push(...subParts);
      }
      
      // 빈 문자열 제거 및 공백 제거
      const filteredParts = finalParts
        .filter(part => part.trim() !== '')
        .map(part => part.trim());
      
      return filteredParts.map(part => ({
        type: 'text',
        talker,
        hasOpts: false,
        prompts: [{
          text: part,
          media: null
        }]
      }));
    }
    
    return {
      type: 'text',
      talker,
      hasOpts: false,
      prompts: [{
        text,
        media: null
      }]
    };
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

    // 백슬래시 처리 - 버튼 반응형 매개자는 talker가 'ahhaohho'
    if (mediatorText && (mediatorText.includes('\\') || mediatorText.includes('＼'))) {
      const textParts = mediatorText.split(/[\\＼]/).map(part => part.trim()).filter(part => part);
      const items = [];
      
      // 첫 번째 부분만 이미지가 있으면 이미지와 함께 표시
      if (textParts.length > 0) {
        const firstText = textParts[0];
        const media = mediatorImage ? this._transformMediaToDTO(mediatorImage[0]) : null;
        
        items.push({
          type: media ? 'text+image' : 'text',
          talker: 'ahhaohho',
          hasOpts: false,
          prompts: [{
            text: firstText,
            media
          }]
        });
        
        // 나머지 부분은 텍스트만
        for (let i = 1; i < textParts.length; i++) {
          items.push({
            type: 'text',
            talker: 'ahhaohho',
            hasOpts: false,
            prompts: [{
              text: textParts[i],
              media: null
            }]
          });
        }
      }
      
      return items;
    }

    // 백슬래시가 없는 경우 기존 로직
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

      // 백슬래시 처리는 여기서는 적용하지 않음 (유저 선택지는 분리되지 않음)
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

    // 백슬래시 처리 - 인터랙션형 매개자는 talker가 'ahhaohho'
    return this._processTextWithBackslash(mediatorText, 'ahhaohho');
  }

  static _transformUserInteractionResponse(data, moduleNum) {
      const medias = [];

      for (let i = 1; i <= 4; i++) {
        const buttonTitle = data[`인터랙션형-유저선택 버튼 이미지 ${i} 설명 텍스트 / 모듈 선택 ${moduleNum}`];
        const buttonImage = data[`인터랙션형-유저선택 버튼 이미지 ${i} / 모듈 선택 ${moduleNum}`];
        const responseImage = data[`인터랙션형-선택지 ${i} 응답 이미지 / 모듈 선택 ${moduleNum}`];
        const responseText = data[`인터랙션형-선택지 ${i} 응답 텍스트 / 모듈 선택 ${moduleNum}`];

        if (buttonImage || responseImage || responseText) {
          // buttonImage 변환
          const transformedButtonImage = buttonImage ? this._transformMediaImage(buttonImage[0]) : null;
          
          // responseImage 변환 또는 buttonImage로 대체
          const transformedResponseImage = responseImage 
            ? this._transformMediaImage(responseImage[0]) 
            : transformedButtonImage; // 응답 이미지가 없으면 버튼 이미지를 사용
          
          // 이미지 배열 생성 (null인 경우 filter로 제거)
          const imageArray = [transformedButtonImage, transformedResponseImage].filter(img => img !== null);
          
          medias.push({
            title: buttonTitle || null,
            image: imageArray,
            imageDescription: responseText || null
          });
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
    // 종료 메시지는 talker가 'prompt'여야 함
    return this._processTextWithBackslash(text, 'endChat');
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
    if (!text) return null;
    
    // 백슬래시 처리 - 타이핑형 매개자는 talker가 'prompt'여야 함
    return this._processTextWithBackslash(text, 'user');
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