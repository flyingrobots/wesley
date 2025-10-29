// @wesley/host-node/console-compat-logger.mjs
import { createPinoLogger } from './logger-pino.mjs';

export class ConsoleLogger {
  constructor(prefix = 'Wesley') {
    this._p = createPinoLogger({ name: prefix });
  }
  info(...a){ this._p.info(...a); }
  warn(...a){ this._p.warn(...a); }
  error(...a){ this._p.error(...a); }
  debug(...a){ this._p.debug(...a); }
  child(b){ return this._p.child(b); }
  async flush(){ await this._p.flush?.(); }
}