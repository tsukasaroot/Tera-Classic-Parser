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

    console.log(msg.raw)
    console.log(parsed)
});

client.on('S_COMPLETE_EVENT_MATCHING_QUEST', (msg) => {
    const {parsed} = msg;

    // by exemple, it seems that for CS id is 2201 and we can find it in EventMatching.xml its part of the compensation list (so the quest giving gold and an item)
    // can be used to know if match is complete, but ONLY if the person in question don't forget to take the quest (and only work for a win)

    console.log(msg.raw)
    console.log(parsed)
    console.log('END OF THE CS');
});

client.on('S_SEND_CHANGE_REPUTATION_POINT', (msg) => {
    const {parsed} = msg;

    console.log(msg.raw)
    console.log(parsed)
    console.log('END OF THE CS BUT WITH REPUTATION POINT CHANGES');
})

client.on('S_BATTLE_FIELD_RESULT', (msg) => {
    const {parsed} = msg;

    console.log(msg.raw)
    console.log(parsed)
    console.log('END OF THE CS BUT WITH BATTLE FIELD RESULT');
});

client.on('S_SYSTEM_MESSAGE', (msg) => {
    const {parsed} = msg;

    console.log(msg.raw);
    console.log(parsed)
})