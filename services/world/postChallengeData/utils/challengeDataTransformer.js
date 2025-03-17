// utils/transformers/challengeDataTransformer.js
class ChallengeDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }
    
    if (!data["챌린지명"]) {
      throw new Error('Missing required field: 챌린지명 (title)');
    }

    if (!data["챌린지 소개 텍스트"]) {
      throw new Error('Missing required field: 챌린지 소개 텍스트 (description)');
    }

    return {
      title: data["챌린지명"].trim(),
      challengeIdx: data.id,
      description: data["챌린지 소개 텍스트"].trim(),
      level: this._transformLevel(data["난이도"]),
      media: this._transformMedia(data["챌린지 썸네일"]),
      categoryMain: data["메인장르"]?.trim() || null,
      categorySub: data["서브장르"]?.trim() || null,
      checklist: this._transformChecklist(data),
      activityGuideIdxs: this._transformActivityGuide(data["챌린지 상세 페이지"])
    };
  }

  static _transformChecklist(data) {
    const checklistFields = [
      "재료/상태 유저 체크리스트 A",
      "재료/상태 유저 체크리스트 B",
      "재료/상태 유저 체크리스트 C",
      "재료/상태 유저 체크리스트 D",
      "재료/상태 유저 체크리스트 E"
    ];

    return checklistFields
      .map(field => data[field])
      .filter(item => item != null && item !== '');
  }

static _transformLevel(level) {
  // Parse the input level to a number, default to 1 if invalid
  const parsedLevel = parseInt(level, 10);
  if (isNaN(parsedLevel)) return 1;
  
  // Transform level based on rules:
  // 1-2 → 1
  // 3 → 2
  // 4-5 → 3
  if (parsedLevel <= 2) return 1;
  if (parsedLevel === 3) return 2;
  if (parsedLevel >= 4 && parsedLevel <= 5) return 3;
  
  // For any other values, return 3 as the maximum level
  return 3;
}

  static _transformMedia(thumbnailData) {
    if (!Array.isArray(thumbnailData) || thumbnailData.length === 0) {
      return null;
    }

    const thumbnail = thumbnailData[0];
    return {
      type: this._getMediaType(thumbnail.type),
      defaultUrl: thumbnail.url || null,
      sound: null,
      thumbnail: {
        tiny: thumbnail.thumbnails?.small?.url || null,
        small: thumbnail.thumbnails?.small?.url || null,
        medium: thumbnail.thumbnails?.large?.url || null,
        large: thumbnail.thumbnails?.full?.url || null
      }
    };
  }

  static _getMediaType(mimeType) {
    if (!mimeType) return null;
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('image')) return 'image';
    return null;
  }

  static _transformActivityGuide(activityGuideIds) {
    if (!Array.isArray(activityGuideIds)) {
      return [];
    }
    return activityGuideIds;
  }
}

module.exports = ChallengeDataTransformer;