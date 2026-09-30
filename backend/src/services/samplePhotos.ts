import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// The sample meals' photos ship with the app: free-license stock photos (see prisma/sample-photos/CREDITS.md).

/** backend/prisma/sample-photos, found relative to this file (the same depth from src/ and from dist/). */
export const SAMPLE_PHOTOS_DIR = fileURLToPath(new URL('../../prisma/sample-photos', import.meta.url));

/** A fixed file name shaped like an uploaded photo's, so a sample meal's photo passes isUploadedMealPhotoUrl. */
export function samplePhotoId(mealName: string): string {
  const hex = createHash('sha256').update(`neighbors-kitchen sample photo: ${mealName}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export const samplePhotoUrl = (mealName: string) => `/uploads/meals/${samplePhotoId(mealName)}.webp`;
