/**
 * Vietnamese linguistic normalization utilities for Entity Resolution
 */

// Common Vietnamese honorifics, titles, and academic degrees
const TITLES_REGEX = /\b(gs\.ts|pgs\.ts|gs|pgs|ts|ths|bs|thạc sĩ|tiến sĩ|giáo sư|phó giáo sư|ông|bà|anh|chị|dr|prof|mr|ms|mrs)\b\.?/gi;

// Legal & organization form synonyms
const ORG_PREFIX_MAP: Record<string, string> = {
  'cty tnhh': 'công ty tnhh',
  'cty': 'công ty',
  'tnhh': 'trách nhiệm hữu hạn',
  'ctcp': 'công ty cổ phần',
  'jsc': 'công ty cổ phần',
  'llc': 'công ty tnhh',
  'corp': 'tập đoàn',
  'group': 'tập đoàn',
  'viện': 'viện',
  'tt': 'trung tâm',
  'trung tâm': 'trung tâm',
  'dh': 'đại học',
  'đh': 'đại học',
  'univ': 'đại học',
};

/**
 * Strips Vietnamese diacritics / tone marks while handling đ/Đ correctly.
 */
export function removeVietnameseDiacritics(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim();
}

/**
 * Normalizes person name by removing academic titles, honorifics, excess whitespace,
 * and normalizing casing.
 */
export function normalizePersonName(name: string): string {
  if (!name) return '';
  let cleaned = name.trim();
  // Strip academic titles
  cleaned = cleaned.replace(TITLES_REGEX, '');
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Normalizes organization name for canonical key comparison.
 */
export function normalizeOrgName(org: string): string {
  if (!org) return '';
  let cleaned = org.toLowerCase().trim();
  // Standardize common abbreviations
  for (const [abbr, standard] of Object.entries(ORG_PREFIX_MAP)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    cleaned = cleaned.replace(regex, standard);
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Generates an informative, standardized identity string for dense vector embedding.
 */
export function buildIdentityString(data: {
  fullName?: string;
  organization?: string;
  role?: string;
  email?: string;
}): string {
  const normName = normalizePersonName(data.fullName || '');
  const unaccentedName = removeVietnameseDiacritics(normName);
  const normOrg = normalizeOrgName(data.organization || '');
  const unaccentedOrg = removeVietnameseDiacritics(normOrg);
  const role = (data.role || '').trim().toLowerCase();
  const email = (data.email || '').trim().toLowerCase();

  return `Tên: ${normName} | Tên không dấu: ${unaccentedName} | Đơn vị: ${normOrg} | Đơn vị không dấu: ${unaccentedOrg} | Chức vụ: ${role} | Email: ${email}`.trim();
}

/**
 * Computes Cosine Similarity between two floating point vector arrays.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
