import { describe, it, expect, vi } from 'vitest';
import { buildIdentityKey, cosineSimilarity } from '../utils/vietnamese.js';

describe('Vietnamese linguistic & vector similarity utilities', () => {
  describe('buildIdentityKey', () => {
    it('is stable across diacritic and case variations of the same person', () => {
      const key1 = buildIdentityKey({
        fullName: 'Nguyễn Văn An',
        organization: 'Công ty TNHH FPT',
        email: 'an.nguyen@fpt.com.vn',
      });

      const key2 = buildIdentityKey({
        fullName: 'NGUYEN VAN AN',
        organization: 'CÔNG TY TNHH FPT',
        email: 'AN.NGUYEN@FPT.COM.VN',
      });

      const key3 = buildIdentityKey({
        fullName: 'An Nguyễn Văn',
        organization: 'công ty tnhh fpt',
        email: 'an.nguyen@fpt.com.vn',
      });

      expect(key1).toBe(key2);
      expect(key1).toBe(key3);
    });

    it('strips academic titles and honorifics', () => {
      const key1 = buildIdentityKey({
        fullName: 'GS.TS Nguyễn Văn An',
        organization: 'FPT',
        email: 'an@fpt.com',
      });

      const key2 = buildIdentityKey({
        fullName: 'Nguyễn Văn An',
        organization: 'FPT',
        email: 'an@fpt.com',
      });

      expect(key1).toBe(key2);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
      const vecA = [0.5, 0.5, 0.5, 0.5];
      const sim = cosineSimilarity(vecA, vecA);
      expect(sim).toBeCloseTo(1.0, 5);
    });

    it('returns near 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0, 0];
      const vecB = [0, 1, 0, 0];
      const sim = cosineSimilarity(vecA, vecB);
      expect(sim).toBeCloseTo(0.0, 5);
    });

    it('logs rather than throwing on a dimension mismatch and returns 0', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const vecA = [1, 2, 3];
      const vecB = [1, 2];

      expect(() => {
        const sim = cosineSimilarity(vecA, vecB);
        expect(sim).toBe(0);
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Embedding dimension mismatch')
      );

      consoleSpy.mockRestore();
    });
  });
});
