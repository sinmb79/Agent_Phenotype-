'use strict';

/**
 * Fingerprint Generator — v2  (human-like circular ridges)
 *
 * Generates a biometric-style circular fingerprint with:
 *   - Concentric elliptical ridge lines (whorl / loop / arch patterns)
 *   - Per-ridge breaks (ridge endings) for organic realism
 *   - Platform-family hue + per-agent ±25° shift
 *   - Core dot + delta landmark point
 */

const SIZE   = 238;
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const CLIP_R = 95;   // clip-circle radius

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

function computeSeed(agentId, createdAt, platform) {
  if (!agentId || !createdAt || !platform)
    throw new Error('generateFingerprint: agentId, createdAt, and platform are required');
  return fnv1a32(`${agentId}\0${createdAt}\0${platform}`);
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

const PLATFORM_HUE = {
  openai: 200, anthropic: 30, google: 140,
  mistral: 270, meta: 220, cohere: 160, groq: 350,
};

function platformHue(platform) {
  return PLATFORM_HUE[(platform || '').toLowerCase()] ?? 210;
}

// ── Ridge builder ─────────────────────────────────────────────────────────────

/**
 * Generate ridge parameters for one ring.
 * patType  0 = whorl  (near-circular, tight spiral feel)
 *          1 = loop   (ellipses tilted progressively to one side)
 *          2 = arch   (shallow flat arcs)
 */
function ridgeParams(i, count, patType, rng) {
  const t      = (i + 1) / count;
  const baseR  = 4 + i * (CLIP_R - 4) / count;

  let rx, ry, rotDeg;

  if (patType === 0) {
    // Whorl — near-circular with slight wobble
    rx     = baseR * (0.97 + (rng() % 7) / 100);
    ry     = baseR * (0.84 + (rng() % 14) / 100);
    rotDeg = (i * 17 + (rng() % 40)) % 360;
  } else if (patType === 1) {
    // Loop — progressively tilted
    rx     = baseR;
    ry     = baseR * (0.42 + t * 0.48);
    rotDeg = ((28 - i * 2) + (rng() % 12) - 6 + 720) % 360;
  } else {
    // Arch — flat, low curvature
    rx     = baseR;
    ry     = baseR * (0.20 + t * 0.28 + (rng() % 10) / 100);
    rotDeg = ((rng() % 20) - 10 + 360) % 360;
  }

  // Ridge endings — 0-2 breaks per ring
  const circumference = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
  const breaks        = rng() % 3;
  let dashAttr = '';
  if (breaks > 0) {
    const seg     = breaks * 2 + 1;
    const dashOn  = (circumference / seg * 0.80).toFixed(1);
    const dashOff = (circumference / seg * 0.20).toFixed(1);
    dashAttr = ` stroke-dasharray="${dashOn} ${dashOff}"`;
  }

  const strokeW = (0.65 + (1 - t) * 0.75).toFixed(2);
  const opacity = (0.48 + t * 0.42).toFixed(2);

  return { rx, ry, rotDeg, dashAttr, strokeW, opacity };
}

// ── Main generator ────────────────────────────────────────────────────────────

function generateFingerprint(agentId, createdAt, platform) {
  const seed = computeSeed(agentId, createdAt, platform);
  const rng  = makePRNG(seed);

  // Color
  const baseHue = platformHue(platform);
  const hShift  = (seed % 51) - 25;
  const h       = ((baseHue + hShift) % 360 + 360) % 360;

  // Pattern type
  const patType = seed % 3;  // 0=whorl, 1=loop, 2=arch

  // Core offset (slightly off-center for realism)
  const coreX = CX + ((rng() % 25) - 12);
  const coreY = CY + ((rng() % 21) - 10);

  const RIDGE_COUNT = 14 + (seed % 9);  // 14-22
  const clipId      = `fp${(seed & 0xffff).toString(16).padStart(4, '0')}`;

  // Build ridge SVG strings
  let ridges = '';
  for (let i = 0; i < RIDGE_COUNT; i++) {
    const { rx, ry, rotDeg, dashAttr, strokeW, opacity } =
      ridgeParams(i, RIDGE_COUNT, patType, rng);

    const cx  = coreX.toFixed(1);
    const cy  = coreY.toFixed(1);
    const rot = rotDeg.toFixed(1);

    ridges += `<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" `
            + `transform="rotate(${rot},${cx},${cy})" `
            + `fill="none" stroke="hsl(${h},40%,28%)" stroke-width="${strokeW}"`
            + `${dashAttr} opacity="${opacity}"/>\n    `;
  }

  // Core point
  const core = `<circle cx="${coreX.toFixed(1)}" cy="${coreY.toFixed(1)}" r="2.5" `
             + `fill="hsl(${h},42%,32%)" opacity="0.7"/>`;

  // Delta landmark
  const dx = (coreX + 22 + (rng() % 18)).toFixed(1);
  const dy = (coreY + (rng() % 20) - 10).toFixed(1);
  const delta = `<circle cx="${dx}" cy="${dy}" r="2" fill="hsl(${h},38%,30%)" opacity="0.45"/>`;

  // Subtle inner glow near core
  const glow = `<circle cx="${coreX.toFixed(1)}" cy="${coreY.toFixed(1)}" r="18" `
             + `fill="hsl(${h},30%,70%)" opacity="0.08"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <title>Agent fingerprint: ${agentId}</title>
  <defs>
    <clipPath id="${clipId}">
      <circle cx="${CX}" cy="${CY}" r="${CLIP_R}"/>
    </clipPath>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" fill="hsl(${h},8%,96%)"/>
  <circle cx="${CX}" cy="${CY}" r="${CLIP_R}" fill="hsl(${h},22%,93%)"/>
  <g clip-path="url(#${clipId})">
    ${glow}
    ${ridges}
    ${core}
    ${delta}
  </g>
  <circle cx="${CX}" cy="${CY}" r="${CLIP_R}" fill="none" stroke="hsl(${h},30%,60%)" stroke-width="1.5"/>
</svg>`;
}

module.exports = { generateFingerprint, computeSeed };
