// Finds a key written twice in one JSON object. `JSON.parse` keeps the last and
// says nothing, so a page could show a value that is never compared.
//
// `text` must already be valid JSON: parse it first. In valid JSON a string
// followed by a colon is always an object key, which is all this relies on.
// Returns the first repeated key, unescaped, or null.
export function duplicateKey(text) {
  const objects = [];
  let i = 0;
  while (i < text.length) {
    const char = text[i];
    if (char === '"') {
      let end = i + 1;
      while (text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      const literal = text.slice(i, end + 1);
      i = end + 1;
      let next = i;
      while (/\s/.test(text[next])) next += 1;
      if (text[next] === ':') {
        const key = JSON.parse(literal);
        const keys = objects[objects.length - 1];
        if (keys.has(key)) return key;
        keys.add(key);
      }
    } else {
      if (char === '{') objects.push(new Set());
      else if (char === '}') objects.pop();
      i += 1;
    }
  }
  return null;
}
