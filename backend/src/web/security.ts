import { RequestHandler } from 'express';

// Security settings for the live site. Design: docs/superpowers/specs/2026-09-29-phase8a-live-preview-design.md

/** What pages may load: our own files, plus map tiles from OpenStreetMap. */
export function contentSecurityDirectives(publicUrl: string): Record<string, string[] | null> {
  const httpsSite = new URL(publicUrl).protocol === 'https:';
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    // Leaflet and React set inline style values; scripts stay strict.
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
    connectSrc: ["'self'"],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    // A plain-http site (the dress rehearsal on this computer) must not ask browsers to switch to https.
    upgradeInsecureRequests: httpsSite ? [] : null,
  };
}

/** True for private, shared, link-local and loopback addresses: never a visitor's own address on the internet. */
export function isPrivateAddress(ip: string): boolean {
  const lower = ip.toLowerCase();
  const address = lower.startsWith('::ffff:') ? lower.slice('::ffff:'.length) : lower;
  if (address.includes(':')) return address === '::1' || /^f[cd]/.test(address) || address.startsWith('fe80:');
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/**
 * Logs once whether visitors' addresses look public, so a wrong TRUST_PROXY_HOPS shows up in the logs
 * without an address ever being logged. The health check comes from inside Railway, so it is not counted.
 */
export function proxyCheck(log: (message: string) => void = console.log): RequestHandler {
  let checked = false;
  return (req, _res, next) => {
    if (!checked && req.path !== '/health' && req.ip) {
      checked = true;
      log(
        isPrivateAddress(req.ip)
          ? 'Proxy check: visitor addresses look private. Check TRUST_PROXY_HOPS.'
          : 'Proxy check: visitor addresses look public.',
      );
    }
    next();
  };
}
