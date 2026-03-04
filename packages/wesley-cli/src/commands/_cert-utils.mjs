/**
 * Shared certificate utilities for cert-sign and cert-verify.
 * Single source of truth for JSON block extraction and canonicalization.
 */

const JSON_FENCE = '```json';
const JSON_FENCE_LEN = JSON_FENCE.length;

/**
 * Extract the WESLEY_CERT JSON block from a SHIPME.md file.
 * Returns { pre, json, post } where pre/post are the surrounding markdown.
 */
export function extractJsonBlock(md) {
  const begin = md.indexOf('<!-- WESLEY_CERT:BEGIN -->');
  const fence = md.indexOf(JSON_FENCE, begin);
  const fenceEnd = md.indexOf('```', fence + JSON_FENCE_LEN);
  const end = md.indexOf('<!-- WESLEY_CERT:END -->', fenceEnd);
  if (begin === -1 || fence === -1 || fenceEnd === -1 || end === -1) throw new Error('Invalid SHIPME.md format');
  const pre = md.slice(0, fence + JSON_FENCE_LEN) + '\n';
  const jsonStr = md.slice(fence + JSON_FENCE_LEN, fenceEnd).trim();
  const post = '\n```\n' + md.slice(end);
  const json = JSON.parse(jsonStr);
  return { pre, json, post };
}

/**
 * Deterministic JSON canonicalization: sort object keys recursively,
 * then stringify. Used for signing and verification — both MUST use
 * this same function.
 */
export function canonicalize(obj) {
  const sort = (x) => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === 'object') {
      return Object.keys(x).sort().reduce((acc, k) => { acc[k] = sort(x[k]); return acc; }, {});
    }
    return x;
  };
  return JSON.stringify(sort(obj));
}
