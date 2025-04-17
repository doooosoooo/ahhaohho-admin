class WorldDataTransformer {
  static transformRequestData(data) {
    if (!data) {
      throw new Error('Data object is required');
    }
    
    if (!data["월드명"]) {
      throw new Error('Missing required field: 월드명 (title)');
    }

    return {
      ...this._transformBasicInfo(data),
      ...this._transformOverview(data),
      ...this._transformWorldImage(data)
    };
  }

  static _transformBasicInfo(data) {
    return {
      title: data["월드명"].trim(),
      description: data["월드 소개 텍스트"]?.trim() || null,
      keywords: this._transformKeywords(data),
      creatorName: this._transformCreatorNames(data["월드 기획자"]),
      groupIdxs: this._safeArrayTransform(data["그룹 이름"]),
      themeColor: data["채팅 배경 색상"]?.trim() || null,
    };
  }

  static _transformCreatorNames(creators) {
    if (Array.isArray(creators)) {
      return creators.map(name => name?.trim()).filter(Boolean);
    }
    return creators ? [creators.trim()].filter(Boolean) : [];
  }

  static _transformOverview(data) {
    return {
      overviewThumbnail: data["오버뷰 썸네일"][0]?.url || null,
      overview: {
        leadSentence: data["월드맵 환영 문구"]?.trim() || null,
        mapBg: data["오버뷰 배경"][0]?.url || null,
        galleryBg: {
          bg: data["오버뷰 갤러리배경"][1]?.url || null,
          acc: data["오버뷰 갤러리배경"][0]?.url || null
        },
        groupBg: data["오버뷰 그룹배경"][0]?.url || null,
        groupNavBg: data["오버뷰 NavBG"][0]?.url || null,
      }
    };
  }

  static _transformWorldImage(data) {
    return {
      worldImage: {
        type: "image",
        defaultUrl: this._safeGetUrl(data["월드 소개 영상"]),
        sound: null,
        mainAssets: this._transformMainAssets(data)
      }
    };
  }

  static _transformKeywords(data) {
    return [
      data["월드 핵심 키워드 A"],
      data["월드 핵심 키워드 B"],
      data["월드 핵심 키워드 C"],
      data["월드 핵심 키워드 D"]
    ].filter(keyword => keyword != null && keyword !== '');
  }

  static _transformMainAssets(data) {
    return {
      back: this._safeGetUrl(data["월드 썸네일_Back"]) || null,
      middle: this._safeGetUrl(data["월드 썸네일_Middle"]) || null,
      front: this._safeGetUrl(data["월드 썸네일_Front"]) || null,
      background: this._safeGetUrl(data["월드 썸네일_BG"]) || null
    };
  }

  static _safeArrayTransform(arr) {
    return Array.isArray(arr) ? arr : [];
  }

  static _safeGetUrl(mediaArray) {
    if (!Array.isArray(mediaArray) || mediaArray.length === 0) {
      return null;
    }
    return mediaArray[0]?.url || null;
  }
}

module.exports = WorldDataTransformer;