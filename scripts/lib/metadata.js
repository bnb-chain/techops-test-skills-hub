'use strict';

/**
 * Skill submission validation (Job A / findings C1, M4 family).
 *
 * `validateStrict` enforces the formal submission contract
 * (schemas/skill.metadata.v1.json) used by the low-privilege parse-pr job:
 * unknown fields are rejected so a PR cannot smuggle extra keys past review.
 *
 * `extractCore` is the relaxed extraction used during enrichment, which may run
 * over an already-enriched file (push mode); it only asserts that the required
 * base fields are present and well-typed.
 */

const path = require('path');
const Ajv = require('ajv');

const submissionSchema = require(path.join(__dirname, '..', '..', 'schemas', 'skill.metadata.v1.json'));

const ajv = new Ajv({ allErrors: true });
const validateSubmissionSchema = ajv.compile(submissionSchema);

function formatErrors(errors) {
  return (errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`.trim());
}

function validateStrict(obj) {
  const valid = validateSubmissionSchema(obj);
  return { valid, errors: valid ? [] : formatErrors(validateSubmissionSchema.errors) };
}

function parseAndValidateStrict(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${err.message}`], data: null };
  }
  return { ...validateStrict(data), data };
}

function extractCore(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new Error('metadata must be a JSON object');
  }

  const { name, github_url: githubUrl, category, description } = obj;
  const errors = [];

  if (typeof githubUrl !== 'string' || githubUrl.trim() === '') {
    errors.push('github_url is required and must be a non-empty string');
  }
  if (!Array.isArray(category) || category.length === 0 || !category.every((c) => typeof c === 'string')) {
    errors.push('category must be a non-empty array of strings');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    errors.push('description is required and must be a non-empty string');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid submission: ${errors.join('; ')}`);
  }

  return {
    name: typeof name === 'string' && name.trim() !== '' ? name : null,
    githubUrl,
    category,
    description,
  };
}

module.exports = { validateStrict, parseAndValidateStrict, extractCore };
