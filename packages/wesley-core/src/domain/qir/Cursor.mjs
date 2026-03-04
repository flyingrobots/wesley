/**
 * Cursor encode/decode for keyset pagination.
 * Uses btoa/atob (available in Node 16+ and all browsers) instead of
 * Buffer to keep @wesley/core platform-agnostic.
 */

export function encodeCursor(obj) {
  const json = JSON.stringify(obj == null ? {} : obj);
  // btoa produces standard base64; convert to base64url
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(str) {
  if (!str) return {};
  try {
    // Restore standard base64 from base64url
    let b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad
    while (b64.length % 4) b64 += '=';
    const json = atob(b64);
    const parsed = JSON.parse(json);
    // Guard: callers expect a plain object; coerce primitives/arrays to {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    // Strip prototype-polluting keys
    delete parsed.__proto__;
    delete parsed.constructor;
    return parsed;
  } catch (e) {
    if (e instanceof SyntaxError) return {};
    // Re-throw unexpected errors (e.g., atob on truly invalid input also
    // throws DOMException / Error depending on platform — treat as bad input)
    return {};
  }
}
