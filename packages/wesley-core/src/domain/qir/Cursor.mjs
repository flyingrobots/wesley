/**
 * Cursor encode/decode for keyset pagination.
 * Uses btoa/atob (available in Node 16+ and all browsers) instead of
 * Buffer to keep @wesley/core platform-agnostic.
 */

export function encodeCursor(obj) {
  const json = JSON.stringify(obj == null ? {} : obj);
  // Encode via TextEncoder for UTF-8 safety (btoa only supports Latin1)
  const bytes = new TextEncoder().encode(json);
  const binary = String.fromCodePoint(...bytes);
  // btoa produces standard base64; convert to base64url
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(str) {
  if (!str) return {};
  try {
    // Restore standard base64 from base64url
    let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad
    while (b64.length % 4) b64 += '=';
    // Decode via TextDecoder for UTF-8 safety (atob only produces Latin1)
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json, (key, val) => (key === '__proto__' || key === 'constructor' || key === 'prototype') ? undefined : val);
    // Guard: callers expect a plain object; coerce primitives/arrays to {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return {};
    // Re-throw unexpected errors (e.g., atob on truly invalid input also
    // throws DOMException / Error depending on platform — treat as bad input)
    return {};
  }
}
