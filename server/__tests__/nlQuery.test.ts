import { describe, it, expect } from 'vitest';
import { fallbackParseNaturalLanguageQuery } from '../services/geminiService.js';

describe('Task 8: Natural language query translation', () => {
  it('asserts that "Ai đã tham gia hội thảo Chuyển đổi số 2025" produces exactly one eventNames filter and no canonicalRole filter', () => {
    const res = fallbackParseNaturalLanguageQuery('Ai đã tham gia hội thảo Chuyển đổi số 2025');

    // Check that there is no canonicalRole filter
    const roleFilters = res.filters.filter((f) => f.field === 'canonicalRole');
    expect(roleFilters.length).toBe(0);

    // Check that there is exactly one eventNames filter
    const eventFilters = res.filters.filter((f) => f.field === 'eventNames');
    expect(eventFilters.length).toBe(1);
    expect(String(eventFilters[0].value).toLowerCase()).toContain('hội thảo chuyển đổi số 2025');
  });

  it('stops event-name capture at trailing locative clauses ("ở ...", "tại ...")', () => {
    const res = fallbackParseNaturalLanguageQuery('Ai đã tham gia hội thảo Chuyển đổi số 2025 ở Hà Nội');

    const roleFilters = res.filters.filter((f) => f.field === 'canonicalRole');
    expect(roleFilters.length).toBe(0);

    const eventFilters = res.filters.filter((f) => f.field === 'eventNames');
    expect(eventFilters.length).toBe(1);
    expect(String(eventFilters[0].value).toLowerCase()).toBe('hội thảo chuyển đổi số 2025');
  });

  it('correctly matches AI role when used as a genuine role keyword, not interrogative pronoun', () => {
    const res = fallbackParseNaturalLanguageQuery('Tìm chuyên gia AI');
    const roleFilters = res.filters.filter((f) => f.field === 'canonicalRole');
    expect(roleFilters.length).toBe(1);
    expect(String(roleFilters[0].value).toLowerCase()).toBe('chuyên gia ai');
  });
});
