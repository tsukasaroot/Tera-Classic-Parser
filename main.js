import {TeraSocketClient} from './lib/TeraSocketClient.js';

const client = new TeraSocketClient('127.0.0.1', 7802);
client.start().catch((err) => console.error('Client error:', err));
client._debug = false;
// client._shownodefs = true
client._writeErrors = true

client.on('C_CHAT', (msg) => {
    const {parsed} = msg;

    if (parsed.message.includes('~bgview')) {
        console.log('we show up the bgview from an electronjs app by exemple');
    }
});

client.on('S_SHOW_PARTY_MATCH_INFO', (msg) => {
    const {parsed} = msg;

    console.log(parsed)
});