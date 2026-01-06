import { EventEmitter } from 'events';

class CoinEvents extends EventEmitter {}

export const coinEvents = new CoinEvents();

