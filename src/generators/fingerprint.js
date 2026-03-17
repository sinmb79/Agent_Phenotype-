'use strict';

/**
 * Fingerprint Generator — Phase 1
 * Deterministically generates a unique SVG visual fingerprint for an AI agent.
 *
 * Usage:
 *   const { generateFingerprint } = require('./fingerprint');
 *   const svg = generateFingerprint('agent-001', '2024-01-15T08:30:00Z', 'openai');
 */

const GRID  = 21;   // cells across / down
const CELL  = 10;   // px per cell
const PAD   = 14;   // px padding around grid
const TOTAL = GRID * CELL + PAD * 2;  // total canvas width/height

// ── Hash & PRNG ───────────────────────────────────────────────────────────────

/** FNV-1a 32-bit hash — fast, good avalanche, pure JS. */
function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h;
}

/**
 * Derive a deterministic 32-bit seed from the three identity fields.
 * Null-bytes separate fields to prevent collisions across boundaries.
 */
function computeSeed(agentId, createdAt, platform) {
  return fnv1a32(`${agentId}\0${createdAt}\0${platform}`);
}

/** xorshift32 — seeded PRNG returning floats in [0, 1). */
function makePRNG(seed) {
  let s = (seed >>> 0) || 0xcafebabe;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

// ── Grid ──────────────────────────────────────────────────────────────────────

/** Paint the classic QR-style 7×7 finder square at (r0, c0). */
function drawFinder(grid, r0, c0) {
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const outer = r === 0 || r === 6 || c === 0 || c === 6;
      const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      grid[r0 + r][c0 + c] = (outer || inner) ? 1 : 0;
    }
  }
}

/** Mark a rectangular zone as reserved (skipped during data fill). */
function reserve(res, r0, c0, rows, cols) {
  for (let r = r0; r < r0 + rows; r++)
    for (let c = c0; c < c0 + cols; c++)
      res[r][c] = 1;
}

function buildGrid(rand) {
  const grid = Array.from({ length: GRID }, () => new Uint8Array(GRID));
  const res  = Array.from({ length: GRID }, () => new Uint8Array(GRID));

  // Three finder patterns (top-left, top-right, bottom-left) + 1-cell separators
  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, GRID - 7);
  drawFinder(grid, GRID - 7, 0);
  reserve(res, 0, 0,        8, 8);
  reserve(res, 0, GRID - 8, 8, 8);
  reserve(res, GRID - 8, 0, 8, 8);

  // Timing strips (row 6 / col 6 between finders — alternating dark/light)
  for (let i = 8; i < GRID - 8; i++) {
    const v = (i % 2 === 0) ? 1 : 0;
    grid[6][i] = v;
    grid[i][6] = v;
    res[6][i] = 1;
    res[i][6] = 1;
  }

  // Data cells — filled by PRNG
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!res[r][c]) {
        grid[r][c] = rand() < 0.5 ? 1 : 0;
      }
    }
  }

  return grid;
}

// ── Color theme ───────────────────────────────────────────────────────────────

function deriveTheme(seed) {
  const hue = seed % 360;
  const sat = 55 + ((seed >>  8) & 0x1f);  // 55–86 %
  const lum = 22 + ((seed >> 14) & 0x1f);  // 22–53 %
  return {
    dark : `hsl(${hue},${sat}%,${lum}%)`,
    bg   : `hsl(${hue},${Math.round(sat * 0.12)}%,97%)`,
    rim  : `hsl(${hue},${Math.round(sat * 0.3)}%,${lum + 30}%)`,
  };
}

// ── SVG renderer ──────────────────────────────────────────────────────────────

function renderSVG(grid, theme, agentId, createdAt, platform) {
  const rects = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (grid[r][c]) {
        const x = PAD + c * CELL;
        const y = PAD + r * CELL;
        rects.push(
          `<rect x="${x}" y="${y}" width="${CELL - 1}" height="${CELL - 1}" rx="1.5" fill="${theme.dark}"/>`
        );
      }
    }
  }

  const label    = `${agentId.slice(0, 12)} · ${createdAt.slice(0, 10)} · ${platform}`;
  const svgH     = TOTAL + 14;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `     width="${TOTAL}" height="${svgH}"`,
    `     viewBox="0 0 ${TOTAL} ${svgH}"`,
    `     role="img" aria-label="Fingerprint for ${agentId}">`,
    `  <title>Agent Fingerprint · ${agentId}</title>`,
    `  <rect width="${TOTAL}" height="${svgH}" rx="10" fill="${theme.bg}"/>`,
    `  <rect x="3" y="3" width="${TOTAL - 6}" height="${svgH - 6}" rx="8"`,
    `        fill="none" stroke="${theme.rim}" stroke-width="1.5"/>`,
    ...rects.map(r => `  ${r}`),
    `  <text x="${TOTAL / 2}" y="${svgH - 4}"`,
    `        text-anchor="middle" font-family="monospace" font-size="7.5"`,
    `        fill="${theme.dark}" opacity="0.55">${label}</text>`,
    `</svg>`,
  ].join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic SVG fingerprint for an AI agent.
 *
 * @param {string} agentId   - Unique agent identifier
 * @param {string} createdAt - ISO 8601 creation timestamp (e.g. "2024-01-15T08:30:00Z")
 * @param {string} platform  - Platform name (e.g. "openai", "anthropic", "google")
 * @returns {string} Complete SVG markup (inline-safe, no external deps)
 */
function generateFingerprint(agentId, createdAt, platform) {
  if (!agentId || !createdAt || !platform) {
    throw new Error('generateFingerprint requires agentId, createdAt, and platform');
  }
  const seed  = computeSeed(agentId, createdAt, platform);
  const rand  = makePRNG(seed);
  const grid  = buildGrid(rand);
  const theme = deriveTheme(seed);
  return renderSVG(grid, theme, agentId, createdAt, platform);
}

module.exports = { generateFingerprint, computeSeed };
