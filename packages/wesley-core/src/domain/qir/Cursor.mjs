export function encodeCursor(obj) {
  const json = JSON.stringify(obj == null ? {} : obj);
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor(str) {
  if (!str) return {};
  try {
    const json = Buffer.from(String(str), 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return {};
  }
}

