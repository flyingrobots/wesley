export function hashString(input) {
  // DJB2 hash (non-cryptographic), stable across environments
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
    hash = hash | 0; // 32-bit
  }
  // return as unsigned hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function randomHex(bytes = 4) {
  // Non-crypto PRNG, sufficient for ids in pure domain
  let out = '';
  for (let i = 0; i < bytes; i++) {
    const v = Math.floor(Math.random() * 256);
    out += v.toString(16).padStart(2, '0');
  }
  return out;
}

