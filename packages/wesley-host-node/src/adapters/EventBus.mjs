import { EventEmitter } from '@wesley/core';

/**
 * Event Bus - Event-driven architecture implementation
 * Shared in-memory publisher used across Node adapters.
 */
export class EventBus extends EventEmitter {}
