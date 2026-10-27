#!/usr/bin/env node

/**
 * Validates operator and train JSON data files.
 * - Schema validation (required fields, types)
 * - Duplicate detection (IDs)
 * - Format validation (slug format for IDs)
 *
 * Usage:
 *   bun scripts/data/validate-data.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - Validation errors found
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '../../data');

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const errors = [];

function error(file, message) {
  errors.push({ file, message });
}

function loadArray(file) {
  let data;

  try {
    data = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    error(file, `Invalid JSON: ${e.message}`);
    return null;
  }

  if (!Array.isArray(data)) {
    error(file, 'Root must be an array');
    return null;
  }

  return data;
}

function validateEntries(file, label, { allowDefunct }) {
  const data = loadArray(file);
  if (!data) return;

  const seenIds = new Map();

  data.forEach((entry, index) => {
    const loc = `[${index}] ${entry.id || '(no id)'}`;

    if (typeof entry.id !== 'string' || !entry.id) {
      error(file, `${loc}: Missing or invalid 'id'`);
    } else if (!SLUG_REGEX.test(entry.id)) {
      error(
        file,
        `${loc}: Invalid ID format. Must be a lowercase slug (e.g., 'trenitalia')`,
      );
    } else if (seenIds.has(entry.id)) {
      error(
        file,
        `${loc}: Duplicate ID (first seen at index ${seenIds.get(entry.id)})`,
      );
    } else {
      seenIds.set(entry.id, index);
    }

    if (typeof entry.name !== 'string' || !entry.name) {
      error(file, `${loc}: Missing or invalid 'name'`);
    }
    if (entry.code !== null && typeof entry.code !== 'string') {
      error(file, `${loc}: 'code' must be a string or null`);
    }
    if (
      entry.defunct !== undefined &&
      (!allowDefunct || typeof entry.defunct !== 'boolean')
    ) {
      error(
        file,
        `${loc}: Invalid 'defunct' (operators only, must be boolean)`,
      );
    }
  });

  console.log(`Validated ${data.length} ${label}`);
}

console.log('Validating data files...\n');

validateEntries('operators.json', 'operators', { allowDefunct: true });
validateEntries('trains.json', 'trains', { allowDefunct: false });

console.log('');

if (errors.length > 0) {
  console.log(`❌ ${errors.length} error(s):`);
  errors.forEach((e) => {
    console.log(`   ${e.file}: ${e.message}`);
  });
  process.exit(1);
} else {
  console.log('✅ All validations passed');
}
