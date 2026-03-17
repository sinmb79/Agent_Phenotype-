'use strict';

/**
 * Diversity analysis — how many unique identities can the system produce?
 * Also surfaces the weak points.
 */

const { generateDisplayName } = require('../src/utils/nameGenerator');
const { generateFace }        = require('../src/generators/face');
const { generateFingerprint } = require('../src/generators/fingerprint');

// ── Test 1: Name collision at scale ───────────────────────────────────────────
console.log('=== NAME COLLISION TEST (same role + platform, 200 agents) ===\n');

const names = new Set();
const ROLE = 'CodeEngineer', PLATFORM = 'anthropic';
let firstCollisionAt = null;

for (let i = 0; i < 200; i++) {
  const id   = `agent-${String(i).padStart(4, '0')}`;
  const name = generateDisplayName(id, ROLE, ['logical','precise'], PLATFORM);
  if (names.has(name) && !firstCollisionAt) firstCollisionAt = i;
  names.add(name);
}
console.log(`200 agents → ${names.size} unique names`);
console.log(`First collision at agent #${firstCollisionAt ?? 'none'}`);
console.log(`Collision rate: ${((200 - names.size) / 200 * 100).toFixed(1)}%\n`);

// ── Test 2: Face hue diversity per platform ────────────────────────────────────
console.log('=== FACE COLOR TEST (same platform, 10 agents) ===\n');

const hues = [];
for (let i = 0; i < 10; i++) {
  const id  = `agent-${String(i).padStart(4, '0')}`;
  const svg = generateFace(id, 'CodeEngineer', ['logical'], 'anthropic');
  const m   = svg.match(/hsl\((\d+),/);
  if (m) hues.push(Number(m[1]));
}
const uniqueHues = new Set(hues);
console.log(`10 anthropic agents → hues: [${hues.join(', ')}]`);
console.log(`Unique hues: ${uniqueHues.size} / 10`);
console.log(uniqueHues.size === 1 ? '⚠  ALL SAME COLOR — no per-agent color variation!\n' : '✓  Colors vary\n');

// ── Test 3: Fingerprint collision ─────────────────────────────────────────────
console.log('=== FINGERPRINT COLLISION TEST (1000 agents) ===\n');

const fps = new Set();
for (let i = 0; i < 1000; i++) {
  const id = `agent-${String(i).padStart(6, '0')}`;
  fps.add(generateFingerprint(id, '2024-01-01T00:00:00Z', 'anthropic'));
}
console.log(`1000 agents → ${fps.size} unique fingerprints`);
console.log(fps.size === 1000 ? '✓  Zero collisions\n' : `⚠  ${1000 - fps.size} collisions\n`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('=== WEAK POINTS ===\n');
console.log('1. Name: Only ~2,240 combinations (56 adj × 40 nouns) → collides quickly');
console.log('2. Face color: Platform-fixed hue → same platform = same color family (no variation)');
console.log('3. Bio: Only 3 structural templates → feels repetitive at scale');
console.log('4. Fingerprint: 2^223 possible patterns → essentially infinite ✓');
