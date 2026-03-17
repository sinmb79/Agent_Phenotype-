'use strict';

/**
 * Agent Visual Identity System — REST API
 * Vanilla Node.js HTTP server, zero external dependencies.
 *
 * Endpoints:
 *   POST /generate  { agent_config } → { fingerprint, face, palmline, display_name, bio }
 *   GET  /health    → { status, version }
 *   GET  /          → API info
 */

const http = require('http');
const { generateIdentity } = require('../index');

const VERSION = '0.1.0';
const PORT    = process.env.PORT || 3000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try   { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('Request body is not valid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type'   : 'application/json',
    'Content-Length' : Buffer.byteLength(body),
  });
  res.end(body);
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleGenerate(req, res) {
  let config;
  try {
    config = await readBody(req);
  } catch (err) {
    return json(res, 400, { error: err.message });
  }

  // Required field validation
  const required = ['id', 'role', 'platform', 'created_at'];
  for (const field of required) {
    if (!config[field]) {
      return json(res, 400, { error: `Missing required field: ${field}` });
    }
  }

  try {
    const identity = generateIdentity(config);
    return json(res, 200, identity);
  } catch (err) {
    return json(res, 500, { error: err.message });
  }
}

function handleHealth(req, res) {
  return json(res, 200, { status: 'ok', version: VERSION });
}

function handleRoot(req, res) {
  return json(res, 200, {
    name    : 'Agent Visual Identity System API',
    version : VERSION,
    endpoints: {
      'POST /generate' : 'Generate full identity for an agent — returns fingerprint, face, palmline, display_name, bio',
      'GET  /health'   : 'Health check',
    },
    input_schema: {
      id          : 'string (required) — unique agent identifier',
      role        : 'string (required) — agent role, e.g. "CodeEngineer"',
      platform    : 'string (required) — platform name, e.g. "anthropic"',
      created_at  : 'string (required) — ISO 8601 timestamp',
      personality : 'string[] (optional) — personality trait array',
      activity_log: {
        taskCount    : 'number — total completed tasks',
        taskTypes    : 'string[] — list of task type names',
        totalDuration: 'number — total active minutes',
        successRate  : 'number — 0..1',
      },
    },
  });
}

// ── Request dispatcher ────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/generate') return handleGenerate(req, res);
  if (req.method === 'GET'  && req.url === '/health')   return handleHealth(req, res);
  if (req.method === 'GET'  && req.url === '/')         return handleRoot(req, res);

  return json(res, 404, { error: 'Not found' });
});

// ── Start (only when run directly) ───────────────────────────────────────────

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`\nAgent Visual Identity API  v${VERSION}`);
    console.log(`Listening on http://localhost:${PORT}\n`);
    console.log(`  POST http://localhost:${PORT}/generate`);
    console.log(`  GET  http://localhost:${PORT}/health\n`);
  });
}

module.exports = { server };
