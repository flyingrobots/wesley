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
  if (!(begin < fence && fence < fenceEnd && fenceEnd < end)) throw new Error('SHIPME.md certificate markers are out of order');
  const pre = md.slice(0, fence + JSON_FENCE_LEN) + '\n';
  const jsonStr = md.slice(fence + JSON_FENCE_LEN, fenceEnd).trim();
  const post = '\n```\n' + md.slice(end);
  const json = JSON.parse(jsonStr);
  return { pre, json, post };
}

export function evaluateCertificatePolicy(json) {
  const holmesVerdict = normalizeOptionalString(json?.holmes?.shipVerdict);
  const okRealm = json?.realm?.verdict === 'PASS';
  const okHolmes = holmesVerdict === 'ELEMENTARY';
  const okCounterfactual = !json?.counterfactual || json.counterfactual.gate !== 'fail';
  const reasons = [];

  if (!okRealm) reasons.push('REALM verdict is not PASS.');
  if (!holmesVerdict) reasons.push('HOLMES verdict is missing.');
  else if (!okHolmes) reasons.push(`HOLMES verdict ${holmesVerdict} does not permit shipping.`);
  if (!okCounterfactual) reasons.push('Counterfactual gate is fail.');

  return {
    okRealm,
    okHolmes,
    okCounterfactual,
    holmesVerdict,
    eligibleToShip: okRealm && okHolmes && okCounterfactual,
    reasons
  };
}

export function buildCertBadge(json) {
  const sha = json?.sha?.slice(0, 7) || 'unknown';
  const policy = evaluateCertificatePolicy(json);
  const parts = [`[SHIPME] ${policy.eligibleToShip ? 'PASS' : 'FAIL'}`];
  parts.push(`HOLMES ${policy.holmesVerdict || 'MISSING'}`);
  return `${parts.join(' · ')} — sha ${sha}`;
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
      return Object.keys(x).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).reduce((acc, k) => { acc[k] = sort(x[k]); return acc; }, {});
    }
    return x;
  };
  return JSON.stringify(sort(obj));
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
