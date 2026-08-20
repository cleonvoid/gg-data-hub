import { describe, it, expect } from 'vitest';
import { extractRowFields } from '../utils/mapping.js';
import { ColumnMappingItem } from '../../src/types/index.js';

describe('extractRowFields column mapping order independence', () => {
  it('reads columns by sourceIndex even when mappings array is in reversed order', () => {
    // Sheet row: Col 0: Full Name, Col 1: Email, Col 2: Organization
    const row = ['Nguyen Van A', 'nguyen@example.com', 'FPT Software'];

    // Three mappings supplied in reversed order (sourceIndex 2, then 1, then 0)
    const reversedMappings: ColumnMappingItem[] = [
      {
        sourceColumn: 'Công ty',
        sourceIndex: 2,
        targetField: 'organization',
        confidence: 0.95,
        reasoning: '',
        sampleValues: ['FPT Software'],
      },
      {
        sourceColumn: 'Email',
        sourceIndex: 1,
        targetField: 'email',
        confidence: 0.99,
        reasoning: '',
        sampleValues: ['nguyen@example.com'],
      },
      {
        sourceColumn: 'Họ và tên',
        sourceIndex: 0,
        targetField: 'fullName',
        confidence: 0.98,
        reasoning: '',
        sampleValues: ['Nguyen Van A'],
      },
    ];

    const { rawJson, parsedFields } = extractRowFields(row, reversedMappings, {
      eventName: 'AI Summit 2026',
      eventDate: '2026-08-20',
    });

    // Confirm each target field receives the value from its own column
    expect(parsedFields.fullName).toBe('Nguyen Van A');
    expect(parsedFields.email).toBe('nguyen@example.com');
    expect(parsedFields.organization).toBe('FPT Software');
    expect(parsedFields.eventName).toBe('AI Summit 2026');
    expect(parsedFields.eventDate).toBe('2026-08-20');

    expect(rawJson['Họ và tên']).toBe('Nguyen Van A');
    expect(rawJson['Email']).toBe('nguyen@example.com');
    expect(rawJson['Công ty']).toBe('FPT Software');
  });
});
