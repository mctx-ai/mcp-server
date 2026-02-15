/**
 * URI Template Matching Module
 *
 * Implements RFC 6570 Level 1 URI templates (simple string expansion {var}).
 * Provides utilities for matching request URIs against registered resource URIs
 * and extracting template parameters.
 *
 * @module uri
 */

/**
 * Checks if a URI contains template variables
 * @param {string} uri - The URI to check
 * @returns {boolean} True if URI contains {param} syntax
 *
 * @example
 * isTemplate('db://customers/123')           // false
 * isTemplate('db://customers/{id}')          // true
 * isTemplate('db://products/{id}/reviews')   // true
 */
export function isTemplate(uri) {
  if (!uri || typeof uri !== "string") return false;
  return /\{[^}]+\}/.test(uri);
}

/**
 * Extracts template variable names from a URI
 * @param {string} uri - The URI template
 * @returns {string[]} Array of variable names
 * @throws {Error} If template variable name is invalid
 *
 * @example
 * extractTemplateVars('db://customers/{id}')                    // ['id']
 * extractTemplateVars('db://products/{category}/items/{id}')    // ['category', 'id']
 * extractTemplateVars('db://customers/123')                     // []
 */
export function extractTemplateVars(uri) {
  if (!uri || typeof uri !== "string") return [];

  const matches = uri.matchAll(/\{([^}]+)\}/g);
  const vars = [];

  for (const match of matches) {
    const varName = match[1];

    // Validate: alphanumeric + underscore only (RFC 6570 Level 1)
    if (!/^[a-zA-Z0-9_]+$/.test(varName)) {
      throw new Error(
        `Invalid template variable name: "${varName}". Must contain only alphanumeric characters and underscores.`,
      );
    }

    vars.push(varName);
  }

  return vars;
}

/**
 * Matches a request URI against a registered URI template
 *
 * Returns null for no match, or an object with extracted parameters for match.
 * Handles both static URIs (exact match) and dynamic URIs (template expansion).
 *
 * @param {string} registeredUri - The registered URI (may contain {param} templates)
 * @param {string} requestUri - The incoming request URI (no templates)
 * @returns {Object|null} Match result: { params: { name: value, ... } } or null
 *
 * @example
 * // Static URI - exact match
 * matchUri('db://customers/schema', 'db://customers/schema')
 * // => { params: {} }
 *
 * matchUri('db://customers/schema', 'db://customers/list')
 * // => null
 *
 * // Dynamic URI - parameter extraction
 * matchUri('db://customers/{id}', 'db://customers/123')
 * // => { params: { id: '123' } }
 *
 * matchUri('db://products/{category}/items/{id}', 'db://products/electronics/items/456')
 * // => { params: { category: 'electronics', id: '456' } }
 *
 * matchUri('db://customers/{id}', 'db://products/123')
 * // => null (different path)
 */
export function matchUri(registeredUri, requestUri) {
  // Guard clauses
  if (!registeredUri || typeof registeredUri !== "string") return null;
  if (!requestUri || typeof requestUri !== "string") return null;

  // Static route: exact string match
  if (!isTemplate(registeredUri)) {
    return registeredUri === requestUri ? { params: {} } : null;
  }

  // Dynamic route: build regex pattern and extract params
  const templateVars = extractTemplateVars(registeredUri);

  // Escape regex special characters except {placeholders}
  // Convert {var} to named capture group
  let pattern = registeredUri
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // Escape regex chars
    .replace(/\\\{([^}]+)\\\}/g, "([^/]+)"); // Convert {var} to capture group

  pattern = `^${pattern}$`; // Exact match (anchored)

  const regex = new RegExp(pattern);
  const match = requestUri.match(regex);

  if (!match) return null;

  // Extract parameters from capture groups
  const params = {};
  for (let i = 0; i < templateVars.length; i++) {
    params[templateVars[i]] = match[i + 1]; // match[0] is full string, params start at [1]
  }

  return { params };
}
