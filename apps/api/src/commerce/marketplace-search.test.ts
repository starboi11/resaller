import { describe, expect, it } from 'vitest';
import { marketplaceScore, normalizeSearch, searchTerms } from './marketplace-search.js';

describe('marketplace search', () => {
  it('matches Uzbek Cyrillic and Latin text', () => {
    expect(normalizeSearch('Телефон ва Қулоқчин')).toBe('telefon va quloqchin');
  });
  it('expands common marketplace synonyms', () => {
    expect(searchTerms('noutbuk')).toContain('laptop');
  });
  it('tolerates a short typo', () => {
    expect(marketplaceScore('telefn', ['Yangi telefon'])).toBeGreaterThan(0);
  });
});
