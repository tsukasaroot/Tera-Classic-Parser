import {TeraSocketClient} from './lib/TeraSocketClient.js';

const client = new TeraSocketClient('127.0.0.1', 7802);
client.start().catch((err) => console.error('Client error:', err));
//client._debug = true;
// client._shownodefs = true

client.on('C_CHAT', (msg) => {
    const {parsed} = msg;

    if (parsed.message.includes('~bgview')) {
        console.log('we show up the bgview from an electronjs app by exemple');
    }
});