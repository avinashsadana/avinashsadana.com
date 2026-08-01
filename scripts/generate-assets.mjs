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

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}"/>

  ${mark(78, 62, 118, INK)}

  <text x="82" y="300" font-family="${SERIF}" font-size="96" font-weight="500" fill="${INK}">avinash <tspan fill="${SOFT}">sadana</tspan></text>

  <rect x="84" y="346" width="92" height="3" fill="${GOLD}"/>

  <text x="82" y="416" font-family="${SERIF}" font-size="34" fill="${INK}">Supply chain and operations, built on the</text>
  <text x="82" y="464" font-family="${SERIF}" font-size="34" fill="${INK}">discipline of endurance sport.</text>

  <text x="82" y="556" font-family="${MONO}" font-size="21" letter-spacing="2.4" fill="${SOFT}">AVINASHSADANA.COM</text>
  <text x="1118" y="556" text-anchor="end" font-family="${MONO}" font-size="21" letter-spacing="2.4" fill="${SOFT}">MBA · SUPPLY CHAIN · ULTRA-CYCLIST</text>
</svg>`;

const appleIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="${PAPER}"/>
  ${mark(26, 26, 128, INK, 7)}
</svg>`;

const faviconSvg = readFileSync('public/favicon.svg', 'utf8');

const targets = [
  { svg: ogSvg, out: 'public/og.png', width: 1200 },
  { svg: appleIconSvg, out: 'public/apple-touch-icon.png', width: 180 },
  { svg: faviconSvg, out: 'public/favicon-96.png', width: 96 },
];

for (const { svg, out, width } of targets) {
  const buffer = await sharp(Buffer.from(svg), { density: 300 })
    .resize({ width })
    .png({ compressionLevel: 9 })
    .toBuffer();
  writeFileSync(out, buffer);
  console.log(`wrote ${out} (${(buffer.length / 1024).toFixed(1)} kB)`);
}
