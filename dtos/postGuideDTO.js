class postGuideDTO {
    constructor(query) {
        this.contentsId = query.contentsId;
    }

    static validate(dto) {
        if (!dto.contentsId) {
            throw new Error('contents id is required');
        }

        if (typeof dto.contentsId !== 'string') {
            throw new Error('contents must be a string');
        }
    }
}

module.exports = postGuideDTO;
