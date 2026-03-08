// wesley-core/src/ports/crypto.mjs

/**
 * Crypto Port - Abstract interface for cryptographic operations
 * Platform hosts must provide an implementation via dependency injection
 */
export class CryptoPort {
  /**
   * Compute SHA-256 hash of a string
   * @param {string} data - Data to hash
   * @returns {string} Hex-encoded hash
   */
  sha256(_data) {
    throw new Error('CryptoPort.sha256() must be implemented by platform host');
  }

  /**
   * Compute SHA-256 hash and return as raw bytes
   * @param {string} data - Data to hash
   * @returns {Uint8Array} Raw hash bytes
   */
  sha256Bytes(_data) {
    throw new Error('CryptoPort.sha256Bytes() must be implemented by platform host');
  }
}

/**
 * Fake Crypto - Test double that returns deterministic hashes
 * Useful for snapshot testing where hash values need to be stable
 */
export class FakeCrypto extends CryptoPort {
  sha256(data) {
    // Return a deterministic fake hash based on input length and first chars
    // Use only hex-safe characters (0-9, a-f) to avoid NaN in sha256Bytes
    const hexChars = 'abcdef0123456789';
    let prefix = '';
    for (let i = 0; i < Math.min(8, data.length); i++) {
      prefix += hexChars[data.charCodeAt(i) % 16];
    }
    prefix = prefix.padEnd(8, '0');
    const len = data.length.toString(16).padStart(8, '0');
    return `${len}${prefix}`.padEnd(64, '0');
  }

  sha256Bytes(data) {
    const hex = this.sha256(data);
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
}

/**
 * Null Crypto - Throws error indicating missing platform adapter
 */
class NullCrypto extends CryptoPort {
  sha256(_data) {
    throw new Error(
      'No crypto adapter configured. ' +
      'Platform host must inject a CryptoPort implementation via dependencies.'
    );
  }

  sha256Bytes(_data) {
    throw new Error(
      'No crypto adapter configured. ' +
      'Platform host must inject a CryptoPort implementation via dependencies.'
    );
  }
}

/**
 * Default crypto instance - throws until platform host provides implementation
 */
export const defaultCrypto = new NullCrypto();
