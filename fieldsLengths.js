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
    vec3: 12, // 3 floats (4 bytes each)
    offset: 6, // 3 int16 (2 bytes each)
    skillid32: 4, // 32-bit integer
    '#': 0 // Placeholder, no length
};

module.exports = {fieldLengths};