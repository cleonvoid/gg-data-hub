import fs from 'fs';
import path from 'path';
import {
  RawSourceRecord,
  CanonicalEntity,
  EntityLink,
  MergeSuggestion,
  IngestionStats,
  FilterParams,
} from '../../src/types/index.js';
import {
  cosineSimilarity,
  removeVietnameseDiacritics,
  buildIdentityKey,
} from '../utils/vietnamese.js';
import { DataStore } from './types.js';

interface DatabaseState {
  rawRecords: RawSourceRecord[];
  canonicalEntities: CanonicalEntity[];
  entityLinks: EntityLink[];
  pendingSuggestions: MergeSuggestion[];
  rejections?: { identityKey: string; canonicalEntityId: string; orgId: string; rejectedAt: string }[];
}

export class JsonDataStore implements DataStore {
  private rawRecords: Map<string, RawSourceRecord> = new Map();
  private canonicalEntities: Map<string, CanonicalEntity> = new Map();
  private entityLinks: Map<string, EntityLink> = new Map();
  private pendingSuggestions: Map<string, MergeSuggestion> = new Map();
  private rejections: Map<string, { identityKey: string; canonicalEntityId: string; orgId: string; rejectedAt: string }> = new Map();
  private storageFilePath: string;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    const dataDir = path.join(process.cwd(), '.data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (err) {
        console.warn('Could not create .data directory, running in-memory only', err);
      }
    }
    this.storageFilePath = path.join(dataDir, 'event_hub_store.json');
    this.loadFromDisk();

    // Process shutdown flush hooks
    const flushSync = () => this.flushToDiskSync();
    process.on('beforeExit', flushSync);
    process.on('SIGINT', () => {
      flushSync();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      flushSync();
      process.exit(0);
    });
  }

  private scheduleFlush(delayMs: number = 250) {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flushToDiskSync();
      this.flushTimer = null;
    }, delayMs);
  }

  private flushToDiskSync() {
    try {
      const state: DatabaseState = {
        rawRecords: Array.from(this.rawRecords.values()),
        canonicalEntities: Array.from(this.canonicalEntities.values()),
        entityLinks: Array.from(this.entityLinks.values()),
        pendingSuggestions: Array.from(this.pendingSuggestions.values()),
        rejections: Array.from(this.rejections.values()),
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database state to disk:', err);
    }
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const state: DatabaseState = JSON.parse(raw);
        this.rawRecords = new Map((state.rawRecords || []).map((r) => [r.id, r]));
        this.canonicalEntities = new Map((state.canonicalEntities || []).map((e) => [e.id, e]));
        this.entityLinks = new Map((state.entityLinks || []).map((l) => [l.id, l]));
        this.pendingSuggestions = new Map((state.pendingSuggestions || []).map((s) => [s.id, s]));
        this.rejections = new Map(
          (state.rejections || []).map((rej) => [`${rej.orgId}:${rej.identityKey}:${rej.canonicalEntityId}`, rej])
        );
        console.log(
          `[JsonStore] Loaded ${this.canonicalEntities.size} canonical entities, ${this.rawRecords.size} raw records, ${this.rejections.size} rejections.`
        );
      }
    } catch (err) {
      console.warn('[JsonStore] Could not load existing store from disk, starting fresh', err);
    }
  }

  public async clearAll(orgId: string): Promise<void> {
    for (const [id, r] of this.rawRecords.entries()) {
      if (!orgId || r.orgId === orgId) this.rawRecords.delete(id);
    }
    for (const [id, e] of this.canonicalEntities.entries()) {
      if (!orgId || e.orgId === orgId) this.canonicalEntities.delete(id);
    }
    for (const [id, l] of this.entityLinks.entries()) {
      // Find raw record to check org
      const raw = this.rawRecords.get(l.rawRecordId);
      if (!raw || !orgId || raw.orgId === orgId) this.entityLinks.delete(id);
    }
    for (const [id, s] of this.pendingSuggestions.entries()) {
      if (!orgId || s.rawRecord.orgId === orgId) this.pendingSuggestions.delete(id);
    }
    for (const [key, rej] of this.rejections.entries()) {
      if (!orgId || rej.orgId === orgId) this.rejections.delete(key);
    }
    this.scheduleFlush(0);
  }

  // --- Layer 1: Raw Records ---

  public async addRawRecord(record: RawSourceRecord): Promise<RawSourceRecord> {
    if (!record.identityKey) {
      record.identityKey = buildIdentityKey({
        fullName: record.parsedFields.fullName,
        organization: record.parsedFields.organization,
        email: record.parsedFields.email,
      });
    }
    this.rawRecords.set(record.id, record);
    this.scheduleFlush();
    return record;
  }

  public async getRawRecord(id: string): Promise<RawSourceRecord | undefined> {
    return this.rawRecords.get(id);
  }

  public async getAllRawRecords(orgId?: string): Promise<RawSourceRecord[]> {
    const all = Array.from(this.rawRecords.values());
    if (!orgId) return all;
    return all.filter((r) => r.orgId === orgId);
  }

  // --- Layer 2: Canonical Entities ---

  public async createCanonicalEntity(orgId: string, data: Partial<CanonicalEntity>): Promise<CanonicalEntity> {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const entity: CanonicalEntity = {
      id,
      entityType: data.entityType || 'person',
      canonicalName: (data.canonicalName || 'Khách không tên').trim(),
      canonicalOrg: (data.canonicalOrg || '').trim(),
      canonicalRole: (data.canonicalRole || '').trim(),
      canonicalEmail: (data.canonicalEmail || '').trim(),
      canonicalPhone: (data.canonicalPhone || '').trim(),
      aliases: data.aliases || [data.canonicalName ? data.canonicalName.trim() : 'Khách không tên'],
      alternateEmails: data.alternateEmails || (data.canonicalEmail ? [data.canonicalEmail.trim()] : []),
      alternateOrgs: data.alternateOrgs || (data.canonicalOrg ? [data.canonicalOrg.trim()] : []),
      eventAppearancesCount: data.eventAppearancesCount || 1,
      firstSeenAt: data.firstSeenAt || now,
      lastSeenAt: data.lastSeenAt || now,
      sourceFilesCount: data.sourceFilesCount || 1,
      confidenceScore: data.confidenceScore ?? 1.0,
      embedding: data.embedding,
      orgId: orgId || data.orgId || 'org_default',
      createdAt: now,
      updatedAt: now,
    };
    this.canonicalEntities.set(id, entity);
    this.scheduleFlush();
    return entity;
  }

  public async getCanonicalEntity(id: string): Promise<CanonicalEntity | undefined> {
    return this.canonicalEntities.get(id);
  }

  public async getAllCanonicalEntities(orgId: string): Promise<CanonicalEntity[]> {
    const all = Array.from(this.canonicalEntities.values());
    if (!orgId) return all;
    return all.filter((e) => e.orgId === orgId);
  }

  public async updateCanonicalEntity(
    orgId: string,
    id: string,
    payload: Partial<CanonicalEntity>
  ): Promise<CanonicalEntity> {
    const existing = this.canonicalEntities.get(id);
    if (!existing) throw new Error(`Canonical entity not found: ${id}`);
    const updated: CanonicalEntity = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    this.canonicalEntities.set(id, updated);
    this.scheduleFlush();
    return updated;
  }

  // --- Layer 3: Link Records ---

  public async addEntityLink(link: EntityLink): Promise<EntityLink> {
    this.entityLinks.set(link.id, link);
    this.scheduleFlush();
    return link;
  }

  private getEntityLinksForCanonical(canonicalId: string): EntityLink[] {
    return Array.from(this.entityLinks.values()).filter(
      (link) => link.canonicalEntityId === canonicalId && link.status === 'approved'
    );
  }

  public async isPairRejected(
    orgId: string,
    identityKeyOrRecordId: string,
    canonicalEntityId: string
  ): Promise<boolean> {
    // 1. Check identity-key level rejection (Task 4)
    const rejKey = `${orgId}:${identityKeyOrRecordId}:${canonicalEntityId}`;
    if (this.rejections.has(rejKey)) return true;

    // Check if identityKeyOrRecordId matches a raw record ID
    const raw = this.rawRecords.get(identityKeyOrRecordId);
    if (raw && raw.identityKey) {
      const rawRejKey = `${orgId}:${raw.identityKey}:${canonicalEntityId}`;
      if (this.rejections.has(rawRejKey)) return true;
    }

    // 2. Check link level rejection
    return Array.from(this.entityLinks.values()).some(
      (link) =>
        link.canonicalEntityId === canonicalEntityId &&
        link.status === 'rejected' &&
        (link.rawRecordId === identityKeyOrRecordId ||
          (raw && link.rawRecordId === raw.id))
    );
  }

  public async recordRejection(
    orgId: string,
    identityKey: string,
    canonicalEntityId: string
  ): Promise<void> {
    const key = `${orgId}:${identityKey}:${canonicalEntityId}`;
    this.rejections.set(key, {
      identityKey,
      canonicalEntityId,
      orgId,
      rejectedAt: new Date().toISOString(),
    });
    this.scheduleFlush();
  }

  // --- Stage 1 Vector Similarity Search ---

  public async findTopCandidatesByVector(
    orgId: string,
    queryEmbedding: number[],
    topN: number = 5,
    minSimilarity: number = 0.65
  ): Promise<{ entity: CanonicalEntity; similarity: number }[]> {
    const results: { entity: CanonicalEntity; similarity: number }[] = [];
    const orgEntities = Array.from(this.canonicalEntities.values()).filter(
      (e) => !orgId || e.orgId === orgId
    );

    for (const entity of orgEntities) {
      let bestSim = 0;

      // 1. Check canonical embedding directly if present
      if (entity.embedding && entity.embedding.length > 0) {
        bestSim = cosineSimilarity(queryEmbedding, entity.embedding);
      } else {
        // 2. Fall back to max similarity across approved raw records linked to this canonical
        const links = this.getEntityLinksForCanonical(entity.id);
        for (const link of links) {
          const rawRec = this.rawRecords.get(link.rawRecordId);
          if (rawRec?.embedding) {
            const sim = cosineSimilarity(queryEmbedding, rawRec.embedding);
            if (sim > bestSim) {
              bestSim = sim;
            }
          }
        }
      }

      if (bestSim >= minSimilarity) {
        results.push({ entity, similarity: bestSim });
      }
    }

    // Sort descending by similarity score
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topN);
  }

  // --- Merge Management & Adjudication ---

  /**
   * Merge endpoints take document IDs straight from the request body, so every
   * resolved document must be re-checked against the caller's org before any write.
   * Without this a caller can merge into another tenant's canonical entity.
   */
  private assertInOrg(orgId: string, doc: { orgId?: string } | undefined, label: string): void {
    if (!doc) {
      throw new Error(`${label} không tồn tại`);
    }
    if (orgId && doc.orgId !== orgId) {
      throw new Error(`${label} không thuộc tổ chức của bạn`);
    }
  }

  public async addPendingSuggestion(suggestion: MergeSuggestion): Promise<MergeSuggestion> {
    this.pendingSuggestions.set(suggestion.id, suggestion);
    this.scheduleFlush();
    return suggestion;
  }

  public async getPendingSuggestions(orgId: string): Promise<MergeSuggestion[]> {
    const all = Array.from(this.pendingSuggestions.values());
    if (!orgId) return all;
    return all.filter((s) => s.rawRecord.orgId === orgId);
  }

  public async approveMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy: 'user' | 'system_initial' | 'auto_merge' = 'user'
  ): Promise<{ success: boolean; canonicalEntity: CanonicalEntity }> {
    // Task 3: Look up pending suggestion BEFORE removing it to preserve real model audit values
    const suggestion = this.pendingSuggestions.get(suggestionId);
    if (suggestion) {
      this.assertInOrg(orgId, suggestion.rawRecord, 'Gợi ý gộp');
    }

    const raw = this.rawRecords.get(rawRecordId);
    const canonical = this.canonicalEntities.get(canonicalEntityId);

    this.assertInOrg(orgId, raw, 'Bản ghi nguồn');
    this.assertInOrg(orgId, canonical, 'Thực thể chuẩn hóa');

    // 1. Create link record with true audit data
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const link: EntityLink = {
      id: linkId,
      rawRecordId,
      canonicalEntityId,
      status: 'approved',
      stage1SimilarityScore: suggestion ? suggestion.vectorSimilarity : null,
      stage2Confidence: suggestion ? suggestion.llmConfidence : null,
      adjudicationReason: suggestion
        ? suggestion.llmReasoning
        : 'Phê duyệt ghép thực thể thủ công từ người dùng',
      decidedBy,
      decidedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.entityLinks.set(linkId, link);

    // 2. Merge details into canonical entity
    const parsed = raw.parsedFields;
    if (parsed.fullName && !canonical.aliases.includes(parsed.fullName.trim())) {
      canonical.aliases.push(parsed.fullName.trim());
    }
    if (parsed.email && !canonical.alternateEmails.includes(parsed.email.trim())) {
      canonical.alternateEmails.push(parsed.email.trim());
      if (!canonical.canonicalEmail) canonical.canonicalEmail = parsed.email.trim();
    }
    if (parsed.organization && !canonical.alternateOrgs.includes(parsed.organization.trim())) {
      canonical.alternateOrgs.push(parsed.organization.trim());
      if (!canonical.canonicalOrg) canonical.canonicalOrg = parsed.organization.trim();
    }
    if (parsed.role && !canonical.canonicalRole) {
      canonical.canonicalRole = parsed.role.trim();
    }
    if (parsed.phone && !canonical.canonicalPhone) {
      canonical.canonicalPhone = parsed.phone.trim();
    }

    // Recalculate event appearances and source files
    const approvedLinks = this.getEntityLinksForCanonical(canonical.id);
    const uniqueFiles = new Set<string>();
    for (const l of approvedLinks) {
      const r = this.rawRecords.get(l.rawRecordId);
      if (r) uniqueFiles.add(r.sourceFileId);
    }

    canonical.eventAppearancesCount = approvedLinks.length;
    canonical.sourceFilesCount = Math.max(1, uniqueFiles.size);
    canonical.lastSeenAt = new Date().toISOString();

    // Maintain embedding on canonical entity if not set
    if (!canonical.embedding && raw.embedding) {
      canonical.embedding = raw.embedding;
    }

    await this.updateCanonicalEntity(orgId, canonical.id, canonical);

    // 3. Remove suggestion from pending queue
    this.pendingSuggestions.delete(suggestionId);
    this.scheduleFlush();

    return { success: true, canonicalEntity: canonical };
  }

  public async rejectMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason: string = 'Người dùng từ chối gợi ý gộp'
  ): Promise<{ success: boolean }> {
    // Task 3: Look up pending suggestion before deleting
    const suggestion = this.pendingSuggestions.get(suggestionId);
    if (suggestion) {
      this.assertInOrg(orgId, suggestion.rawRecord, 'Gợi ý gộp');
    }
    const raw = this.rawRecords.get(rawRecordId);
    const canonical = this.canonicalEntities.get(canonicalEntityId);

    this.assertInOrg(orgId, raw, 'Bản ghi nguồn');
    this.assertInOrg(orgId, canonical, 'Thực thể chuẩn hóa');

    // Task 4: Store rejection by identityKey
    const identityKey = raw?.identityKey || (raw ? buildIdentityKey({
      fullName: raw.parsedFields.fullName,
      organization: raw.parsedFields.organization,
      email: raw.parsedFields.email,
    }) : rawRecordId);

    await this.recordRejection(orgId, identityKey, canonicalEntityId);

    // Record rejection in entityLinks
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const link: EntityLink = {
      id: linkId,
      rawRecordId,
      canonicalEntityId,
      status: 'rejected',
      stage1SimilarityScore: suggestion ? suggestion.vectorSimilarity : null,
      stage2Confidence: suggestion ? suggestion.llmConfidence : null,
      adjudicationReason: reason || (suggestion ? suggestion.llmReasoning : 'Từ chối ghép thực thể'),
      decidedBy: 'user',
      decidedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.entityLinks.set(linkId, link);

    // If this raw record doesn't belong to any canonical entity yet, create its own distinct canonical entity
    const existingApprovedLinks = Array.from(this.entityLinks.values()).filter(
      (l) => l.rawRecordId === rawRecordId && l.status === 'approved'
    );

    if (existingApprovedLinks.length === 0 && raw) {
      const newEntity = await this.createCanonicalEntity(orgId, {
        entityType: 'person',
        canonicalName: raw.parsedFields.fullName || 'Khách không tên',
        canonicalOrg: raw.parsedFields.organization,
        canonicalRole: raw.parsedFields.role,
        canonicalEmail: raw.parsedFields.email,
        canonicalPhone: raw.parsedFields.phone,
        embedding: raw.embedding,
        orgId,
      });

      // Link to its own new entity
      const selfLinkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await this.addEntityLink({
        id: selfLinkId,
        rawRecordId: raw.id,
        canonicalEntityId: newEntity.id,
        status: 'approved',
        stage1SimilarityScore: 1.0,
        stage2Confidence: 1.0,
        adjudicationReason: 'Thực thể chuẩn riêng biệt sau khi từ chối ứng viên gộp',
        decidedBy: 'user',
        decidedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.pendingSuggestions.delete(suggestionId);
    this.scheduleFlush();
    return { success: true };
  }

  // --- Aggregate Stats & Multi-Field Filtered Querying ---

  public async getStats(orgId: string): Promise<IngestionStats> {
    const orgEntities = Array.from(this.canonicalEntities.values()).filter(
      (e) => !orgId || e.orgId === orgId
    );
    const orgRawRecords = Array.from(this.rawRecords.values()).filter(
      (r) => !orgId || r.orgId === orgId
    );
    const orgPending = Array.from(this.pendingSuggestions.values()).filter(
      (s) => !orgId || s.rawRecord.orgId === orgId
    );

    const totalCanonical = orgEntities.length;
    const totalRaw = orgRawRecords.length;
    const pendingCount = orgPending.length;

    const sourceFileIds = new Set<string>();
    const breakdown = {
      drive_sheets: 0,
      local_xlsx: 0,
      seed: 0,
    };

    for (const r of orgRawRecords) {
      sourceFileIds.add(r.sourceFileId);
      if (r.sourceType in breakdown) {
        breakdown[r.sourceType]++;
      }
    }

    const dedupRatio = totalRaw > 0 ? Math.round(((totalRaw - totalCanonical) / totalRaw) * 100) : 0;

    return {
      totalCanonicalEntities: totalCanonical,
      totalRawRecords: totalRaw,
      totalPendingMerges: pendingCount,
      totalSourceFiles: sourceFileIds.size,
      dedupRatio: Math.max(0, dedupRatio),
      sourcesBreakdown: breakdown,
    };
  }

  public async queryEntities(
    orgId: string,
    params: FilterParams
  ): Promise<{
    items: CanonicalEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    let entities = Array.from(this.canonicalEntities.values()).filter(
      (e) => !orgId || e.orgId === orgId
    );

    // 1. Text search across name, aliases, org, email, role
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      const qUnaccented = removeVietnameseDiacritics(q);

      entities = entities.filter((e) => {
        const nameMatch =
          e.canonicalName.toLowerCase().includes(q) ||
          removeVietnameseDiacritics(e.canonicalName.toLowerCase()).includes(qUnaccented);
        const orgMatch =
          e.canonicalOrg.toLowerCase().includes(q) ||
          removeVietnameseDiacritics(e.canonicalOrg.toLowerCase()).includes(qUnaccented);
        const emailMatch = e.canonicalEmail.toLowerCase().includes(q);
        const roleMatch =
          e.canonicalRole.toLowerCase().includes(q) ||
          removeVietnameseDiacritics(e.canonicalRole.toLowerCase()).includes(qUnaccented);
        const aliasMatch = e.aliases.some((a) =>
          removeVietnameseDiacritics(a.toLowerCase()).includes(qUnaccented)
        );

        return nameMatch || orgMatch || emailMatch || roleMatch || aliasMatch;
      });
    }

    // 2. Structured field filters
    if (params.organization) {
      const orgQ = removeVietnameseDiacritics(params.organization.toLowerCase());
      entities = entities.filter((e) =>
        removeVietnameseDiacritics(e.canonicalOrg.toLowerCase()).includes(orgQ)
      );
    }

    if (params.minAppearances) {
      entities = entities.filter((e) => e.eventAppearancesCount >= params.minAppearances!);
    }

    // 3. AI Translated Structured Filters (Safe Parameterized Whitelist)
    if (params.structuredFilters && params.structuredFilters.length > 0) {
      for (const filter of params.structuredFilters) {
        entities = entities.filter((e) => {
          const val = (e as any)[filter.field];
          if (filter.field === 'eventAppearancesCount') {
            const num = Number(val) || 0;
            const target = Number(filter.value) || 0;
            if (filter.operator === 'greaterThan') return num >= target;
            if (filter.operator === 'lessThan') return num <= target;
            if (filter.operator === 'equals') return num === target;
            return true;
          }

          const strVal = String(val || '').toLowerCase();
          const targetStr = String(filter.value || '').toLowerCase();
          const strUnaccented = removeVietnameseDiacritics(strVal);
          const targetUnaccented = removeVietnameseDiacritics(targetStr);

          if (filter.operator === 'contains') {
            return strUnaccented.includes(targetUnaccented);
          }
          if (filter.operator === 'equals') {
            return strUnaccented === targetUnaccented;
          }
          if (filter.operator === 'startsWith') {
            return strUnaccented.startsWith(targetUnaccented);
          }
          return true;
        });
      }
    }

    // Sort by appearances descending, then updated timestamp
    entities.sort((a, b) => {
      if (b.eventAppearancesCount !== a.eventAppearancesCount) {
        return b.eventAppearancesCount - a.eventAppearancesCount;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    const page = Math.max(1, params.page || 1);
    const limit = Math.max(1, params.limit || 20);
    const startIndex = (page - 1) * limit;
    const paginated = entities.slice(startIndex, startIndex + limit);

    return {
      items: paginated,
      total: entities.length,
      page,
      limit,
    };
  }

  public async getEntityDetails(
    orgId: string,
    entityId: string
  ): Promise<{
    canonicalEntity: CanonicalEntity;
    rawRecords: {
      rawRecord: RawSourceRecord;
      link: EntityLink;
      fieldDifferences: Record<string, string>;
    }[];
  } | null> {
    const canonical = this.canonicalEntities.get(entityId);
    if (!canonical || (orgId && canonical.orgId !== orgId)) return null;

    const links = this.getEntityLinksForCanonical(entityId);
    const rawDetails = links
      .map((link) => {
        const raw = this.rawRecords.get(link.rawRecordId);
        const fieldDifferences: Record<string, string> = {};

        if (raw) {
          if (raw.parsedFields.fullName && raw.parsedFields.fullName !== canonical.canonicalName) {
            fieldDifferences['Họ tên'] = raw.parsedFields.fullName;
          }
          if (raw.parsedFields.organization && raw.parsedFields.organization !== canonical.canonicalOrg) {
            fieldDifferences['Đơn vị'] = raw.parsedFields.organization;
          }
          if (raw.parsedFields.role && raw.parsedFields.role !== canonical.canonicalRole) {
            fieldDifferences['Chức danh'] = raw.parsedFields.role;
          }
          if (raw.parsedFields.email && raw.parsedFields.email !== canonical.canonicalEmail) {
            fieldDifferences['Email'] = raw.parsedFields.email;
          }
          if (raw.parsedFields.phone && raw.parsedFields.phone !== canonical.canonicalPhone) {
            fieldDifferences['Điện thoại'] = raw.parsedFields.phone;
          }
        }

        return {
          rawRecord: raw!,
          link,
          fieldDifferences,
        };
      })
      .filter((item) => item.rawRecord !== undefined);

    return {
      canonicalEntity: canonical,
      rawRecords: rawDetails,
    };
  }
}
