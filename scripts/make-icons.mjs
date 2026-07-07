// One-shot icon generation: renders the favicon art to PWA PNGs via sharp.
// Run: node scripts/make-icons.mjs
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const art = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#0b1026"/>
  <g transform="translate(32 32) scale(${1 - pad}) translate(-32 -32)">
    <ellipse cx="32" cy="34" rx="22" ry="9" fill="none" stroke="#3a4a7a" stroke-width="1.5" transform="rotate(-18 32 34)"/>
    <circle cx="32" cy="34" r="10" fill="#e8b45a"/>
    <circle cx="28" cy="30" r="3.5" fill="#f5ce82"/>
    <circle cx="49" cy="24" r="2.2" fill="#e9ebf4"/>
  </g>
</svg>`;

const render = async (svg, size, file) => {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  await writeFile(new URL(`../public/${file}`, import.meta.url), png);
  console.log(`wrote public/${file}`);
};

await render(art(0), 192, 'icon-192.png');
await render(art(0), 512, 'icon-512.png');
await render(art(0.3), 512, 'icon-maskable-512.png'); // safe-zone inset for maskable
