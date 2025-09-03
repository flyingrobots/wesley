// wesley-host-node/src/adapters/logger-pino.mjs
import pino from 'pino';

export function createPinoLogger({ name = 'Wesley', level = 'info', pretty = true, json = false, bindings = {} } = {}) {
  const transport = pretty && !json ? pino.transport({ target: 'pino-pretty', options: { colorize: true, singleLine: true } }) : undefined;
  const base = pino({ name, level, base: bindings }, transport);
  return {
    info: (o, m) => m ? base.info(o, m) : base.info(o),
    warn: (o, m) => m ? base.warn(o, m) : base.warn(o),
    error: (o, m) => m ? base.error(o, m) : base.error(o),
    debug: (o, m) => m ? base.debug(o, m) : base.debug(o),
    child(b) { return createPinoLogger({ name, level: base.level, pretty, json, bindings: { ...bindings, ...b } }); },
    setLevel(l) { base.level = l; },
    async flush() { await base.flush?.(); await base.transport?.flush?.(); },
    _raw: base,
  };
}