import { TeraSocketClient } from './lib/TeraSocketClient.js';

const client = new TeraSocketClient('127.0.0.1', 7802);
client.start().catch((err) => console.error('Client error:', err));