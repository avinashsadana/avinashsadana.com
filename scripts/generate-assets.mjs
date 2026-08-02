/**
 * Generates the raster brand assets from SVG sources, using the logo system in
 * private/avinash-logo-presentation.html.
 *
 * These are committed to the repo rather than generated during the Vercel build
 * on purpose: text in an SVG is rendered using fonts available to the machine
 * doing the rasterising, and the build container does not have the same fonts
 * as a Mac. Generating locally and committing the PNGs means what you review is
 * exactly what ships.
 *
 * Run with: npm run assets
 */
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const INK = '#22252A';
const GOLD = '#C08A2E';
const PAPER = '#F7F6F3';
const SOFT = '#7A7E85';

// Fonts referenced here must exist on the machine running this script.
// Fraunces is not a system font, so the OG card uses the closest system serif —
// Iowan/Palatino share Fraunces' warm, high-contrast character.
const SERIF = 'Iowan Old Style, Palatino, Georgia, serif';
const MONO = 'Menlo, Monaco, monospace';

/** The mark: one unbroken stroke, gold terminal dot. */
const mark = (x, y, size, stroke, dotRadius = 6) => {
  const scale = size / 120;
  return `<g transform="translate(${x} ${y}) scale(${scale})">
    <path d="M24,96 L44,24 L64,96 C34,96 34,66 64,66 C94,66 94,36 64,36"
          fill="none" stroke="${stroke}" stroke-width="10"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="64" cy="36" r="${dotRadius}" fill="${GOLD}"/>
  </g>`;
};

// Text sits left, portrait right. A face materially lifts click-through when
// the link is pasted into LinkedIn or WhatsApp.
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  ${mark(80, 74, 104, INK)}

  <text x="82" y="296" font-family="${SERIF}" font-size="84" font-weight="500" fill="${INK}">avinash <tspan fill="${SOFT}">sadana</tspan></text>

  <rect x="84" y="338" width="88" height="3" fill="${GOLD}"/>

  <text x="82" y="404" font-family="${SERIF}" font-size="31" fill="${INK}">Supply chain and operations, built</text>
  <text x="82" y="446" font-family="${SERIF}" font-size="31" fill="${INK}">on the discipline of endurance sport.</text>

  <text x="82" y="548" font-family="${MONO}" font-size="20" letter-spacing="2.2" fill="${SOFT}">AVINASHSADANA.COM</text>
</svg>`;

const PORTRAIT_SIZE = 330;
const PORTRAIT_X = 782;
const PORTRAIT_Y = 150;

/** Rounded-square mask, applied with dest-in so the corners become transparent. */
const portraitMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}">
     <rect width="${PORTRAIT_SIZE}" height="${PORTRAIT_SIZE}" rx="28" fill="#fff"/>
   </svg>`,
);

const portrait = await sharp('src/assets/avinash-sadana.jpg')
  .resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { fit: 'cover' })
  .composite([{ input: portraitMask, blend: 'dest-in' }])
  .png()
  .toBuffer();

const appleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="${PAPER}"/>
  ${mark(26, 26, 128, INK, 7)}
</svg>`;

const faviconSvg = readFileSync('public/favicon.svg', 'utf8');

const targets = [
  { svg: ogSvg, out: 'public/og.jpg', width: 1200, overlay: portrait, jpeg: true },
  { svg: appleIconSvg, out: 'public/apple-touch-icon.png', width: 180 },
  { svg: faviconSvg, out: 'public/favicon-96.png', width: 96 },
];

for (const { svg, out, width, overlay, jpeg } of targets) {
  let pipeline = sharp(Buffer.from(svg), { density: 300 }).resize({ width });
  if (overlay) {
    pipeline = pipeline.composite([{ input: overlay, left: PORTRAIT_X, top: PORTRAIT_Y }]);
  }
  // The share card contains a photograph, so JPEG rather than PNG — the same
  // image is ~350 kB as PNG and under 100 kB as JPEG.
  const buffer = jpeg
    ? await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer()
    : await pipeline.png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(out, buffer);
  console.log(`wrote ${out} (${(buffer.length / 1024).toFixed(1)} kB)`);
}

// A stable, unhashed copy for schema.org `image` and any external profile that
// needs a permanent URL. Astro's optimised builds use content-hashed filenames,
// which are unsuitable for a URL that must not change.
const profile = await sharp('src/assets/avinash-sadana.jpg')
  .resize(800, 800, { fit: 'cover' })
  .jpeg({ quality: 82, mozjpeg: true })
  .toBuffer();
writeFileSync('public/avinash-sadana.jpg', profile);
console.log(`wrote public/avinash-sadana.jpg (${(profile.length / 1024).toFixed(1)} kB)`);
