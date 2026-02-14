/**
 * Types Module Tests
 *
 * Tests the T type system and buildInputSchema functionality.
 */

import { describe, it, expect } from 'vitest';
import { T, buildInputSchema } from '../src/types.js';

describe('T.string()', () => {
  it('creates basic string schema', () => {
    const schema = T.string();
    expect(schema).toEqual({ type: 'string' });
  });

  it('adds description', () => {
    const schema = T.string({ description: 'A name' });
    expect(schema.description).toBe('A name');
  });

  it('adds enum values', () => {
    const schema = T.string({ enum: ['red', 'green', 'blue'] });
    expect(schema.enum).toEqual(['red', 'green', 'blue']);
  });

  it('adds default value', () => {
    const schema = T.string({ default: 'hello' });
    expect(schema.default).toBe('hello');
  });

  it('adds minLength', () => {
    const schema = T.string({ minLength: 5 });
    expect(schema.minLength).toBe(5);
  });

  it('adds maxLength', () => {
    const schema = T.string({ maxLength: 100 });
    expect(schema.maxLength).toBe(100);
  });

  it('adds pattern', () => {
    const schema = T.string({ pattern: '^[a-z]+$' });
    expect(schema.pattern).toBe('^[a-z]+$');
  });

  it('adds format', () => {
    const schema = T.string({ format: 'email' });
    expect(schema.format).toBe('email');
  });

  it('marks as required (metadata)', () => {
    const schema = T.string({ required: true });
    expect(schema._required).toBe(true);
  });

  it('combines multiple options', () => {
    const schema = T.string({
      description: 'Email address',
      format: 'email',
      required: true,
      maxLength: 255,
    });

    expect(schema.type).toBe('string');
    expect(schema.description).toBe('Email address');
    expect(schema.format).toBe('email');
    expect(schema.maxLength).toBe(255);
    expect(schema._required).toBe(true);
  });
});

describe('T.number()', () => {
  it('creates basic number schema', () => {
    const schema = T.number();
    expect(schema).toEqual({ type: 'number' });
  });

  it('adds description', () => {
    const schema = T.number({ description: 'Age' });
    expect(schema.description).toBe('Age');
  });

  it('adds enum values', () => {
    const schema = T.number({ enum: [1, 2, 3] });
    expect(schema.enum).toEqual([1, 2, 3]);
  });

  it('adds default value', () => {
    const schema = T.number({ default: 42 });
    expect(schema.default).toBe(42);
  });

  it('adds min (maps to minimum)', () => {
    const schema = T.number({ min: 0 });
    expect(schema.minimum).toBe(0);
  });

  it('adds max (maps to maximum)', () => {
    const schema = T.number({ max: 100 });
    expect(schema.maximum).toBe(100);
  });

  it('marks as required (metadata)', () => {
    const schema = T.number({ required: true });
    expect(schema._required).toBe(true);
  });

  it('combines multiple options', () => {
    const schema = T.number({
      description: 'Age in years',
      min: 0,
      max: 120,
      required: true,
    });

    expect(schema.type).toBe('number');
    expect(schema.description).toBe('Age in years');
    expect(schema.minimum).toBe(0);
    expect(schema.maximum).toBe(120);
    expect(schema._required).toBe(true);
  });
});

describe('T.boolean()', () => {
  it('creates basic boolean schema', () => {
    const schema = T.boolean();
    expect(schema).toEqual({ type: 'boolean' });
  });

  it('adds description', () => {
    const schema = T.boolean({ description: 'Is active' });
    expect(schema.description).toBe('Is active');
  });

  it('adds default value', () => {
    const schema = T.boolean({ default: true });
    expect(schema.default).toBe(true);
  });

  it('marks as required (metadata)', () => {
    const schema = T.boolean({ required: true });
    expect(schema._required).toBe(true);
  });
});

describe('T.array()', () => {
  it('creates basic array schema', () => {
    const schema = T.array();
    expect(schema).toEqual({ type: 'array' });
  });

  it('adds description', () => {
    const schema = T.array({ description: 'List of items' });
    expect(schema.description).toBe('List of items');
  });

  it('adds default value', () => {
    const schema = T.array({ default: [] });
    expect(schema.default).toEqual([]);
  });

  it('adds items schema', () => {
    const schema = T.array({ items: T.string() });
    expect(schema.items).toEqual({ type: 'string' });
  });

  it('cleans metadata from items schema', () => {
    const schema = T.array({
      items: T.string({ required: true, description: 'Item' }),
    });

    expect(schema.items.type).toBe('string');
    expect(schema.items.description).toBe('Item');
    expect(schema.items._required).toBeUndefined();
  });

  it('marks as required (metadata)', () => {
    const schema = T.array({ required: true });
    expect(schema._required).toBe(true);
  });
});

describe('T.object()', () => {
  it('creates basic object schema', () => {
    const schema = T.object();
    expect(schema).toEqual({ type: 'object' });
  });

  it('adds description', () => {
    const schema = T.object({ description: 'User object' });
    expect(schema.description).toBe('User object');
  });

  it('adds default value', () => {
    const schema = T.object({ default: {} });
    expect(schema.default).toEqual({});
  });

  it('adds nested properties', () => {
    const schema = T.object({
      properties: {
        name: T.string(),
        age: T.number(),
      },
    });

    expect(schema.properties.name).toEqual({ type: 'string' });
    expect(schema.properties.age).toEqual({ type: 'number' });
  });

  it('extracts required fields from properties', () => {
    const schema = T.object({
      properties: {
        name: T.string({ required: true }),
        email: T.string({ required: true }),
        age: T.number(),
      },
    });

    expect(schema.required).toEqual(['name', 'email']);
    expect(schema.properties.name._required).toBeUndefined();
    expect(schema.properties.email._required).toBeUndefined();
  });

  it('adds additionalProperties (boolean)', () => {
    const schema = T.object({ additionalProperties: false });
    expect(schema.additionalProperties).toBe(false);
  });

  it('adds additionalProperties (schema)', () => {
    const schema = T.object({
      additionalProperties: T.string(),
    });

    expect(schema.additionalProperties).toEqual({ type: 'string' });
  });

  it('cleans metadata from additionalProperties schema', () => {
    const schema = T.object({
      additionalProperties: T.string({ required: true }),
    });

    expect(schema.additionalProperties._required).toBeUndefined();
  });

  it('marks as required (metadata)', () => {
    const schema = T.object({ required: true });
    expect(schema._required).toBe(true);
  });

  it('handles nested objects', () => {
    const schema = T.object({
      properties: {
        address: T.object({
          properties: {
            street: T.string({ required: true }),
            city: T.string({ required: true }),
            zip: T.string(),
          },
        }),
      },
    });

    expect(schema.properties.address.type).toBe('object');
    expect(schema.properties.address.properties.street.type).toBe('string');
    expect(schema.properties.address.required).toEqual(['street', 'city']);
    expect(schema.properties.address.properties.street._required).toBeUndefined();
  });
});

describe('buildInputSchema()', () => {
  it('handles null input', () => {
    const schema = buildInputSchema(null);
    expect(schema).toEqual({
      type: 'object',
      properties: {},
    });
  });

  it('handles undefined input', () => {
    const schema = buildInputSchema(undefined);
    expect(schema).toEqual({
      type: 'object',
      properties: {},
    });
  });

  it('builds schema from simple properties', () => {
    const schema = buildInputSchema({
      name: T.string({ required: true }),
      age: T.number(),
    });

    expect(schema.type).toBe('object');
    expect(schema.properties.name).toEqual({ type: 'string' });
    expect(schema.properties.age).toEqual({ type: 'number' });
    expect(schema.required).toEqual(['name']);
  });

  it('extracts required array', () => {
    const schema = buildInputSchema({
      email: T.string({ required: true }),
      password: T.string({ required: true }),
      remember: T.boolean(),
    });

    expect(schema.required).toEqual(['email', 'password']);
  });

  it('omits required array when empty', () => {
    const schema = buildInputSchema({
      name: T.string(),
      age: T.number(),
    });

    expect(schema.required).toBeUndefined();
  });

  it('handles nested objects', () => {
    const schema = buildInputSchema({
      user: T.object({
        properties: {
          name: T.string({ required: true }),
          email: T.string({ required: true }),
        },
      }),
    });

    expect(schema.properties.user.type).toBe('object');
    expect(schema.properties.user.properties.name.type).toBe('string');
    expect(schema.properties.user.required).toEqual(['name', 'email']);
    expect(schema.properties.user.properties.name._required).toBeUndefined();
  });

  it('handles arrays with items', () => {
    const schema = buildInputSchema({
      tags: T.array({
        items: T.string({ required: true }),
      }),
    });

    expect(schema.properties.tags.type).toBe('array');
    expect(schema.properties.tags.items).toEqual({ type: 'string' });
    expect(schema.properties.tags.items._required).toBeUndefined();
  });

  it('cleans metadata from all properties', () => {
    const schema = buildInputSchema({
      name: T.string({ required: true }),
      email: T.string({ required: true }),
      age: T.number(),
    });

    expect(schema.properties.name._required).toBeUndefined();
    expect(schema.properties.email._required).toBeUndefined();
    expect(schema.properties.age._required).toBeUndefined();
  });

  it('produces valid JSON Schema', () => {
    const schema = buildInputSchema({
      query: T.string({
        required: true,
        description: 'Search query',
        minLength: 1,
        maxLength: 500,
      }),
      limit: T.number({
        description: 'Max results',
        min: 1,
        max: 100,
        default: 10,
      }),
      tags: T.array({
        description: 'Filter tags',
        items: T.string({ enum: ['bug', 'feature', 'docs'] }),
      }),
    });

    expect(schema).toEqual({
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
          minLength: 1,
          maxLength: 500,
        },
        limit: {
          type: 'number',
          description: 'Max results',
          minimum: 1,
          maximum: 100,
          default: 10,
        },
        tags: {
          type: 'array',
          description: 'Filter tags',
          items: {
            type: 'string',
            enum: ['bug', 'feature', 'docs'],
          },
        },
      },
      required: ['query'],
    });
  });
});
