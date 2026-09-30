import { once } from 'node:events';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { AppOptions, createApp } from '../src/app.js';

// A stand-in for frontend/dist.
let websiteDir: string;
beforeAll(() => {
  websiteDir = mkdtempSync(path.join(os.tmpdir(), 'nk-website-'));
  writeFileSync(
    path.join(websiteDir, 'index.html'),
    '<!doctype html>\n<html lang="en">\n  <head>\n    <title>Neighbors Kitchen</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n',
  );
  mkdirSync(path.join(websiteDir, 'assets'));
  writeFileSync(path.join(websiteDir, 'assets', 'index-abc123.js'), 'console.log("hello")');
  writeFileSync(path.join(websiteDir, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
});

const site = (options: Partial<AppOptions> = {}) =>
  createApp({ preview: false, publicUrl: 'https://neighborskitchen.app', websiteDir, ...options });

/** Sends the request line exactly as given: supertest would tidy "/\" into "//" first. */
async function rawGet(app: ReturnType<typeof createApp>, address: string, host: string) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address() as AddressInfo;
    return await new Promise<{ status?: number; location?: string }>((resolve, reject) => {
      http
        .get({ host: '127.0.0.1', port, path: address, headers: { host } }, (res) => {
          res.resume();
          resolve({ status: res.statusCode, location: res.headers.location });
        })
        .on('error', reject);
    });
  } finally {
    server.close();
  }
}

describe('the website in production', () => {
  it('answers every page address with the app, never cached', async () => {
    for (const address of ['/', '/orders/order-1', '/chef/feedback?view=requests', '/reset-password/', '/index.html']) {
      const res = await request(site()).get(address);

      expect(res.status).toBe(200);
      expect(res.get('Content-Type')).toBe('text/html; charset=utf-8');
      expect(res.get('Cache-Control')).toBe('no-cache');
      expect(res.text).toContain('<div id="root"></div>');
    }
  });

  it('lets browsers keep built files for a year', async () => {
    const res = await request(site()).get('/assets/index-abc123.js');

    expect(res.status).toBe(200);
    expect(res.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  });

  it('serves the other website files for an hour', async () => {
    const res = await request(site()).get('/favicon.svg');

    expect(res.status).toBe(200);
    expect(res.get('Cache-Control')).toBe('public, max-age=3600');
  });

  it('keeps real 404s for missing built files, the API and photos', async () => {
    for (const address of ['/assets/index-old999.js', '/api/v1/nothing-here', '/uploads/meals/00000000-0000-0000-0000-000000000000.webp']) {
      const res = await request(site()).get(address);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
  });

  it('leaves the health check alone', async () => {
    const res = await request(site()).get('/health');

    expect(res.body.message).toBe('Neighbors-Kitchen API is running');
  });

  it('does not answer other methods with the page', async () => {
    expect((await request(site()).post('/orders/order-1')).status).toBe(404);
  });

  it('sends www visitors to the site address, keeping the page', async () => {
    const res = await request(site()).get('/chefs?near=92373').set('Host', 'www.neighborskitchen.app');

    expect(res.status).toBe(301);
    expect(res.get('Location')).toBe('https://neighborskitchen.app/chefs?near=92373');
  });

  it('never names the web framework, even when sending www visitors on', async () => {
    const res = await request(site()).get('/chefs').set('Host', 'www.neighborskitchen.app');

    expect(res.status).toBe(301);
    expect(res.get('X-Powered-By')).toBeUndefined();
  });

  it('never sends www visitors to another site, whatever the page address looks like', async () => {
    const cases = [
      ['//evil.example/login', 'https://neighborskitchen.app//evil.example/login'],
      ['/\\evil.example/login', 'https://neighborskitchen.app/\\evil.example/login'],
      ['http://evil.example/login', 'https://neighborskitchen.app/'],
    ];
    for (const [address, location] of cases) {
      expect(await rawGet(site(), address, 'www.neighborskitchen.app')).toEqual({ status: 301, location });
    }
  });
});

describe('the preview site', () => {
  it('marks every page as the preview', async () => {
    const res = await request(site({ preview: true })).get('/meals');

    expect(res.text).toContain('<meta name="nk-preview" content="true" />');
  });

  it('asks search engines to stay away', async () => {
    const robots = await request(site({ preview: true })).get('/robots.txt');
    const api = await request(site({ preview: true })).get('/api/v1');

    expect(robots.text).toBe('User-agent: *\nDisallow: /\n');
    expect(api.get('X-Robots-Tag')).toBe('noindex, nofollow');
  });

  it('is unmarked and open to search engines once it is the real site', async () => {
    const page = await request(site()).get('/meals');
    const robots = await request(site()).get('/robots.txt');

    expect(page.text).not.toContain('nk-preview');
    expect(page.get('X-Robots-Tag')).toBeUndefined();
    expect(robots.text).toBe('User-agent: *\nAllow: /\n');
  });
});

describe('development and tests', () => {
  it('serve no website from the API', async () => {
    expect((await request(createApp()).get('/meals')).status).toBe(404);
  });
});
