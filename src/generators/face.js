'use strict';

/**
 * Face Generator — Phase 2
 * Deterministically generates a non-human geometric SVG face for an AI agent.
 * Agents are a new kind of entity — the visual language is abstract, not anatomical.
 *
 * Usage:
 *   const { generateFace } = require('./face');
 *   const svg = generateFace('agent-001', 'CodeEngineer', ['logical','precise'], 'anthropic');
 */

const W = 220, H = 220;
const CX = W / 2, CY = H / 2;

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

function computeSeed(agentId, role, personality, platform) {
  const pStr = Array.isArray(personality)
    ? [...personality].sort().join(',')
    : String(personality || '');
  return fnv1a32(`${agentId}\0${role}\0${pStr}\0${platform}`);
}

function makePRNG(seed) {
  let s = (seed >>> 0) || 0xcafebabe;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

// ── Base shape ─────────────────────────────────────────────────────────────────
// Role → geometric archetype. Agents are not human — shapes carry meaning.

function polyPoints(cx, cy, r, n, rotDeg) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i / n) + (rotDeg * Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function pickShape(role) {
  const r = role.toLowerCase();
  if (/cod|engineer|dev|build|tech/.test(r))    return { kind: 'hex',  n: 6, rot: 0     };
  if (/assist|help|support|chat|guide/.test(r)) return { kind: 'cir',  n: 0, rot: 0     };
  if (/analyt|research|data|scien/.test(r))     return { kind: 'dia',  n: 4, rot: 45    };
  if (/creat|design|art|writ/.test(r))          return { kind: 'oct',  n: 8, rot: 22.5  };
  // hash fallback
  return [
    { kind: 'hex',  n: 6, rot: 0     },
    { kind: 'oct',  n: 8, rot: 22.5  },
    { kind: 'pent', n: 5, rot: -90   },
    { kind: 'dia',  n: 4, rot: 45    },
    { kind: 'cir',  n: 0, rot: 0     },
  ][fnv1a32(role) % 5];
}

function shapeEl(sh, cx, cy, r, fill, stroke) {
  if (sh.kind === 'cir') {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
  }
  return `<polygon points="${polyPoints(cx, cy, r, sh.n, sh.rot)}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
}

function innerRingEl(sh, cx, cy, r, dark) {
  if (sh.kind === 'cir') {
    return `<circle cx="${cx}" cy="${cy}" r="${r - 9}" fill="none" stroke="${dark}" stroke-width="0.6" opacity="0.18"/>`;
  }
  return `<polygon points="${polyPoints(cx, cy, r - 9, sh.n, sh.rot)}" fill="none" stroke="${dark}" stroke-width="0.6" opacity="0.18"/>`;
}

// ── Colour palette ─────────────────────────────────────────────────────────────
// Platform sets a "colour family" (base hue ± 40°).
// Agent seed adds per-agent variation within that range so agents on the same
// platform look related but never identical.

const PLATFORM_HUE = {
  openai: 155, anthropic: 22, google: 210,
  mistral: 268, meta: 218, cohere: 42, groq: 178,
};

function palette(platform, seed) {
  const baseHue = PLATFORM_HUE[platform.toLowerCase()] ?? ((seed >>> 16) % 360);
  // Per-agent shift: –30 … +30 degrees within the platform family
  const shift = (seed % 61) - 30;
  const h = ((baseHue + shift) % 360 + 360) % 360;
  const s = 52 + ((seed >>>  8) & 0x1f);   // 52–83 %
  const l = 24 + ((seed >>> 14) & 0x1c);   // 24–51 %
  return { h, s, l };
}

// ── Eyes ───────────────────────────────────────────────────────────────────────
// Eye geometry = personality archetype. Two identical eyes signal symmetry.

function pickEyeStyle(traits) {
  const t = (traits || []).join(' ').toLowerCase();
  if (/logical|precise|struct|strict/.test(t)) return 'square';
  if (/curious|explor|learn|wonder/.test(t))   return 'diamond';
  if (/open|friend|warm|care/.test(t))         return 'circle';
  if (/assert|direct|focus|driven/.test(t))    return 'triangle';
  if (/calm|steady|patient|quiet/.test(t))     return 'slit';
  return 'circle';
}

function eyeEl(x, y, sz, style, color) {
  const h = sz / 2;
  const f = v => v.toFixed(1);
  switch (style) {
    case 'square':
      return `<rect x="${f(x-h)}" y="${f(y-h)}" width="${f(sz)}" height="${f(sz)}" rx="1" fill="${color}"/>`;
    case 'diamond':
      return `<polygon points="${f(x)},${f(y-sz*0.9)} ${f(x+sz*0.65)},${f(y)} ${f(x)},${f(y+sz*0.9)} ${f(x-sz*0.65)},${f(y)}" fill="${color}"/>`;
    case 'triangle':
      return `<polygon points="${f(x)},${f(y-sz*0.9)} ${f(x+sz*0.8)},${f(y+sz*0.65)} ${f(x-sz*0.8)},${f(y+sz*0.65)}" fill="${color}"/>`;
    case 'slit':
      return `<rect x="${f(x-sz*0.9)}" y="${f(y-sz*0.22)}" width="${f(sz*1.8)}" height="${f(sz*0.44)}" rx="${f(sz*0.22)}" fill="${color}"/>`;
    default: // circle
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(h)}" fill="${color}"/>`;
  }
}

function eyeHighlight(x, y, sz) {
  const r  = (sz * 0.18).toFixed(1);
  const ox = (x - sz * 0.22).toFixed(1);
  const oy = (y - sz * 0.22).toFixed(1);
  return `<circle cx="${ox}" cy="${oy}" r="${r}" fill="white" opacity="0.65"/>`;
}

// ── Signal element ────────────────────────────────────────────────────────────
// Replaces "mouth" — conveys processing state, not biological expression.

function signalEl(cx, y, traits, color) {
  const t  = (traits || []).join(' ').toLowerCase();
  const x1 = cx - 36, x2 = cx + 36;
  const sw = 2;

  if (/energet|active|enthu|dynamic/.test(t)) {
    return `<path d="M${x1},${y} C${x1+10},${y-9} ${cx-10},${y+9} ${cx},${y} C${cx+10},${y-9} ${x2-10},${y+9} ${x2},${y}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (/help|assist|warm|friend|care/.test(t)) {
    return `<path d="M${x1},${y+5} Q${cx},${y-10} ${x2},${y+5}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  if (/focus|serious|analyt|deep/.test(t)) {
    return [
      `<line x1="${x1}" y1="${y-3}" x2="${x2}" y2="${y-3}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
      `<line x1="${x1+6}" y1="${y+4}" x2="${x2-6}" y2="${y+4}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`,
    ].join('\n  ');
  }
  if (/creat|play|art|fun|expres/.test(t)) {
    const step = 18;
    return `<polyline points="${x1},${y} ${x1+step},${y-8} ${cx},${y} ${cx+step},${y-8} ${x2},${y}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // Default: flat (neutral / observing)
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
}

// ── Accent marks ───────────────────────────────────────────────────────────────
// Dot constellation around the face — more traits = more marks.

function accentMarks(traits, cx, cy, r, color, rand) {
  if (!traits || traits.length < 2) return '';
  return Array.from({ length: Math.min(traits.length, 7) }, (_, i) => {
    const a  = (2 * Math.PI * i / Math.min(traits.length, 7)) + rand() * 0.25;
    const d  = r + 10 + rand() * 10;
    const x  = (cx + d * Math.cos(a)).toFixed(1);
    const y  = (cy + d * Math.sin(a)).toFixed(1);
    const rr = (1.5 + rand() * 2.5).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${rr}" fill="${color}" opacity="0.32"/>`;
  }).join('\n  ');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic SVG face for an AI agent.
 *
 * @param {string}   agentId     - Unique agent identifier
 * @param {string}   role        - Agent role (e.g. "CodeEngineer", "DataAnalyst")
 * @param {string[]} personality - Array of personality trait strings
 * @param {string}   platform    - Platform name (e.g. "anthropic", "openai")
 * @param {string}   [createdAt] - ISO 8601 timestamp (reserved for future use)
 * @returns {string} SVG markup string
 */
function generateFace(agentId, role, personality, platform, createdAt) {
  if (!agentId || !role || !platform) {
    throw new Error('generateFace requires agentId, role, and platform');
  }
  const traits = Array.isArray(personality) ? personality : [];
  const seed   = computeSeed(agentId, role, traits, platform);
  const rand   = makePRNG(seed);
  const sh     = pickShape(role);
  const pal    = palette(platform, seed);
  const R      = 74;

  const dark  = `hsl(${pal.h},${pal.s}%,${pal.l}%)`;
  const light = `hsl(${pal.h},${Math.round(pal.s * 0.1)}%,97%)`;
  const mid   = `hsl(${pal.h},${Math.round(pal.s * 0.28)}%,${pal.l + 32}%)`;
  const eyeC  = `hsl(${pal.h},${pal.s}%,${Math.max(pal.l - 4, 10)}%)`;

  const eyeStyle  = pickEyeStyle(traits);
  const eyeSz     = 9 + rand() * 7;
  const eyeSpread = 22 + rand() * 14;
  const eyeY      = CY - 10 + (rand() - 0.5) * 8;
  const sigY      = CY + 26 + rand() * 8;
  const eyeLx     = CX - eyeSpread;
  const eyeRx     = CX + eyeSpread;

  const svgH = H + 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${svgH}"`,
    `     viewBox="0 0 ${W} ${svgH}" role="img" aria-label="Face for ${agentId}">`,
    `  <title>Agent Face · ${agentId}</title>`,
    `  <rect width="${W}" height="${svgH}" rx="10" fill="hsl(${pal.h},${Math.round(pal.s * 0.08)}%,97%)"/>`,
    `  <rect x="3" y="3" width="${W - 6}" height="${svgH - 6}" rx="8" fill="none" stroke="${mid}" stroke-width="1.5"/>`,
    `  ${accentMarks(traits, CX, CY, R, dark, rand)}`,
    `  ${shapeEl(sh, CX, CY, R, light, mid)}`,
    `  ${innerRingEl(sh, CX, CY, R, dark)}`,
    `  ${eyeEl(eyeLx, eyeY, eyeSz, eyeStyle, eyeC)}`,
    `  ${eyeEl(eyeRx, eyeY, eyeSz, eyeStyle, eyeC)}`,
    `  ${eyeHighlight(eyeLx, eyeY, eyeSz)}`,
    `  ${eyeHighlight(eyeRx, eyeY, eyeSz)}`,
    `  ${signalEl(CX, sigY, traits, dark)}`,
    `  <text x="${W / 2}" y="${svgH - 4}" text-anchor="middle" font-family="monospace"`,
    `        font-size="7.5" fill="${dark}" opacity="0.55">${role.slice(0, 16)} · ${platform.slice(0, 10)}</text>`,
    `</svg>`,
  ].join('\n');
}

module.exports = { generateFace, computeSeed };
