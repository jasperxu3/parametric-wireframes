'use strict';

const os = require('os');
const path = require('path');

function loadSharp() {
  const candidates = [
    'sharp',
    process.env.CODEX_SHARP_PATH,
    path.join(os.homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp')
  ].filter(Boolean);

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.code || error.message}`);
    }
  }

  throw new Error(`Sharp is required for PNG export. Set CODEX_SHARP_PATH to its module directory. Tried: ${failures.join('; ')}`);
}

module.exports = { loadSharp };
