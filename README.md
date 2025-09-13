Tera Classic EU Packet Parser

This project provides a custom packet parser for Tera Classic EU (patch 286406), designed to process raw network packets from the game.

Unlike Toolbox, which is incompatible with this version, this parser connects to a local proxy (e.g., 127.0.0.1:7802) to capture and parse packets into readable data structures, enabling developers to analyze game events such as chat messages (S_CHAT), guild updates (S_UPDATE_GUILD_MEMBER).

This parser handles server-to-client and client-to-server packets..

It is built to be extensible, using definition files (e.g., S_CHAT.2.def) to map opcodes to packet structures, and supports dynamic offset handling for complex fields like strings and arrays.
Features

Packet Parsing: Decodes raw network packets into structured JavaScript objects.

Event-Driven: Uses an event emitter to dispatch parsed packets by opcode (e.g., S_CHAT, S_ACTION_END).

Customizable Definitions: Supports .def files for packet structures, loaded via data.json.

Robust Error Handling: Logs parsing errors (e.g., invalid offsets, unknown types) for debugging.

Prerequisites
Node.js: Version 16 or higher.
Electron: Optional, for GUI integration (commented out in main.js).
Proxy Server: A local proxy (e.g., Tera Toolbox or custom) running on 127.0.0.1:7802 to capture decrypted packets.
Game Client: Tera Classic EU (patch 286406).

Create main.js:
Create a file named main.js in the project root with the following code to initialize the parser:
```js
import { TeraSocketClient } from './lib/TeraSocketClient.js';

const client = new TeraSocketClient('127.0.0.1', 7802); // Adjust port if needed
client.start().catch((err) => console.error('Client error:', err));
```
Listen for Parsed Packets:
Use the event emitter to handle specific opcodes. For example, to capture chat messages:
```js
client.on('S_CHAT', (msg) => {
  console.log('Received S_CHAT:', msg);
  // Example output:
  // {
  //   offset_authorName: 23,
  //   offset_message: 45,
  //   channel: 0,
  //   authorID: "140737489017891",
  //   unk1: false,
  //   gm: false,
  //   founder: true,
  //   authorName: "Islanzadie",
  //   message: "<FONT>hjdhzd</FONT>"
  // }
});

client.on('S_ACTION_END', (msg) => {
  console.log('Received S_ACTION_END:', msg);
});

client.on('S_UPDATE_GUILD_MEMBER', (msg) => {
  console.log('Received S_UPDATE_GUILD_MEMBER:', msg);
});
```

There may be a need to do some more work on parsing correctly certain packets definitions
