// Regenerates the logo files in public/ from src/components/brand/logo-geometry.ts:
//   public/favicon.ico (16/32/48), public/brand/logo-mark.svg, logo-mark-{96,192,512}.png, logo-maskable-512.png
// Run after changing the logo:  npx tsx scripts/brand-assets.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { logoMarkSvg } from "../src/components/brand/logo-geometry";

const PUBLIC = join(process.cwd(), "public");
const png = (size: number, full = false) => sharp(Buffer.from(logoMarkSvg(size, { full }))).resize(size, size).png().toBuffer();

/** ICO with embedded PNG images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(img.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

async function main() {
  mkdirSync(join(PUBLIC, "brand"), { recursive: true });
  writeFileSync(join(PUBLIC, "brand", "logo-mark.svg"), logoMarkSvg(48));
  for (const s of [96, 192, 512]) writeFileSync(join(PUBLIC, "brand", `logo-mark-${s}.png`), await png(s));
  writeFileSync(join(PUBLIC, "brand", "logo-maskable-512.png"), await png(512, true));
  const sizes = [16, 32, 48];
  writeFileSync(join(PUBLIC, "favicon.ico"), ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })))));
  console.log("Logo files written to public/ and public/brand/");
}

void main();
