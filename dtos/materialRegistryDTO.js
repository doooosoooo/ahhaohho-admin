class MaterialRegistryDTO {
    constructor({ id, material, materialImage, material_tips }) {
        this.id = id;
        this.material = material;
        this.materialImage = materialImage;
        this.material_tips = material_tips;
    }

    static validate(dto) {
        if (!dto.id || !dto.material ) {
            throw new Error('Invalid DTO: Missing required fields');
        }
        // 추가적인 유효성 검사...
    }
}

module.exports = MaterialRegistryDTO;