import { copyFile, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const output = path.resolve(root, process.argv[2] || 'dist');

const fixedRootFiles = [
  'index.html',
  'basketball.html',
  'basketball-supa.js',
  'basketball-sw.js',
  'basketball.manifest.json',
  'robots.txt',
  'sitemap.xml',
  '_redirects',
  '404.html'
];

const rootEntries = await readdir(root);
const runtimeModules = rootEntries
  .filter((name) => /^courtcall-[a-z0-9-]+\.(?:css|js)$/.test(name))
  .sort();
const sourceFiles = [...fixedRootFiles, ...runtimeModules];

const assetPattern = /(?:\.\/)?((?:assets|icons)\/[A-Za-z0-9_.\/-]+\.(?:jpg|png|svg|webp|mp4|webm))/g;
const publicFiles = new Set(sourceFiles);

for (const file of sourceFiles) {
  const body = await readFile(path.join(root, file), 'utf8');
  for (const match of body.matchAll(assetPattern)) publicFiles.add(match[1]);
}

const missing = [];
for (const file of publicFiles) {
  try {
    const info = await stat(path.join(root, file));
    if (!info.isFile() || info.size === 0) missing.push(file);
  } catch {
    missing.push(file);
  }
}
if (missing.length) {
  throw new Error(`Missing or empty production assets:\n${missing.join('\n')}`);
}

await rm(output, { recursive: true, force: true });
for (const file of [...publicFiles].sort()) {
  const target = path.join(output, file);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(root, file), target);
}

const forbidden = /(?:^|\/)(?:tests|tools|supabase|\.github)(?:\/|$)|\.(?:sql|zip|md)$/i;
const leaked = [...publicFiles].filter((file) => forbidden.test(file));
if (leaked.length) throw new Error(`Private files selected for deployment:\n${leaked.join('\n')}`);

console.log(`Built ${publicFiles.size} production files in ${path.relative(root, output) || '.'}.`);
