import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_DIMENSION = 1600;
const MEAL_PHOTO_FOLDER = 'meals';
const MEAL_PHOTO_URL = /^\/uploads\/meals\/[0-9a-f-]{36}\.webp$/;

/** True for addresses produced by saveMealPhoto. */
export function isUploadedMealPhotoUrl(url: string): boolean {
  return MEAL_PHOTO_URL.test(url);
}

/**
 * Stores a meal photo as a WebP no larger than 1600px on its longest side and returns its URL.
 * Re-encoding drops all hidden photo details (EXIF), including the GPS location phones record.
 */
export async function saveMealPhoto(file: Buffer): Promise<string> {
  const format = await sharp(file)
    .metadata()
    .then((metadata) => metadata.format, () => undefined);
  if (!format || !ACCEPTED_FORMATS.has(format)) {
    throw new AppError(422, 'INVALID_IMAGE', 'Please upload a JPG, PNG or WebP photo');
  }

  const fileName = `${randomUUID()}.webp`;
  const folder = path.join(env.UPLOAD_DIR, MEAL_PHOTO_FOLDER);
  await mkdir(folder, { recursive: true });
  await sharp(file)
    .rotate() // apply the phone's orientation before the metadata is dropped
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(path.join(folder, fileName));

  return `/uploads/${MEAL_PHOTO_FOLDER}/${fileName}`;
}
