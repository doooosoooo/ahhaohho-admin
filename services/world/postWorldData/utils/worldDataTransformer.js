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
      creatorName: this._transformCreatorNames(data["매개자 이름"]),
      groupIdxs: this._safeArrayTransform(data["그룹 이름"])
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
      overview: {
        leadSentence: data["월드맵 환영 문구"]?.trim() || null,
        bgImage: 'https://cdn-world.ahhaohho.com/sampleAsset/world-map-bg.jpeg',
        bgGallery: 'https://cdn-world.ahhaohho.com/sampleAsset/world-postit.png'
      }
    };
  }

  static _transformWorldImage(data) {
    return {
      worldImage: {
        type: "image",
        defaultUrl: this._safeGetUrl(data["월드 소개 영상"]),
        sound: null,
        mainAssets: this._transformMainAssets(data),
        animationAssets: [
          'https://cdn-world.ahhaohho.com/sampleAsset/BlowingLeaf.png',
          'https://cdn-world.ahhaohho.com/sampleAsset/CloudSmall.png',
          'https://cdn-world.ahhaohho.com/sampleAsset/CloudLarge.png',
          'https://cdn-world.ahhaohho.com/sampleAsset/Tree.png',
        ]
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
      back: this._safeGetUrl(data["월드 썸네일_Back"]) || 'https://cdn-world.ahhaohho.com/worldData/xUuW1JkPWi2OQJkA4U2UZHtSYWTKguS6edGzxp2nBeo',
      middle: this._safeGetUrl(data["월드 썸네일_Middle"]) || 'https://cdn-world.ahhaohho.com/worldData/1gzoMeI5n6E9JOdO3gTXhpl4sIljYkhTBMTq8_mUEjs',
      front: this._safeGetUrl(data["월드 썸네일_Front"]) || 'https://cdn-world.ahhaohho.com/worldData/lKRvavWxKdwL7njs9WAzyY1bIJqtGTuKNkDrV3_V-MQ'
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