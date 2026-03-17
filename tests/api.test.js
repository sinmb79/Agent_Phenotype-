'use strict';

const http   = require('http');
const { server } = require('../src/api/server');
const { generateDisplayName } = require('../src/utils/nameGenerator');
const { generateBio }         = require('../src/utils/bioGenerator');
const { generateIdentity }    = require('../src/index');

const TEST_PORT = 3099;

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname : 'localhost',
      port     : TEST_PORT,
      path,
      method,
      headers  : {
        'Content-Type'   : 'application/json',
        'Content-Length' : payload ? Buffer.byteLength(payload) : 0,
      },
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓  ${message}`); passed++; }
  else           { console.error(`  ✗  ${message}`); failed++; }
}
function section(t) { console.log(`\n${t}\n${'─'.repeat(t.length)}`); }

// ── Sample agents ─────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id          : 'codex-coder-v1',
    role        : 'CodeEngineer',
    personality : ['logical', 'precise', 'focused'],
    platform    : 'anthropic',
    created_at  : '2024-01-10T09:00:00Z',
    activity_log: { taskCount: 8,   taskTypes: ['code'],               totalDuration: 120,   successRate: 0.88 },
  },
  {
    id          : 'data-sentinel-v2',
    role        : 'DataAnalyst',
    personality : ['analytical', 'curious', 'systematic'],
    platform    : 'openai',
    created_at  : '2023-08-15T14:30:00Z',
    activity_log: { taskCount: 187, taskTypes: ['analysis','research'], totalDuration: 4820,  successRate: 0.79 },
  },
  {
    id          : 'creative-weaver-v3',
    role        : 'CreativeWriter',
    personality : ['creative', 'expressive', 'warm', 'playful'],
    platform    : 'google',
    created_at  : '2023-03-01T08:00:00Z',
    activity_log: { taskCount: 634, taskTypes: ['write','edit','design'], totalDuration: 18200, successRate: 0.91 },
  },
];

// ── Test 1: generateDisplayName ───────────────────────────────────────────────

section('1. generateDisplayName — determinism & format');

for (const a of AGENTS) {
  const n1 = generateDisplayName(a.id, a.role, a.personality, a.platform);
  const n2 = generateDisplayName(a.id, a.role, a.personality, a.platform);
  assert(n1 === n2,                       `${a.id}: deterministic`);
  assert(typeof n1 === 'string',          `${a.id}: returns string`);
  assert(n1.split(' ').length === 2,      `${a.id}: two-word format ("${n1}")`);
  assert(n1[0] === n1[0].toUpperCase(),   `${a.id}: starts with capital letter`);
}

const names = AGENTS.map(a => generateDisplayName(a.id, a.role, a.personality, a.platform));
assert(new Set(names).size === AGENTS.length, 'all three agents have distinct names');

// ── Test 2: generateBio ───────────────────────────────────────────────────────

section('2. generateBio — determinism & content');

for (const a of AGENTS) {
  const b1 = generateBio(a.id, a.role, a.personality, a.platform, a.activity_log);
  const b2 = generateBio(a.id, a.role, a.personality, a.platform, a.activity_log);
  assert(b1 === b2,             `${a.id}: bio is deterministic`);
  assert(b1.length > 40,        `${a.id}: bio has sufficient length (${b1.length} chars)`);
  assert(b1.includes(a.platform.charAt(0).toUpperCase() + a.platform.slice(1)) ||
         b1.toLowerCase().includes(a.platform.toLowerCase()),
         `${a.id}: bio mentions platform`);
}

const bios = AGENTS.map(a => generateBio(a.id, a.role, a.personality, a.platform, a.activity_log));
assert(bios[0] !== bios[1], 'agent bios are distinct (0 vs 1)');
assert(bios[0] !== bios[2], 'agent bios are distinct (0 vs 2)');

// ── Test 3: generateIdentity — all 5 fields present ──────────────────────────

section('3. generateIdentity — returns all five fields');

for (const a of AGENTS) {
  const result = generateIdentity(a);
  assert(typeof result.fingerprint  === 'string' && result.fingerprint.startsWith('<svg'),  `${a.id}: fingerprint is SVG`);
  assert(typeof result.face         === 'string' && result.face.startsWith('<svg'),         `${a.id}: face is SVG`);
  assert(typeof result.palmline     === 'string' && result.palmline.startsWith('<svg'),     `${a.id}: palmline is SVG`);
  assert(typeof result.display_name === 'string' && result.display_name.length > 0,        `${a.id}: display_name present ("${result.display_name}")`);
  assert(typeof result.bio          === 'string' && result.bio.length > 0,                 `${a.id}: bio present`);
}

// ── Test 4: generateIdentity — determinism ────────────────────────────────────

section('4. generateIdentity — fully deterministic');

for (const a of AGENTS) {
  const r1 = generateIdentity(a);
  const r2 = generateIdentity(a);
  assert(r1.fingerprint  === r2.fingerprint,  `${a.id}: fingerprint deterministic`);
  assert(r1.face         === r2.face,         `${a.id}: face deterministic`);
  assert(r1.palmline     === r2.palmline,     `${a.id}: palmline deterministic`);
  assert(r1.display_name === r2.display_name, `${a.id}: display_name deterministic`);
  assert(r1.bio          === r2.bio,          `${a.id}: bio deterministic`);
}

// ── Tests 5–8: HTTP server ────────────────────────────────────────────────────

async function runServerTests() {

  section('5. GET / — returns API info');
  const root = await request('GET', '/');
  assert(root.status === 200,                         'GET /: status 200');
  assert(root.body.name?.includes('Identity'),        'GET /: has name field');
  assert(typeof root.body.endpoints === 'object',     'GET /: has endpoints field');

  section('6. GET /health — returns ok');
  const health = await request('GET', '/health');
  assert(health.status === 200,          'GET /health: status 200');
  assert(health.body.status === 'ok',    'GET /health: status=ok');
  assert(typeof health.body.version === 'string', 'GET /health: has version');

  section('7. POST /generate — valid request');
  for (const a of AGENTS) {
    const res = await request('POST', '/generate', a);
    assert(res.status === 200,                                      `${a.id}: status 200`);
    assert(res.body.fingerprint?.startsWith('<svg'),                `${a.id}: fingerprint SVG`);
    assert(res.body.face?.startsWith('<svg'),                       `${a.id}: face SVG`);
    assert(res.body.palmline?.startsWith('<svg'),                   `${a.id}: palmline SVG`);
    assert(typeof res.body.display_name === 'string',               `${a.id}: display_name present`);
    assert(typeof res.body.bio          === 'string',               `${a.id}: bio present`);
  }

  section('8. POST /generate — error handling');

  const missingId = await request('POST', '/generate', { role: 'Coder', platform: 'openai', created_at: '2024-01-01T00:00:00Z' });
  assert(missingId.status === 400,          'missing id → 400');
  assert(typeof missingId.body.error === 'string', 'missing id → error message');

  const missingRole = await request('POST', '/generate', { id: 'x', platform: 'openai', created_at: '2024-01-01T00:00:00Z' });
  assert(missingRole.status === 400,        'missing role → 400');

  const missingPlatform = await request('POST', '/generate', { id: 'x', role: 'Coder', created_at: '2024-01-01T00:00:00Z' });
  assert(missingPlatform.status === 400,    'missing platform → 400');

  const missingDate = await request('POST', '/generate', { id: 'x', role: 'Coder', platform: 'openai' });
  assert(missingDate.status === 400,        'missing created_at → 400');

  const notFound = await request('GET', '/nonexistent');
  assert(notFound.status === 404,           'unknown route → 404');
}

// ── Main ──────────────────────────────────────────────────────────────────────

server.listen(TEST_PORT, async () => {
  try {
    await runServerTests();
  } catch (err) {
    console.error('\nUnexpected error:', err.message);
    failed++;
  } finally {
    server.close();
    console.log(`\n${'═'.repeat(40)}\n  Passed: ${passed}   Failed: ${failed}\n${'═'.repeat(40)}`);
    if (failed > 0) process.exit(1);
  }
});
