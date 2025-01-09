// utils/transformers/groupDataTransformer.js
class GroupDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }
    
    if (!data["그룹명"]) {
      throw new Error('Missing required field: 그룹명 (title)');
    }

    return {
      title: data["그룹명"].trim(),
      groupIdx: data.id || null,
      order: data["그룹 탐험 순서"],
      openChatIdxs: data["월드맵(매개자-유저 대화)"]?.[0] || null,
      badge: 'https://cdn-world.ahhaohho.com/sampleAsset/world-badge.svg',
      challengeIdxs: this._transformChallengeIdxs(data["챌린지 소개 페이지"])
    };
  }

  static _transformChallengeIdxs(challenges) {
    if (!Array.isArray(challenges)) {
      return [];
    }
    return challenges.filter(Boolean);
  }
}

module.exports = GroupDataTransformer;