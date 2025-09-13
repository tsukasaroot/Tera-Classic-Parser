const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const maps = data.maps["286406"];
const protocol = data.protocol;
const definitions = {};
const loadProtocol = require('./protocolParser');
const parsePayloadByType = require("./parsePayloadByType");

loadProtocol(protocol, definitions);

const net = require('net');
const {EventEmitter} = require('events');

const DIRECTION = {
    CLIENT_SERVER: 1,
    SERVER_CLIENT: 2
};

let skillOpcodes;
try {
    skillOpcodes = JSON.parse(fs.readFileSync('blacklist.json', 'utf8'));
} catch (err) {
    console.warn(`Failed to load blacklist.json: ${err.message}`);
    skillOpcodes = [];
}

class TeraSocketClient extends EventEmitter {
    constructor(socketHost, socketPort, handleMessageReceived = null) {
        super();
        this._socketHost = socketHost;
        this._socketPort = socketPort;
        this.Connected = false;
        this._client = null;
        this._controller = new AbortController();
        this._debug = false;
        this._shownodefs = false;

        this.onEndConnection = () => console.log('Connection ended');
        this.onWarning = (msg) => console.log(`Warning: ${msg}`);
    }

    dataHandler(opcodeName, buffer, teraPacketLen, opcode) {
        if (!skillOpcodes.includes(opcodeName)) {
            const isClientToServer = this.direction === DIRECTION.CLIENT_SERVER;

            const payload = buffer.slice(7, 7 + teraPacketLen);
            const definition = definitions[opcodeName];
            if (definition) {
                let offset = 0;
                let buffer_pos = 0;
                let parsed = {};

                for (const field of definition) {
                    if (offset >= payload.length) {
                        console.warn(`Parse overrun at field ${field.name} for ${opcodeName} at offset ${offset} (payload len: ${payload.length})`);
                        break;
                    }

                    if (field.type === 'array') {
                        if (!parsed[`${field.name}_ref`]) {
                            console.warn(`Missing ref for array ${field.name} in ${opcodeName}`);
                            break;
                        }
                        const {count, offset: refOffset} = parsed[`${field.name}_ref`];
                        const maxItems = 50;
                        if (count > maxItems) {
                            console.warn(`Excessive array count ${count} for ${field.name} in ${opcodeName}, capping at ${maxItems}`);
                            parsed[field.name] = [];
                            break;
                        }

                        const items = [];
                        let currentOffset = refOffset;
                        for (let k = 0; k < count; k++) {
                            if (currentOffset + 4 > payload.length) {
                                console.warn(`Array overrun at ${currentOffset} for ${field.name}`);
                                break;
                            }
                            const here = payload.readUInt16LE(currentOffset);
                            const next = payload.readUInt16LE(currentOffset + 2);
                            currentOffset += 4;

                            if (k === 0 && here !== refOffset && refOffset !== 0) {
                                console.warn(`Here mismatch: ${here} != refOffset ${refOffset}`);
                            }

                            const item = {};
                            let validItem = true;
                            for (const subField of field.subType || []) {
                                if (currentOffset >= payload.length) {
                                    console.warn(`Array item overrun at ${currentOffset} for ${subField.name} in ${opcodeName}`);
                                    validItem = false;
                                    break;
                                }
                                const {
                                    value,
                                    length
                                } = parsePayloadByType(subField.type, payload, currentOffset, null, opcodeName, subField.name);
                                if (length === 0) {
                                    console.warn(`Zero length for subfield ${subField.name} in ${opcodeName} at ${currentOffset}`);
                                    validItem = false;
                                    break;
                                }
                                item[subField.name] = value;
                                currentOffset += length;
                            }

                            if (validItem) {
                                items.push(item);
                            } else {
                                break;
                            }

                            if (next === 0) {
                                if (k < count - 1) {
                                    console.warn(`Early array end at item ${k + 1}/${count}`);
                                    break;
                                }
                            } else {
                                currentOffset = next;
                            }
                        }
                        parsed[field.name] = items;
                        offset = currentOffset;
                    } else if (field.type === 'string' && parsed[`offset_${field.name}`]) {
                        const refOffset = parsed[`offset_${field.name}`];
                        if (typeof refOffset !== 'number' || refOffset < 0 || refOffset >= payload.length) {
                            console.warn(`Invalid string offset ${refOffset} for ${field.name} in ${opcodeName}`);
                            parsed[field.name] = '';
                            continue;
                        }
                        buffer_pos = refOffset;
                        const {
                            value,
                            length
                        } = parsePayloadByType(field.type, payload, buffer_pos, null, opcodeName, field.name);
                        parsed[field.name] = value;
                        offset = Math.max(offset, refOffset + length);
                    } else {
                        const {
                            value,
                            length
                        } = parsePayloadByType(field.type, payload, offset, null, opcodeName, field.name);
                        if (length === 0) {
                            console.warn(`Zero length for field ${field.name} in ${opcodeName} at ${offset}`);
                            break;
                        }
                        parsed[field.name] = value;
                        offset += length;
                    }
                }

                if (offset !== payload.length) {
                    console.warn(`Partial parse for ${opcodeName}: used ${offset}/${payload.length} bytes`);
                }

                if (this._debug) {
                    console.log(`Parsed ${opcodeName}:`, {
                        ...parsed,
                        ...(Object.keys(parsed).reduce((acc, k) => {
                            acc[k] = typeof parsed[k] === 'bigint' ? parsed[k].toString() : parsed[k];
                            return acc;
                        }, {}))
                    });
                }

                this.emit(opcodeName, {
                    direction: this.direction,
                    name: opcodeName,
                    opcode,
                    parsed,
                    raw: payload
                });
            } else {
                if (this._shownodefs) {
                    console.log(`No definition for ${opcodeName} [0x${opcode.toString(16)}]`);
                }
            }
        }
    }

    async start() {
        const {signal} = this._controller;
        while (!signal.aborted) {
            try {
                this._client = new net.Socket({
                    highWaterMark: 10 * 1024 * 1024 // 10 MB
                });

                this._client.setMaxListeners(2);

                let buffer = Buffer.alloc(0);

                await new Promise((resolve, reject) => {
                    this._client.connect(this._socketPort, this._socketHost, () => {
                        this.Connected = true;
                        console.log(`Connected to ${this._socketHost}:${this._socketPort}`);
                        resolve();
                    });

                    this._client.on('error', (err) => {
                        this.onWarning(`Socket error: ${err.message}`);
                        reject(err);
                    });
                });

                const findOpcodeName = (opcode) => {
                    return Object.keys(maps).find(key => maps[key] === opcode);
                };

                this._client.on('data', (data) => {
                    buffer = Buffer.concat([buffer, data]);

                    if (buffer.length > 2 * 1024 * 1024) {
                        this.onWarning(`Buffer too large (${buffer.length} bytes), clearing to prevent OOM`);
                        buffer = Buffer.alloc(0);
                        return;
                    }

                    while (!signal.aborted && buffer.length >= 2) {
                        const totalLen = buffer.readUInt16LE(0);
                        const frameBytesNeeded = 2 + totalLen;

                        if (buffer.length < frameBytesNeeded) {
                            break;
                        }

                        if (totalLen < 5) {
                            this.onWarning(`Invalid totalLen ${totalLen}, skipping 2 bytes`);
                            buffer = buffer.slice(2);
                            continue;
                        }

                        this.direction = buffer.readUInt8(2);
                        const teraPacketLen = buffer.readUInt16LE(3);

                        if (teraPacketLen < 4 || 1 + teraPacketLen !== totalLen) {
                            this.onWarning(`Length mismatch: transportLen=${totalLen}, teraLen=${teraPacketLen}`);
                            buffer = buffer.slice(2 + totalLen);
                            continue;
                        }

                        const opcode = buffer.readUInt16LE(5);
                        const opcodeName = findOpcodeName(opcode);

                        this.dataHandler(opcodeName, buffer, teraPacketLen, opcode);

                        buffer = buffer.slice(2 + totalLen);

                        const mem = process.memoryUsage();
                        if (mem.heapUsed > 1.5 * 1024 * 1024 * 1024) {
                            console.warn(`High memory usage: ${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
                            global.gc && global.gc();
                        }
                    }
                });

                this._client.on('close', () => {
                    if (this.Connected) {
                        this.Connected = false;
                        this.onEndConnection();
                    }
                });

                await new Promise((resolve) => {
                    this._client.on('close', resolve);
                    signal.addEventListener('abort', () => {
                        this._client.destroy();
                        resolve();
                    }, {once: true});
                });
            } catch (err) {
                this.onWarning(`Error: ${err.message}`);
            } finally {
                if (this._client) {
                    try {
                        this._client.destroy();
                    } catch {
                    }
                }
                if (this.Connected) {
                    this.Connected = false;
                    this.onEndConnection();
                }
            }

            if (!signal.aborted) {
                console.log('Reconnecting in 2 seconds...');
                await new Promise((resolve) => setTimeout(resolve, 2000, signal));
            }
        }
    }

    stop() {
        this._controller.abort();
        if (this._client) {
            this._client.destroy();
        }
    }
}

module.exports = {TeraSocketClient};