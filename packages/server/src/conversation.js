/**
 * Conversation Module - Prompt System
 *
 * Provides a clean builder API for constructing MCP prompt messages.
 * Supports user and AI messages with text, images, and embedded resources.
 *
 * @module conversation
 */

/**
 * Creates a conversation using a builder function
 *
 * @param {Function} builderFn - Function that receives { user, ai } helpers
 * @returns {Object} MCP prompt result: { messages: [...] }
 *
 * @example
 * conversation(({ user, ai }) => [
 *   user.say("What's in this image?"),
 *   user.attach(base64data, "image/png"),
 *   user.embed("db://customers/schema"),
 *   ai.say("I see a customer schema with fields: id, name, email"),
 * ])
 * // Returns: { messages: [{ role: "user", content: {...} }, ...] }
 */
export function conversation(builderFn) {
  if (typeof builderFn !== 'function') {
    throw new Error('conversation() requires a builder function');
  }

  // Create helper objects
  const user = createRoleHelper('user');
  const ai = createRoleHelper('assistant');

  // Execute builder function
  const result = builderFn({ user, ai });

  // Validate result is array
  if (!Array.isArray(result)) {
    throw new Error('Builder function must return an array of messages');
  }

  return { messages: result };
}

/**
 * Creates a role-specific helper object with say/attach/embed methods
 * @private
 * @param {string} role - The role ("user" or "assistant")
 * @returns {Object} Helper with say/attach/embed methods
 */
function createRoleHelper(role) {
  return {
    /**
     * Add a text message
     * @param {string} text - The text content
     * @returns {Object} MCP message object
     */
    say(text) {
      if (typeof text !== 'string') {
        throw new Error(`${role}.say() requires a string argument`);
      }

      return {
        role,
        content: {
          type: 'text',
          text,
        },
      };
    },

    /**
     * Attach an image (base64 data)
     * @param {string} data - Base64-encoded image data
     * @param {string} mimeType - MIME type (REQUIRED: e.g., "image/png", "image/jpeg")
     * @returns {Object} MCP message object
     * @throws {Error} If mimeType is missing
     */
    attach(data, mimeType) {
      if (typeof data !== 'string') {
        throw new Error(`${role}.attach() requires base64 data as first argument`);
      }

      if (!mimeType || typeof mimeType !== 'string') {
        throw new Error(`${role}.attach() requires mimeType as second argument (e.g., "image/png")`);
      }

      return {
        role,
        content: {
          type: 'image',
          data,
          mimeType,
        },
      };
    },

    /**
     * Embed a resource by URI
     * @param {string} uri - The resource URI to embed
     * @returns {Object} MCP message object
     *
     * Note: Actual resource resolution happens at server level.
     * This creates a placeholder with [embedded] text.
     */
    embed(uri) {
      if (typeof uri !== 'string') {
        throw new Error(`${role}.embed() requires a URI string`);
      }

      return {
        role,
        content: {
          type: 'resource',
          resource: {
            uri,
            text: '[embedded]',
          },
        },
      };
    },
  };
}
