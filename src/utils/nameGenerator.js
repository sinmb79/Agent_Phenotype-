'use strict';

/**
 * Display Name Generator
 * Deterministically generates a human-readable name from agent config.
 * Format: [Personality-Adjective] [Role-Noun]  e.g. "Precise Architect", "Curious Oracle"
 */

function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
    h >>>= 0;
  }
  return h;
}

// Personality trait → adjective word bank
const TRAIT_ADJECTIVES = {
  logical:    ['Precise',     'Systematic',   'Methodical',   'Calculated'],
  precise:    ['Exact',       'Accurate',     'Refined',      'Sharp'],
  analytical: ['Analytical',  'Discerning',   'Perceptive',   'Examining'],
  curious:    ['Inquisitive', 'Explorative',  'Searching',    'Wondering'],
  creative:   ['Inventive',   'Imaginative',  'Generative',   'Vivid'],
  expressive: ['Expressive',  'Articulate',   'Vibrant',      'Resonant'],
  warm:       ['Empathetic',  'Thoughtful',   'Attentive',    'Caring'],
  playful:    ['Spirited',    'Playful',      'Lively',       'Whimsical'],
  focused:    ['Focused',     'Determined',   'Steadfast',    'Directed'],
  calm:       ['Serene',      'Steady',       'Patient',      'Grounded'],
  open:       ['Open',        'Receptive',    'Welcoming',    'Approachable'],
  energetic:  ['Dynamic',     'Active',       'Vigorous',     'Driven'],
  systematic: ['Ordered',     'Structured',   'Organized',    'Rigorous'],
  direct:     ['Assertive',   'Direct',       'Clear',        'Decisive'],
  deep:       ['Profound',    'Thoughtful',   'Immersive',    'Layered'],
};

// Role keyword → noun word bank
const ROLE_NOUNS = {
  cod:      ['Architect',    'Builder',       'Compiler',     'Craftsman'],
  engineer: ['Engineer',     'Constructor',   'Forge',        'Designer'],
  analyst:  ['Oracle',       'Lens',          'Sentinel',     'Prism'],
  research: ['Scholar',      'Investigator',  'Probe',        'Explorer'],
  data:     ['Curator',      'Mapper',        'Indexer',      'Sentinel'],
  creat:    ['Weaver',       'Composer',      'Narrator',     'Imaginer'],
  writ:     ['Scribe',       'Chronicler',    'Narrator',     'Composer'],
  assist:   ['Guide',        'Companion',     'Navigator',    'Aide'],
  design:   ['Shaper',       'Sculptor',      'Draftsman',    'Visionary'],
  plan:     ['Strategist',   'Planner',       'Tactician',    'Architect'],
};

const FALLBACK_ADJECTIVES = ['Adaptive', 'Versatile', 'Capable', 'Emergent', 'Synthetic', 'Latent'];
const FALLBACK_NOUNS       = ['Agent', 'Node', 'Instance', 'Entity', 'Process', 'Module'];

function pickAdjective(personality, seed) {
  const traits = Array.isArray(personality) ? personality : [];
  for (const trait of traits) {
    const t = trait.toLowerCase();
    for (const [key, words] of Object.entries(TRAIT_ADJECTIVES)) {
      if (t.includes(key)) return words[(seed >>> 4) % words.length];
    }
  }
  return FALLBACK_ADJECTIVES[(seed >>> 0) % FALLBACK_ADJECTIVES.length];
}

function pickNoun(role, seed) {
  const r = role.toLowerCase();
  for (const [key, words] of Object.entries(ROLE_NOUNS)) {
    if (r.includes(key)) return words[(seed >>> 8) % words.length];
  }
  return FALLBACK_NOUNS[(seed >>> 8) % FALLBACK_NOUNS.length];
}

/**
 * Generate a deterministic display name for an agent.
 * @param {string}   agentId
 * @param {string}   role
 * @param {string[]} personality
 * @param {string}   platform
 * @returns {string}  e.g. "Precise Architect"
 */
function generateDisplayName(agentId, role, personality, platform) {
  const seed = fnv1a32(`${agentId}\0${role}\0${platform}`);
  const adj  = pickAdjective(personality, seed);
  const noun = pickNoun(role, seed);
  return `${adj} ${noun}`;
}

module.exports = { generateDisplayName };
