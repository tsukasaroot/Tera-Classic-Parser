const fieldLengths = require("./fieldsLengths").fieldLengths;

function parsePayloadByType(type, payload, offset, refOffset = null, opcodeName = '', fieldName = '') {
    if (offset >= payload.length) {
        console.warn(`Offset ${offset} exceeds payload length ${payload.length} for type ${type} (${fieldName} in ${opcodeName})`);
        return {value: null, length: 0};
    }

    switch (type) {
        case 'offset': {
            if (offset + 1 >= payload.length) {
                console.warn(`offset overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            const refOffset = payload.readUInt16LE(offset);
            return {value: refOffset - 4, length: 2}; // Adjust offset by -4
        }
        case 'ref': {
            if (offset + 3 >= payload.length) {
                console.warn(`ref overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            const count = payload.readUInt16LE(offset);
            const refOffset = payload.readUInt16LE(offset + 2);
            return {value: {count, offset: refOffset}, length: 4};
        }
        case 'int8':
            return {value: payload.readInt8(offset), length: fieldLengths.int8};
        case 'uint8':
            return {value: payload.readUInt8(offset), length: fieldLengths.uint8};
        case 'int16':
            if (offset + 1 >= payload.length) {
                console.warn(`int16 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readInt16LE(offset), length: fieldLengths.int16};
        case 'uint16':
            if (offset + 1 >= payload.length) {
                console.warn(`uint16 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readUInt16LE(offset), length: fieldLengths.uint16};
        case 'int32':
            if (offset + 3 >= payload.length) {
                console.warn(`int32 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readInt32LE(offset), length: fieldLengths.int32};
        case 'uint32':
            if (offset + 3 >= payload.length) {
                console.warn(`uint32 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readUInt32LE(offset), length: fieldLengths.uint32};
        case 'int64':
            if (offset + 7 >= payload.length) {
                console.warn(`int64 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readBigInt64LE(offset), length: fieldLengths.int64};
        case 'uint64':
            if (offset + 7 >= payload.length) {
                console.warn(`uint64 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: 0n, length: 0};
            }
            return {value: payload.readBigUInt64LE(offset), length: fieldLengths.uint64};
        case 'float':
            if (offset + 3 >= payload.length) {
                console.warn(`float overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readFloatLE(offset), length: fieldLengths.float};
        case 'double':
            if (offset + 7 >= payload.length) {
                console.warn(`double overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            return {value: payload.readDoubleLE(offset), length: fieldLengths.double};
        case 'string': {
            const readOffset = refOffset !== null ? refOffset : offset;
            if (readOffset >= payload.length) {
                console.warn(`string read overrun at ${readOffset} for ${fieldName} in ${opcodeName}`);
                return {value: '', length: 0};
            }
            let value = '';
            let length = 0;
            let pos = readOffset;
            // Read UTF-16LE chars until null (0x0000)
            while (pos + 1 < payload.length) {
                const charCode = payload.readUInt16LE(pos);
                pos += 2;
                length += 2;
                if (charCode === 0) break;
                value += String.fromCharCode(charCode);
            }
            return {value, length};
        }
        case 'bool':
            return {value: payload.readUInt8(offset) !== 0, length: fieldLengths.bool};
        case 'byte': {
            if (opcodeName === 'S_CHAT' || opcodeName === 'S_UPDATE_GUILD_MEMBER') {
                return {value: payload.readUInt8(offset) !== 0, length: 1};
            }
            if (offset + 1 >= payload.length) {
                console.warn(`byte length read overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: Buffer.alloc(0), length: 0};
            }
            const len = payload.readUInt16LE(offset);
            const maxLen = 256;
            if (len > maxLen) {
                console.warn(`Excessive byte length ${len} at ${offset} for ${fieldName} in ${opcodeName}, capping at ${maxLen}`);
                return {value: Buffer.alloc(0), length: 2};
            }
            const end = offset + 2 + len;
            if (end > payload.length) {
                console.warn(`byte data overrun at ${offset}, len ${len} for ${fieldName} in ${opcodeName}`);
                return {value: Buffer.alloc(0), length: 2};
            }
            return {value: payload.slice(offset + 2, end), length: 2 + len};
        }
        case 'angle': {
            if (offset + 1 >= payload.length) {
                console.warn(`angle overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: 0, length: 0};
            }
            const angle = payload.readInt16LE(offset);
            return {value: (angle / 32768) * Math.PI, length: fieldLengths.angle};
        }
        case 'vec3': {
            if (offset + 11 >= payload.length) {
                console.warn(`vec3 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: {x: 0, y: 0, z: 0}, length: 0};
            }
            const x = payload.readFloatLE(offset);
            const y = payload.readFloatLE(offset + 4);
            const z = payload.readFloatLE(offset + 8);
            return {value: {x, y, z}, length: fieldLengths.vec3};
        }
        case 'offset3d': {
            if (offset + 5 >= payload.length) {
                console.warn(`offset3d overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: {x: 0, y: 0, z: 0}, length: 0};
            }
            const x = payload.readInt16LE(offset);
            const y = payload.readInt16LE(offset + 2);
            const z = payload.readInt16LE(offset + 4);
            return {value: {x, y, z}, length: fieldLengths.offset3d};
        }
        case 'skillid32': {
            if (offset + 3 >= payload.length) {
                console.warn(`skillid32 overrun at ${offset} for ${fieldName} in ${opcodeName}`);
                return {value: null, length: 0};
            }
            const value = parseSkillId32(payload.slice(offset, offset + 4));
            return {value, length: fieldLengths.skillid32};
        }
        case '#': {
            return {value: null, length: 0};
        }
        default:
            console.warn(`Unknown type: ${type} at offset ${offset} for ${fieldName} in ${opcodeName}`);
            return {value: null, length: 0};
    }
}

function parseSkillId32(skill) {
    if (!Buffer.isBuffer(skill) || skill.length < 4) {
        console.warn('Invalid skill buffer: must be at least 4 bytes');
        return {id: 0, hasHuntingZone: 0, type: 0, isNpc: false, reserved: 0};
    }
    const value = skill.readUInt32LE(0);
    const type = (value >> 26) & 0xf;
    const isNpc = Boolean(value & 0x40000000);
    const hasHuntingZone = isNpc && type === 1;
    return {
        id: Number(value & (hasHuntingZone ? 0xffff : 0x3ffffff)),
        hasHuntingZone: hasHuntingZone ? Number((value >> 16) & 0x3ff) : 0,
        type,
        isNpc,
        reserved: Number(value >> 31)
    };
}

module.exports = parsePayloadByType;