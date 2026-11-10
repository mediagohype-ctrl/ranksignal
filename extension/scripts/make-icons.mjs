// Regenerates extension/icons/icon-{16,32,48,128}.png from the brand mark (public/brand/logo-mark.svg).
// Uses sharp, which the website already depends on. Run from the repo root: node extension/scripts/make-icons.mjs
import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const svg = await readFile(path.join(root, "public", "brand", "logo-mark.svg"));
const outDir = path.join(root, "extension", "icons");
await mkdir(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const file = path.join(outDir, `icon-${size}.png`);
  await sharp(svg, { density: Math.max(72, Math.ceil((72 * size) / 48) * 2) })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`wrote ${path.relative(root, file)}`);
}
