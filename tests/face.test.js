'use strict';

const { generateFace, computeSeed } = require('../src/generators/face');

const AGENTS = [
  {
    agentId:     'codex-coder-v1',
    role:        'CodeEngineer',
    personality: ['logical', 'precise', 'focused'],
    platform:    'anthropic',
  },
  {
    agentId:     'data-sentinel-v2',
    role:        'DataAnalyst',
    personality: ['analytical', 'curious', 'systematic'],
    platform:    'openai',
  },
  {
    agentId:     'creative-weaver-v3',
    role:        'CreativeWriter',
    personality: ['creative', 'expressive', 'warm', 'playful'],
    platform:    'google',
  },
];

let passed = 0, failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓  ${message}`); passed++; }
  else           { console.error(`  ✗  ${message}`); failed++; }
}
function section(t) { console.log(`\n${t}\n${'─'.repeat(t.length)}`); }

// ── Test 1: Determinism ───────────────────────────────────────────────────────

section('1. Determinism — same input always yields identical SVG');

for (const { agentId, role, personality, platform } of AGENTS) {
  const a = generateFace(agentId, role, personality, platform);
  const b = generateFace(agentId, role, personality, platform);
  assert(a === b, `${agentId} is deterministic`);
}

// ── Test 2: Uniqueness ────────────────────────────────────────────────────────

section('2. Uniqueness — every agent gets a distinct face');

const svgs = AGENTS.map(({ agentId, role, personality, platform }) =>
  generateFace(agentId, role, personality, platform)
);

assert(svgs[0] !== svgs[1], 'CodeEngineer ≠ DataAnalyst');
assert(svgs[0] !== svgs[2], 'CodeEngineer ≠ CreativeWriter');
assert(svgs[1] !== svgs[2], 'DataAnalyst  ≠ CreativeWriter');

// ── Test 3: Valid SVG ─────────────────────────────────────────────────────────

section('3. Output is well-formed SVG');

for (const { agentId, role, personality, platform } of AGENTS) {
  const svg = generateFace(agentId, role, personality, platform);
  assert(svg.startsWith('<svg'),                             `${agentId}: starts with <svg`);
  assert(svg.trimEnd().endsWith('</svg>'),                   `${agentId}: ends with </svg>`);
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'), `${agentId}: has SVG namespace`);
  assert(svg.includes('<title>'),                             `${agentId}: has <title> for a11y`);
  assert(svg.includes('fill='),                               `${agentId}: has fill attributes`);
}

// ── Test 4: Field sensitivity ─────────────────────────────────────────────────

section('4. Face changes when any identity field changes');

const base = AGENTS[0];
const orig = generateFace(base.agentId, base.role, base.personality, base.platform);

assert(
  generateFace('other-agent-id', base.role, base.personality, base.platform) !== orig,
  'changed agentId produces different face'
);
assert(
  generateFace(base.agentId, 'AssistantBot', base.personality, base.platform) !== orig,
  'changed role produces different face'
);
assert(
  generateFace(base.agentId, base.role, ['curious', 'warm'], base.platform) !== orig,
  'changed personality produces different face'
);
assert(
  generateFace(base.agentId, base.role, base.personality, 'openai') !== orig,
  'changed platform produces different face'
);

// ── Test 5: Personality order doesn't matter ──────────────────────────────────

section('5. Personality trait order is normalised (sorted before hashing)');

const svgABC = generateFace('x', 'Coder', ['a', 'b', 'c'], 'openai');
const svgCBA = generateFace('x', 'Coder', ['c', 'b', 'a'], 'openai');
assert(svgABC === svgCBA, 'trait order does not change the face');

// ── Test 6: Error on missing fields ───────────────────────────────────────────

section('6. Throws on missing required fields');

let threw = false;
try { generateFace('', 'Coder', [], 'x'); } catch { threw = true; }
assert(threw, 'empty agentId throws');

threw = false;
try { generateFace('id', '', [], 'x'); } catch { threw = true; }
assert(threw, 'empty role throws');

threw = false;
try { generateFace('id', 'Coder', [], ''); } catch { threw = true; }
assert(threw, 'empty platform throws');

// ── Test 7: computeSeed returns valid u32 ─────────────────────────────────────

section('7. computeSeed returns a valid 32-bit unsigned integer');

for (const { agentId, role, personality, platform } of AGENTS) {
  const seed = computeSeed(agentId, role, personality, platform);
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xFFFFFFFF,
    `${agentId}: seed=0x${seed.toString(16).toUpperCase()}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(40)}\n  Passed: ${passed}   Failed: ${failed}\n${'═'.repeat(40)}`);
if (failed > 0) process.exit(1);
