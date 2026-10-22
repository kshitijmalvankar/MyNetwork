// Generates the favicon, Apple touch icon and install icons from one SVG mark
// (the "network" glyph in white on the brand color). Re-run after changing it:
//   node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const BRAND = "#c0482d"; // --brand in light mode, oklch(0.56 0.16 34)
const GLYPH = `
  <rect x="16" y="16" width="6" height="6" rx="1"/>
  <rect x="2" y="16" width="6" height="6" rx="1"/>
  <rect x="9" y="2" width="6" height="6" rx="1"/>
  <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/>
  <path d="M12 12V8"/>`;

/** A 512px square: `radius` rounds the corners, `glyph` is the mark's size in px. */
function svg({ radius, glyph }) {
  const scale = glyph / 24;
  const offset = (512 - glyph) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${radius}" fill="${BRAND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH}
  </g>
</svg>
`;
}

const png = (source, size) => sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

/** An .ico that wraps PNG images, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6 + images.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

const rounded = svg({ radius: 112, glyph: 288 });
// Maskable icons get cropped to a circle or squircle, so the mark stays inside the middle 80%.
const fullBleed = svg({ radius: 0, glyph: 240 });

mkdirSync("public/icons", { recursive: true });
writeFileSync("app/icon.svg", rounded);
writeFileSync("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded, size) })))));
writeFileSync("app/apple-icon.png", await png(fullBleed, 180));
writeFileSync("public/icons/icon-192.png", await png(rounded, 192));
writeFileSync("public/icons/icon-512.png", await png(rounded, 512));
writeFileSync("public/icons/maskable-512.png", await png(fullBleed, 512));
console.log("Icons written to app/ and public/icons/");
