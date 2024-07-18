class MaterialRegistryDTO {
    constructor({ id, material, materialImage, materialTips }) {
        this.id = id;
        this.material = material;
        this.materialImage = materialImage;
        this.materialTips = materialTips;
    }

    static validate(dto) {
        if (!dto.id || !dto.material ) {
            throw new Error('Invalid DTO: Missing required fields');
        }
        // 추가적인 유효성 검사...
    }
}

module.exports = MaterialRegistryDTO;