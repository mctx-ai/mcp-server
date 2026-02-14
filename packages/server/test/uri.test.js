/**
 * URI Template Module Tests
 *
 * Tests URI matching, template detection, and parameter extraction.
 */

import { describe, it, expect } from 'vitest';
import { isTemplate, extractTemplateVars, matchUri } from '../src/uri.js';

describe('isTemplate()', () => {
  it('returns false for static URIs', () => {
    expect(isTemplate('db://customers/123')).toBe(false);
    expect(isTemplate('http://example.com/api')).toBe(false);
    expect(isTemplate('static://resource')).toBe(false);
  });

  it('returns true for template URIs', () => {
    expect(isTemplate('db://customers/{id}')).toBe(true);
    expect(isTemplate('db://products/{id}/reviews')).toBe(true);
    expect(isTemplate('http://api/{version}/users/{userId}')).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isTemplate(null)).toBe(false);
    expect(isTemplate(undefined)).toBe(false);
  });

  it('returns false for non-strings', () => {
    expect(isTemplate(123)).toBe(false);
    expect(isTemplate({})).toBe(false);
    expect(isTemplate([])).toBe(false);
  });

  it('detects multiple template variables', () => {
    expect(isTemplate('db://{resource}/{id}')).toBe(true);
  });
});

describe('extractTemplateVars()', () => {
  it('returns empty array for static URIs', () => {
    expect(extractTemplateVars('db://customers/123')).toEqual([]);
    expect(extractTemplateVars('static://resource')).toEqual([]);
  });

  it('extracts single variable', () => {
    expect(extractTemplateVars('db://customers/{id}')).toEqual(['id']);
  });

  it('extracts multiple variables', () => {
    const vars = extractTemplateVars('db://products/{category}/items/{id}');
    expect(vars).toEqual(['category', 'id']);
  });

  it('handles multiple variables in different positions', () => {
    const vars = extractTemplateVars('http://api/{version}/users/{userId}/posts/{postId}');
    expect(vars).toEqual(['version', 'userId', 'postId']);
  });

  it('returns empty array for null/undefined', () => {
    expect(extractTemplateVars(null)).toEqual([]);
    expect(extractTemplateVars(undefined)).toEqual([]);
  });

  it('returns empty array for non-strings', () => {
    expect(extractTemplateVars(123)).toEqual([]);
  });

  it('validates alphanumeric + underscore only', () => {
    expect(extractTemplateVars('db://{user_id}')).toEqual(['user_id']);
    expect(extractTemplateVars('db://{userId123}')).toEqual(['userId123']);
  });

  it('throws on invalid variable names', () => {
    expect(() => extractTemplateVars('db://{user-id}')).toThrow(/Invalid template variable name/);
    expect(() => extractTemplateVars('db://{user.id}')).toThrow(/Invalid template variable name/);
    expect(() => extractTemplateVars('db://{user id}')).toThrow(/Invalid template variable name/);
  });
});

describe('matchUri() - static URIs', () => {
  it('matches exact static URI', () => {
    const match = matchUri('db://customers/schema', 'db://customers/schema');
    expect(match).toEqual({ params: {} });
  });

  it('returns null for non-matching static URI', () => {
    const match = matchUri('db://customers/schema', 'db://customers/list');
    expect(match).toBeNull();
  });

  it('is case-sensitive', () => {
    const match = matchUri('db://Customers', 'db://customers');
    expect(match).toBeNull();
  });

  it('returns null for null/undefined registeredUri', () => {
    expect(matchUri(null, 'db://test')).toBeNull();
    expect(matchUri(undefined, 'db://test')).toBeNull();
  });

  it('returns null for null/undefined requestUri', () => {
    expect(matchUri('db://test', null)).toBeNull();
    expect(matchUri('db://test', undefined)).toBeNull();
  });
});

describe('matchUri() - template URIs', () => {
  it('matches template URI and extracts parameter', () => {
    const match = matchUri('db://customers/{id}', 'db://customers/123');
    expect(match).toEqual({
      params: { id: '123' },
    });
  });

  it('extracts multiple parameters', () => {
    const match = matchUri(
      'db://products/{category}/items/{id}',
      'db://products/electronics/items/456'
    );

    expect(match).toEqual({
      params: {
        category: 'electronics',
        id: '456',
      },
    });
  });

  it('returns null for non-matching template', () => {
    const match = matchUri('db://customers/{id}', 'db://products/123');
    expect(match).toBeNull();
  });

  it('returns null when path structure differs', () => {
    const match = matchUri('db://customers/{id}', 'db://customers/123/extra');
    expect(match).toBeNull();
  });

  it('does not match slashes in parameters', () => {
    const match = matchUri('db://users/{id}', 'db://users/123/posts');
    expect(match).toBeNull();
  });

  it('handles parameters at different positions', () => {
    const match = matchUri(
      'http://api/{version}/users/{userId}',
      'http://api/v1/users/alice'
    );

    expect(match).toEqual({
      params: {
        version: 'v1',
        userId: 'alice',
      },
    });
  });

  it('escapes special regex characters in static parts', () => {
    const match = matchUri('db://data.json/{id}', 'db://data.json/123');
    expect(match).toEqual({ params: { id: '123' } });
  });

  it('extracts numeric parameter values as strings', () => {
    const match = matchUri('db://items/{id}', 'db://items/42');
    expect(match).toEqual({
      params: { id: '42' },
    });
  });

  it('handles complex URIs', () => {
    const match = matchUri(
      'https://api.example.com/v2/orgs/{orgId}/repos/{repoId}/issues/{issueNumber}',
      'https://api.example.com/v2/orgs/acme/repos/webapp/issues/1234'
    );

    expect(match).toEqual({
      params: {
        orgId: 'acme',
        repoId: 'webapp',
        issueNumber: '1234',
      },
    });
  });
});

describe('matchUri() - special characters', () => {
  it('handles URIs with dots', () => {
    const match = matchUri('file://data.json', 'file://data.json');
    expect(match).toEqual({ params: {} });
  });

  it('handles URIs with hyphens', () => {
    const match = matchUri('db://my-database/{id}', 'db://my-database/abc-123');
    expect(match).toEqual({ params: { id: 'abc-123' } });
  });

  it('handles URIs with underscores', () => {
    const match = matchUri('db://users/{user_id}', 'db://users/alice_123');
    expect(match).toEqual({ params: { user_id: 'alice_123' } });
  });

  it('handles query strings in template params', () => {
    // Query strings are captured as part of the parameter value
    // because the regex pattern uses [^/]+ which stops at slashes but not at ?
    const match = matchUri(
      'http://api.com/users/{id}',
      'http://api.com/users/123?format=json'
    );
    expect(match).toEqual({ params: { id: '123?format=json' } });
  });
});
