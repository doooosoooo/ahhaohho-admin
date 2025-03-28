class OpenChatDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    // 객체가 아닌 배열인 경우 처리
    let processedData;
    if (Array.isArray(data)) {
      // ID 값이 있는 첫 번째 항목 찾기
      const firstItemWithId = data.find(item => item.id);
      processedData = {
        id: firstItemWithId ? firstItemWithId.id : 'unknown',
        ...this._mergeArrayData(data)
      };
    } else {
      processedData = data;
    }

    const transformedData = {
      chatIdx: processedData.id,
      step: 'openChat',
      chat: this._transformChat(processedData)
    };
    
    // 모든 변환이 끝난 후, 백슬래시 메시지 후처리 적용
    transformedData.chat = this._processBackslashesInFinalChat(transformedData.chat);

    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    
    return transformedData;
  }
  
  // 배열 데이터를 하나의 객체로 병합하는 메서드
  static _mergeArrayData(dataArray) {
    const mergedData = {};
    
    for (const item of dataArray) {
      // 각 아이템의 모든 속성을 병합
      Object.keys(item).forEach(key => {
        // ID는 별도로 처리했으므로 스킵
        if (key !== 'id') {
          mergedData[key] = item[key];
        }
      });
    }
    
    return mergedData;
  }
   
  // 최종 chat 배열에 대한 백슬래시 후처리
  static _processBackslashesInFinalChat(chatArray) {
    const result = [];
    
    for (const message of chatArray) {
      // 각 메시지의 prompts 배열 확인
      if (message.prompts && message.prompts.length > 0) {
        // hasOpts가 true인 경우 (선택지가 있는 경우)
        if (message.hasOpts) {
          // 선택지 각각에 대해 백슬래시 처리 하지 않고 그대로 유지
          result.push(message);
        } else {
          // 일반 메시지인 경우 (선택지가 없는 경우)
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
    
    // 대화 1 처리
    const dialogue1Items = this._processDialogue1And3(data, 1);
    chatArray.push(...dialogue1Items);
    
    // 대화 2 처리 (특별한 구조)
    const dialogue2Items = this._processDialogue2(data);
    chatArray.push(...dialogue2Items);
    
    // 대화 3 처리
    const dialogue3Items = this._processDialogue1And3(data, 3);
    chatArray.push(...dialogue3Items);

    return chatArray;
  }

  // 대화 1과 3 처리 (일반적인 대화 구조)
  static _processDialogue1And3(data, dialogueNum) {
    const items = [];
    let userOptionsProcessed = false;
    
    // 일반 대화 처리 (최대 3번)
    for (let utteranceNum = 1; utteranceNum <= 3; utteranceNum++) {
      // 매개자 발화 처리
      const mediatorSpeech = this._processMediatorUtterance(data, dialogueNum, utteranceNum);
      if (mediatorSpeech) {
        // 배열인 경우 모든 항목 추가, 객체인 경우 단일 항목으로 추가
        if (Array.isArray(mediatorSpeech)) {
          items.push(...mediatorSpeech);
        } else {
          items.push(mediatorSpeech);
        }
      }

      // 유저 선택지 처리 (각 대화에서 한 번만 수행)
      if (!userOptionsProcessed) {
        const userOptions = this._processUserOptions(data, dialogueNum, utteranceNum);
        if (userOptions) {
          items.push(userOptions);
          userOptionsProcessed = true;
          continue; // 선택지 처리 후 일반 응답은 건너뜀
        }
      }

      // 일반 유저 응답 처리
      const userResponse = this._processNormalUserResponse(data, dialogueNum, utteranceNum);
      if (userResponse) {
        items.push(userResponse);
      }
    }

    return items;
  }

  // 대화 2 처리 (특별한 구조)
  static _processDialogue2(data) {
    const items = [];
    
    // 1. 유저 옵션 선택지 (3개)
    const userOptions = this._processDialogue2Options(data);
    if (userOptions) {
      items.push(userOptions);
    }
    
    // 2. 매개자 응답 처리 (선택지 옵션에 대한 응답) - **수정 부분**
    const mediatorResponses = this._processDialogue2MediatorResponses(data);
    if (mediatorResponses) {
      items.push(mediatorResponses);
    }
    
    // 3. 매개자 확인 질문
    const confirmQuestion = this._processDialogue2ConfirmQuestion(data);
    if (confirmQuestion) {
      items.push(confirmQuestion);
    }
    
    // 4. 유저 응답 A, B (확인 질문에 대한 응답)
    const userConfirmResponses = this._processDialogue2UserResponses(data);
    if (userConfirmResponses) {
      items.push(userConfirmResponses);
    }

    return items;
  }

  // 매개자 발화
  static _processMediatorUtterance(data, dialogueNum, utteranceNum) {
    // 기본 발화 키 (매개자 대사)
    const speechKey = `대화 ${dialogueNum}: 발화 ${utteranceNum} 매개자 대사`;
    const speakerKey = `대화 ${dialogueNum}: 발화 ${utteranceNum}의 발화자`;
    
    // 매개자 대사가 있고 발화자가 매개자인 경우
    if (data[speechKey] && (!data[speakerKey] || data[speakerKey] === '매개자')) {
      // 백슬래시 처리 - 매개자는 talker가 'ahhaohho'
      return this._processTextWithBackslash(data[speechKey], 'ahhaohho');
    }
    
    return null;
  }

  // 백슬래시 처리 함수
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

  // 일반 유저 응답 처리 (선택지가 아닌 경우)
  static _processNormalUserResponse(data, dialogueNum, utteranceNum) {
    const responseKey = `대화 ${dialogueNum}: 응답 ${utteranceNum} 유저 대사`;
    const responseSpeakerKey = `대화 ${dialogueNum}: 응답 ${utteranceNum}의 발화자`;
    
    if (data[responseKey] && data[responseSpeakerKey] === '유저') {
      return {
        type: 'text',
        talker: 'user',
        hasOpts: false,
        prompts: [{
          text: data[responseKey],
          media: null
        }]
      };
    }
    
    return null;
  }
  
  // 대화 1, 3의 유저 선택지 처리
  static _processUserOptions(data, dialogueNum, utteranceNum) {
    const options = [];
    let hasValidOptions = false;
    
    // "대화 N: 응답 M의 발화자"가 "유저-옵션 선택"인 경우
    const speakerKey = `대화 ${dialogueNum}: 응답 ${utteranceNum}의 발화자`;
    
    if (data[speakerKey] === '유저-옵션 선택') {
      // 선택지 A, B 처리
      for (const option of ['A', 'B']) {
        const optionKey = `대화 ${dialogueNum}: 응답 ${utteranceNum} 유저 대사 선택 ${option}`;
        
        if (data[optionKey]) {
          hasValidOptions = true;
          options.push({
            text: data[optionKey],
            media: null
          });
        }
      }
    }
    
    // 유효한 선택지가 있는 경우만 반환
    if (hasValidOptions && options.length > 0) {
      return {
        type: 'text',
        talker: 'user',
        hasOpts: true,
        prompts: options
      };
    }
    
    return null;
  }
  
  // 대화 2 전용: 유저 옵션 선택 처리 (선택지만)
  static _processDialogue2Options(data) {
    const options = [];
    let hasValidOptions = false;
    
    // "대화 2: 유저 옵션 선택 X" 형식 처리 (최대 3개)
    for (let i = 1; i <= 3; i++) {
      const optionKey = `대화 2: 유저 옵션 선택 ${i}`;
      
      if (data[optionKey]) {
        hasValidOptions = true;
        
        // 유저 선택지 추가 (매개자 응답 없이)
        options.push({
          text: data[optionKey],
          media: null
        });
      }
    }
    
    // 유효한 선택지가 있는 경우만 반환
    if (hasValidOptions && options.length > 0) {
      return {
        type: 'text',
        talker: 'user',
        hasOpts: true,
        prompts: options
      };
    }
    
    return null;
  }
  
  // **수정된 부분**: 대화 2 전용 - 매개자 응답 처리 (최대 3개를 묶어서 한 번에)
  static _processDialogue2MediatorResponses(data) {
    const responses = [];
    
    // "대화 2: 매개자 응답 X"를 최대 3개까지 확인
    for (let i = 1; i <= 3; i++) {
      const responseKey = `대화 2: 매개자 응답 ${i}`;
      if (data[responseKey]) {
        responses.push({
          text: data[responseKey],
          media: null
        });
      }
    }
    
    // 응답이 하나도 없으면 null, 하나 이상 있으면 묶어서 반환
    if (responses.length > 0) {
      return {
        type: 'text',
        talker: 'ahhaohho',
        hasOpts: false,
        prompts: responses
      };
    }
    
    return null;
  }
  
  // 대화 2 전용: 매개자 확인 질문 처리
  static _processDialogue2ConfirmQuestion(data) {
    const confirmQuestionKey = `대화 2: 매개자 확인 질문`;
    
    if (data[confirmQuestionKey]) {
      return {
        type: 'text',
        talker: 'ahhaohho',
        hasOpts: false,
        prompts: [{
          text: data[confirmQuestionKey],
          media: null
        }]
      };
    }
    
    return null;
  }
  
  // 대화 2 전용: 유저 응답 A, B 처리
  static _processDialogue2UserResponses(data) {
    const options = [];
    let hasValidOptions = false;
    
    // 확인 질문에 대한 유저 응답 옵션 확인
    const userResponseAKey = `대화 2: 유저 응답 A`;
    const userResponseBKey = `대화 2: 유저 응답 B`;
    
    if (data[userResponseAKey]) {
      hasValidOptions = true;
      options.push({
        text: data[userResponseAKey],
        media: null
      });
    }
    
    if (data[userResponseBKey]) {
      hasValidOptions = true;
      options.push({
        text: data[userResponseBKey],
        media: null
      });
    }
    
    // 유효한 선택지가 있는 경우만 반환
    if (hasValidOptions && options.length > 0) {
      return {
        type: 'text',
        talker: 'user',
        hasOpts: true,
        prompts: options
      };
    }
    
    return null;
  }
}

module.exports = OpenChatDataTransformer;
