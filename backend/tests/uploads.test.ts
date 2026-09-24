import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { API, bearer, signUp, signUpChefWithKitchen } from './helpers.js';
import { testEnv } from './testEnv.js';

const app = createApp();

function photo(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: '#e07a5f' } }).png().toBuffer();
}

function upload(accessToken: string, file: Buffer, filename = 'dinner.png') {
  return request(app).post(`${API}/uploads/meal-photo`).set(bearer(accessToken)).attach('photo', file, filename);
}

describe('POST /uploads/meal-photo', () => {
  it('saves a resized WebP copy of the photo and returns its address', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await upload(chef.accessToken, await photo(2400, 1200));

    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/meals\/[0-9a-f-]{36}\.webp$/);
    const saved = path.join(testEnv.UPLOAD_DIR, res.body.data.url.replace('/uploads/', ''));
    expect(existsSync(saved)).toBe(true);
    const metadata = await sharp(saved).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 1600, height: 800 });

    const served = await request(app).get(res.body.data.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
  });

  it('removes hidden photo details, such as where the photo was taken', async () => {
    const chef = await signUpChefWithKitchen(app);
    const withDetails = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#81b29a' } })
      .jpeg()
      .withExif({ IFD0: { Artist: 'Home cook', ImageDescription: '742 Evergreen Terrace' } })
      .toBuffer();
    expect((await sharp(withDetails).metadata()).exif).toBeDefined();

    const res = await upload(chef.accessToken, withDetails, 'dinner.jpg');

    const saved = path.join(testEnv.UPLOAD_DIR, res.body.data.url.replace('/uploads/', ''));
    expect((await sharp(saved).metadata()).exif).toBeUndefined();
  });

  it('rejects files that are not photos', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await upload(chef.accessToken, Buffer.from('definitely not a picture'), 'dinner.png');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('rejects photos larger than 5 MB', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await upload(chef.accessToken, Buffer.alloc(5 * 1024 * 1024 + 1), 'huge.png');

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('asks for a photo when none was sent', async () => {
    const chef = await signUpChefWithKitchen(app);

    const res = await request(app).post(`${API}/uploads/meal-photo`).set(bearer(chef.accessToken));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NO_FILE');
  });

  it('is only for chefs', async () => {
    const customer = await signUp(app, 'CUSTOMER');

    const res = await upload(customer.accessToken, await photo(100, 100));

    expect(res.status).toBe(403);
  });
});
