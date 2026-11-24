import { describe, expect, it } from "vitest";
import { imageKey, isR2Configured, r2Config, sniffImage } from "@/lib/storage/r2";

const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
const text = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("R2 image uploads", () => {
  it("is off until every setting is present, with an https public URL", () => {
    const env = { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET_NAME: "mywebrank", R2_PUBLIC_URL: "https://media.mywebrank.tech/" };
    expect(isR2Configured(env)).toBe(true);
    expect(r2Config(env)).toMatchObject({ bucket: "mywebrank", publicUrl: "https://media.mywebrank.tech", prefix: "uploads" });
    expect(isR2Configured({ ...env, R2_BUCKET_NAME: "" })).toBe(false);
    expect(isR2Configured({ ...env, R2_PUBLIC_URL: "http://insecure.example" })).toBe(false);
  });

  it("recognises images by their bytes and refuses everything else (including SVG)", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))?.type).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47))?.ext).toBe("png");
    expect(sniffImage(text("GIF89a__________"))?.ext).toBe("gif");
    expect(sniffImage(text("RIFF____WEBPVP8 "))?.ext).toBe("webp");
    expect(sniffImage(text("____ftypavif____"))?.ext).toBe("avif");
    expect(sniffImage(text('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffImage(text("%PDF-1.7 ......."))).toBeNull();
  });

  it("names files by date with a random part and a readable name", () => {
    const k = imageKey("uploads", "Best Cake Shop (Final).JPG", "jpg", new Date("2026-11-24T10:00:00Z"), "a1b2c3d4");
    expect(k).toBe("uploads/blog/2026/11/a1b2c3d4-best-cake-shop-final.jpg");
    expect(imageKey("uploads", "###.png", "png", new Date("2026-01-05T00:00:00Z"), "ff")).toBe("uploads/blog/2026/01/ff-image.png");
  });
});
