/**
 * Security Module - MCP Server Security Protections
 *
 * Provides comprehensive security controls:
 * - Error sanitization (secret redaction, stack trace removal)
 * - Request/response size limits (DoS prevention)
 * - URI scheme validation (injection prevention)
 * - Prototype pollution protection (object sanitization)
 *
 * Defense in depth: Multiple layers protect against OWASP Top 10 threats.
 */

// Secret patterns to detect and redact
// IMPORTANT: Order matters - more specific patterns must come before generic patterns
const SECRET_PATTERNS = [
  // AWS Access Keys (AKIA + 16 alphanumeric chars)
  { regex: /AKIA[0-9A-Z]{16}/g, label: 'REDACTED_AWS_KEY' },

  // JWT tokens (three base64url segments separated by dots)
  { regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, label: 'REDACTED_JWT' },

  // Database connection strings
  { regex: /(?:mongodb|postgres|mysql|mariadb|mssql|oracle):\/\/[^\s]+/gi, label: 'REDACTED_CONNECTION_STRING' },

  // Bearer tokens
  { regex: /Bearer\s+[a-zA-Z0-9_\-\.]+/gi, label: 'Bearer [REDACTED]' },

  // GitHub tokens (personal access tokens, OAuth, app tokens, refresh tokens)
  // MUST come before generic API key pattern (which would match "token:")
  // GitHub tokens: gh[pors]_ prefix + 33-40 alphanumeric chars
  // Note: gh[pors] matches ghp, gho, ghr, ghs
  { regex: /gh[pors]_[a-zA-Z0-9]{33,40}/g, label: 'REDACTED_GITHUB_TOKEN' },

  // Slack tokens (format: xoxb-numbers-alphanumeric or similar hyphen-separated patterns)
  // MUST come before generic API key pattern (which would match "token:")
  { regex: /xox[bpas]-[a-zA-Z0-9]+-[a-zA-Z0-9-]+/g, label: 'REDACTED_SLACK_TOKEN' },

  // Private keys (RSA, EC, DSA)
  { regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g, label: 'REDACTED_PRIVATE_KEY' },

  // GCP API keys (AIzaSy prefix + variable length alphanumeric/special chars)
  { regex: /AIzaSy[0-9A-Za-z\-_]{21,}/g, label: 'REDACTED_GCP_KEY' },

  // Azure connection strings
  { regex: /AccountKey=[a-zA-Z0-9+\/=]{40,}/g, label: 'REDACTED_AZURE_KEY' },

  // Generic API key patterns (key=, token=, secret=, password= followed by value)
  // ReDoS mitigation: bounded whitespace quantifiers (max 10 instead of unbounded \s*)
  // MUST come LAST to avoid matching more specific token patterns above
  { regex: /(?:api[_-]?key|token|secret|password)\s{0,10}[=:]\s{0,10}['"]?([a-zA-Z0-9_\-\.]{16,})['"]?/gi, label: (match) => match.replace(/(['"]?)[a-zA-Z0-9_\-\.]{16,}(['"]?)/, '$1[REDACTED]$2') },
];

// Dangerous URI schemes that enable injection attacks
const DANGEROUS_SCHEMES = ['file', 'javascript', 'data', 'vbscript', 'about'];

/**
 * Sanitize error messages for safe output
 *
 * Security: Prevents information disclosure through error messages
 * - Removes stack traces in production (leak implementation details)
 * - Redacts secrets (AWS keys, JWTs, connection strings, API keys)
 * - Preserves error context for debugging
 *
 * @param {Error} error - Error object to sanitize
 * @param {boolean} isProduction - True to strip stack traces (default: true)
 * @returns {string} Sanitized error message
 */
export function sanitizeError(error, isProduction = true) {
  if (!error) return 'Unknown error';

  let message = error.message || String(error);

  // Redact secrets from message
  for (const pattern of SECRET_PATTERNS) {
    if (typeof pattern.label === 'function') {
      message = message.replace(pattern.regex, pattern.label);
    } else {
      message = message.replace(pattern.regex, `[${pattern.label}]`);
    }
  }

  // In production: strip stack traces completely
  // In development: include stack trace but redact secrets
  if (!isProduction && error.stack) {
    let stack = error.stack;

    // Redact secrets from stack trace
    for (const pattern of SECRET_PATTERNS) {
      if (typeof pattern.label === 'function') {
        stack = stack.replace(pattern.regex, pattern.label);
      } else {
        stack = stack.replace(pattern.regex, `[${pattern.label}]`);
      }
    }

    return stack;
  }

  return message;
}

/**
 * Validate request body size
 *
 * Security: Prevents DoS attacks via large payloads
 * - Default 1MB limit (configurable)
 * - Validates before parsing to avoid memory exhaustion
 *
 * @param {string|Object} body - Request body (JSON string or parsed object)
 * @param {number} maxSize - Maximum size in bytes (default: 1MB)
 * @throws {Error} If body exceeds maxSize
 */
export function validateRequestSize(body, maxSize = 1048576) {
  if (!body) return;

  const size = typeof body === 'string' ? body.length : JSON.stringify(body).length;

  if (size > maxSize) {
    throw new Error(`Request body too large: ${size} bytes (max: ${maxSize} bytes)`);
  }
}

/**
 * Validate response body size
 *
 * Security: Prevents DoS attacks via large responses
 * - Default 1MB limit (configurable)
 * - Protects clients from memory exhaustion
 *
 * @param {string|Object} body - Response body (JSON string or object)
 * @param {number} maxSize - Maximum size in bytes (default: 1MB)
 * @throws {Error} If body exceeds maxSize
 */
export function validateResponseSize(body, maxSize = 1048576) {
  if (!body) return;

  const size = typeof body === 'string' ? body.length : JSON.stringify(body).length;

  if (size > maxSize) {
    throw new Error(`Response body too large: ${size} bytes (max: ${maxSize} bytes)`);
  }
}

/**
 * Validate string input length
 *
 * Security: Prevents DoS via excessively long strings
 * - Default 10MB limit (configurable)
 * - Useful for individual string fields
 *
 * @param {string} value - String to validate
 * @param {number} maxLength - Maximum length in characters (default: 10MB)
 * @throws {Error} If string exceeds maxLength
 */
export function validateStringInput(value, maxLength = 10485760) {
  if (typeof value !== 'string') return;

  if (value.length > maxLength) {
    throw new Error(`String input too long: ${value.length} chars (max: ${maxLength} chars)`);
  }
}

/**
 * Validate URI scheme against allowlist
 *
 * Security: Prevents injection attacks via dangerous URI schemes
 * - Blocks file://, javascript:, data:, etc. by default
 * - Allows http:// and https:// by default
 * - Supports custom allowlists for special cases
 *
 * @param {string} uri - URI to validate
 * @param {string[]} allowedSchemes - Allowed schemes (default: ['http', 'https'])
 * @returns {boolean} True if URI scheme is allowed
 */
export function validateUriScheme(uri, allowedSchemes = ['http', 'https']) {
  if (!uri || typeof uri !== 'string') return false;

  // Extract scheme (characters before first colon)
  const schemeMatch = uri.match(/^([a-z][a-z0-9+.-]*?):/i);
  if (!schemeMatch) return false;

  const scheme = schemeMatch[1].toLowerCase();

  // Check if scheme is explicitly dangerous
  if (DANGEROUS_SCHEMES.includes(scheme)) {
    return false;
  }

  // Check if scheme is in allowlist
  return allowedSchemes.some(allowed => allowed.toLowerCase() === scheme);
}

/**
 * Canonicalize path and detect traversal attempts
 *
 * Security: Prevents path traversal attacks
 * - Detects ../ sequences that escape intended directory
 * - Handles double/triple encoding (%252e%252e%252f)
 * - Detects null byte injection (%00 and literal \0)
 * - Handles mixed encoding (%2e./, .%2e/)
 * - Checks Unicode variants (\u002e\u002e/)
 * - Normalizes path for consistent validation
 *
 * @param {string} uri - URI/path to canonicalize
 * @returns {string} Canonicalized path
 * @throws {Error} If path traversal detected
 */
export function canonicalizePath(uri) {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Invalid URI: must be a non-empty string');
  }

  // Decode URI repeatedly (max 3 iterations) to catch double/triple encoding
  let decoded = uri;
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break; // No more decoding needed
      decoded = nextDecoded;
    } catch {
      // Invalid URI encoding, continue with current value
      break;
    }
  }

  // Detect null byte injection (both encoded and literal)
  if (decoded.includes('%00') || decoded.includes('\0')) {
    throw new Error('Path traversal detected: null byte injection is not allowed');
  }

  // Detect Unicode variants of dots and slashes
  // \u002e = '.', \u002f = '/'
  if (decoded.includes('\u002e\u002e\u002f') || decoded.includes('\u002e\u002e/') || decoded.includes('..\u002f')) {
    throw new Error('Path traversal detected: Unicode-encoded ../ sequences are not allowed');
  }

  // Check fully decoded string for literal path traversal attempts
  if (decoded.includes('../') || decoded.includes('..\\')) {
    throw new Error('Path traversal detected: ../ sequences are not allowed');
  }

  // Check for mixed encoding in decoded string (case-insensitive)
  const lowerDecoded = decoded.toLowerCase();
  if (lowerDecoded.includes('%2e%2e%2f') || lowerDecoded.includes('%2e%2e/') || lowerDecoded.includes('..%2f') ||
      lowerDecoded.includes('%2e.') || lowerDecoded.includes('.%2e')) {
    throw new Error('Path traversal detected: encoded ../ sequences are not allowed');
  }

  // Normalize path separators
  let normalized = decoded.replace(/\\/g, '/');

  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');

  return normalized;
}

/**
 * Sanitize input object to prevent prototype pollution
 *
 * Security: Prevents prototype pollution attacks
 * - Strips __proto__, constructor, prototype keys
 * - Deep clones to avoid mutations
 * - Handles nested objects and arrays
 *
 * Reference: OWASP Prototype Pollution Prevention
 *
 * @param {*} obj - Object to sanitize
 * @returns {*} Clean copy with dangerous keys removed
 */
export function sanitizeInput(obj) {
  // Handle non-objects (primitives, null, undefined)
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeInput(item));
  }

  // Handle objects - create clean copy
  const sanitized = {};

  for (const key in obj) {
    // Skip prototype pollution vectors
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    // Recursively sanitize nested values
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      sanitized[key] = sanitizeInput(obj[key]);
    }
  }

  return sanitized;
}
