'use strict';

const { generateFingerprint, computeSeed } = require('../src/generators/fingerprint');

// ── Sample agents ─────────────────────────────────────────────────────────────

const AGENTS = [
  { agentId: 'agent-alpha-001',  createdAt: '2024-01-15T08:30:00Z', platform: 'openai'     },
  { agentId: 'agent-beta-002',   createdAt: '2024-03-22T14:45:00Z', platform: 'anthropic'  },
  { agentId: 'agent-gamma-003',  createdAt: '2024-06-10T22:00:00Z', platform: 'google'     },
];

// ── Tiny test runner (no deps) ────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passed++;
  } else {
    console.error(`  ✗  ${message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(title.length));
}

// ── Test 1: Determinism ───────────────────────────────────────────────────────

section('1. Determinism — same input always yields identical SVG');

for (const { agentId, createdAt, platform } of AGENTS) {
  const a = generateFingerprint(agentId, createdAt, platform);
  const b = generateFingerprint(agentId, createdAt, platform);
  assert(a === b, `${agentId} is deterministic`);
}

// ── Test 2: Uniqueness ────────────────────────────────────────────────────────

section('2. Uniqueness — every agent gets a distinct fingerprint');

const svgs = AGENTS.map(({ agentId, createdAt, platform }) =>
  generateFingerprint(agentId, createdAt, platform)
);

assert(svgs[0] !== svgs[1], 'alpha ≠ beta');
assert(svgs[0] !== svgs[2], 'alpha ≠ gamma');
assert(svgs[1] !== svgs[2], 'beta  ≠ gamma');

// ── Test 3: Valid SVG structure ───────────────────────────────────────────────

section('3. Output is well-formed SVG markup');

for (const { agentId, createdAt, platform } of AGENTS) {
  const svg = generateFingerprint(agentId, createdAt, platform);
  assert(svg.startsWith('<svg'),                                  `${agentId}: starts with <svg`);
  assert(svg.trimEnd().endsWith('</svg>'),                        `${agentId}: ends with </svg>`);
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'),      `${agentId}: has SVG namespace`);
  assert(svg.includes('<title>'),                                  `${agentId}: has <title> for a11y`);
  assert((svg.match(/<ellipse/g) || []).length > 5,               `${agentId}: contains ridge ellipses`);
}

// ── Test 4: Seed sensitivity ──────────────────────────────────────────────────

section('4. Seed changes when any identity field changes');

const base = AGENTS[0];
const orig = generateFingerprint(base.agentId, base.createdAt, base.platform);

assert(
  generateFingerprint('agent-alpha-CHANGED', base.createdAt, base.platform) !== orig,
  'agentId mutation changes fingerprint'
);
assert(
  generateFingerprint(base.agentId, '2025-12-31T00:00:00Z', base.platform) !== orig,
  'createdAt mutation changes fingerprint'
);
assert(
  generateFingerprint(base.agentId, base.createdAt, 'mistral') !== orig,
  'platform mutation changes fingerprint'
);

// ── Test 5: computeSeed sanity ────────────────────────────────────────────────

section('5. computeSeed returns a valid 32-bit unsigned integer');

for (const { agentId, createdAt, platform } of AGENTS) {
  const seed = computeSeed(agentId, createdAt, platform);
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xFFFFFFFF,
    `${agentId}: seed=${seed} is in [0, 2³²)`);
}

// ── Test 6: Error on missing fields ──────────────────────────────────────────

section('6. Throws on missing required fields');

let threw = false;
try { generateFingerprint('', '2024-01-01T00:00:00Z', 'x'); } catch { threw = true; }
assert(threw, 'empty agentId throws');

threw = false;
try { generateFingerprint('id', '', 'x'); } catch { threw = true; }
assert(threw, 'empty createdAt throws');

threw = false;
try { generateFingerprint('id', '2024-01-01T00:00:00Z', ''); } catch { threw = true; }
assert(threw, 'empty platform throws');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(40));
console.log(`  Passed: ${passed}   Failed: ${failed}`);
console.log('═'.repeat(40));

if (failed > 0) process.exit(1);
