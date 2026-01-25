// wesley-host-node/src/adapters/NodeCrypto.mjs

/**
 * Node.js Crypto Adapter - Uses native crypto module for performance
 */

import { createHash } from 'node:crypto';
import { CryptoPort } from '@wesley/core/src/ports/crypto.mjs';

/**
 * Node Crypto - Native Node.js crypto implementation
 * Much faster than pure JS implementation
 */
export class NodeCrypto extends CryptoPort {
  sha256(data) {
    return createHash('sha256').update(data).digest('hex');
  }

  sha256Bytes(data) {
    const buf = createHash('sha256').update(data).digest();
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}

/** Singleton instance */
export const nodeCrypto = new NodeCrypto();
