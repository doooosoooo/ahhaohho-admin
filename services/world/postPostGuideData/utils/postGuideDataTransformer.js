// utils/transformers/groupDataTransformer.js
class PostGuideDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }
    
    if (!data["id"]) {
      throw new Error('Missing required field: ID');
    }

    // aiPrompt와 guides는 있는 경우에만 포함
    const transformed = {
      challengeId: data["챌린지명"]
    };

    if (data["매개자 AI 프롬프트"]) {
      transformed.aiPrompt = data["매개자 AI 프롬프트"];
    }

    // guides 객체는 mediaGuide나 descGuide가 있는 경우에만 생성
    if (data["매개자 사진/영상 제출 유도 대사"] || data["프로젝트 설명하기 가이드 문구"]) {
      transformed.guides = {
        mediaGuide: data["매개자 사진/영상 제출 유도 대사"] || null,
        descGuide: data["프로젝트 설명하기 가이드 문구"] || null
      };
    }

    return transformed;
  }
}

module.exports = PostGuideDataTransformer;