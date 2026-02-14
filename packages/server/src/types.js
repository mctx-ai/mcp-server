/**
 * T - JSON Schema type system for MCP tool and prompt inputs
 *
 * Provides factory methods to build JSON Schema objects with a clean API.
 * Supports type validation, constraints, and nested schemas.
 */

/**
 * Creates a string type schema
 * @param {Object} options - Schema options
 * @param {boolean} [options.required] - Mark field as required (metadata for buildInputSchema)
 * @param {string} [options.description] - Field description
 * @param {Array} [options.enum] - Allowed values
 * @param {*} [options.default] - Default value
 * @param {number} [options.minLength] - Minimum string length
 * @param {number} [options.maxLength] - Maximum string length
 * @param {string} [options.pattern] - Regex pattern
 * @param {string} [options.format] - Format (email, uri, date-time, etc.)
 * @returns {Object} JSON Schema object
 */
function string(options = {}) {
  const schema = { type: 'string' };

  if (options.description !== undefined) schema.description = options.description;
  if (options.enum !== undefined) schema.enum = options.enum;
  if (options.default !== undefined) schema.default = options.default;
  if (options.minLength !== undefined) schema.minLength = options.minLength;
  if (options.maxLength !== undefined) schema.maxLength = options.maxLength;
  if (options.pattern !== undefined) schema.pattern = options.pattern;
  if (options.format !== undefined) schema.format = options.format;

  // Store required as metadata (not a JSON Schema keyword on properties)
  if (options.required === true) schema._required = true;

  return schema;
}

/**
 * Creates a number type schema
 * @param {Object} options - Schema options
 * @param {boolean} [options.required] - Mark field as required (metadata for buildInputSchema)
 * @param {string} [options.description] - Field description
 * @param {Array} [options.enum] - Allowed values
 * @param {*} [options.default] - Default value
 * @param {number} [options.min] - Minimum value (maps to 'minimum')
 * @param {number} [options.max] - Maximum value (maps to 'maximum')
 * @returns {Object} JSON Schema object
 */
function number(options = {}) {
  const schema = { type: 'number' };

  if (options.description !== undefined) schema.description = options.description;
  if (options.enum !== undefined) schema.enum = options.enum;
  if (options.default !== undefined) schema.default = options.default;
  if (options.min !== undefined) schema.minimum = options.min;
  if (options.max !== undefined) schema.maximum = options.max;

  if (options.required === true) schema._required = true;

  return schema;
}

/**
 * Creates a boolean type schema
 * @param {Object} options - Schema options
 * @param {boolean} [options.required] - Mark field as required (metadata for buildInputSchema)
 * @param {string} [options.description] - Field description
 * @param {*} [options.default] - Default value
 * @returns {Object} JSON Schema object
 */
function boolean(options = {}) {
  const schema = { type: 'boolean' };

  if (options.description !== undefined) schema.description = options.description;
  if (options.default !== undefined) schema.default = options.default;

  if (options.required === true) schema._required = true;

  return schema;
}

/**
 * Creates an array type schema
 * @param {Object} options - Schema options
 * @param {boolean} [options.required] - Mark field as required (metadata for buildInputSchema)
 * @param {string} [options.description] - Field description
 * @param {Object} [options.items] - Schema for array items
 * @param {*} [options.default] - Default value
 * @returns {Object} JSON Schema object
 */
function array(options = {}) {
  const schema = { type: 'array' };

  if (options.description !== undefined) schema.description = options.description;
  if (options.default !== undefined) schema.default = options.default;
  if (options.items !== undefined) {
    // Clean _required metadata from items schema
    schema.items = cleanMetadata(options.items);
  }

  if (options.required === true) schema._required = true;

  return schema;
}

/**
 * Creates an object type schema
 * @param {Object} options - Schema options
 * @param {boolean} [options.required] - Mark field as required (metadata for buildInputSchema)
 * @param {string} [options.description] - Field description
 * @param {Object} [options.properties] - Nested property schemas
 * @param {boolean|Object} [options.additionalProperties] - Allow additional properties
 * @param {*} [options.default] - Default value
 * @returns {Object} JSON Schema object
 */
function object(options = {}) {
  const schema = { type: 'object' };

  if (options.description !== undefined) schema.description = options.description;
  if (options.default !== undefined) schema.default = options.default;

  // Handle nested properties
  if (options.properties !== undefined) {
    const { properties, required } = buildProperties(options.properties);
    schema.properties = properties;
    if (required.length > 0) schema.required = required;
  }

  if (options.additionalProperties !== undefined) {
    if (typeof options.additionalProperties === 'boolean') {
      schema.additionalProperties = options.additionalProperties;
    } else {
      // Clean metadata from additionalProperties schema
      schema.additionalProperties = cleanMetadata(options.additionalProperties);
    }
  }

  if (options.required === true) schema._required = true;

  return schema;
}

/**
 * Builds properties object and extracts required fields
 * Helper for buildInputSchema and object()
 * @param {Object} properties - Properties map
 * @returns {{properties: Object, required: Array<string>}} Cleaned properties and required array
 */
function buildProperties(properties) {
  if (!properties || typeof properties !== 'object') {
    return { properties: {}, required: [] };
  }

  const cleanedProperties = {};
  const required = [];

  for (const [key, schema] of Object.entries(properties)) {
    if (!schema || typeof schema !== 'object') continue;

    // Extract required metadata
    if (schema._required === true) {
      required.push(key);
    }

    // Clean the schema (remove metadata)
    cleanedProperties[key] = cleanMetadata(schema);
  }

  return { properties: cleanedProperties, required };
}

/**
 * Removes framework metadata from schema
 * @param {Object} schema - Schema object
 * @returns {Object} Cleaned schema
 */
function cleanMetadata(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  // Create shallow copy
  const cleaned = { ...schema };

  // Remove metadata
  delete cleaned._required;

  // Recursively clean nested schemas
  if (cleaned.properties && typeof cleaned.properties === 'object') {
    const { properties, required } = buildProperties(cleaned.properties);
    cleaned.properties = properties;
    if (required.length > 0) cleaned.required = required;
  }

  if (cleaned.items && typeof cleaned.items === 'object') {
    cleaned.items = cleanMetadata(cleaned.items);
  }

  if (cleaned.additionalProperties && typeof cleaned.additionalProperties === 'object') {
    cleaned.additionalProperties = cleanMetadata(cleaned.additionalProperties);
  }

  return cleaned;
}

/**
 * Builds a complete MCP input schema from handler input definition
 * @param {Object} input - Handler input definition using T types
 * @returns {Object} Valid JSON Schema for MCP inputSchema
 */
export function buildInputSchema(input) {
  // Handle null/undefined input
  if (!input) {
    return {
      type: 'object',
      properties: {},
    };
  }

  // Build properties and extract required fields
  const { properties, required } = buildProperties(input);

  const schema = {
    type: 'object',
    properties,
  };

  // Only add required array if not empty
  if (required.length > 0) {
    schema.required = required;
  }

  return schema;
}

/**
 * T - Type factory object
 * Exports all type builders
 */
export const T = {
  string,
  number,
  boolean,
  array,
  object,
};
