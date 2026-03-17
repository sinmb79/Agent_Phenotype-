'use strict';

/**
 * Agent Visual Identity System — 22B Labs
 * Unified entry point for all identity generators.
 *
 * Each generator is deterministic: same input → same output, always.
 */

const { generateFingerprint }  = require('./generators/fingerprint');
const { generateFace }         = require('./generators/face');
const { generatePalmLine }     = require('./generators/palmline');
const { generateDisplayName }  = require('./utils/nameGenerator');
const { generateBio }          = require('./utils/bioGenerator');

/**
 * Generate the full visual identity for an agent in one call.
 *
 * @param {object}   config
 *   @param {string}   config.id           - Unique agent identifier
 *   @param {string}   config.role         - Agent role string
 *   @param {string[]} config.personality  - Personality trait array
 *   @param {string}   config.platform     - Platform name
 *   @param {string}   config.created_at   - ISO 8601 timestamp
 *   @param {object}   config.activity_log - Activity summary object
 *
 * @returns {{
 *   fingerprint:   string,
 *   face:          string,
 *   palmline:      string,
 *   display_name:  string,
 *   bio:           string
 * }}
 */
function generateIdentity(config) {
  const {
    id,
    role,
    personality  = [],
    platform,
    created_at,
    activity_log = {},
  } = config;

  return {
    fingerprint  : generateFingerprint(id, created_at, platform),
    face         : generateFace(id, role, personality, platform, created_at),
    palmline     : generatePalmLine(id, activity_log),
    display_name : generateDisplayName(id, role, personality, platform),
    bio          : generateBio(id, role, personality, platform, activity_log),
  };
}

module.exports = {
  generateFingerprint,
  generateFace,
  generatePalmLine,
  generateDisplayName,
  generateBio,
  generateIdentity,
};
