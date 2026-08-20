import { ColumnMappingItem, CanonicalSchema } from '../../src/types/index.js';

/**
 * Extracts rawJson and parsedFields from a spreadsheet row according to column mappings.
 * Mapping array order does not need to match sheet column order; sourceIndex drives the read.
 */
export function extractRowFields(
  row: any[],
  mappings: ColumnMappingItem[],
  defaults: { eventName?: string; eventDate?: string } = {}
): { rawJson: Record<string, any>; parsedFields: Partial<CanonicalSchema> } {
  const rawJson: Record<string, any> = {};
  const parsedFields: Partial<CanonicalSchema> = {
    eventName: defaults.eventName || '',
    eventDate: defaults.eventDate || '',
  };

  mappings.forEach((m: ColumnMappingItem) => {
    // Read by declared column index. Mapping array order does not necessarily
    // match sheet column order, so array position must never be used here.
    const colIdx = m.sourceIndex;
    const cell = row[colIdx];
    const val = cell !== undefined && cell !== null ? String(cell).trim() : '';
    rawJson[m.sourceColumn || `Cột_${colIdx + 1}`] = val;

    if (m.targetField && m.targetField !== 'ignore' && val) {
      (parsedFields as any)[m.targetField] = val;
    }
  });

  return { rawJson, parsedFields };
}

/**
 * Deterministic JSON serialization with recursively sorted object keys.
 */
export function stableStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',') + '}';
}
