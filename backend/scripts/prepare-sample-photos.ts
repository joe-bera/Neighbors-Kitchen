// Turns downloaded stock photos into the sample meal photos the app ships (prisma/sample-photos).
//
//   npx tsx scripts/prepare-sample-photos.ts <folder with the downloads>
//
// The folder holds the downloaded files and sources.json, one entry per sample meal:
//   [{ "meal": "Beef Pho", "file": "beef-pho.jpg", "page": "https://unsplash.com/photos/...",
//      "photographer": "Name", "license": "Unsplash License" }]
// Each photo is turned upright, fitted within 1200 x 1200, saved as WebP without its hidden details (EXIF),
// and named with samplePhotoId(meal). CREDITS.md is written from sources.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SAMPLE_PHOTOS_DIR, samplePhotoId } from '../src/services/samplePhotos.js';

interface PhotoSource {
  meal: string;
  file: string;
  page: string;
  photographer: string;
  license: 'Unsplash License' | 'Pexels License';
}

const folder = process.argv[2];
if (!folder) throw new Error('Usage: npx tsx scripts/prepare-sample-photos.ts <folder with the downloads>');
const sources = JSON.parse(readFileSync(path.join(folder, 'sources.json'), 'utf8')) as PhotoSource[];

mkdirSync(SAMPLE_PHOTOS_DIR, { recursive: true });
for (const source of sources) {
  await sharp(path.join(folder, source.file))
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(path.join(SAMPLE_PHOTOS_DIR, `${samplePhotoId(source.meal)}.webp`));
}

const rows = sources.map(
  (source) => `| ${source.meal} | \`${samplePhotoId(source.meal)}.webp\` | [photo page](${source.page}) | ${source.photographer} | ${source.license} |`,
);
writeFileSync(
  path.join(SAMPLE_PHOTOS_DIR, 'CREDITS.md'),
  [
    '# Sample meal photos',
    '',
    'Free-license stock photos for the sample meals (this computer and the preview site). Food only, no people.',
    'Unsplash License: https://unsplash.com/license. Pexels License: https://www.pexels.com/license/',
    '',
    '| Meal | File | Source | Photographer | License |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n'),
);
console.log(`Prepared ${sources.length} photos in ${SAMPLE_PHOTOS_DIR}`);
