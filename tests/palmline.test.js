'use strict';

const { generatePalmLine, computeSeed } = require('../src/generators/palmline');

// Three agents: new, mid-career, veteran
const AGENTS = [
  {
    agentId:  'codex-coder-v1',
    activity: { taskCount: 8,   taskTypes: ['code'],                          totalDuration: 120,   successRate: 0.88 },
    label:    'new',
  },
  {
    agentId:  'data-sentinel-v2',
    activity: { taskCount: 187, taskTypes: ['analysis', 'research', 'report'], totalDuration: 4820,  successRate: 0.79 },
    label:    'mid',
  },
  {
    agentId:  'creative-weaver-v3',
    activity: { taskCount: 634, taskTypes: ['write', 'edit', 'design', 'ideate'], totalDuration: 18200, successRate: 0.91 },
    label:    'veteran',
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

for (const { agentId, activity } of AGENTS) {
  const a = generatePalmLine(agentId, activity);
  const b = generatePalmLine(agentId, activity);
  assert(a === b, `${agentId} is deterministic`);
}

// ── Test 2: Uniqueness ────────────────────────────────────────────────────────

section('2. Uniqueness — different agents produce different palms');

const svgs = AGENTS.map(({ agentId, activity }) => generatePalmLine(agentId, activity));
assert(svgs[0] !== svgs[1], 'new   ≠ mid');
assert(svgs[0] !== svgs[2], 'new   ≠ veteran');
assert(svgs[1] !== svgs[2], 'mid   ≠ veteran');

// ── Test 3: Valid SVG ─────────────────────────────────────────────────────────

section('3. Output is well-formed SVG');

for (const { agentId, activity } of AGENTS) {
  const svg = generatePalmLine(agentId, activity);
  assert(svg.startsWith('<svg'),                             `${agentId}: starts with <svg`);
  assert(svg.trimEnd().endsWith('</svg>'),                   `${agentId}: ends with </svg>`);
  assert(svg.includes('xmlns="http://www.w3.org/2000/svg"'), `${agentId}: has SVG namespace`);
  assert(svg.includes('<title>'),                             `${agentId}: has <title> for a11y`);
  assert(svg.includes('<clipPath'),                           `${agentId}: has clipPath for line clipping`);
  assert(svg.includes(AGENTS[0].agentId === agentId
    ? '8 tasks' : agentId === 'data-sentinel-v2' ? '187 tasks' : '634 tasks'),
    `${agentId}: label shows correct task count`);
}

// ── Test 4: Veteran has more lines than new agent ─────────────────────────────

section('4. Veteran palm contains more lines than new agent palm');

function countPaths(svg) {
  return (svg.match(/<path /g) || []).length;
}

const newPaths = countPaths(svgs[0]);
const vetPaths = countPaths(svgs[2]);
assert(vetPaths > newPaths, `veteran (${vetPaths} paths) has more lines than new agent (${newPaths} paths)`);

// ── Test 5: Activity changes palm ─────────────────────────────────────────────

section('5. Changing activity changes the palm');

const base = AGENTS[1];
const orig = generatePalmLine(base.agentId, base.activity);

assert(
  generatePalmLine('other-id', base.activity) !== orig,
  'changed agentId produces different palm'
);
assert(
  generatePalmLine(base.agentId, { ...base.activity, taskCount: 999 }) !== orig,
  'changed taskCount produces different palm'
);
assert(
  generatePalmLine(base.agentId, { ...base.activity, successRate: 0.1 }) !== orig,
  'changed successRate produces different palm'
);

// ── Test 6: Blank activity = minimal palm (still valid) ───────────────────────

section('6. New agent with no activity still generates valid SVG');

const blankSvg = generatePalmLine('brand-new-agent', {});
assert(blankSvg.startsWith('<svg'),          'blank activity: valid SVG start');
assert(blankSvg.includes('0 tasks'),         'blank activity: shows 0 tasks');
const blankPaths = countPaths(blankSvg);
assert(blankPaths >= 3 && blankPaths <= 8,   `blank activity: minimal lines (${blankPaths} paths)`);

// ── Test 7: Error on missing agentId ──────────────────────────────────────────

section('7. Throws when agentId is missing');

let threw = false;
try { generatePalmLine('', {}); } catch { threw = true; }
assert(threw, 'empty agentId throws');

threw = false;
try { generatePalmLine(null, {}); } catch { threw = true; }
assert(threw, 'null agentId throws');

// ── Test 8: computeSeed is a valid u32 ───────────────────────────────────────

section('8. computeSeed returns a valid 32-bit unsigned integer');

for (const { agentId, activity } of AGENTS) {
  const seed = computeSeed(agentId, activity);
  assert(Number.isInteger(seed) && seed >= 0 && seed <= 0xFFFFFFFF,
    `${agentId}: seed=0x${seed.toString(16).toUpperCase()}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(40)}\n  Passed: ${passed}   Failed: ${failed}\n${'═'.repeat(40)}`);
if (failed > 0) process.exit(1);
