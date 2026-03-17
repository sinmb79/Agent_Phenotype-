'use strict';

/**
 * Palm Line Generator — Phase 3
 * Deterministically generates an SVG palm that grows with agent activity history.
 *
 * New agent  → sparse, faint lines   (near-blank palm)
 * Veteran    → dense, thick lines    (complex, readable history)
 *
 * Usage:
 *   const { generatePalmLine } = require('./palmline');
 *   const svg = generatePalmLine('agent-001', {
 *     taskCount: 150, taskTypes: ['code','review'], totalDuration: 4800, successRate: 0.87
 *   });
 *
 * activitySummary schema:
 *   taskCount     {number}   Total completed tasks
 *   taskTypes     {string[]} Distinct task type names
 *   totalDuration {number}   Total active time in minutes
 *   successRate   {number}   0..1  (defaults to 0.75 if omitted)
 */

const W = 200, H = 280;

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
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

// ── Palm shape ────────────────────────────────────────────────────────────────
// Abstract palm silhouette — not anatomical, just clearly "a palm".
// Canvas: 200 × 280 px.  Palm spans roughly x:[36, 164], y:[40, 254].

const PALM_PATH = 'M 42,98 C 36,62 58,44 100,40 C 142,44 164,62 158,98 L 164,198 Q 160,252 100,254 Q 40,252 36,198 Z';

// Conservative bounding box used for line endpoint generation.
// Lines generated here will stay well inside the palm silhouette.
const B = { xMin: 52, xMax: 148, yMin: 68, yMax: 238 };

// ── Activity → visual parameters ──────────────────────────────────────────────

function activityToParams(s) {
  const tc = Math.max(0, s.taskCount    || 0);
  const sr = Math.min(1, Math.max(0, s.successRate ?? 0.75));
  const types = Array.isArray(s.taskTypes) ? s.taskTypes : [];

  return {
    lineCount  : Math.min(18, 2 + Math.floor(tc / 25)),
    thickness  : 0.6 + Math.min(tc / 180, 1.8),
    opacity    : 0.22 + Math.min(tc / 280, 0.62),
    curvature  : 0.3  + Math.min(tc / 400, 0.65),
    continuity : sr,
    typeCount  : types.length,
  };
}

// ── Line generation ───────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function makeLine(rand, params, index, total) {
  const { xMin, xMax, yMin, yMax } = B;
  const spanX = xMax - xMin;
  const spanY = yMax - yMin;
  const zone  = index / Math.max(total - 1, 1); // 0..1

  let x1, y1, x2, y2;

  if (zone < 0.33) {
    // Upper zone: left-to-right, slightly descending — "life lines"
    x1 = xMin + rand() * spanX * 0.25;
    y1 = yMin + zone * spanY * 0.5 + rand() * 18;
    x2 = xMax - rand() * spanX * 0.18;
    y2 = y1 + 24 + rand() * 58;
  } else if (zone < 0.66) {
    // Middle zone: diagonal — "work lines"
    x1 = xMin + rand() * spanX * 0.35;
    y1 = yMin + spanY * 0.22 + rand() * spanY * 0.3;
    x2 = xMin + spanX * 0.48 + rand() * spanX * 0.38;
    y2 = y1 + 32 + rand() * 76;
  } else {
    // Lower zone: shorter, more horizontal — "detail lines"
    x1 = xMin + rand() * spanX * 0.4;
    y1 = yMin + spanY * 0.52 + rand() * spanY * 0.3;
    x2 = x1 + spanX * 0.28 + rand() * spanX * 0.22;
    y2 = y1 + rand() * 46 - 12;
  }

  x1 = clamp(x1, xMin, xMax); y1 = clamp(y1, yMin, yMax);
  x2 = clamp(x2, xMin, xMax); y2 = clamp(y2, yMin, yMax);

  // Cubic bezier control points — curvature adds history-like complexity
  const cp1x = lerp(x1, x2, 0.33) + (rand() - 0.5) * params.curvature * 58;
  const cp1y = lerp(y1, y2, 0.33) + (rand() - 0.5) * params.curvature * 38;
  const cp2x = lerp(x1, x2, 0.66) + (rand() - 0.5) * params.curvature * 58;
  const cp2y = lerp(y1, y2, 0.66) + (rand() - 0.5) * params.curvature * 38;

  const f = v => v.toFixed(1);
  return `M ${f(x1)},${f(y1)} C ${f(cp1x)},${f(cp1y)} ${f(cp2x)},${f(cp2y)} ${f(x2)},${f(y2)}`;
}

// ── Colours ───────────────────────────────────────────────────────────────────

function lineColor(seed) {
  // Warm brown-red range — evokes aged skin / ink on paper
  const h = (seed % 55) + 12;
  const s = 22 + ((seed >>  8) & 0x1f);
  const l = 20 + ((seed >> 14) & 0x18);
  return `hsl(${h},${s}%,${l}%)`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic SVG palm line for an AI agent.
 *
 * @param {string} agentId
 * @param {object} activitySummary
 *   @param {number}   activitySummary.taskCount     - Total tasks completed
 *   @param {string[]} activitySummary.taskTypes     - List of task type names
 *   @param {number}   activitySummary.totalDuration - Total active time in minutes
 *   @param {number}   activitySummary.successRate   - 0..1
 * @returns {string} SVG markup string
 */
function generatePalmLine(agentId, activitySummary) {
  if (!agentId) throw new Error('generatePalmLine requires agentId');

  const summary = activitySummary || {};
  const seed    = computeSeed(agentId, summary);
  const rand    = makePRNG(seed);
  const params  = activityToParams(summary);
  const color   = lineColor(seed);

  const bgH     = (seed % 55) + 12;
  const bg      = `hsl(${bgH},6%,97%)`;
  const palmFill = `hsl(${bgH},14%,93%)`;
  const palmRim  = `hsl(${bgH},18%,82%)`;

  // Build clipPath ID unique per SVG (safe for multi-SVG pages)
  const clipId = `pc${(seed >>> 0).toString(16)}`;

  const lineEls = [];
  for (let i = 0; i < params.lineCount; i++) {
    const d  = makeLine(rand, params, i, params.lineCount);
    // Vary per-line opacity slightly for an organic feel
    const op = (params.opacity * (0.65 + 0.35 * (i % 3 === 0 ? params.continuity : 1))).toFixed(2);
    const sw = (params.thickness * (0.65 + 0.6 * rand())).toFixed(2);
    // Dashed lines for low-success stretches
    const dash = params.continuity < 0.5 && rand() < 0.4
      ? ` stroke-dasharray="${(4 + rand() * 4).toFixed(1)},${(3 + rand() * 3).toFixed(1)}"`
      : '';
    lineEls.push(
      `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" opacity="${op}"${dash}/>`
    );
  }

  const tc  = summary.taskCount ?? 0;
  const sr  = summary.successRate != null ? Math.round(summary.successRate * 100) : '?';
  const svgH = H + 14;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${svgH}"`,
    `     viewBox="0 0 ${W} ${svgH}" role="img" aria-label="Palm line for ${agentId}">`,
    `  <title>Agent Palm Line · ${agentId}</title>`,
    `  <defs>`,
    `    <clipPath id="${clipId}">`,
    `      <path d="${PALM_PATH}"/>`,
    `    </clipPath>`,
    `  </defs>`,
    `  <rect width="${W}" height="${svgH}" rx="10" fill="${bg}"/>`,
    `  <rect x="3" y="3" width="${W - 6}" height="${svgH - 6}" rx="8" fill="none" stroke="hsl(${bgH},14%,85%)" stroke-width="1.5"/>`,
    `  <path d="${PALM_PATH}" fill="${palmFill}" stroke="${palmRim}" stroke-width="1.5"/>`,
    `  <g clip-path="url(#${clipId})">`,
    ...lineEls.map(l => `    ${l}`),
    `  </g>`,
    `  <text x="${W / 2}" y="${svgH - 4}" text-anchor="middle" font-family="monospace"`,
    `        font-size="7.5" fill="${color}" opacity="0.55">${agentId.slice(0, 12)} · ${tc} tasks · ${sr}% success</text>`,
    `</svg>`,
  ].join('\n');
}

module.exports = { generatePalmLine, computeSeed };
