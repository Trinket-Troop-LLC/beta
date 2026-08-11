// One-off generator for PWA manifest icons, run via `node scripts/generate-pwa-icons.mjs`.
// Source: app/icon.png (512x512, transparent). Re-run if that source image changes.
import sharp from "sharp";

const SOURCE = "app/icon.png";
const CREAM_BG = "#faf7f0";

await sharp(SOURCE).resize(192, 192).png().toFile("public/icons/icon-192.png");

// Maskable icon: Android's adaptive-icon mask crops anything outside a centered
// ~80%-diameter circle, and this logo's linework touches the edges of the source
// canvas. Pad it onto a solid background at ~58% scale so it survives masking.
const logo = await sharp(SOURCE).resize(300, 300).toBuffer();
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: CREAM_BG,
  },
})
  .composite([{ input: logo, gravity: "center" }])
  .png()
  .toFile("public/icons/maskable-icon-512.png");

console.log("Generated public/icons/icon-192.png and public/icons/maskable-icon-512.png");
