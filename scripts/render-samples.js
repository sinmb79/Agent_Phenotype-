'use strict';

/**
 * Render sample agent identities as PNG images.
 * Output: output/<agentId>-identity.png  (fingerprint + face + palm, side by side)
 */

const fs   = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { generateIdentity } = require('../src/index');

const OUT = path.join(__dirname, '../output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

// ── Sample agents ─────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id:          'codex-coder-v1',
    role:        'CodeEngineer',
    personality: ['logical', 'precise', 'focused'],
    platform:    'anthropic',
    created_at:  '2024-01-10T09:00:00Z',
    activity_log: { taskCount: 8,   taskTypes: ['code'],                              totalDuration: 120,   successRate: 0.88 },
  },
  {
    id:          'data-sentinel-v2',
    role:        'DataAnalyst',
    personality: ['analytical', 'curious', 'systematic'],
    platform:    'openai',
    created_at:  '2023-08-15T14:30:00Z',
    activity_log: { taskCount: 187, taskTypes: ['analysis', 'research', 'report'],    totalDuration: 4820,  successRate: 0.79 },
  },
  {
    id:          'creative-weaver-v3',
    role:        'CreativeWriter',
    personality: ['creative', 'expressive', 'warm', 'playful'],
    platform:    'google',
    created_at:  '2023-03-01T08:00:00Z',
    activity_log: { taskCount: 634, taskTypes: ['write', 'edit', 'design', 'ideate'], totalDuration: 18200, successRate: 0.91 },
  },
];

// ── SVG → PNG buffer ──────────────────────────────────────────────────────────

function svgToPng(svgStr, scale = 2) {
  const resvg = new Resvg(svgStr, {
    fitTo: { mode: 'zoom', value: scale },
    font:  { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

// ── Build composite SVG: fingerprint | face | palmline ────────────────────────
// Wraps the three SVGs into a single canvas with dark background + labels.

function buildCompositeSVG(identity, agent) {
  // Individual dimensions (from generator constants)
  const FP_W  = 224,  FP_H  = 238;   // fingerprint  21*10+28+14
  const FA_W  = 220,  FA_H  = 234;   // face
  const PL_W  = 200,  PL_H  = 294;   // palmline

  const PAD   = 24;
  const GAP   = 20;
  const LABEL = 22;   // height reserved for per-layer label above each panel
  const TITLE = 52;   // height reserved for agent title at top

  const totalW = PAD + FP_W + GAP + FA_W + GAP + PL_W + PAD;
  const panelH = Math.max(FP_H, FA_H, PL_H);
  const totalH = TITLE + LABEL + panelH + PAD;

  // Positions for each panel
  const fpX  = PAD;
  const faX  = PAD + FP_W + GAP;
  const plX  = PAD + FP_W + GAP + FA_W + GAP;
  const panY = TITLE + LABEL;

  // Embed each child SVG via foreignObject → use inline <svg> inside <svg>
  // We strip the outer <svg ...> tags and re-wrap with a <g transform="translate">
  function stripSVGTag(svgStr) {
    return svgStr
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>\s*$/, '');
  }

  const fpInner = stripSVGTag(identity.fingerprint);
  const faInner = stripSVGTag(identity.face);
  const plInner = stripSVGTag(identity.palmline);

  const ageLabel = agent.activity_log.taskCount < 20  ? 'New Agent'
                 : agent.activity_log.taskCount < 300 ? 'Mid-Career'
                 : 'Veteran';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <!-- background -->
  <rect width="${totalW}" height="${totalH}" fill="#0d0d12"/>
  <rect x="1" y="1" width="${totalW-2}" height="${totalH-2}" rx="14" fill="#0d0d12" stroke="#222238" stroke-width="1"/>

  <!-- agent header -->
  <text x="${totalW/2}" y="26" text-anchor="middle"
        font-family="'Segoe UI',system-ui,sans-serif" font-size="17" font-weight="600"
        fill="#f0f0f8" letter-spacing="-0.3">${identity.display_name}</text>
  <text x="${totalW/2}" y="44" text-anchor="middle"
        font-family="'Segoe UI',system-ui,sans-serif" font-size="11"
        fill="#55557a">${agent.id}  ·  ${agent.role}  ·  ${agent.platform}  ·  ${ageLabel}</text>

  <!-- layer labels -->
  <text x="${fpX + FP_W/2}" y="${TITLE + 14}" text-anchor="middle"
        font-family="monospace" font-size="9" fill="#444466" letter-spacing="0.08em">FINGERPRINT</text>
  <text x="${faX + FA_W/2}" y="${TITLE + 14}" text-anchor="middle"
        font-family="monospace" font-size="9" fill="#444466" letter-spacing="0.08em">FACE</text>
  <text x="${plX + PL_W/2}" y="${TITLE + 14}" text-anchor="middle"
        font-family="monospace" font-size="9" fill="#444466" letter-spacing="0.08em">PALM LINE</text>

  <!-- fingerprint panel -->
  <svg x="${fpX}" y="${panY}" width="${FP_W}" height="${FP_H}">
    ${fpInner}
  </svg>

  <!-- face panel -->
  <svg x="${faX}" y="${panY}" width="${FA_W}" height="${FA_H}">
    ${faInner}
  </svg>

  <!-- palm line panel -->
  <svg x="${plX}" y="${panY}" width="${PL_W}" height="${PL_H}">
    ${plInner}
  </svg>
</svg>`;
}

// ── Render all agents ─────────────────────────────────────────────────────────

for (const agent of AGENTS) {
  process.stdout.write(`Rendering ${agent.id} ... `);

  const identity = generateIdentity(agent);
  const composite = buildCompositeSVG(identity, agent);

  const png = svgToPng(composite, 2);
  const outPath = path.join(OUT, `${agent.id}.png`);
  fs.writeFileSync(outPath, png);

  console.log(`✓  ${outPath}  (${Math.round(png.length / 1024)} KB)`);
}

console.log('\nDone.');
