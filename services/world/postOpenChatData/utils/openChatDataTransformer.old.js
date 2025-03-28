class OpenChatDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }

    const transformedData = {
      chatIdx: data.id,
      step: 'openChat',
      chat: this._transformChat(data)
    };

    console.log('DEBUG - Transformed request data:', JSON.stringify(transformedData, null, 2));
    
    return transformedData;
  }
   
  static _transformChat(data) {
    const chatArray = [];
    
    // 최대 3개의 대화 처리
    for (let dialogueNum = 1; dialogueNum <= 3; dialogueNum++) {
      const dialogueItems = this._processDialogue(data, dialogueNum);
      if (dialogueItems.length === 0) break;
      chatArray.push(...dialogueItems);
    }

    return chatArray;
  }

  static _processDialogue(data, dialogueNum) {
    const items = [];
    
    // 각 대화의 발화와 응답 처리 (최대 3번)
    for (let utteranceNum = 1; utteranceNum <= 3; utteranceNum++) {
      // 매개자 발화 처리
      const mediatorSpeech = this._processMediatorUtterance(data, dialogueNum, utteranceNum);
      if (mediatorSpeech) {
        items.push(mediatorSpeech);
      }

      // 유저 응답 처리
      const userResponse = this._processUserResponse(data, dialogueNum, utteranceNum);
      if (userResponse) {
        items.push(userResponse);
      }
    }

    return items;
  }

  static _processMediatorUtterance(data, dialogueNum, utteranceNum) {
    const speechKey = `대화 ${dialogueNum}: 발화 ${utteranceNum} 매개자 대사`;
    const speakerKey = `대화 ${dialogueNum}: 발화 ${utteranceNum}의 발화자`;
    
    if (data[speechKey] && (!data[speakerKey] || data[speakerKey] === '매개자')) {
      return {
        type: 'text',
        talker: 'ahhaohho',
        hasOpts: false,
        prompts: [{
          text: data[speechKey],
          media: null
        }]
      };
    }
    return null;
  }

  static _processUserResponse(data, dialogueNum, utteranceNum) {
    // 일반 유저 응답 처리
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
    
    // 유저 옵션 선택 처리
    const optionAKey = `대화 ${dialogueNum}: 응답 ${utteranceNum}-유저 대사 선택 A`;
    const optionBKey = `대화 ${dialogueNum}: 응답 ${utteranceNum}-유저 대사 선택 B`;
    const optionSpeakerKey = `대화 ${dialogueNum}: 응답 ${utteranceNum}의 발화자`;
    
    if ((data[optionAKey] || data[optionBKey]) && 
        (!data[optionSpeakerKey] || data[optionSpeakerKey] === '유저-옵션 선택')) {
      const prompts = [];
      
      if (data[optionAKey]) {
        prompts.push({
          text: data[optionAKey],
          media: null
        });
      }
      
      if (data[optionBKey]) {
        prompts.push({
          text: data[optionBKey],
          media: null
        });
      }
      
      if (prompts.length > 0) {
        return {
          type: 'text',
          talker: 'user',
          hasOpts: true,
          prompts
        };
      }
    }

    return null;
  }
}

module.exports = OpenChatDataTransformer;