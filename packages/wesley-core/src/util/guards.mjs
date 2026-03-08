/**
 * Defensive lookup helpers that throw on miss instead of returning
 * undefined/null.  Centralises the "find-or-throw" and "match-or-throw"
 * pattern that recurs across the codebase.
 */

/**
 * Like `Array.prototype.find`, but throws when no element matches.
 *
 * Caveat: arrays containing `undefined` as a value are not supported —
 * a matched `undefined` element is indistinguishable from no match.
 *
 * @template T
 * @param {T[]}                   arr       Array to search.
 * @param {(item: T) => boolean}  predicate Test applied to each element.
 * @param {string}                message   Error message on miss.
 * @returns {T}
 */
export function mustFind(arr, predicate, message) {
  const result = arr.find(predicate);
  if (result === undefined) {
    throw new Error(message);
  }
  return result;
}

/**
 * Like `String.prototype.match`, but throws when the pattern does not match.
 *
 * @param {string}        str     String to test.
 * @param {RegExp|string} pattern Pattern to match against.
 * @param {string}        message Error message on miss.
 * @returns {RegExpMatchArray}
 */
export function mustMatch(str, pattern, message) {
  const result = str.match(pattern);
  if (!result) {
    throw new Error(message);
  }
  return result;
}
