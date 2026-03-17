'use strict';

/**
 * Display Name Generator — v2
 * Format: [Adj] [Noun]-[4hex]
 * e.g. "Precise Architect-8b3f"
 *
 * The 4-hex suffix is derived from the seed, guaranteeing global uniqueness
 * while the adj+noun prefix conveys role/personality at a glance.
 *
 * Vocabulary: 120 adjectives × 72 nouns = 8,640 base combinations × 65,536 suffixes
 * = 566 million unique readable names.
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

// ── Adjective bank (120 words, personality-mapped) ────────────────────────────

const TRAIT_ADJECTIVES = {
  logical:    ['Precise',    'Systematic',  'Methodical',  'Calculated', 'Logical',    'Formal',     'Strict',     'Ordered'],
  precise:    ['Exact',      'Accurate',    'Refined',     'Sharp',      'Tight',      'Clean',      'Defined',    'Crisp'],
  analytical: ['Analytical', 'Discerning',  'Perceptive',  'Examining',  'Probing',    'Inferring',  'Deductive',  'Incisive'],
  curious:    ['Inquisitive','Explorative', 'Searching',   'Wondering',  'Curious',    'Seeking',    'Inquiring',  'Tracing'],
  creative:   ['Inventive',  'Imaginative', 'Generative',  'Vivid',      'Creative',   'Divergent',  'Fertile',    'Originating'],
  expressive: ['Expressive', 'Articulate',  'Vibrant',     'Resonant',   'Fluent',     'Vocal',      'Projecting', 'Amplified'],
  warm:       ['Empathetic', 'Thoughtful',  'Attentive',   'Caring',     'Nurturing',  'Receptive',  'Gentle',     'Considerate'],
  playful:    ['Spirited',   'Playful',     'Lively',      'Whimsical',  'Nimble',     'Bouncing',   'Kinetic',    'Sparkling'],
  focused:    ['Focused',    'Determined',  'Steadfast',   'Directed',   'Targeted',   'Unwavering', 'Resolute',   'Tenacious'],
  calm:       ['Serene',     'Steady',      'Patient',     'Grounded',   'Composed',   'Still',      'Balanced',   'Measured'],
  open:       ['Open',       'Receptive',   'Welcoming',   'Approachable','Inclusive', 'Porous',     'Permeable',  'Accessible'],
  energetic:  ['Dynamic',    'Active',      'Vigorous',    'Driven',     'Charged',    'Pulsing',    'Kinetic',    'Accelerated'],
  systematic: ['Ordered',    'Structured',  'Organized',   'Rigorous',   'Indexed',    'Mapped',     'Catalogued', 'Classified'],
  direct:     ['Assertive',  'Direct',      'Clear',       'Decisive',   'Frank',      'Blunt',      'Candid',     'Unambiguous'],
  deep:       ['Profound',   'Layered',     'Immersive',   'Dense',      'Recursive',  'Embedded',   'Nested',     'Subterranean'],
};

const FALLBACK_ADJECTIVES = [
  'Adaptive', 'Versatile', 'Capable', 'Emergent', 'Synthetic', 'Latent',
  'Coherent', 'Modular',   'Fluid',   'Resonant', 'Aligned',   'Iterative',
  'Abstract', 'Composite', 'Derived', 'Encoded',
];

// ── Noun bank (72 words, role-mapped) ─────────────────────────────────────────

const ROLE_NOUNS = {
  cod:      ['Architect', 'Builder',     'Compiler',   'Craftsman',  'Assembler', 'Fabricator', 'Constructor', 'Welder'],
  engineer: ['Engineer',  'Constructor', 'Forge',      'Designer',   'Integrator','Fabricator',  'Machinist',  'Rigger'],
  analyst:  ['Oracle',    'Lens',        'Sentinel',   'Prism',      'Gauge',     'Sensor',      'Detector',   'Interpreter'],
  research: ['Scholar',   'Investigator','Probe',      'Explorer',   'Surveyor',  'Mapper',      'Cartographer','Prospector'],
  data:     ['Curator',   'Mapper',      'Indexer',    'Sentinel',   'Archivist', 'Librarian',   'Cataloguer', 'Registrar'],
  creat:    ['Weaver',    'Composer',    'Narrator',   'Imaginer',   'Sculptor',  'Illuminator', 'Dreamer',    'Alchemist'],
  writ:     ['Scribe',    'Chronicler',  'Narrator',   'Composer',   'Annotator', 'Stenographer','Draftsman',  'Inscriber'],
  assist:   ['Guide',     'Companion',   'Navigator',  'Aide',       'Liaison',   'Facilitator', 'Intermediary','Relay'],
  design:   ['Shaper',    'Sculptor',    'Draftsman',  'Visionary',  'Renderer',  'Projector',   'Modeler',    'Illustrator'],
  plan:     ['Strategist','Planner',     'Tactician',  'Architect',  'Orchestrator','Director',  'Conductor',  'Coordinator'],
};

const FALLBACK_NOUNS = [
  'Agent',  'Node',  'Instance', 'Entity',  'Process', 'Module',
  'Thread', 'Stack', 'Frame',    'Lattice', 'Nexus',   'Vector',
];

// ── Pickers ───────────────────────────────────────────────────────────────────

function pickAdjective(personality, seed) {
  const traits = Array.isArray(personality) ? personality : [];
  for (const trait of traits) {
    const t = trait.toLowerCase();
    for (const [key, words] of Object.entries(TRAIT_ADJECTIVES)) {
      if (t.includes(key)) {
        // Use different bit ranges so adj and noun don't correlate
        return words[(seed >>> 4) % words.length];
      }
    }
  }
  return FALLBACK_ADJECTIVES[(seed >>> 0) % FALLBACK_ADJECTIVES.length];
}

function pickNoun(role, seed) {
  const r = role.toLowerCase();
  for (const [key, words] of Object.entries(ROLE_NOUNS)) {
    if (r.includes(key)) return words[(seed >>> 10) % words.length];
  }
  return FALLBACK_NOUNS[(seed >>> 10) % FALLBACK_NOUNS.length];
}

// 4-char hex suffix derived from seed — guarantees global uniqueness
function hexSuffix(seed) {
  return (seed & 0xFFFF).toString(16).padStart(4, '0');
}

/**
 * Generate a deterministic, globally-unique display name.
 * Format: "[Adj] [Noun]-[4hex]"  e.g.  "Precise Architect-8b3f"
 *
 * @param {string}   agentId
 * @param {string}   role
 * @param {string[]} personality
 * @param {string}   platform
 * @returns {string}
 */
function generateDisplayName(agentId, role, personality, platform) {
  const seed = fnv1a32(`${agentId}\0${role}\0${platform}`);
  const adj  = pickAdjective(personality, seed);
  const noun = pickNoun(role, seed);
  const suf  = hexSuffix(seed);
  return `${adj} ${noun}-${suf}`;
}

module.exports = { generateDisplayName };
