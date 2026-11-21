// Derives web crops from the supplied RAW raster logo (public/brand/maison-surge-logo-source.png).
// Temporary until an approved vector exists (docs/ASSET_GAPS.md A-01/A-02).
import sharp from "sharp";
const src = "public/brand/maison-surge-logo-source.png";
const trim = { threshold: 40 };
await sharp(src).flatten({ background: "#ffffff" }).trim(trim).png().toFile("public/brand/maison-surge-signature.png");
const crop = await sharp(src).flatten({ background: "#ffffff" }).extract({ left: 300, top: 300, width: 680, height: 500 }).png().toBuffer();
await sharp(crop).trim(trim).png().toFile("public/brand/maison-surge-raven.png");
const r = await sharp("public/brand/maison-surge-raven.png").metadata();
const s = await sharp("public/brand/maison-surge-signature.png").metadata();
console.log("raven", r.width, r.height, "signature", s.width, s.height);
await sharp("public/brand/maison-surge-raven.png").resize(256, 256, { fit: "contain", background: "#E5DECF" }).png().toFile("src/app/icon.png");

// True transparency: alpha derived from darkness of the white-background crop.
async function transparent(input, output, rgb) {
  const { data, info } = await sharp(input).flatten({ background: "#ffffff" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < data.length; i++) {
    const a = Math.max(0, Math.min(255, Math.round(((255 - data[i]) / 255) * 1.15 * 255)));
    out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = a;
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(output);
}
await transparent("public/brand/maison-surge-raven.png", "public/brand/maison-surge-raven-dark.png", [0x2b, 0x2e, 0x22]);
await transparent("public/brand/maison-surge-raven.png", "public/brand/maison-surge-raven-light.png", [0xe5, 0xde, 0xcf]);
await sharp("public/brand/maison-surge-raven-light.png").resize(220, 220, { fit: "contain", background: "#00000000" }).extend({ top: 18, bottom: 18, left: 18, right: 18, background: "#1A1A1A" }).flatten({ background: "#1A1A1A" }).png().toFile("src/app/icon.png");
