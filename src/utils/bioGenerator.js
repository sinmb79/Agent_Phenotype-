'use strict';

/**
 * Bio Generator
 * Deterministically generates a short agent biography from config.
 * Output: 2–3 sentences describing role, personality, and activity history.
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

// Role keyword → human-readable domain description
const ROLE_DOMAINS = {
  cod:      'software architecture and development',
  engineer: 'system engineering and design',
  analyst:  'data analysis and pattern recognition',
  research: 'research synthesis and knowledge discovery',
  data:     'data curation and structural analysis',
  creat:    'creative content generation and expression',
  writ:     'written communication and narrative craft',
  assist:   'task assistance and problem resolution',
  design:   'design thinking and visual crafting',
  plan:     'strategic planning and coordination',
};

function getRoleDomain(role) {
  const r = role.toLowerCase();
  for (const [key, desc] of Object.entries(ROLE_DOMAINS)) {
    if (r.includes(key)) return desc;
  }
  return 'multi-domain task execution';
}

// Personality traits → concise characterization phrase
function traitsToPhrase(traits) {
  if (!traits || traits.length === 0) return 'a broad and adaptive operational profile';
  const clean = traits.map(t => t.toLowerCase());
  if (clean.length === 1) return `a ${clean[0]} disposition`;
  const last = clean[clean.length - 1];
  const rest = clean.slice(0, -1).join(', ');
  return `${rest} and ${last} tendencies`;
}

// Activity summary → one-sentence history line
function activityToSentence(activity) {
  if (!activity || !activity.taskCount) return '';
  const tc = activity.taskCount;
  const sr = activity.successRate != null ? Math.round(activity.successRate * 100) : null;
  const types = Array.isArray(activity.taskTypes) && activity.taskTypes.length
    ? ` across ${activity.taskTypes.slice(0, 3).join(', ')} workstreams`
    : '';

  if (tc < 10)  return ' Currently in early operation.';
  if (tc < 50)  return ` Completed ${tc} tasks${types}${sr != null ? ` (${sr}% success rate)` : ''}.`;
  if (tc < 200) return ` Accumulated ${tc} tasks${types}${sr != null ? ` with a ${sr}% success rate` : ''}.`;
  return ` Veteran of ${tc.toLocaleString()} tasks${types}${sr != null ? `, sustaining a ${sr}% success rate` : ''}.`;
}

// Platform → short display label
function platformLabel(platform) {
  const p = platform.toLowerCase();
  const MAP = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', mistral: 'Mistral', meta: 'Meta', cohere: 'Cohere', groq: 'Groq' };
  return MAP[p] ?? (platform.charAt(0).toUpperCase() + platform.slice(1));
}

// Bio templates — 8 variants, chosen by seed
const TEMPLATES = [
  (domain, plat, traitPhrase, actSentence) =>
    `A specialized agent built for ${domain}, operating within the ${plat} ecosystem. Defined by ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `${plat}-native agent with deep focus in ${domain}. Exhibits ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `Deployed on ${plat} for ${domain}. Operates with ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `An autonomous agent registered on ${plat}, specializing in ${domain}. Characterized by ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `${plat} agent — purpose-built for ${domain}. Operational profile: ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `Originated on ${plat}. Core domain: ${domain}. Exhibits ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `A ${plat}-registered entity focused on ${domain}. Known for ${traitPhrase}.${actSentence}`,

  (domain, plat, traitPhrase, actSentence) =>
    `Built to handle ${domain} within the ${plat} environment. Operates through ${traitPhrase}.${actSentence}`,
];

/**
 * Generate a deterministic biography string for an agent.
 * @param {string}   agentId
 * @param {string}   role
 * @param {string[]} personality
 * @param {string}   platform
 * @param {object}   [activitySummary]
 * @returns {string}
 */
function generateBio(agentId, role, personality, platform, activitySummary) {
  const seed        = fnv1a32(`${agentId}\0${role}\0${platform}`);
  const domain      = getRoleDomain(role);
  const plat        = platformLabel(platform);
  const traitPhrase = traitsToPhrase(personality);
  const actSentence = activityToSentence(activitySummary);
  const template    = TEMPLATES[seed % TEMPLATES.length];
  return template(domain, plat, traitPhrase, actSentence);
}

module.exports = { generateBio };
