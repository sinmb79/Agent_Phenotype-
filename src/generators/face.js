'use strict';

/**
 * Face Generator — v3  (robot / synthetic agent aesthetic)
 *
 * Generates a mechanical robot face with:
 *   - Dark metallic head panel (platform-tinted)
 *   - Two rectangular eye screens with inner LED (circle / square / bar style)
 *   - Forehead status indicator (LED dot or segment bar)
 *   - Horizontal mouth grille (4–7 slits)
 *   - Optional antenna(s) and corner rivets
 *   - Panel seam line separating eye-zone from mouth-zone
 *
 * All structural parameters are derived from agent seed bits so every
 * agent gets a unique robot face while remaining clearly "robotic".
 */

const W = 220, H = 220;

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
  if (!agentId)   throw new Error('generateFace: agentId is required');
  if (!role)      throw new Error('generateFace: role is required');
  if (!platform)  throw new Error('generateFace: platform is required');
  const pStr = Array.isArray(personality)
    ? [...personality].sort().join(',')
    : String(personality || '');
  return fnv1a32(`${agentId}\0${role}\0${pStr}\0${platform}`);
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

// ── Platform accent color ─────────────────────────────────────────────────────

const PLATFORM_BASE = {
  anthropic: { h: 28,  s: 88 },
  openai:    { h: 198, s: 82 },
  google:    { h: 138, s: 72 },
  mistral:   { h: 268, s: 74 },
  meta:      { h: 218, s: 80 },
  cohere:    { h: 158, s: 70 },
  groq:      { h: 348, s: 78 },
};

function accentColor(platform, seed) {
  const base = PLATFORM_BASE[(platform || '').toLowerCase()] ?? { h: 208, s: 75 };
  const hShift = (seed % 41) - 20;  // ±20° per-agent variation
  const h = ((base.h + hShift) % 360 + 360) % 360;
  return { h, s: base.s };
}

// ── Parameter derivation ──────────────────────────────────────────────────────

function deriveParams(seed, platform) {
  const rng = makePRNG(seed);
  const { h, s } = accentColor(platform, seed);

  // Antenna
  const antennaCount  = rng() % 3;           // 0, 1, or 2
  const antennaOffset = (rng() % 31) - 15;   // -15..+15 px from centre

  // Head corner radius  (rounder vs boxier)
  const headRx = 8 + (rng() % 14);            // 8–21 px

  // Forehead: 0=LED dot, 1=segment bar
  const foreheadStyle = rng() % 2;
  const barLit        = 1 + (rng() % 4);      // 1–4 lit segments

  // Eye panel dimensions
  const eyeW    = 46 + (rng() % 18);          // 46–63 px
  const eyeH    = 28 + (rng() % 16);          // 28–43 px
  const eyePanelRx = rng() % 10;              // 0–9 (square to rounded)

  // Eye LED style: 0=circle, 1=square, 2=horizontal bar
  const eyeStyle = rng() % 3;
  const ledSize  = 6 + (rng() % 7);           // 6–12 px radius / half-width

  // Mouth grille
  const slitCount = 4 + (rng() % 4);          // 4–7 slits

  // Extras
  const hasRivets    = (rng() % 3) > 0;       // 67% have rivets
  const seamY        = 136 + (rng() % 10);    // 136–145 px

  return { h, s, antennaCount, antennaOffset, headRx,
           foreheadStyle, barLit,
           eyeW, eyeH, eyePanelRx, eyeStyle, ledSize,
           slitCount, hasRivets, seamY };
}

// ── SVG builders ──────────────────────────────────────────────────────────────

function buildAntenna(p) {
  if (p.antennaCount === 0) return '';
  const { h, s, antennaCount, antennaOffset } = p;
  const accent = `hsl(${h},${s}%,58%)`;
  const dim    = `hsl(${h},${s}%,40%)`;

  const ax  = 110 + antennaOffset;
  let out = `<line x1="${ax}" y1="32" x2="${ax}" y2="10" stroke="${accent}" stroke-width="1.5"/>
  <circle cx="${ax}" cy="8" r="3.5" fill="${accent}"/>`;

  if (antennaCount >= 2) {
    const ax2 = ax - 18;
    out += `
  <line x1="${ax2}" y1="32" x2="${ax2}" y2="16" stroke="${dim}" stroke-width="1"/>
  <circle cx="${ax2}" cy="14" r="2.5" fill="${dim}" opacity="0.8"/>`;
  }
  return out;
}

function buildForehead(p) {
  const { h, s, foreheadStyle, barLit } = p;
  const accent = `hsl(${h},${s}%,60%)`;
  const off    = `hsl(${h},20%,25%)`;
  const fy = 54;

  if (foreheadStyle === 0) {
    // Single LED dot with glow
    return `<circle cx="110" cy="${fy}" r="8" fill="${off}" opacity="0.6"/>
  <circle cx="110" cy="${fy}" r="4.5" fill="${accent}"/>
  <circle cx="110" cy="${fy}" r="9" fill="${accent}" opacity="0.12"/>`;
  }

  // Segment bar  (up to 5 segments, barLit are lit)
  const TOTAL_BARS = 5;
  const bw = 10, bh = 5, gap = 3;
  const totalW = TOTAL_BARS * bw + (TOTAL_BARS - 1) * gap;
  const bx0 = 110 - totalW / 2;
  let out = '';
  for (let i = 0; i < TOTAL_BARS; i++) {
    const lit = i < barLit;
    out += `<rect x="${(bx0 + i * (bw + gap)).toFixed(1)}" y="${fy - bh / 2}" `
         + `width="${bw}" height="${bh}" rx="1.5" `
         + `fill="${lit ? accent : off}" opacity="${lit ? 0.9 : 0.35}"/>`;
  }
  return out;
}

function buildEyes(p) {
  const { h, s, eyeW, eyeH, eyePanelRx, eyeStyle, ledSize } = p;
  const accent     = `hsl(${h},${s}%,60%)`;
  const accentGlow = `hsl(${h},${s}%,72%)`;
  const panelFill  = `hsl(${h},15%,7%)`;
  const panelEdge  = `hsl(${h},${s}%,38%)`;

  const eyeLX = 70, eyeRX = 150, eyeY = 100;

  function panel(cx) {
    const ex = cx - eyeW / 2, ey = eyeY - eyeH / 2;
    return `<rect x="${ex.toFixed(1)}" y="${ey.toFixed(1)}" width="${eyeW}" height="${eyeH}" `
         + `rx="${eyePanelRx}" fill="${panelFill}" stroke="${panelEdge}" stroke-width="1.2"/>`;
  }

  function led(cx) {
    if (eyeStyle === 0) {
      // Circular LED
      return `<circle cx="${cx}" cy="${eyeY}" r="${ledSize + 3}" fill="${accent}" opacity="0.15"/>
  <circle cx="${cx}" cy="${eyeY}" r="${ledSize}" fill="${accentGlow}"/>`;
    }
    if (eyeStyle === 1) {
      // Square LED
      const half = ledSize;
      return `<rect x="${cx - half}" y="${eyeY - half}" width="${half * 2}" height="${half * 2}" `
           + `rx="2" fill="${accentGlow}"/>`;
    }
    // Horizontal bar LED
    const lw = ledSize * 2.8, lh = Math.max(3, ledSize * 0.55);
    return `<rect x="${(cx - lw / 2).toFixed(1)}" y="${(eyeY - lh / 2).toFixed(1)}" `
         + `width="${lw.toFixed(1)}" height="${lh.toFixed(1)}" `
         + `rx="1.5" fill="${accentGlow}"/>`;
  }

  return panel(eyeLX) + panel(eyeRX) + led(eyeLX) + led(eyeRX);
}

function buildGrille(p) {
  const { h, s, slitCount, seamY } = p;
  const gx = 44, gw = 132;
  const gy = seamY + 6;
  const slitH = 3;
  const totalH = slitCount * slitH + (slitCount - 1) * 2 + 6;
  const panelFill = `hsl(${h},12%,8%)`;
  const slitColor = `hsl(${h},${s}%,35%)`;
  const edgeColor = `hsl(${h},18%,22%)`;

  let out = `<rect x="${gx}" y="${gy}" width="${gw}" height="${totalH}" rx="4" `
          + `fill="${panelFill}" stroke="${edgeColor}" stroke-width="1"/>`;
  for (let i = 0; i < slitCount; i++) {
    const sy = gy + 3 + i * (slitH + 2);
    out += `<rect x="${gx + 7}" y="${sy}" width="${gw - 14}" height="${slitH}" rx="1" `
         + `fill="${slitColor}" opacity="0.5"/>`;
  }
  return out;
}

// ── Main generator ────────────────────────────────────────────────────────────

function generateFace(agentId, role, personality, platform) {
  const seed = computeSeed(agentId, role, personality, platform);
  const p    = deriveParams(seed, platform);

  const { h, s, headRx, seamY, hasRivets } = p;

  const gradId    = `hg${(seed & 0xffff).toString(16).padStart(4, '0')}`;
  const metalDark = `hsl(${h},14%,12%)`;
  const metalMid  = `hsl(${h},12%,16%)`;
  const metalEdge = `hsl(${h},20%,24%)`;

  const defs = `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="hsl(${h},18%,20%)"/>
      <stop offset="45%"  stop-color="${metalMid}"/>
      <stop offset="100%" stop-color="hsl(${h},16%,8%)"/>
    </linearGradient>
  </defs>`;

  // Head body
  const head = `<rect x="18" y="28" width="184" height="168" rx="${headRx}" `
             + `fill="url(#${gradId})" stroke="${metalEdge}" stroke-width="1.5"/>`;

  // Subtle highlight stripe on top of head
  const highlight = `<rect x="18" y="28" width="184" height="4" rx="${headRx}" `
                  + `fill="hsl(${h},18%,32%)" opacity="0.6"/>`;

  // Panel seam
  const seam = `<line x1="18" y1="${seamY}" x2="202" y2="${seamY}" `
             + `stroke="${metalEdge}" stroke-width="0.8" opacity="0.6"/>`;

  // Corner rivets
  let rivets = '';
  if (hasRivets) {
    [[22, 32], [198, 32], [22, 192], [198, 192]].forEach(([rx, ry]) => {
      rivets += `<circle cx="${rx}" cy="${ry}" r="2.8" `
              + `fill="hsl(${h},14%,18%)" stroke="hsl(${h},22%,32%)" stroke-width="0.8"/>`;
    });
  }

  // Assemble
  const antenna  = buildAntenna(p);
  const forehead = buildForehead(p);
  const eyes     = buildEyes(p);
  const grille   = buildGrille(p);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>Agent face: ${agentId}</title>
  ${defs}
  <rect width="${W}" height="${H}" fill="#080810"/>
  ${rivets}
  ${antenna}
  ${head}
  ${highlight}
  ${seam}
  ${forehead}
  ${eyes}
  ${grille}
</svg>`;
}

module.exports = { generateFace, computeSeed };
