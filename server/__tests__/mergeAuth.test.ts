import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JsonDataStore } from '../db/jsonStore.js';
import { RawSourceRecord, CanonicalEntity } from '../../src/types/index.js';

describe('JsonDataStore cross-org merge authorization', () => {
  let tempDir: string;
  let store: JsonDataStore;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edh-'));
    store = new JsonDataStore(tempDir);
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects approveMerge when caller org does not match entity org', async () => {
    const raw: RawSourceRecord = {
      id: 'raw_1',
      sourceFileId: 'file_1',
      sourceFileName: 'file.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 1,
      rawJson: {},
      parsedFields: { fullName: 'Nguyen Van A', email: 'a@example.com' },
      normalizedIdentityKey: 'nguyen van a',
      importedAt: new Date().toISOString(),
      orgId: 'org_a',
    };
    await store.addRawRecord(raw);

    const canonical = await store.createCanonicalEntity('org_a', {
      entityType: 'person',
      canonicalName: 'Nguyen Van A',
      canonicalOrg: 'Acme',
      canonicalRole: 'Dev',
      canonicalEmail: 'a@example.com',
      canonicalPhone: '',
      aliases: ['Nguyen Van A'],
      alternateEmails: ['a@example.com'],
      alternateOrgs: ['Acme'],
      eventNames: ['TechCon'],
      eventAppearancesCount: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      sourceFilesCount: 1,
      confidenceScore: 1.0,
      orgId: 'org_a',
    });

    // Call under org_b must be rejected
    await expect(
      store.approveMerge('org_b', 'sugg_1', raw.id, canonical.id)
    ).rejects.toThrow();

    // Call under org_a must succeed
    const res = await store.approveMerge('org_a', 'sugg_1', raw.id, canonical.id);
    expect(res.success).toBe(true);
  });

  it('rejects rejectMerge when caller org does not match entity org', async () => {
    const raw: RawSourceRecord = {
      id: 'raw_2',
      sourceFileId: 'file_1',
      sourceFileName: 'file.xlsx',
      sourceType: 'local_xlsx',
      rowIndex: 2,
      rawJson: {},
      parsedFields: { fullName: 'Tran Thi B', email: 'b@example.com' },
      normalizedIdentityKey: 'tran thi b',
      importedAt: new Date().toISOString(),
      orgId: 'org_a',
    };
    await store.addRawRecord(raw);

    const canonical = await store.createCanonicalEntity('org_a', {
      entityType: 'person',
      canonicalName: 'Tran Thi B',
      canonicalOrg: 'Beta',
      canonicalRole: 'Lead',
      canonicalEmail: 'b@example.com',
      canonicalPhone: '',
      aliases: ['Tran Thi B'],
      alternateEmails: ['b@example.com'],
      alternateOrgs: ['Beta'],
      eventNames: ['DesignCon'],
      eventAppearancesCount: 1,
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      sourceFilesCount: 1,
      confidenceScore: 1.0,
      orgId: 'org_a',
    });

    // Call under org_b must be rejected
    await expect(
      store.rejectMerge('org_b', 'sugg_2', raw.id, canonical.id)
    ).rejects.toThrow();

    // Call under org_a must succeed
    const res = await store.rejectMerge('org_a', 'sugg_2', raw.id, canonical.id);
    expect(res.success).toBe(true);
  });
});
