import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { samplePhotoId, samplePhotoUrl } from '../src/services/samplePhotos.js';
import { isUploadedMealPhotoUrl } from '../src/services/uploadService.js';

describe('sample meal photos', () => {
  it('have a fixed, upload-shaped address for each sample meal', () => {
    expect(samplePhotoId('Beef Pho')).toBe('62576e04-b770-84a1-e886-d668ce2521c1');
    expect(samplePhotoUrl('Chicken Enchilada Casserole')).toBe('/uploads/meals/24180d31-378c-c867-2a7f-a4e36d920cbe.webp');
    expect(isUploadedMealPhotoUrl(samplePhotoUrl('Beef Pho'))).toBe(true);
  });

  it('are served from the photos that ship with the app', async () => {
    const res = await request(createApp()).get('/uploads/meals/62576e04-b770-84a1-e886-d668ce2521c1.webp');

    expect(res.status).toBe(200);
    expect(res.get('Content-Type')).toBe('image/webp');
    expect(res.get('Cache-Control')).toBe('public, max-age=2592000, immutable');
  });
});
