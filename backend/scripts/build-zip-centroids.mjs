// Builds data/zip-centroids.csv (zip,latitude,longitude) from the US Census Bureau's ZIP code (ZCTA) Gazetteer file.
// Source, public domain: https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip
// Usage: node scripts/build-zip-centroids.mjs path/to/2025_Gaz_zcta_national.txt
import fs from 'node:fs';
import path from 'node:path';

const source = process.argv[2];
if (!source) {
  console.error('Usage: node scripts/build-zip-centroids.mjs path/to/2025_Gaz_zcta_national.txt');
  process.exit(1);
}

const [header, ...rows] = fs.readFileSync(source, 'utf8').trim().split(/\r?\n/);
// The 2025 file separates columns with "|"; older years used tabs.
const delimiter = header.includes('|') ? '|' : '\t';
const columns = header.split(delimiter).map((name) => name.trim());
const zipIndex = columns.indexOf('GEOID');
const latIndex = columns.indexOf('INTPTLAT');
const lngIndex = columns.indexOf('INTPTLONG');
if ([zipIndex, latIndex, lngIndex].includes(-1)) throw new Error(`Unexpected columns: ${columns.join(', ')}`);

const lines = rows.map((row) => {
  const cells = row.split(delimiter).map((cell) => cell.trim());
  return `${cells[zipIndex]},${Number(cells[latIndex]).toFixed(4)},${Number(cells[lngIndex]).toFixed(4)}`;
});

const target = path.resolve(import.meta.dirname, '../data/zip-centroids.csv');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `zip,latitude,longitude\n${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} ZIP codes to ${target}`);
