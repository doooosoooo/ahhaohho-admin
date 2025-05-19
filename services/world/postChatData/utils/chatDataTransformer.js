// utils/transformers/chatDataTransformer.js
class ChatDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    // 데이터 유효성 검증
    if (!data.id) {
      throw new Error('ID field is required in data object');
    }

    // 서버 DTO 요구사항에 맞게 데이터 변환
    const chatItems = this._transformChat(data);
    
    // chatId 값이 반드시 전송되도록 보장
    if (!data.id) {
      throw new Error('ID field is required in data object');
    }
    
    const transformedData = {
      chatId: data.id,   // 중요! PutChatRequestDTO에서 필수 필드
      step: 'challenge', 
      chat: this._transformPromptFormsat(chatItems) // prompt 형식으로 변환
    };
    
    // chatId가 있는지 디버그 출력
    console.log(`DEBUG - chatId 확인: ${transformedData.chatId}`);
    
    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    return transformedData;
  }
  
  // PutChatRequestDTO 형식에 맞게 변환 (서버 DTO 기준)
  static _transformPromptFormat(chatItems) {
    if (!chatItems || !Array.isArray(chatItems)) {
      return [];
    }
    
    return chatItems.map(item => {
      // DTO 요구사항에 맞게 변환 (서버 validatePrompt 메서드 참고)
      if (item.prompts) {
        // type 검증 및 기본값 설정
        let type = item.type || 'text';
        if (!['text', 'image', 'text+image'].includes(type)) {
          type = 'text';
        }
        
        // talker 검증 및 기본값 설정
        let talker = item.talker || 'ahhaohho';
        if (!['user', 'ahhaohho', 'prompt'].includes(talker)) {
          talker = 'ahhaohho';
        }
        
        // 텍스트를 prompt 배열로 변환 (반드시 비어있지 않은 배열이어야 함)
        const promptTexts = item.prompts
          .map(p => p.text || '')
          .filter(text => text !== undefined);
          
        // 빈 배열인 경우 기본값 추가
        const prompt = promptTexts.length > 0 ? promptTexts : [''];
        
        // 이미지 처리
        const image = this._extractImagesFromPrompts(item.prompts);
        
        return {
          type,
          talker,
          prompt, // 서버 요구사항: 비어있지 않은 문자열 배열
          ...(image.length > 0 && { image }) // 이미지가 있는 경우에만 필드 추가
        };
      }
      return item;
    });
  }
  
  // 프롬프트에서 이미지 추출하여 DTO 형식으로 변환
  static _extractImagesFromPrompts(prompts) {
    if (!prompts || !Array.isArray(prompts)) {
      return [];
    }
    
    const images = [];
    
    for (const prompt of prompts) {
      if (prompt.media && Array.isArray(prompt.media)) {
        for (const mediaItem of prompt.media) {
          if (mediaItem && mediaItem.image && Array.isArray(mediaItem.image)) {
            for (const img of mediaItem.image) {
              if (img) {
                // 서버 DTO validateMedia 메서드에 맞게 변환
                images.push({
                  media: {
                    type: img.type || '',
                    defaultUrl: img.defaultUrl || '',
                    sound: !!img.sound, // boolean 값 보장
                    thumbnail: {
                      tiny: img.thumbnail?.tiny || '',
                      small: img.thumbnail?.small || '',
                      medium: img.thumbnail?.medium || '',
                      large: img.thumbnail?.large || ''
                    }
                  },
                  description: mediaItem.imageDescription || ''
                });
              }
            }
          }
        }
      }
    }
    
    return images;
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
    
    // 백슬래시가 있는지 확인
    const hasBackslash = text.includes('\\') || text.includes('＼');
    
    if (!hasBackslash) {
      // 백슬래시가 없으면 단일 메시지 반환
      return {
        type: 'text',
        talker: 'prompt',
        hasOpts: false,
        prompts: [{
          text: text,
          media: null
        }]
      };
    }
    
    // 백슬래시로 텍스트 분리
    const parts = text.split(/[\\＼]/).map(part => part.trim()).filter(part => part);
    
    // 결과 배열 초기화
    const result = [];
    
    // userTyping 객체 생성
    const userTypingObj = this._transformTypingType();
    
    // 각 부분에 대해 메시지와 userTyping 교대로 추가
    for (let i = 0; i < parts.length; i++) {
      // 매개자 메시지 추가
      result.push({
        type: 'text',
        talker: 'prompt',
        hasOpts: false,
        prompts: [{
          text: parts[i],
          media: null
        }]
      });
      
      // 각 메시지 뒤에 userTyping 추가 (마지막 메시지 제외)
      if (i < parts.length - 1) {
        result.push({...userTypingObj});
      }
    }
    
    return result;
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