const fieldLengths = {
    int8: 1,
    uint8: 1,
    int16: 2,
    uint16: 2,
    int32: 4,
    uint32: 4,
    int64: 8,
    uint64: 8,
    float: 4,
    double: 8,
    bool: 1,
    angle: 2,
    vec3: 12,
    vec3fa: 12,
    skillid32: 4,
    skillid: 8,
    customize: 8,
    ref: 4,
    offset: 2,
    '#': 0
};

module.exports = { fieldLengths };