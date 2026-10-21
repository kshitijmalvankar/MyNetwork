// Generates synthetic business-card images (all people and companies are
// fictional) plus the expected extraction for each, used by the extraction
// eval and end-to-end tests: node scripts/make-fixture-cards.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import QRCode from "qrcode";
import sharp from "sharp";

const OUT = "fixtures/cards";
const W = 1050;
const H = 600;
mkdirSync(OUT, { recursive: true });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** text(x, y, string, size, opts) → <text> element */
function t(x, y, s, size, { weight = 400, fill = "#1f2937", family = "Helvetica Neue, Helvetica, Arial", anchor = "start", spacing = 0 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${esc(s)}</text>`;
}

function svg(body, bg = "#ffffff") {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`);
}

async function qrSvgGroup(text, x, y, size) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  let rects = "";
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) rects += `<rect x="${x + c * cell}" y="${y + r * cell}" width="${cell + 0.3}" height="${cell + 0.3}"/>`;
  return `<rect x="${x - 10}" y="${y - 10}" width="${size + 20}" height="${size + 20}" fill="#fff"/><g fill="#111">${rects}</g>`;
}

/** Make a flat card look like a phone photo: tilt, background, shadow, blur, JPEG. */
async function asPhoto(png, { angle = -4, bg = "#5b4636" } = {}) {
  const rotated = await sharp(png).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(rotated).metadata();
  const pad = 140;
  const canvasW = meta.width + pad * 2;
  const canvasH = meta.height + pad * 2;
  const shadow = await sharp(rotated).ensureAlpha().modulate({ brightness: 0 }).blur(18).png().toBuffer();
  return sharp({ create: { width: canvasW, height: canvasH, channels: 3, background: bg } })
    .composite([
      { input: shadow, left: pad + 14, top: pad + 18, blend: "multiply" },
      { input: rotated, left: pad, top: pad },
    ])
    .modulate({ brightness: 0.93 })
    .blur(0.8)
    .jpeg({ quality: 72 })
    .toBuffer();
}

const cards = [];

// 1. Clean English card with a vCard QR code
{
  const vcard = "BEGIN:VCARD\nVERSION:3.0\nN:Rao;Ananya\nFN:Ananya Rao\nORG:XYZ Technologies\nTITLE:Senior Software Engineer\nEMAIL:ananya.rao@xyztech.example\nTEL:+14155550123\nURL:https://xyztech.example\nEND:VCARD";
  const body =
    `<rect x="0" y="0" width="16" height="${H}" fill="#4f46e5"/>` +
    t(70, 120, "XYZ Technologies", 30, { weight: 700, fill: "#4f46e5" }) +
    t(70, 250, "Ananya Rao", 56, { weight: 700, fill: "#111827" }) +
    t(70, 300, "Senior Software Engineer", 30, { fill: "#4b5563" }) +
    t(70, 430, "ananya.rao@xyztech.example", 26) +
    t(70, 470, "+1 (415) 555-0123", 26) +
    t(70, 510, "xyztech.example", 26) +
    (await qrSvgGroup(vcard, 790, 330, 200));
  cards.push({
    id: "01-english-qr",
    front: await sharp(svg(body)).png().toBuffer(),
    expected: {
      fullName: "Ananya Rao",
      title: "Senior Software Engineer",
      company: "XYZ Technologies",
      emails: ["ananya.rao@xyztech.example"],
      phones: ["+14155550123"],
      website: "xyztech.example",
      roleFamily: "Engineering",
      seniority: "Senior",
      language: "en",
    },
  });
}

// 2. Same company, project manager, centred layout, photographed
{
  const body =
    t(W / 2, 110, "XYZ TECHNOLOGIES", 26, { weight: 700, anchor: "middle", spacing: 6, fill: "#0f172a" }) +
    `<line x1="425" y1="140" x2="625" y2="140" stroke="#cbd5e1" stroke-width="2"/>` +
    t(W / 2, 260, "Marcus Webb", 54, { weight: 600, anchor: "middle", fill: "#0f172a" }) +
    t(W / 2, 310, "Project Manager, Cloud Platform", 28, { anchor: "middle", fill: "#64748b" }) +
    t(W / 2, 430, "m.webb@xyztech.example  ·  +1 415 555 0188", 24, { anchor: "middle" }) +
    t(W / 2, 470, "500 Market Street, Suite 300, San Francisco, CA 94105", 22, { anchor: "middle", fill: "#475569" });
  cards.push({
    id: "02-english-photo",
    front: await asPhoto(await sharp(svg(body, "#fbfaf7")).png().toBuffer()),
    expected: {
      fullName: "Marcus Webb",
      title: "Project Manager, Cloud Platform",
      company: "XYZ Technologies",
      emails: ["m.webb@xyztech.example"],
      phones: ["+14155550188"],
      city: "San Francisco",
      country: "US",
      roleFamily: "Product",
      seniority: "Lead/Manager",
      language: "en",
    },
  });
}

// 3. Double-sided: logo front, details back
{
  const front =
    `<circle cx="${W / 2}" cy="230" r="90" fill="#0d9488"/>` +
    t(W / 2, 255, "N", 90, { weight: 700, anchor: "middle", fill: "#ffffff" }) +
    t(W / 2, 410, "NORTHWIND HEALTH", 40, { weight: 700, anchor: "middle", spacing: 4, fill: "#134e4a" }) +
    t(W / 2, 460, "Care that travels with you", 24, { anchor: "middle", fill: "#5f7f7c" });
  const back =
    t(80, 130, "Dr. Sofia Marquez", 48, { weight: 700, fill: "#134e4a" }) +
    t(80, 180, "Chief Medical Officer", 28, { fill: "#0f766e" }) +
    t(80, 330, "T  +44 20 7946 0321", 26) +
    t(80, 375, "M  +44 7700 900456", 26) +
    t(80, 420, "E  sofia.marquez@northwindhealth.example", 26) +
    t(80, 465, "W  northwindhealth.example", 26) +
    t(80, 530, "12 Harley Street, London W1G 9PG, United Kingdom", 22, { fill: "#475569" });
  cards.push({
    id: "03-double-sided",
    front: await sharp(svg(front, "#f0fdfa")).png().toBuffer(),
    back: await sharp(svg(back)).png().toBuffer(),
    expected: {
      fullName: "Sofia Marquez",
      title: "Chief Medical Officer",
      company: "Northwind Health",
      emails: ["sofia.marquez@northwindhealth.example"],
      phones: ["+442079460321", "+447700900456"],
      website: "northwindhealth.example",
      city: "London",
      country: "GB",
      roleFamily: "Healthcare",
      seniority: "C-level/Founder",
      industry: "Healthcare",
      language: "en",
    },
  });
}

// 4. Japanese card (kanji + romaji)
{
  const jp = "Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif";
  const body =
    t(70, 110, "株式会社さくらロボティクス", 30, { weight: 600, family: jp, fill: "#be123c" }) +
    t(70, 150, "Sakura Robotics Co., Ltd.", 22, { fill: "#9f1239" }) +
    t(70, 260, "営業部長", 28, { family: jp, fill: "#374151" }) +
    t(70, 330, "田中 健太", 60, { weight: 700, family: jp, fill: "#111827" }) +
    t(70, 375, "Kenta Tanaka  ·  Sales Director", 24, { fill: "#4b5563" }) +
    t(70, 470, "〒150-0002 東京都渋谷区渋谷2-21-1", 22, { family: jp }) +
    t(70, 510, "TEL 03-5555-0142   k.tanaka@sakura-robotics.example", 22, { family: jp });
  cards.push({
    id: "04-japanese",
    front: await sharp(svg(body)).png().toBuffer(),
    expected: {
      fullName: "Kenta Tanaka",
      nameNative: "田中 健太",
      title: "Sales Director",
      company: "Sakura Robotics Co., Ltd.",
      emails: ["k.tanaka@sakura-robotics.example"],
      phones: ["+81355550142"],
      city: "Tokyo",
      country: "JP",
      roleFamily: "Sales",
      seniority: "Director",
      language: "ja",
    },
  });
}

// 5. Bilingual Hindi / English
{
  const hi = "Kohinoor Devanagari, Devanagari Sangam MN, sans-serif";
  const body =
    `<rect x="0" y="${H - 18}" width="${W}" height="18" fill="#ea580c"/>` +
    t(70, 120, "प्रिया शर्मा", 50, { weight: 600, family: hi, fill: "#7c2d12" }) +
    t(70, 175, "Priya Sharma", 34, { weight: 600, fill: "#111827" }) +
    t(70, 220, "Founder & CEO", 26, { fill: "#4b5563" }) +
    t(70, 330, "Chai & Code Labs Pvt. Ltd.", 28, { weight: 600, fill: "#c2410c" }) +
    t(70, 420, "+91 98765 43210", 26) +
    t(70, 460, "priya@chaiandcode.example", 26) +
    t(70, 500, "Koramangala, Bengaluru 560034", 24, { fill: "#57534e" });
  cards.push({
    id: "05-hindi-bilingual",
    front: await sharp(svg(body, "#fffaf5")).png().toBuffer(),
    expected: {
      fullName: "Priya Sharma",
      nameNative: "प्रिया शर्मा",
      title: "Founder & CEO",
      company: "Chai & Code Labs Pvt. Ltd.",
      emails: ["priya@chaiandcode.example"],
      phones: ["+919876543210"],
      city: "Bengaluru",
      country: "IN",
      roleFamily: "Founder",
      seniority: "C-level/Founder",
      language: "en",
    },
  });
}

// 6. Dark, low-contrast designer card, photographed at an angle
{
  const body =
    t(980, 110, "LUMEN STUDIO", 24, { weight: 700, anchor: "end", spacing: 8, fill: "#a3a3a3" }) +
    t(80, 330, "Theo Laurent", 52, { weight: 300, fill: "#e5e5e5" }) +
    t(80, 380, "Lead Product Designer", 26, { fill: "#a3a3a3" }) +
    t(80, 500, "theo@lumenstudio.example", 24, { fill: "#d4d4d4" }) +
    t(80, 540, "+33 6 12 34 56 78  ·  lumenstudio.example", 24, { fill: "#d4d4d4" });
  cards.push({
    id: "06-dark-angled",
    front: await asPhoto(await sharp(svg(body, "#171717")).png().toBuffer(), { angle: 7, bg: "#d6d3d1" }),
    expected: {
      fullName: "Theo Laurent",
      title: "Lead Product Designer",
      company: "Lumen Studio",
      emails: ["theo@lumenstudio.example"],
      phones: ["+33612345678"],
      website: "lumenstudio.example",
      country: "FR",
      roleFamily: "Design",
      seniority: "Lead/Manager",
      language: "en",
    },
  });
}

for (const card of cards) {
  const ext = card.front[0] === 0xff ? "jpg" : "png";
  writeFileSync(`${OUT}/${card.id}-front.${ext}`, card.front);
  if (card.back) writeFileSync(`${OUT}/${card.id}-back.png`, card.back);
}
writeFileSync(
  `${OUT}/expected.json`,
  JSON.stringify(
    cards.map((c) => ({
      id: c.id,
      front: `${c.id}-front.${c.front[0] === 0xff ? "jpg" : "png"}`,
      back: c.back ? `${c.id}-back.png` : undefined,
      expected: c.expected,
    })),
    null,
    2,
  ) + "\n",
);
console.log(`Wrote ${cards.length} cards to ${OUT}/`);
