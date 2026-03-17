'use strict';

// Render 6 agents — all same role+platform — to prove visual diversity.

const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { generateIdentity } = require('../src/index');

const OUT = path.join(__dirname, '../output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

function svgToPng(svgStr, scale = 2) {
  const resvg = new Resvg(svgStr, { fitTo: { mode: 'zoom', value: scale }, font: { loadSystemFonts: false } });
  return resvg.render().asPng();
}

function stripSVG(s) { return s.replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''); }

const AGENTS = Array.from({ length: 6 }, (_, i) => ({
  id:          `anthropic-coder-${String(i + 1).padStart(3, '0')}`,
  role:        'CodeEngineer',
  personality: ['logical', 'precise', 'focused'],
  platform:    'anthropic',
  created_at:  `2024-0${(i % 9) + 1}-${String((i * 7 + 10) % 28 + 1).padStart(2,'0')}T09:00:00Z`,
  activity_log: { taskCount: [5, 40, 120, 280, 500, 850][i], taskTypes: ['code'], successRate: 0.75 + i * 0.04 },
}));

// Build a 3×2 grid composite
const CELL_W = 220, CELL_H = 240, GAP = 16, PAD = 20, COLS = 3, ROWS = 2;
const TITLE_H = 48;
const totalW = PAD * 2 + COLS * CELL_W + (COLS - 1) * GAP;
const totalH = TITLE_H + PAD + ROWS * CELL_H + (ROWS - 1) * GAP + PAD;

let cells = '';
AGENTS.forEach((agent, i) => {
  const identity = generateIdentity(agent);
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = PAD + col * (CELL_W + GAP);
  const y = TITLE_H + PAD + row * (CELL_H + GAP);

  // Show face only (most visually striking for diversity proof)
  cells += `
  <rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" rx="10" fill="#111118" stroke="#1e1e30" stroke-width="1"/>
  <svg x="${x + 0}" y="${y}" width="${CELL_W}" height="${CELL_H - 20}">
    ${stripSVG(identity.face)}
  </svg>
  <text x="${x + CELL_W/2}" y="${y + CELL_H - 6}" text-anchor="middle"
        font-family="monospace" font-size="8" fill="#444466">${identity.display_name}</text>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="#0a0a10"/>
  <text x="${totalW/2}" y="26" text-anchor="middle"
        font-family="'Segoe UI',system-ui,sans-serif" font-size="15" font-weight="600"
        fill="#f0f0f8">6 CodeEngineers — Same Role, Same Platform (Anthropic)</text>
  <text x="${totalW/2}" y="42" text-anchor="middle"
        font-family="monospace" font-size="9" fill="#444466">Every agent is visually unique</text>
  ${cells}
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'zoom', value: 2 }, font: { loadSystemFonts: false } }).render().asPng();
const out = path.join(OUT, 'diversity-proof.png');
fs.writeFileSync(out, png);
console.log(`✓  ${out}  (${Math.round(png.length/1024)} KB)`);
