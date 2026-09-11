import { describe, expect, it } from 'vitest';
import {
  cleanVariantOptions,
  validateCategoryAttributes,
} from './catalog-validation.js';

describe('catalog validation', () => {
  it('normalizes variant options', () =>
    expect(cleanVariantOptions({ color: ' Green ' })).toEqual({
      color: 'Green',
    }));
  it('enforces required and enumerated category attributes', () => {
    const definitions = [
      {
        key: 'brand',
        type: 'SELECT',
        required: true,
        options: ['Apple', 'Samsung'],
      },
    ];
    expect(validateCategoryAttributes(definitions, { brand: 'Apple' })).toEqual(
      { brand: 'Apple' },
    );
    expect(() => validateCategoryAttributes(definitions, {})).toThrow(
      /Required/,
    );
    expect(() =>
      validateCategoryAttributes(definitions, { brand: 'Other' }),
    ).toThrow(/Invalid/);
  });
  it('rejects undeclared attributes', () =>
    expect(() => validateCategoryAttributes([], { hidden: true })).toThrow(
      /Unknown/,
    ));
});
