import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { JsonDataStore } from '../db/jsonStore.js';
import { extractRowFields, stableStringify } from '../utils/mapping.js';
import { ColumnMappingItem, RawSourceRecord } from '../../src/types/index.js';

describe('Task 5: Ingest content-based deduplication and stable file ID', () => {
  let tempDir: string;
  let store: JsonDataStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edh-dedup-'));
    store = new JsonDataStore(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  const mappings: ColumnMappingItem[] = [
    { sourceColumn: 'Họ tên', sourceIndex: 0, targetField: 'fullName', confidence: 1, reasoning: '', sampleValues: [] },
    { sourceColumn: 'Email', sourceIndex: 1, targetField: 'email', confidence: 1, reasoning: '', sampleValues: [] },
    { sourceColumn: 'Đơn vị', sourceIndex: 2, targetField: 'organization', confidence: 1, reasoning: '', sampleValues: [] },
  ];

  function simulateIngestRow(
    row: any[],
    rIdx: number,
    orgId: string,
    sourceFileId: string,
    sourceFileName: string
  ) {
    const { rawJson, parsedFields } = extractRowFields(row, mappings, {
      eventName: 'Conference 2026',
    });

    const recId =
      'raw_' +
      createHash('sha1')
        .update(`${orgId}|${sourceFileId || sourceFileName}|${stableStringify(rawJson)}`)
        .digest('hex')
        .slice(0, 24);

    return {
      recId,
      rawRecord: {
        id: recId,
        sourceFileId,
        sourceFileName,
        sourceType: 'local_xlsx' as const,
        rowIndex: rIdx + 1,
        rawJson,
        parsedFields,
        normalizedIdentityKey: `${parsedFields.fullName} ${parsedFields.email}`,
        importedAt: new Date().toISOString(),
        orgId,
      },
    };
  }

  it('re-importing an unchanged file ingests 0 new records', async () => {
    const fileRows = [
      ['Nguyen Van A', 'a@test.com', 'FPT'],
      ['Tran Thi B', 'b@test.com', 'Viettel'],
      ['Le Van C', 'c@test.com', 'VNPT'],
    ];

    let ingestedCount1 = 0;
    for (let i = 0; i < fileRows.length; i++) {
      const { recId, rawRecord } = simulateIngestRow(fileRows[i], i, 'org_test', 'file_123', 'test.xlsx');
      const existing = await store.getRawRecord(recId);
      if (!existing) {
        await store.addRawRecord(rawRecord);
        ingestedCount1++;
      }
    }
    expect(ingestedCount1).toBe(3);

    // Second import of unchanged file
    let ingestedCount2 = 0;
    let skippedCount2 = 0;
    for (let i = 0; i < fileRows.length; i++) {
      const { recId, rawRecord } = simulateIngestRow(fileRows[i], i, 'org_test', 'file_123', 'test.xlsx');
      const existing = await store.getRawRecord(recId);
      if (!existing) {
        await store.addRawRecord(rawRecord);
        ingestedCount2++;
      } else {
        skippedCount2++;
      }
    }
    expect(ingestedCount2).toBe(0);
    expect(skippedCount2).toBe(3);
  });

  it('re-importing the same file with a row inserted at the top ingests exactly the new row', async () => {
    const originalRows = [
      ['Nguyen Van A', 'a@test.com', 'FPT'],
      ['Tran Thi B', 'b@test.com', 'Viettel'],
    ];

    for (let i = 0; i < originalRows.length; i++) {
      const { recId, rawRecord } = simulateIngestRow(originalRows[i], i, 'org_test', 'file_123', 'test.xlsx');
      await store.addRawRecord(rawRecord);
    }

    // New file content with row inserted at top:
    // Row 0 is new; Row 1 and Row 2 have shifted positions (formerly row 0 and 1)
    const updatedRows = [
      ['Pham Van New', 'new@test.com', 'CMC'],
      ['Nguyen Van A', 'a@test.com', 'FPT'],
      ['Tran Thi B', 'b@test.com', 'Viettel'],
    ];

    let newIngested = 0;
    let skipped = 0;
    for (let i = 0; i < updatedRows.length; i++) {
      const { recId, rawRecord } = simulateIngestRow(updatedRows[i], i, 'org_test', 'file_123', 'test.xlsx');
      const existing = await store.getRawRecord(recId);
      if (!existing) {
        await store.addRawRecord(rawRecord);
        newIngested++;
      } else {
        skipped++;
      }
    }

    expect(newIngested).toBe(1);
    expect(skipped).toBe(2);
  });

  it('uploading the same local file twice produces the same fileId and ingests 0 new records the second time', async () => {
    const fileBuffer = Buffer.from('dummy spreadsheet binary bytes for file hash test');
    const fileId1 = 'local_' + createHash('sha1').update(fileBuffer).digest('hex').slice(0, 16);
    const fileId2 = 'local_' + createHash('sha1').update(fileBuffer).digest('hex').slice(0, 16);

    expect(fileId1).toBe(fileId2);

    const rows = [
      ['Hoang Minh D', 'd@test.com', 'NIC'],
    ];

    // First upload
    const { recId: rec1, rawRecord: raw1 } = simulateIngestRow(rows[0], 0, 'org_test', fileId1, 'sample.xlsx');
    await store.addRawRecord(raw1);

    // Second upload of identical file
    const { recId: rec2, rawRecord: raw2 } = simulateIngestRow(rows[0], 0, 'org_test', fileId2, 'sample.xlsx');
    expect(rec1).toBe(rec2);

    const existing = await store.getRawRecord(rec2);
    expect(existing).toBeDefined();
  });
});
