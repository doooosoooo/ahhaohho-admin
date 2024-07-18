class contentRegistryDTO {
        constructor({ title, contentsId, createrName, thumbnailUrl, category_main, category_sub, activePlan, playtime_min, materials, preparationTip, activeGuide, postingGuide, recommendation }) {
        this.title = title || '';
        this.contentsId = contentsId || '';
        this.createrName = createrName || '';
        this.thumbnailUrl = thumbnailUrl || { url: '', type: '' };
        this.category_main = category_main || '';
        this.category_sub = category_sub || '';
        this.activePlan = activePlan || '';
        this.playtime_min = playtime_min || 0;
        this.materials = materials || [];
        this.preparationTip = preparationTip.map(tip => ({
            imageUrl: String(tip.imageUrl),  // URL을 문자열로 변환
            comment: tip.comment || null
        }));
        this.activeGuide = activeGuide.map(guide => ({
            imageUrl: {
                defaultUrl: guide.imageUrl.default || null,
                aos: guide.imageUrl.aos || null,
                ios: guide.imageUrl.ios || null,
                type: guide.imageUrl.type || null
            },
            guide: guide.guide || '',
            tip: guide.tip || null
        }));
        this.postingGuide = postingGuide || '';
        this.recommendation = recommendation || [];
    }
    
    static validate(dto) {
        if (!dto.title || !dto.createrName || !dto.thumbnailUrl || !dto.category_main
            || !dto.category_sub || !dto.activePlan || dto.playtime_min === undefined) {
            throw new Error('Invalid request: Missing required contents data.');
        }
        // 추가적인 유효성 검사 로직을 여기에 구현할 수 있습니다.
    }
}

module.exports = contentRegistryDTO;