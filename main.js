const {app, BrowserWindow} = require('electron')
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

class TeraSocketClient extends EventEmitter {
    constructor(socketHost, socketPort, handleMessageReceived = null) {
        super();
        this._socketHost = socketHost;
        this._socketPort = socketPort;
        this.Connected = false;
        this._client = null;
        this._controller = new AbortController();

        this.onEndConnection = () => console.log('Connection ended');
        this.onWarning = (msg) => console.log(`Warning: ${msg}`);
    }

    async start() {
        const {signal} = this._controller;
        while (!signal.aborted) {
            try {
                this._client = new net.Socket(
                    {
                        highWaterMark: 10 * 1024 * 1024 // 10 MB
                    }
                );

                this._client.setMaxListeners(2);

                let buffer = Buffer.alloc(0);

                await new Promise((resolve, reject) => {
                    this._client.connect(7802, this._socketHost, () => {
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
                }

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

                        const direction = buffer.readUInt8(2);
                        const teraPacketLen = buffer.readUInt16LE(3);

                        if (teraPacketLen < 4 || 1 + teraPacketLen !== totalLen) {
                            this.onWarning(`Length mismatch: transportLen=${totalLen}, teraLen=${teraPacketLen}`);
                            buffer = buffer.slice(2 + totalLen);
                            continue;
                        }

                        const opcode = buffer.readUInt16LE(5);
                        const opcodeName = findOpcodeName(opcode);

                        const skillOpcodes = [
                            'C_START_SKILL',
                            'C_PRESS_SKILL',
                            'C_START_TARGETED_SKILL',
                            'SCreatureChangeLife',
                            'SCombatSkillHitResultNotify',
                            'SSpawnUser'
                        ];
                        if (skillOpcodes.includes(opcodeName)) {
                            const isClientToServer = direction === DIRECTION.CLIENT_SERVER;
                            console.log(`${isClientToServer ? 'C->S' : 'S->C'}: ${opcodeName} [0x${opcode.toString(16).padStart(4, '0')}]`);

                            const payload = buffer.slice(7, 3 + teraPacketLen);
                            if (opcodeName === 'C_START_TARGETED_SKILL') {
                                console.log(`Payload hex: ${payload.toString('hex')} (len: ${payload.length})`);
                                console.log(`Definition:`, JSON.stringify(definitions[opcodeName], null, 2));
                            }

                            const definition = definitions[opcodeName];
                            if (definition) {
                                let offset = 0;
                                let parsed = {};

                                for (const field of definition) {
                                    if (offset >= payload.length) {
                                        console.warn(`Parse overrun at field ${field.name} for ${opcodeName}`);
                                        break;
                                    }

                                    if (field.type === 'array') {
                                        if (!parsed[`${field.name}_ref`]) {
                                            console.warn(`Missing ref for array ${field.name} in ${opcodeName}`);
                                            break;
                                        }
                                        const {count, offset: refOffset} = parsed[`${field.name}_ref`];
                                        const maxTargets = 50;
                                        if (count > maxTargets) {
                                            console.warn(`Excessive array count ${count} for ${field.name} in ${opcodeName}, capping at ${maxTargets}`);
                                            parsed[field.name] = [];
                                            break;
                                        }

                                        const items = [];
                                        let currentOffset = refOffset || offset; // Use ref offset if available
                                        for (let k = 0; k < count; k++) {
                                            if (currentOffset + 4 > payload.length) {
                                                console.warn(`Array overrun at ${currentOffset} for ${field.name}`);
                                                break;
                                            }
                                            // Read implicit here/next
                                            const here = payload.readUInt16LE(currentOffset);
                                            const next = payload.readUInt16LE(currentOffset + 2);
                                            currentOffset += 4;

                                            // Verify here (optional, for debugging)
                                            if (k === 0 && here !== refOffset && refOffset !== 0) {
                                                console.warn(`Here mismatch: ${here} != refOffset ${refOffset}`);
                                            }

                                            const item = {};
                                            let validItem = true;
                                            for (const subField of field.subType || []) {
                                                if (currentOffset >= payload.length) {
                                                    console.warn(`Array item overrun at ${currentOffset} for ${subField.name}`);
                                                    validItem = false;
                                                    break;
                                                }
                                                const {
                                                    value,
                                                    length
                                                } = parsePayloadByType(subField.type, payload, currentOffset);
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

                                            // Move to next element
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
                                        offset = currentOffset; // Update main offset
                                    } else {
                                        const {value, length} = parsePayloadByType(field.type, payload, offset);
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

                                console.log(`Parsed ${opcodeName}:`, {
                                    ...parsed,
                                    ...(Object.keys(parsed).reduce((acc, k) => {
                                        acc[k] = typeof parsed[k] === 'bigint' ? parsed[k].toString() : parsed[k];
                                        return acc;
                                    }, {}))
                                });
                            } else {
                                console.log(`No definition for ${opcodeName} [0x${opcode.toString(16)}]`);
                            }
                        }

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

                // Wait for connection to close or cancellation
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

            // Reconnect after 2 seconds unless cancelled
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

// Example usage
const client = new TeraSocketClient('127.0.0.1', 7801);
client.start().catch((err) => console.error('Client error:', err));

/*const createWindow = () => {
    const win = new BrowserWindow({
        width: 500,
        height: 700,
        frame: true,
        transparent: true,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true, contextIsolation: false,
        }
    })

    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
})*/