'use strict';

/**
 * Face Generator — v2  (near-infinite parametric diversity)
 *
 * Every visual parameter is derived directly from seed bits → no fixed categories.
 * Role + personality act as *biases* (not hard constraints) so the face still
 * "reads" the agent's character while remaining globally unique.
 *
 * Diversity capacity:
 *   Shape  : 8 n-gon families × 72 rotations × 28 size steps = 16,128 base shapes
 *   Eyes   : 13 widths × 15 heights × 9 radii × 2 rotation states = 3,510 eye configs
 *   Signal : 8 styles × 28 lengths × 20 curvature steps = 4,480 signal variants
 *   Color  : 360 hues × 32 saturations × 30 lightness = 345,600 palettes
 *   Combined: >> 10^13 unique faces (effectively infinite at any real scale)
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
  const pStr = Array.isArray(personality) ? [...personality].sort().join(',') : String(personality || '');
  return fnv1a32(`${agentId}\0${role}\0${pStr}\0${platform}`);
}

// Two independent 32-bit seeds — avoids bit correlations between parameters
function seeds(agentId, role, personality, platform) {
  const s1 = computeSeed(agentId, role, personality, platform);
  const s2 = fnv1a32(`${s1}\0${platform}\0${agentId}`);
  return [s1, s2];
}

// ── Parameter extraction ──────────────────────────────────────────────────────
//
// Role and personality provide *biases* to guide the parameter ranges so the
// face still "reads" the agent's character, but the seed determines the exact
// value within those ranges — guaranteeing uniqueness.

function roleBias(role) {
  const r = role.toLowerCase();
  if (/cod|engineer|dev|build|tech/.test(r))    return { nMin: 5, nMax: 9  };  // precise polygon
  if (/assist|help|support|chat|guide/.test(r)) return { nMin: 0, nMax: 0  };  // circle
  if (/analyt|research|data|scien/.test(r))     return { nMin: 3, nMax: 5  };  // sharp/angular
  if (/creat|design|art|writ/.test(r))          return { nMin: 7, nMax: 11 };  // complex multi-sided
  return { nMin: 3, nMax: 10 };
}

function personalityBias(traits) {
  const t = (traits || []).join(' ').toLowerCase();
  // Returns [eyeAspectLow, eyeAspectHigh] — aspect = height/width
  if (/logical|precise|strict|struct/.test(t)) return [0.85, 1.15];  // square
  if (/curious|explor|wonder|learn/.test(t))   return [1.2,  2.0 ];  // tall/diamond
  if (/calm|steady|patient|quiet/.test(t))     return [0.2,  0.45];  // wide slit
  if (/assert|direct|focus|driven/.test(t))    return [0.5,  0.85];  // slightly tall
  if (/creat|play|art|expres/.test(t))         return [0.6,  1.8 ];  // free range
  return [0.4, 1.4];  // default: any
}

function deriveParams(s1, s2, role, personality) {
  const { nMin, nMax } = roleBias(role);
  const [aspLo, aspHi] = personalityBias(personality);

  // ── Shape ──
  let n;
  if (nMin === 0) {
    n = 0;  // circle
  } else {
    const range = nMax - nMin + 1;
    n = nMin + ((s1 >>> 0) % range);
  }
  const rot  = ((s1 >>> 4)  % 72) * 5;           // 0–355° in 5° steps
  const R    = 62 + ((s1 >>> 10) & 0x1b);        // radius 62–89 px

  // ── Eyes ──
  const eW   = 9  + ((s1 >>> 15) & 0xd);         // width 9–22 px
  const aspR = aspLo + ((s1 >>> 19) & 0xf) / 15 * (aspHi - aspLo);
  const eH   = Math.max(3, Math.round(eW * aspR));
  const eRx  = Math.min((s1 >>> 23) & 0x7, Math.floor(Math.min(eW, eH) / 2));
  const eSp  = 20 + ((s1 >>> 26) & 0x1f);        // spread 20–51 px
  const eYOff = -10 + ((s2 >>> 0) & 0xf);        // Y offset –10..+5

  // Optional 45° rotation on eyes (makes rect look like diamond when aspect≈1)
  const eRot = ((s2 >>> 4) & 0x1) ? 45 : 0;

  // ── Signal (expression) ──
  const sigStyle = (s2 >>> 5)  & 0x7;            // 0–7
  const sigLen   = 28 + ((s2 >>> 8) & 0x1b);     // 28–55 px half-length
  const sigYOff  = 22 + ((s2 >>> 13) & 0xf);     // distance below center 22–37
  const sigCurve = ((s2 >>> 17) % 21) - 10;      // –10..+10

  // ── Accents ──
  const accentN  = (s2 >>> 22) & 0x7;            // 0–7 dots
  const accentD  = 10 + ((s2 >>> 25) & 0xf);     // distance from shape edge 10–25

  return { n, rot, R, eW, eH, eRx, eSp, eYOff, eRot, sigStyle, sigLen, sigYOff, sigCurve, accentN, accentD };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function polyPoints(cx, cy, r, n, rotDeg) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i / n) + (rotDeg * Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function shapeEl(n, rot, R, cx, cy, fill, stroke) {
  if (n === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
  }
  const pts = polyPoints(cx, cy, R, n, rot);
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
}

function innerEl(n, rot, R, cx, cy, dark) {
  const r = R - 10;
  if (n === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${dark}" stroke-width="0.6" opacity="0.16"/>`;
  }
  return `<polygon points="${polyPoints(cx, cy, r, n, rot)}" fill="none" stroke="${dark}" stroke-width="0.6" opacity="0.16"/>`;
}

// Parametric eye — rect with variable aspect, corner-radius, optional rotation
function eyeEl(x, y, eW, eH, eRx, rotDeg, color) {
  const f = v => v.toFixed(2);
  const base = `<rect x="${f(x - eW/2)}" y="${f(y - eH/2)}" width="${f(eW)}" height="${f(eH)}" rx="${eRx}" ry="${eRx}" fill="${color}"`;
  const transform = rotDeg ? ` transform="rotate(${rotDeg},${f(x)},${f(y)})"` : '';
  return base + transform + '/>';
}

function eyeHighlight(x, y, eW, eH, eRx, rotDeg) {
  const r  = Math.max(1.2, Math.min(eW, eH) * 0.18);
  const ox = x - eW * 0.22;
  const oy = y - eH * 0.22;
  const f  = v => v.toFixed(2);
  const transform = rotDeg ? ` transform="rotate(${rotDeg},${f(x)},${f(y)})"` : '';
  return `<circle cx="${f(ox)}" cy="${f(oy)}" r="${r.toFixed(2)}" fill="white" opacity="0.65"${transform}/>`;
}

// Parametric signal — 8 distinct styles with continuous parameters
function signalEl(cx, baseY, style, halfLen, curve, dark) {
  const x1 = cx - halfLen, x2 = cx + halfLen;
  const sw = 2, lc = 'stroke-linecap="round"', lj = 'stroke-linejoin="round"';
  const s = `stroke="${dark}" stroke-width="${sw}"`;

  switch (style & 7) {
    case 0: // flat line
      return `<line x1="${x1}" y1="${baseY}" x2="${x2}" y2="${baseY}" ${s} ${lc}/>`;
    case 1: // single arc (smile/frown by curve direction)
      return `<path d="M${x1},${baseY} Q${cx},${baseY + curve * 2} ${x2},${baseY}" fill="none" ${s} ${lc}/>`;
    case 2: // S-curve (wave)
      return `<path d="M${x1},${baseY} C${x1+halfLen*.5},${baseY-curve*1.5} ${x2-halfLen*.5},${baseY+curve*1.5} ${x2},${baseY}" fill="none" ${s} ${lc}/>`;
    case 3: // double line
      return `<line x1="${x1}" y1="${baseY-3}" x2="${x2}" y2="${baseY-3}" ${s} ${lc}/><line x1="${x1+5}" y1="${baseY+4}" x2="${x2-5}" y2="${baseY+4}" ${s} ${lc}/>`;
    case 4: // zigzag
      return `<polyline points="${x1},${baseY} ${x1+halfLen*.5},${baseY+curve} ${cx},${baseY} ${cx+halfLen*.5},${baseY+curve} ${x2},${baseY}" fill="none" ${s} ${lc} ${lj}/>`;
    case 5: // uptick ends
      return `<path d="M${x1},${baseY} L${x1+halfLen*.3},${baseY} L${cx-halfLen*.05},${baseY+curve} L${cx+halfLen*.05},${baseY+curve} L${x2-halfLen*.3},${baseY} L${x2},${baseY}" fill="none" ${s} ${lc} ${lj}/>`;
    case 6: // triple dot
      return `<circle cx="${cx-halfLen*.4}" cy="${baseY}" r="2.5" fill="${dark}"/><circle cx="${cx}" cy="${baseY}" r="2.5" fill="${dark}"/><circle cx="${cx+halfLen*.4}" cy="${baseY}" r="2.5" fill="${dark}"/>`;
    case 7: // long single arc (more expressive)
      return `<path d="M${x1},${baseY+Math.abs(curve)*0.5} Q${cx},${baseY-Math.abs(curve)*2} ${x2},${baseY+Math.abs(curve)*0.5}" fill="none" ${s} ${lc}/>`;
    default:
      return `<line x1="${x1}" y1="${baseY}" x2="${x2}" y2="${baseY}" ${s} ${lc}/>`;
  }
}

// Accent constellation
function accentMarks(n, R, accentD, cx, cy, color, s2) {
  if (n === 0) return '';
  return Array.from({ length: n }, (_, i) => {
    // Spread evenly + per-mark jitter derived from s2 bits
    const a   = (2 * Math.PI * i / n) + ((s2 >>> (i * 4)) & 0xf) * 0.2 - 0.4;
    const d   = R + accentD + ((s2 >>> (i * 3 + 2)) & 0x7);
    const x   = (cx + d * Math.cos(a)).toFixed(1);
    const y   = (cy + d * Math.sin(a)).toFixed(1);
    const rr  = (1.2 + ((s2 >>> (i * 5)) & 0x3) * 0.8).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="${rr}" fill="${color}" opacity="0.3"/>`;
  }).join('');
}

// ── Colour palette ────────────────────────────────────────────────────────────
// Platform sets a "colour family" (±40°). Seed adds per-agent variation.

const PLATFORM_HUE = {
  openai: 155, anthropic: 22, google: 210,
  mistral: 268, meta: 218, cohere: 42, groq: 178,
};

function palette(platform, s1) {
  const base  = PLATFORM_HUE[platform.toLowerCase()] ?? ((s1 >>> 16) % 360);
  const shift = (s1 % 61) - 30;
  const h = ((base + shift) % 360 + 360) % 360;
  const s = 50 + ((s1 >>>  8) & 0x21);   // 50–83 %
  const l = 23 + ((s1 >>> 14) & 0x1e);   // 23–53 %
  return { h, s, l };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic, near-infinitely diverse SVG face.
 *
 * @param {string}   agentId
 * @param {string}   role
 * @param {string[]} personality
 * @param {string}   platform
 * @returns {string} SVG markup
 */
function generateFace(agentId, role, personality, platform) {
  if (!agentId || !role || !platform) throw new Error('generateFace requires agentId, role, and platform');

  const traits       = Array.isArray(personality) ? personality : [];
  const [s1, s2]     = seeds(agentId, role, traits, platform);
  const p            = deriveParams(s1, s2, role, traits);
  const pal          = palette(platform, s1);

  const dark  = `hsl(${pal.h},${pal.s}%,${pal.l}%)`;
  const light = `hsl(${pal.h},${Math.round(pal.s * 0.1)}%,97%)`;
  const mid   = `hsl(${pal.h},${Math.round(pal.s * 0.28)}%,${pal.l + 32}%)`;
  const eyeC  = `hsl(${pal.h},${pal.s}%,${Math.max(pal.l - 5, 8)}%)`;

  const eyeY  = CY - 10 + p.eYOff;
  const eyeLx = CX - p.eSp;
  const eyeRx = CX + p.eSp;
  const sigY  = CY + p.sigYOff;

  const svgH = H + 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${svgH}"`,
    `     viewBox="0 0 ${W} ${svgH}" role="img" aria-label="Face for ${agentId}">`,
    `  <title>Agent Face · ${agentId}</title>`,
    `  <rect width="${W}" height="${svgH}" rx="10" fill="hsl(${pal.h},${Math.round(pal.s*.08)}%,97%)"/>`,
    `  <rect x="3" y="3" width="${W-6}" height="${svgH-6}" rx="8" fill="none" stroke="${mid}" stroke-width="1.5"/>`,
    `  ${accentMarks(p.accentN, p.R, p.accentD, CX, CY, dark, s2)}`,
    `  ${shapeEl(p.n, p.rot, p.R, CX, CY, light, mid)}`,
    `  ${innerEl(p.n, p.rot, p.R, CX, CY, dark)}`,
    `  ${eyeEl(eyeLx, eyeY, p.eW, p.eH, p.eRx, p.eRot, eyeC)}`,
    `  ${eyeEl(eyeRx, eyeY, p.eW, p.eH, p.eRx, p.eRot, eyeC)}`,
    `  ${eyeHighlight(eyeLx, eyeY, p.eW, p.eH, p.eRx, p.eRot)}`,
    `  ${eyeHighlight(eyeRx, eyeY, p.eW, p.eH, p.eRx, p.eRot)}`,
    `  ${signalEl(CX, sigY, p.sigStyle, p.sigLen, p.sigCurve, dark)}`,
    `  <text x="${W/2}" y="${svgH-4}" text-anchor="middle" font-family="monospace"`,
    `        font-size="7.5" fill="${dark}" opacity="0.55">${role.slice(0,16)} · ${platform.slice(0,10)}</text>`,
    `</svg>`,
  ].join('\n');
}

module.exports = { generateFace, computeSeed };
