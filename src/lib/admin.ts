import { timingSafeEqual } from 'node:crypto';
export function isAdmin(header: string | null) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !header?.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 0 || decoded.slice(0, separator) !== 'admin') return false;
    const incoming = Buffer.from(decoded.slice(separator + 1));
    const expected = Buffer.from(password);
    return incoming.length === expected.length && timingSafeEqual(incoming, expected);
  } catch { return false; }
}
