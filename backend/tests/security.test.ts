import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { isPrivateAddress } from '../src/web/security.js';

const directivesOf = (policy: string) => policy.split(';').map((part) => part.trim());

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Content-Security-Policy', () => {
  it('lets pages load only our own files and the map tiles', async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app' })).get('/health');
    const directives = directivesOf(res.get('Content-Security-Policy')!);

    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("script-src 'self'");
    expect(directives).toContain("style-src 'self' 'unsafe-inline'");
    expect(directives).toContain("img-src 'self' data: https://tile.openstreetmap.org");
    expect(directives).toContain("connect-src 'self'");
    expect(directives).toContain("frame-ancestors 'none'");
    expect(directives).toContain('upgrade-insecure-requests');
  });

  it('does not ask a plain-http site (the dress rehearsal) to switch to https', async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'http://localhost:4100' })).get('/health');

    expect(directivesOf(res.get('Content-Security-Policy')!)).not.toContain('upgrade-insecure-requests');
  });

  it("tells other sites only the site's address, as OpenStreetMap's tile policy asks", async () => {
    const res = await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app' })).get('/health');

    expect(res.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });
});

describe("visitors' own addresses behind Railway's proxy", () => {
  it('uses the address the proxy passes on', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 });

    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');

    expect(app.get('trust proxy')).toBe(1);
    expect(log).toHaveBeenCalledWith('Proxy check: visitor addresses look public.');
  });

  it('says so when addresses look private, which means the wrong number of proxies', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await request(createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 })).get('/api/v1');

    expect(log).toHaveBeenCalledWith('Proxy check: visitor addresses look private. Check TRUST_PROXY_HOPS.');
  });

  it('checks once, and not on the health check (it comes from inside Railway)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', trustProxyHops: 1 });

    await request(app).get('/health');
    expect(log).not.toHaveBeenCalled();
    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');
    await request(app).get('/api/v1').set('X-Forwarded-For', '198.51.100.7');

    expect(log).toHaveBeenCalledTimes(1);
  });

  it('trusts no proxy and checks nothing when there is none', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const app = createApp({ preview: false, publicUrl: 'http://localhost:3000' });

    await request(app).get('/api/v1').set('X-Forwarded-For', '203.0.113.9');

    expect(app.get('trust proxy')).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });
});

describe('isPrivateAddress', () => {
  it('knows private, shared, link-local and loopback addresses', () => {
    for (const ip of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '100.64.0.1', '127.0.0.1', '169.254.1.1', '::1', '::ffff:10.0.0.1', 'fd12::1', 'fe80::1']) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
  });

  it('treats everything else as a visitor on the internet', () => {
    for (const ip of ['203.0.113.9', '172.32.0.1', '100.128.0.1', '8.8.8.8', '2001:db8::1', '::ffff:203.0.113.9']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });
});
