/**
 * Vitest setup file - configures test environment
 * Provides crypto adapter for TTD tests
 */

import { createHash } from 'node:crypto';
import { CryptoPort } from '@wesley/core/ports';

/**
 * Node Crypto adapter for tests
 */
class TestCrypto extends CryptoPort {
  sha256(data) {
    return createHash('sha256').update(data).digest('hex');
  }

  sha256Bytes(data) {
    const buf = createHash('sha256').update(data).digest();
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
}

/** Export for test use */
export const testCrypto = new TestCrypto();
