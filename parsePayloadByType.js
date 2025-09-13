const fieldLengths = require("./fieldsLengths").fieldLengths;

function parsePayloadByType(type, payload, offset) {
    if (offset + 1 > payload.length) {
        console.warn(`Offset overrun for type ${type} at ${offset} (payload len: ${payload.length})`);
        return { value: null, length: 0 };
    }

    switch (type) {
        case 'ref': {
            if (offset + 3 > payload.length) {
                console.warn(`ref overrun at ${offset}`);
                return { value: null, length: 0 };
            }
            const count = payload.readUInt16LE(offset);
            const refOffset = payload.readUInt16LE(offset + 2);
            return { value: { count, offset: refOffset }, length: 4 };
        }
        case 'int8':
            return { value: payload.readInt8(offset), length: fieldLengths.int8 };
        case 'uint8':
            return { value: payload.readUInt8(offset), length: fieldLengths.uint8 };
        case 'int16':
            if (offset + 1 > payload.length) return { value: null, length: 0 };
            return { value: payload.readInt16LE(offset), length: fieldLengths.int16 };
        case 'uint16':
            if (offset + 1 > payload.length) return { value: null, length: 0 };
            return { value: payload.readUInt16LE(offset), length: fieldLengths.uint16 };
        case 'int32':
            if (offset + 3 > payload.length) return { value: null, length: 0 };
            return { value: payload.readInt32LE(offset), length: fieldLengths.int32 };
        case 'uint32':
            if (offset + 3 > payload.length) return { value: null, length: 0 };
            return { value: payload.readUInt32LE(offset), length: fieldLengths.uint32 };
        case 'int64':
            if (offset + 7 > payload.length) return { value: null, length: 0 };
            return { value: payload.readBigInt64LE(offset), length: fieldLengths.int64 };
        case 'uint64':
            if (offset + 7 > payload.length) {
                console.warn(`uint64 overrun at ${offset} (payload len: ${payload.length})`);
                return { value: 0n, length: 0 };
            }
            return { value: payload.readBigUInt64LE(offset), length: fieldLengths.uint64 };
        case 'float':
            if (offset + 3 > payload.length) return { value: null, length: 0 };
            return { value: payload.readFloatLE(offset), length: fieldLengths.float };
        case 'double':
            if (offset + 7 > payload.length) return { value: null, length: 0 };
            return { value: payload.readDoubleLE(offset), length: fieldLengths.double };
        case 'string': {
            if (offset + 1 > payload.length) return { value: '', length: 0 };
            const len = payload.readUInt16LE(offset);
            const end = offset + 2 + len * 2; // UTF-16LE: 2 bytes per char
            if (end > payload.length) {
                console.warn(`String length ${len} overruns payload at ${offset}`);
                return { value: '', length: 2 };
            }
            let value = payload.slice(offset + 2, end).toString('ucs2');
            return { value: value.trim(), length: 2 + len * 2 };
        }
        case 'bool':
            return { value: payload.readUInt8(offset) !== 0, length: fieldLengths.bool };
        case 'byte': {
            if (offset + 1 > payload.length) return { value: Buffer.alloc(0), length: 0 };
            const len = payload.readUInt16LE(offset);
            const end = offset + 2 + len;
            if (end > payload.length) {
                console.warn(`Byte array length ${len} overruns at ${offset}`);
                return { value: Buffer.alloc(0), length: 2 };
            }
            return { value: payload.slice(offset + 2, end), length: 2 + len };
        }
        case 'angle': {
            if (offset + 1 > payload.length) return { value: 0, length: 0 };
            const angle = payload.readInt16LE(offset); // Signed per spec
            return { value: (angle / 32768) * Math.PI, length: fieldLengths.angle }; // To radians
        }
        case 'vec3': {
            if (offset + 11 > payload.length) return { value: { x: 0, y: 0, z: 0 }, length: 0 };
            const x = payload.readFloatLE(offset);
            const y = payload.readFloatLE(offset + 4);
            const z = payload.readFloatLE(offset + 8);
            return { value: { x, y, z }, length: fieldLengths.vec3 };
        }
        case 'offset': {
            if (offset + 5 > payload.length) return { value: { x: 0, y: 0, z: 0 }, length: 0 };
            const x = payload.readInt16LE(offset);
            const y = payload.readInt16LE(offset + 2);
            const z = payload.readInt16LE(offset + 4);
            return { value: { x, y, z }, length: fieldLengths.offset };
        }
        case '#':
            return { value: null, length: fieldLengths['#'] };
        case 'skillid32': {
            if (offset + 3 > payload.length) return { value: null, length: 0 };
            const value = parseSkillId32(payload.slice(offset, offset + 4));
            return { value, length: fieldLengths.skillid32 };
        }
        default:
            console.warn(`Unknown type: ${type} at ${offset}`);
            return { value: null, length: 0 };
    }
}

function parseSkillId32(skill) {
    if (!Buffer.isBuffer(skill) || skill.length < 4) {
        console.warn('Invalid skill buffer: must be at least 4 bytes');
        return { id: 0, hasHuntingZone: 0, type: 0, isNpc: false, reserved: 0 };
    }
    const value = skill.readUInt32LE(0);
    const type = (value >> 26) & 0xF;
    const isNpc = Boolean(value & 0x40000000);
    const hasHuntingZone = isNpc && type === 1;
    const idMask = hasHuntingZone ? 0xFFFF : 0x3FFFF;
    return {
        id: Number(value & idMask),
        hasHuntingZone: hasHuntingZone ? Number((value >> 16) & 0x3FF) : 0,
        type,
        isNpc,
        reserved: Number(value >> 31)
    };
}

module.exports = parsePayloadByType;