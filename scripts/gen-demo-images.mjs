// Generates clearly-labelled DEMO placeholder artwork in /public/demo.
// These are NOT product photos; they exist only so the demo catalog renders.
// Real product photography must be uploaded from the admin panel.
import { mkdirSync, writeFileSync } from "node:fs";

const out = new URL("../public/demo/", import.meta.url);
mkdirSync(out, { recursive: true });

const C = { sand: "#E5DECF", olive: "#5A6248", forest: "#3A3F32", burgundy: "#7B2E36", ink: "#1A1A1A", paper: "#FBFAF7" };

// Minimal garment silhouettes (viewBox 0 0 400 500), drawn as simple outlines.
const shapes = {
  tisort: "M130 110 L170 92 Q200 112 230 92 L270 110 L320 160 L290 190 L270 172 L270 400 L130 400 L130 172 L110 190 L80 160 Z",
  polo: "M130 110 L172 92 L190 130 L200 112 L210 130 L228 92 L270 110 L320 165 L290 192 L270 175 L270 400 L130 400 L130 175 L110 192 L80 165 Z M192 130 L200 165 L208 130",
  sweatshirt: "M128 112 L172 94 Q200 110 228 94 L272 112 L330 260 L300 272 L270 190 L270 382 Q200 396 130 382 L130 190 L100 272 L70 260 Z",
  hoodie: "M150 120 Q200 50 250 120 L280 130 L332 262 L302 274 L272 196 L272 384 Q200 398 128 384 L128 196 L98 274 L68 262 L120 130 Z M170 128 Q200 170 230 128",
  kazak: "M134 112 L176 96 Q200 106 224 96 L266 112 L326 262 L298 274 L268 196 L268 386 L132 386 L132 196 L102 274 L74 262 Z M140 360 L260 360 M140 372 L260 372",
};

const label = (fg) =>
  `<g font-family="Montserrat, Arial, sans-serif" fill="${fg}" opacity="0.75"><text x="200" y="462" text-anchor="middle" font-size="13" letter-spacing="4">DEMO GÖRSEL · DEMO IMAGE</text></g>`;

function garment(shape, bg, stroke, fill) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="800" height="1000">
  <rect width="400" height="500" fill="${bg}"/>
  <path d="${shape}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>
  ${label(stroke)}
</svg>
`;
}

for (const [slug, d] of Object.entries(shapes)) {
  writeFileSync(new URL(`product-${slug}-1.svg`, out), garment(d, C.sand, C.forest, C.paper));
  writeFileSync(new URL(`product-${slug}-2.svg`, out), garment(d, C.olive, C.sand, C.forest));
  writeFileSync(new URL(`category-${slug}.svg`, out), garment(d, slug === "kazak" ? C.burgundy : C.forest, C.sand, "none"));
}

const wide = (bg, fg, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${C.ink}"/></linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <g stroke="${fg}" stroke-opacity="0.18" fill="none">
    <path d="M0 640 L1600 520"/><path d="M0 700 L1600 580"/><path d="M1100 0 L1100 900"/><path d="M1180 0 L1180 900"/>
  </g>
  <text x="1560" y="870" text-anchor="end" font-family="Montserrat, Arial, sans-serif" font-size="18" letter-spacing="6" fill="${fg}" opacity="0.7">${title}</text>
</svg>
`;
writeFileSync(new URL("hero.svg", out), wide(C.forest, C.sand, "DEMO GÖRSEL · DEMO IMAGE"));
writeFileSync(
  new URL("editorial.svg", out),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
  <rect width="800" height="1000" fill="${C.olive}"/>
  <rect x="80" y="80" width="640" height="840" fill="none" stroke="${C.sand}" stroke-opacity="0.4"/>
  <g stroke="${C.sand}" stroke-opacity="0.15">${Array.from({ length: 40 }, (_, i) => `<path d="M80 ${100 + i * 20} L720 ${100 + i * 20}"/>`).join("")}</g>
  <text x="400" y="960" text-anchor="middle" font-family="Montserrat, Arial, sans-serif" font-size="16" letter-spacing="5" fill="${C.sand}" opacity="0.8">DEMO GÖRSEL · DEMO IMAGE</text>
</svg>
`,
);
console.log("Demo images written to public/demo");
