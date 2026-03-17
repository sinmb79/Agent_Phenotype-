'use strict';

/**
 * Palm Line Generator — v2  (robot hand / PCB circuit aesthetic)
 *
 * Renders a mechanical robot hand with circuit traces inside the palm.
 * Activity history drives trace density and complexity:
 *   New agent    → sparse traces, faint glow
 *   Veteran      → dense branching circuit network, bright traces
 *
 * Canvas: 200 × 294 px
 */

const W  = 200;
const SH = 294;   // SVG total height (incl. label row)

// Palm panel geometry
const PX = 36, PY = 90, PW = 128, PH = 152, PR = 8;   // x, y, w, h, corner-radius

// 4 finger rectangles [x, y, w, h, rx]
const FINGERS = [
  [40,  35, 24, 56, 4],   // index
  [68,  21, 24, 70, 4],   // middle (tallest)
  [96,  24, 24, 67, 4],   // ring
  [124, 37, 24, 54, 4],   // pinky
];

// Trace bounding box (inside palm)
const TX1 = PX + 10, TX2 = PX + PW - 10;
const TY1 = PY + 12, TY2 = PY + PH - 12;

// ── Hash & PRNG ───────────────────────────────────────────────────────────────

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h;
}

function computeSeed(agentId, activitySummary) {
  return fnv1a32(`${agentId}\0${JSON.stringify(activitySummary || {})}`);
}

function makePRNG(seed) {
  let s = (seed >>> 0) || 0xcafebabe;
  return function () {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return s >>> 0;
  };
}

// ── Color ─────────────────────────────────────────────────────────────────────

// Circuit trace hues — pulled from PCB / HUD palette
const CIRCUIT_HUES = [145, 170, 195, 212, 38, 28, 278, 320];

function traceHue(seed) {
  const base  = CIRCUIT_HUES[seed % CIRCUIT_HUES.length];
  const shift = ((seed >> 8) % 21) - 10;
  return ((base + shift) % 360 + 360) % 360;
}

// ── Activity → visual parameters ─────────────────────────────────────────────

function activityToParams(s) {
  const tc = Math.max(0, s.taskCount    || 0);
  const sr = Math.min(1, Math.max(0, s.successRate ?? 0.75));
  return {
    lineCount  : Math.min(18, 2 + Math.floor(tc / 25)),
    opacity    : 0.35 + Math.min(tc / 320, 0.60),
    thickness  : 0.9  + Math.min(tc / 220, 1.4),
    dotSize    : 1.5  + Math.min(tc / 400, 1.5),
    continuity : sr,
  };
}

// ── Circuit trace builder ─────────────────────────────────────────────────────

/**
 * Returns an L-shaped Manhattan path (PCB trace) within the palm bounds.
 * Alternates H-then-V vs V-then-H routing per trace index.
 */
function makeTrace(rng, index) {
  const spanX = TX2 - TX1;
  const spanY = TY2 - TY1;

  const x1 = TX1 + (rng() % spanX);
  const y1 = TY1 + (rng() % (spanY - 24));

  // Length varies: short traces on dense networks, longer on sparse
  const lenH = 18 + (rng() % 72);
  const lenV = 12 + (rng() % 56);

  const goRight = (rng() % 2) === 0;
  const goDown  = (rng() % 2) === 0;

  const x2 = Math.min(TX2, Math.max(TX1, goRight ? x1 + lenH : x1 - lenH));
  const y2 = Math.min(TY2, Math.max(TY1, goDown  ? y1 + lenV : y1 - lenV));

  const f = v => v.toFixed(1);

  if (index % 2 === 0) {
    // Horizontal first, then vertical
    return { d: `M ${f(x1)},${f(y1)} H ${f(x2)} V ${f(y2)}`, jx: x2, jy: y1 };
  } else {
    // Vertical first, then horizontal
    return { d: `M ${f(x1)},${f(y1)} V ${f(y2)} H ${f(x2)}`, jx: x1, jy: y2 };
  }
}

// ── SVG assembly ──────────────────────────────────────────────────────────────

function generatePalmLine(agentId, activitySummary) {
  if (!agentId) throw new Error('generatePalmLine requires agentId');

  const summary = activitySummary || {};
  const seed    = computeSeed(agentId, summary);
  const rng     = makePRNG(seed);
  const params  = activityToParams(summary);
  const h       = traceHue(seed);

  // Color palette
  const traceColor  = `hsl(${h},72%,55%)`;
  const traceGlow   = `hsl(${h},72%,68%)`;
  const metalDark   = `hsl(${h},14%,12%)`;
  const metalMid    = `hsl(${h},12%,16%)`;
  const metalEdge   = `hsl(${h},18%,22%)`;
  const gradId      = `pg${(seed & 0xffff).toString(16).padStart(4, '0')}`;
  const clipId      = `pc${(seed & 0xffff).toString(16).padStart(4, '0')}`;

  // Gradient for metallic palm
  const defs = `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="hsl(${h},16%,18%)"/>
      <stop offset="50%"  stop-color="${metalMid}"/>
      <stop offset="100%" stop-color="hsl(${h},14%,9%)"/>
    </linearGradient>
    <clipPath id="${clipId}">
      <rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="${PR}"/>
    </clipPath>
  </defs>`;

  // Background
  const bg = `<rect width="${W}" height="${SH}" fill="#070710"/>`;

  // Fingers
  let fingerEls = '';
  FINGERS.forEach(([fx, fy, fw, fh, frx]) => {
    fingerEls += `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="${frx}" `
               + `fill="url(#${gradId})" stroke="${metalEdge}" stroke-width="1"/>`;
    // Joint lines on each finger (two horizontal seams)
    const jy1 = (fy + fh * 0.38).toFixed(1);
    const jy2 = (fy + fh * 0.68).toFixed(1);
    fingerEls += `<line x1="${fx + 3}" y1="${jy1}" x2="${fx + fw - 3}" y2="${jy1}" `
               + `stroke="${metalEdge}" stroke-width="0.7" opacity="0.7"/>`;
    fingerEls += `<line x1="${fx + 3}" y1="${jy2}" x2="${fx + fw - 3}" y2="${jy2}" `
               + `stroke="${metalEdge}" stroke-width="0.7" opacity="0.7"/>`;
  });

  // Palm body
  const palm = `<rect x="${PX}" y="${PY}" width="${PW}" height="${PH}" rx="${PR}" `
             + `fill="url(#${gradId})" stroke="${metalEdge}" stroke-width="1.2"/>`;

  // Constant bus line — always present (horizontal bar near top of palm)
  const busY  = (PY + 22).toFixed(1);
  const busEl = `<path d="M ${TX1},${busY} H ${TX2}" `
              + `fill="none" stroke="${traceColor}" stroke-width="1.2" opacity="0.45"/>`;

  // Circuit traces (activity-driven)
  const traceEls   = [];
  const junctionEls = [];

  for (let i = 0; i < params.lineCount; i++) {
    const { d, jx, jy } = makeTrace(rng, i);
    const op  = (params.opacity * (0.6 + 0.4 * ((rng() % 100) / 100))).toFixed(2);
    const sw  = (params.thickness * (0.7 + 0.5 * ((rng() % 100) / 100))).toFixed(2);
    const dash = params.continuity < 0.5 && (rng() % 3 === 0)
      ? ` stroke-dasharray="${3 + rng() % 5} ${2 + rng() % 3}"`
      : '';

    traceEls.push(
      `<path d="${d}" fill="none" stroke="${traceGlow}" stroke-width="${sw}"`
      + ` stroke-linecap="square" opacity="${op}"${dash}/>`
    );

    // Junction dot at the corner of each L-trace
    junctionEls.push(
      `<circle cx="${jx.toFixed(1)}" cy="${jy.toFixed(1)}" r="${params.dotSize.toFixed(1)}" `
      + `fill="${traceGlow}" opacity="${op}"/>`
    );
  }

  const tc = summary.taskCount ?? 0;
  const sr = summary.successRate != null ? Math.round(summary.successRate * 100) : '?';
  const label = `<text x="${W / 2}" y="${SH - 6}" text-anchor="middle" font-family="monospace" `
              + `font-size="7.5" fill="${traceColor}" opacity="0.5">`
              + `${agentId.slice(0, 12)} · ${tc} tasks · ${sr}% success</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SH}"`,
    `     viewBox="0 0 ${W} ${SH}" role="img" aria-label="Palm line for ${agentId}">`,
    `  <title>Agent Palm Line · ${agentId}</title>`,
    `  ${defs}`,
    `  ${bg}`,
    `  ${fingerEls}`,
    `  ${palm}`,
    `  <g clip-path="url(#${clipId})">`,
    `    ${busEl}`,
    ...traceEls.map(l => `    ${l}`),
    ...junctionEls.map(c => `    ${c}`),
    `  </g>`,
    `  ${label}`,
    `</svg>`,
  ].join('\n');
}

module.exports = { generatePalmLine, computeSeed };
