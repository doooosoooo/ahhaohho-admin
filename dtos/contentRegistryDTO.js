class contentRegistryDTO {
    constructor({ title, createrName, thumbnailUrl, category_main, category_sub, activePlan, playtime_min, materials, preparationTip, activeGuide}) {
        this.title = title;
        this.createrName = createrName;
        this.thumbnailUrl = thumbnailUrl;
        this.category_main = category_main;
        this.category_sub = category_sub;
        this.activePlan = activePlan;
        this.playtime_min = playtime_min;
        this.materials = materials;
        this.preparationTip = preparationTip;
        this.activeGuide = activeGuide;

    }
    
    static validate(dto) {
        if (!dto.title || !dto.createrName || !dto.thumbnailUrl || !dto.category_main
            || !dto.category_sub || !dto.activePlan || !dto.playtime_min || !dto.playtime_min) {
            throw new Error('Invalid request: Missing required contents  data.');
        }
    }
}

module.exports = contentRegistryDTO;