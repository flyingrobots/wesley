/**
 * Deep-freeze an object and all nested objects. Pure utility (no node:* imports).
 * @param {T} obj
 * @returns {Readonly<T>}
 * @template T
 */
export function deepFreeze(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  Object.freeze(obj);
  for (const val of Object.values(obj)) {
    if (val != null && typeof val === 'object' && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}
