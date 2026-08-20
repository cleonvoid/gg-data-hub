import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JsonDataStore } from '../db/jsonStore.js';
import { RawSourceRecord, CanonicalEntity } from '../../src/types/index.js';

describe('Event tracking, appearances counting, and embeddingModel propagation', () => {
  let tempDir: string;
  let store: JsonDataStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edh-events-'));
    store = new JsonDataStore(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('Task 2: creates canonical entity with eventNames and finds it via event-name search', async () => {
    const entity = await store.createCanonicalEntity('org_test', {
      entityType: 'person',
      canonicalName: 'Nguyen Van An',
      canonicalOrg: 'VAST',
      canonicalRole: 'Researcher',
      canonicalEmail: 'an@vast.vn',
      canonicalPhone: '',
      eventNames: ['Hội Thảo Chuyển Đổi Số 2025'],
      orgId: 'org_test',
    });

    expect(entity.eventNames).toEqual(['Hội Thảo Chuyển Đổi Số 2025']);

    // Search by event name substring / query
    const results = await store.queryEntities('org_test', { search: 'Chuyển Đổi Số' });
    expect(results.items.length).toBe(1);
    expect(results.items[0].id).toBe(entity.id);

    // Search via structured filter
    const structuredResults = await store.queryEntities('org_test', {
      structuredFilters: [
        {
          field: 'eventNames',
          operator: 'contains',
          value: 'Chuyển Đổi Số 2025',
        },
      ],
    });
    expect(structuredResults.items.length).toBe(1);
    expect(structuredResults.items[0].id).toBe(entity.id);
  });

  it('Task 3: eventAppearancesCount reports eventNames.length when available', async () => {
    // 1. Raw record 1 from Event A
    const raw1: RawSourceRecord = {
      id: 'raw_1',
      sourceFileId: 'file_1',
      sourceFileName: 'event_a.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: {
        fullName: 'Tran Thi B',
        email: 'b@example.com',
        eventName: 'Event A',
      },
      normalizedIdentityKey: 'tran thi b',
      importedAt: new Date().toISOString(),
      orgId: 'org_test',
    };
    await store.addRawRecord(raw1);

    // Initial canonical created with Event A
    const canonical = await store.createCanonicalEntity('org_test', {
      entityType: 'person',
      canonicalName: 'Tran Thi B',
      canonicalOrg: 'Company',
      canonicalRole: 'Dev',
      canonicalEmail: 'b@example.com',
      canonicalPhone: '',
      eventNames: ['Event A'],
      eventAppearancesCount: 1,
      orgId: 'org_test',
    });

    // Link raw1
    await store.addEntityLink({
      id: 'link_1',
      rawRecordId: raw1.id,
      canonicalEntityId: canonical.id,
      status: 'approved',
      stage1SimilarityScore: 1.0,
      stage2Confidence: 1.0,
      adjudicationReason: 'Initial link',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      decidedBy: 'auto_merge',
    });

    // Raw record 2 from Event B
    const raw2: RawSourceRecord = {
      id: 'raw_2',
      sourceFileId: 'file_2',
      sourceFileName: 'event_b.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: {
        fullName: 'Tran Thi B',
        email: 'b@example.com',
        eventName: 'Event B',
      },
      normalizedIdentityKey: 'tran thi b',
      importedAt: new Date().toISOString(),
      orgId: 'org_test',
    };
    await store.addRawRecord(raw2);

    // Approve merge of raw2 into canonical
    const mergeRes = await store.approveMerge('org_test', 'sugg_1', raw2.id, canonical.id);
    expect(mergeRes.success).toBe(true);

    const updated = await store.getCanonicalEntity(canonical.id);
    expect(updated?.eventNames).toEqual(['Event A', 'Event B']);
    expect(updated?.eventAppearancesCount).toBe(2);
  });

  it('Task 3: eventAppearancesCount falls back to approved links count when eventNames is empty', async () => {
    // Canonical entity with empty eventNames
    const canonical = await store.createCanonicalEntity('org_test', {
      entityType: 'person',
      canonicalName: 'Le Van C',
      canonicalOrg: 'Corp',
      canonicalRole: 'Manager',
      canonicalEmail: 'c@example.com',
      canonicalPhone: '',
      eventNames: [],
      eventAppearancesCount: 1,
      orgId: 'org_test',
    });

    const raw1: RawSourceRecord = {
      id: 'raw_c1',
      sourceFileId: 'file_1',
      sourceFileName: 'list1.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: { fullName: 'Le Van C' }, // No eventName
      normalizedIdentityKey: 'le van c',
      importedAt: new Date().toISOString(),
      orgId: 'org_test',
    };
    await store.addRawRecord(raw1);

    await store.addEntityLink({
      id: 'link_c1',
      rawRecordId: raw1.id,
      canonicalEntityId: canonical.id,
      status: 'approved',
      stage1SimilarityScore: 1.0,
      stage2Confidence: 1.0,
      adjudicationReason: 'Initial link',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      decidedAt: new Date().toISOString(),
      decidedBy: 'auto_merge',
    });

    const raw2: RawSourceRecord = {
      id: 'raw_c2',
      sourceFileId: 'file_2',
      sourceFileName: 'list2.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: { fullName: 'Le Van C' }, // No eventName
      normalizedIdentityKey: 'le van c',
      importedAt: new Date().toISOString(),
      orgId: 'org_test',
    };
    await store.addRawRecord(raw2);

    await store.approveMerge('org_test', 'sugg_c2', raw2.id, canonical.id);

    const updated = await store.getCanonicalEntity(canonical.id);
    expect(updated?.eventNames).toEqual([]);
    // With 2 approved links and no eventNames, must report 2, not 1
    expect(updated?.eventAppearancesCount).toBe(2);
  });

  it('Task 4: approveMerge copies embeddingModel alongside embedding onto canonical entity', async () => {
    const raw: RawSourceRecord = {
      id: 'raw_emb_1',
      sourceFileId: 'file_emb',
      sourceFileName: 'emb.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: { fullName: 'Pham Van D', email: 'd@example.com' },
      normalizedIdentityKey: 'pham van d',
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'text-embedding-004',
      importedAt: new Date().toISOString(),
      orgId: 'org_test',
    };
    await store.addRawRecord(raw);

    const canonical = await store.createCanonicalEntity('org_test', {
      entityType: 'person',
      canonicalName: 'Pham Van D',
      canonicalOrg: 'Org',
      canonicalRole: 'Role',
      canonicalEmail: 'd@example.com',
      canonicalPhone: '',
      orgId: 'org_test',
    });

    expect(canonical.embedding).toBeUndefined();
    expect(canonical.embeddingModel).toBeUndefined();

    await store.approveMerge('org_test', 'sugg_emb_1', raw.id, canonical.id);

    const updated = await store.getCanonicalEntity(canonical.id);
    expect(updated?.embedding).toEqual([0.1, 0.2, 0.3]);
    expect(updated?.embeddingModel).toBe('text-embedding-004');
  });
});
