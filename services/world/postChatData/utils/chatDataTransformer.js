// utils/transformers/chatDataTransformer.js
class ChatDataTransformer {
  static async transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    // 데이터 유효성 검증 - 더 상세한 로깅과 검증
    if (!data.id) {
      console.error('ERROR - Missing ID in data object:', {
        dataKeys: Object.keys(data),
        dataType: typeof data,
        hasId: 'id' in data,
        idValue: data.id
      });
      throw new Error('ID field is required in data object');
    }

    // ID 타입 및 값 검증
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      console.error('ERROR - Invalid ID format:', {
        idType: typeof data.id,
        idValue: data.id,
        idLength: data.id?.length
      });
      throw new Error(`Invalid ID format: expected non-empty string, got ${typeof data.id} with value: ${data.id}`);
    }

    console.log(`[TRANSFORM] Processing data with ID: ${data.id}`);

    // 서버 DTO 요구사항에 맞게 데이터 변환
    const chatItems = await this._transformChat(data);
    
    const transformedData = {
      chatId: data.id,   // 중요! PutChatRequestDTO에서 필수 필드
      step: 'challenge', 
      chat: this._transformPromptFormat(chatItems) // prompt 형식으로 변환
    };
    
    // 최종 변환 결과 검증
    if (!transformedData.chatId) {
      console.error('ERROR - chatId missing after transformation:', {
        originalId: data.id,
        transformedChatId: transformedData.chatId
      });
      throw new Error('ChatId was lost during transformation');
    }
    
    // chatId가 있는지 디버그 출력
    console.log(`[TRANSFORM] Successfully transformed data - chatId: ${transformedData.chatId}`);
    
    // userTyping 항목이 몇 개 있는지 확인
    const userTypingCount = transformedData.chat.filter(item => item.type === 'userTyping').length;
    console.log(`[DEBUG] 최종 변환 결과의 userTyping 항목 수: ${userTypingCount}`);
    
    if (userTypingCount > 0) {
      console.log(`[DEBUG] userTyping 항목 샘플:`, 
        JSON.stringify(transformedData.chat.filter(item => item.type === 'userTyping')[0]));
    }
    
    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    return transformedData;
  }
  
  // PutChatRequestDTO 형식에 맞게 변환 (서버 DTO 기준)
  static _transformPromptFormat(chatItems) {
    if (!chatItems || !Array.isArray(chatItems)) {
      return [];
    }
    
    // userTyping 형식이 몇 개 있는지 확인
    const userTypingCount = chatItems.filter(item => item.type === 'userTyping').length;
    console.log(`[DEBUG] 변환 전 userTyping 항목 수: ${userTypingCount}`);
    
    return chatItems.map(item => {
      // DTO 요구사항에 맞게 변환 (서버 validatePrompt 메서드 참고)
      if (item.prompts) {
        // type 검증 및 기본값 설정
        let type = item.type || 'text';
        // userTyping 타입은 그대로 유지 (유효한 타입)
        if (type === 'userTyping') {
          console.log(`[DEBUG] userTyping 항목 발견: talker=${item.talker}`);
          // userTyping 타입은 그대로 유지해야 함
        } else if (!['text', 'image', 'text+image', 'text+octo', 'userTyping'].includes(type)) {
          console.log(`[DEBUG] 유효하지 않은 타입 변환: ${type} -> text`);
          type = 'text';
        }
        
        // talker 검증 및 기본값 설정
        let talker = item.talker || 'ahhaohho';
        if (!['user', 'ahhaohho', 'prompt', 'endChat'].includes(talker)) {
          talker = 'ahhaohho';
        }
        
        // 텍스트를 prompt 배열로 변환 (반드시 비어있지 않은 배열이어야 함)
        const promptTexts = item.prompts
          .map(p => p.text || '')
          .filter(text => text !== undefined);
          
        // 빈 배열인 경우 기본값 추가
        const prompt = promptTexts.length > 0 ? promptTexts : [''];
          
        // 서버 DTO 요구사항: prompts는 객체 배열 [{text: "텍스트"}] 형태이어야 함
        const promptObjects = prompt.map(text => ({
          text: text,
          media: null
        }));
        
        // 이미지 처리 - 기존 방식이 아닌 프롬프트 배열에 이미지 포함
        const images = this._extractImagesFromPrompts(item.prompts);
        
        // 프롬프트에 이미지 포함 처리
        const updatedPromptObjects = promptObjects.map((prompt, index) => {
          // 원본 프롬프트의 미디어 정보 참조
          const originalPrompt = item.prompts && item.prompts[index];
          const media = originalPrompt && originalPrompt.media ? originalPrompt.media : null;
          const octo = originalPrompt && originalPrompt.octo ? originalPrompt.octo : undefined;
          
          // 이미지가 있는 경우 미디어 필드 설정, octo가 있는 경우 octo 필드 설정
          const result = { ...prompt, media };
          if (octo) {
            result.octo = octo;
          }
          return result;
        });
        
        // 수정된 구조: image 필드는 중첩구조가 아닌 정규화된 형태로만 추가
        // 그리고 hasOpts 필드 추가
        const result = {
          type,
          talker,
          prompts: updatedPromptObjects, // 프롬프트에 미디어 정보 포함
          hasOpts: item.hasOpts || false // hasOpts 필드 보존
        };
        
        // 디버깅을 위한 로그 (이미지 감지)
        if (images.length > 0) {
          console.log(`[DEBUG] 아이템에 이미지 ${images.length}개 있음 (중첩 구조 방지)`);
        }
        
        // userTyping 타입인 경우 디버깅 로그 추가
        if (type === 'userTyping') {
          console.log(`[DEBUG] userTyping 항목 최종 변환 결과:`, JSON.stringify(result));
        }
        
        return result;
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
        // 원래 미디어 구조 유지 - 각 미디어 아이템은 하나의 객체로 변환
        for (const mediaItem of prompt.media) {
          if (mediaItem && mediaItem.image && Array.isArray(mediaItem.image)) {
            // 서버 DTO validateMedia 메서드에 맞게 변환하되, 이미지 배열을 유지
            const transformedImages = mediaItem.image.map(img => {
              if (!img) return null;
              
              return {
                type: img.type || '',
                defaultUrl: img.defaultUrl || '',
                sound: !!img.sound, // boolean 값 보장
                thumbnail: {
                  tiny: img.thumbnail?.tiny || '',
                  small: img.thumbnail?.small || '',
                  medium: img.thumbnail?.medium || '',
                  large: img.thumbnail?.large || ''
                }
              };
            }).filter(img => img !== null);
            
            if (transformedImages.length > 0) {
              // 중첩된 구조 대신 직접 미디어 객체를 배열에 추가
              images.push({
                title: mediaItem.title || null,
                image: transformedImages,
                imageDescription: mediaItem.imageDescription || ''
              });
            }
          }
        }
      }
    }
    
    return images;
  }

  static async _transformChat(data) {
    const chatArray = [];
    
    for (let i = 1; i <= 15; i++) {
      const moduleType = data[`모듈 선택 ${i}`];
      if (!moduleType) continue;
      
      console.log(`[DEBUG] 모듈 ${i} 타입: ${moduleType}`); // 어떤 모듈이 사용되는지 확인

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
    const endMessageMedia = data['모듈 4 대화 종료 매개자 첨부 미디어'];
    
    if (endMessage) {
      // octostudio 파일이 있는지 확인
      if (endMessageMedia && endMessageMedia.length > 0) {
        const endMessageItems = await this._processEndMessageWithOcto(endMessage, endMessageMedia);
        if (Array.isArray(endMessageItems)) {
          chatArray.push(...endMessageItems);
        } else {
          chatArray.push(endMessageItems);
        }
      } else {
        // 기존 방식: 텍스트만 있는 경우
        const endMessageItems = this._processTextWithBackslash(endMessage, 'endChat');
        if (Array.isArray(endMessageItems)) {
          chatArray.push(...endMessageItems);
        } else {
          chatArray.push(endMessageItems);
        }
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
      case '모듈3 : 타이핑형': {
        console.log(`[DEBUG] 모듈3 타이핑형 유저 응답 변환 호출 (모듈 ${moduleNum})`);
        const typingObj = this._transformTypingType();
        console.log(`[DEBUG] 생성된 userTyping 객체:`, JSON.stringify(typingObj));
        return typingObj;
      }
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
          // 직접 이미지 배열 생성 - 옛 방식으로 복원
          const imageArray = [
            buttonImage ? this._transformMediaImage(buttonImage[0]) : null,
            responseImage ? this._transformMediaImage(responseImage[0]) : null
          ].filter(img => img !== null);

          // 두 번째 이미지가 없으면 첫 번째 이미지 복제 (서버 DTO 요구사항: 이미지는 2개까지 가능)
          if (imageArray.length === 1 && !responseImage) {
            // 응답 이미지가 없으면 버튼 이미지 복제
            imageArray.push(JSON.parse(JSON.stringify(imageArray[0])));
          }

          medias.push({
            title: buttonTitle || null,
            image: imageArray,
            imageDescription: responseText || null
          });
        }
      }

      // 중첩된 이미지 구조를 방지하기 위한 로그 추가
      console.log(`[DEBUG] 인터랙션형 이미지 처리 - 미디어 개수: ${medias.length}`);
      
      if (medias.length > 0) {
        // 올바른 구조로 반환 - 중첩 구조 제거
        // prompts에 media 배열은 제공하되, 별도의 image 배열은 생성하지 않음
        return {
          type: 'text+image',
          talker: 'prompt',
          prompts: [{
            text: null,
            media: medias
          }],
          hasOpts: false
        };
      } else {
        return null;
      }
    }

  static _createMediatorMessage(text) {
    // 종료 메시지는 talker가 'prompt'여야 함
    return this._processTextWithBackslash(text, 'endChat');
  }
  
  static _transformTypingType() {    
    console.log(`[DEBUG] _transformTypingType 함수 호출됨 - userTyping 객체 생성`);
    
    const typingObj = {
      type: 'userTyping',
      talker: 'user',
      hasOpts: false,
      prompts: [{
        text: null,
        media: null
      }]
    };
    
    console.log(`[DEBUG] 생성된 userTyping 객체:`, JSON.stringify(typingObj));
    return typingObj;
  }

  static _transformTypingTypeMediator(data, moduleNum) {
    const text = data[`타이핑형-매개자 대사 / 모듈 선택 ${moduleNum}`];
    console.log(`[DEBUG] 타이핑형 매개자 처리 (모듈 ${moduleNum}): ${text ? '텍스트 있음' : '텍스트 없음'}`);
    
    if (!text) return null;
    
    // 백슬래시가 있는지 확인
    const hasBackslash = text.includes('\\') || text.includes('＼');
    console.log(`[DEBUG] 백슬래시 포함 여부: ${hasBackslash ? '포함' : '미포함'}`);
    
    if (!hasBackslash) {
      // 백슬래시가 없으면 단일 메시지 반환
      console.log(`[DEBUG] 백슬래시 없음, 단일 메시지 반환 (type: text, talker: prompt)`);
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
    console.log(`[DEBUG] 백슬래시로 분리된 텍스트 부분: ${parts.length}개`);
    
    // 결과 배열 초기화
    const result = [];
    
    // userTyping 객체 생성
    const userTypingObj = this._transformTypingType();
    console.log(`[DEBUG] 생성된 userTyping 객체:`, JSON.stringify(userTypingObj));
    
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
        console.log(`[DEBUG] ${i+1}번째 메시지 뒤에 userTyping 추가`);
        result.push({...userTypingObj});
      }
    }
    
    console.log(`[DEBUG] 타이핑형 매개자 처리 결과: ${result.length}개 아이템`);
    result.forEach((item, idx) => {
      console.log(`[DEBUG] 결과 항목 ${idx+1}: type=${item.type}, talker=${item.talker}`);
    });
    
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

  static async _processEndMessageWithOcto(text, mediaArray) {
    if (!text || !mediaArray || !Array.isArray(mediaArray)) return null;

    const octoItems = [];
    
    for (const mediaItem of mediaArray) {
      if (mediaItem && mediaItem.media_type === 'octostudio') {
        // octostudio 파일 처리 (비동기)
        const octoData = await this._processOctostudioFile(mediaItem);
        if (octoData) {
          octoItems.push(octoData);
        }
      }
    }

    if (octoItems.length === 0) {
      // octo 파일이 없으면 기존 방식으로 처리
      return this._processTextWithBackslash(text, 'endChat');
    }

    // 백슬래시 처리
    const hasBackslash = text.includes('\\') || text.includes('＼');
    
    if (hasBackslash) {
      const parts = text.split(/[\\＼]/).map(part => part.trim()).filter(part => part);
      const results = [];
      
      for (let i = 0; i < parts.length; i++) {
        const isLast = i === parts.length - 1;
        
        results.push({
          type: isLast && octoItems.length > 0 ? 'text+octo' : 'text',
          talker: 'endChat',
          hasOpts: false,
          prompts: [{
            text: parts[i],
            media: null,
            octo: isLast ? octoItems : undefined
          }]
        });
      }
      
      return results;
    } else {
      // 백슬래시가 없는 경우
      return {
        type: 'text+octo',
        talker: 'endChat',
        hasOpts: false,
        prompts: [{
          text: text,
          media: null,
          octo: octoItems
        }]
      };
    }
  }

  static async _processOctostudioFile(mediaItem) {
    if (!mediaItem) return null;

    // 파일명에서 카테고리 추출
    const filename = mediaItem.filename || '';
    let category = '옥토스튜디오'; // 기본값

    // [] 안의 텍스트를 카테고리로 사용
    const categoryMatch = filename.match(/^\[(.*?)\]/);
    if (categoryMatch) {
      category = categoryMatch[1].trim();
    }

    // 제목 추출
    let title = filename;
    
    // []가 있는 경우: []와 .octostudio 사이의 텍스트 추출
    const titleMatch = filename.match(/^\[(.*?)\](.*)\.octostudio$/);
    if (titleMatch) {
      title = titleMatch[2].trim(); // []와 .octostudio 사이의 텍스트
    } else {
      // []가 없는 경우: .octostudio 앞의 전체 텍스트
      title = filename.replace(/\.octostudio$/, '').trim();
    }
    
    // 공백 정리
    title = title.trim();

    // 썸네일 생성 및 S3 업로드
    let thumbnailUrl;
    try {
      console.log(`[DEBUG] Generating thumbnail for octostudio file: ${filename}`);
      thumbnailUrl = await this._generateOctostudioThumbnail(mediaItem);
      console.log(`[DEBUG] Generated thumbnail URL: ${thumbnailUrl}`);
    } catch (error) {
      console.error('Failed to generate octostudio thumbnail:', error);
      thumbnailUrl = this._getDefaultThumbnail(mediaItem);
      console.log(`[DEBUG] Using default thumbnail: ${thumbnailUrl}`);
    }

    return {
      category: category,
      title: title || 'Octostudio 파일',
      url: mediaItem.url,
      thumbnail: thumbnailUrl
    };
  }

  static async _generateOctostudioThumbnail(mediaItem) {
    // octostudio 파일의 썸네일 생성
    // zip 파일을 풀고 project/thumbnails 폴더에서 jpeg 파일을 찾아서 S3에 업로드
    try {
      console.log(`[DEBUG] Starting thumbnail generation for: ${mediaItem.url}`);
      const fs = require('fs');
      const AdmZip = require('adm-zip');
      
      // octostudio 파일 다운로드 (쿼리 파라미터 제거)
      const cleanUrl = mediaItem.url.split('?')[0];
      console.log(`[DEBUG] Downloading octostudio file from: ${cleanUrl}`);
      const zipBuffer = await this._downloadFile(cleanUrl);
      if (!zipBuffer) {
        console.log(`[DEBUG] Failed to download octostudio file`);
        return this._getDefaultThumbnail(mediaItem);
      }
      console.log(`[DEBUG] Downloaded ${zipBuffer.length} bytes`);
      
      // octostudio 파일은 "OCTOSTUDIO" 헤더 + 4바이트 + ZIP 데이터 구조
      console.log(`[DEBUG] Processing octostudio file format...`);
      
      // octostudio 헤더 확인 및 제거
      const headerLength = 14; // "OCTOSTUDIO" (10) + 4 bytes
      if (zipBuffer.length < headerLength) {
        console.log(`[DEBUG] File too small to be valid octostudio`);
        return this._getDefaultThumbnail(mediaItem);
      }
      
      const header = zipBuffer.toString('ascii', 0, 10);
      if (header !== 'OCTOSTUDIO') {
        console.log(`[DEBUG] Invalid octostudio header: ${header}`);
        return this._getDefaultThumbnail(mediaItem);
      }
      
      // ZIP 데이터 추출 (헤더 제거)
      const actualZipBuffer = zipBuffer.slice(headerLength);
      console.log(`[DEBUG] Extracted ZIP data: ${actualZipBuffer.length} bytes`);
      
      // zip 파일 압축 해제
      console.log(`[DEBUG] Extracting zip file...`);
      let zip, entries;
      try {
        zip = new AdmZip(actualZipBuffer);
        entries = zip.getEntries();
        console.log(`[DEBUG] Found ${entries.length} entries in zip file`);
      } catch (zipError) {
        console.error(`[DEBUG] AdmZip extraction failed:`, zipError);
        
        // AdmZip 실패 시 Linux unzip 명령어 사용
        console.log(`[DEBUG] Trying Linux unzip command...`);
        const tempDir = `/tmp/octostudio_${Date.now()}`;
        const zipPath = `${tempDir}.zip`;
        
        const fs = require('fs');
        fs.mkdirSync(tempDir, { recursive: true });
        fs.writeFileSync(zipPath, actualZipBuffer); // 헤더 제거된 ZIP 데이터 사용
        
        const { execSync } = require('child_process');
        try {
          execSync(`unzip "${zipPath}" -d "${tempDir}"`, { stdio: 'ignore' });
          
          // 압축 해제된 파일들에서 썸네일 찾기
          const thumbnailPath = this._findThumbnailInDirectory(tempDir);
          if (thumbnailPath) {
            const thumbnailBuffer = fs.readFileSync(thumbnailPath);
            console.log(`[DEBUG] Found thumbnail via unzip: ${thumbnailBuffer.length} bytes`);
            
            // 임시 파일들 정리
            execSync(`rm -rf "${tempDir}" "${zipPath}"`, { stdio: 'ignore' });
            
            const uploadedUrl = await this._uploadThumbnailToS3(thumbnailBuffer, mediaItem.filename, mediaItem.url);
            return uploadedUrl;
          }
          
          // 임시 파일들 정리
          execSync(`rm -rf "${tempDir}" "${zipPath}"`, { stdio: 'ignore' });
        } catch (unzipError) {
          console.error(`[DEBUG] Linux unzip also failed:`, unzipError);
          // 임시 파일들 정리
          try {
            execSync(`rm -rf "${tempDir}" "${zipPath}"`, { stdio: 'ignore' });
          } catch (cleanupError) {
            console.error(`[DEBUG] Cleanup failed:`, cleanupError);
          }
        }
        
        return this._getDefaultThumbnail(mediaItem);
      }
      
      // project/thumbnails 폴더에서 jpeg 파일 찾기
      console.log(`[DEBUG] Searching for thumbnail files...`);
      const thumbnailEntry = entries.find(entry => {
        const entryPath = entry.entryName;
        const isInThumbnails = entryPath.includes('project/thumbnails/');
        const isJpeg = entryPath.endsWith('.jpg') || entryPath.endsWith('.jpeg');
        console.log(`[DEBUG] Checking entry: ${entryPath} - in thumbnails: ${isInThumbnails}, is jpeg: ${isJpeg}`);
        return isInThumbnails && isJpeg;
      });
      
      if (thumbnailEntry) {
        console.log(`[DEBUG] Found thumbnail entry: ${thumbnailEntry.entryName}`);
        // 썸네일 파일을 찾았으면 S3에 업로드하고 URL 반환
        const thumbnailBuffer = thumbnailEntry.getData();
        console.log(`[DEBUG] Extracted thumbnail buffer: ${thumbnailBuffer.length} bytes`);
        const uploadedUrl = await this._uploadThumbnailToS3(thumbnailBuffer, mediaItem.filename, mediaItem.url);
        return uploadedUrl;
      }
      
      console.log(`[DEBUG] No thumbnail found in AdmZip entries, using default`);
      return this._getDefaultThumbnail(mediaItem);
    } catch (error) {
      console.error('Error processing octostudio thumbnail:', error);
      return this._getDefaultThumbnail(mediaItem);
    }
  }

  static _getDefaultThumbnail(mediaItem) {
    return mediaItem.thumbnails?.large?.url || 
           mediaItem.thumbnails?.full?.url || 
           'https://cdn-world.ahhaohho.com/default-octostudio-thumb.jpg';
  }

  static _findThumbnailInDirectory(dir) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      const findThumbnail = (directory) => {
        const items = fs.readdirSync(directory, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = path.join(directory, item.name);
          
          if (item.isDirectory()) {
            // 재귀적으로 하위 디렉토리 탐색
            const result = findThumbnail(fullPath);
            if (result) return result;
          } else if (item.isFile()) {
            // project/thumbnails 경로에 있는 jpeg 파일 찾기
            const relativePath = path.relative(dir, fullPath);
            const isInThumbnails = relativePath.includes('project/thumbnails/') || 
                                 relativePath.includes('project\\thumbnails\\');
            const isJpeg = item.name.endsWith('.jpg') || item.name.endsWith('.jpeg');
            
            if (isInThumbnails && isJpeg) {
              console.log(`[DEBUG] Found thumbnail file: ${fullPath}`);
              return fullPath;
            }
          }
        }
        
        return null;
      };
      
      return findThumbnail(dir);
    } catch (error) {
      console.error(`[DEBUG] Error finding thumbnail in directory:`, error);
      return null;
    }
  }

  static async _downloadFile(url) {
    const https = require('https');
    return new Promise((resolve, reject) => {
      const chunks = [];
      https.get(url, (response) => {
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  static async _uploadThumbnailToS3(buffer, originalFilename, originalUrl) {
    try {
      const AWS = require('aws-sdk');
      const { loadConfig } = require('../../../../config/config');
      
      const config = await loadConfig();
      
      const s3 = new AWS.S3({
        region: config.aws_region,
        accessKeyId: config.aws_accessKeyId,
        secretAccessKey: config.aws_secretAccessKey
      });
      
      // 원본 URL에서 해시값 추출 (chatData/ 뒤의 값)
      const urlParts = originalUrl.split('/');
      const hashPart = urlParts[urlParts.indexOf('chatData') + 1];
      const hash = hashPart.split('?')[0]; // 쿼리 파라미터 제거
      
      const filename = `thumbnail-${hash}.jpg`;
      const s3Key = `chatData/octo-thumbnails/${filename}`;
      
      const uploadParams = {
        Bucket: config.world_bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'image/jpeg'
      };
      
      const result = await s3.upload(uploadParams).promise();
      console.log(`Successfully uploaded thumbnail for ${originalFilename} to ${result.Location}`);
      
      // CloudFront URL로 변환
      const cloudfrontUrl = `https://cdn-world.ahhaohho.com/${s3Key}`;
      return cloudfrontUrl;
    } catch (error) {
      console.error('Error uploading thumbnail to S3:', error);
      
      // S3 업로드 실패 시 기본 썸네일 URL 반환
      const urlParts = originalUrl.split('/');
      const hashPart = urlParts[urlParts.indexOf('chatData') + 1];
      const hash = hashPart.split('?')[0]; // 쿼리 파라미터 제거
      const filename = `thumbnail-${hash}.jpg`;
      return `https://cdn-world.ahhaohho.com/chatData/octo-thumbnails/${filename}`;
    }
  }
}

module.exports = ChatDataTransformer;