import fs from 'fs';
import path from 'path';
import {
  RawSourceRecord,
  CanonicalEntity,
  EntityLink,
  MergeSuggestion,
  IngestionStats,
  FilterParams,
  CanonicalSchema,
} from '../../src/types/index.js';
import {
  cosineSimilarity,
  normalizePersonName,
  normalizeOrgName,
  removeVietnameseDiacritics,
  buildIdentityString,
} from '../utils/vietnamese.js';

interface DatabaseState {
  rawRecords: RawSourceRecord[];
  canonicalEntities: CanonicalEntity[];
  entityLinks: EntityLink[];
  pendingSuggestions: MergeSuggestion[];
}

class EventDataStore {
  private rawRecords: Map<string, RawSourceRecord> = new Map();
  private canonicalEntities: Map<string, CanonicalEntity> = new Map();
  private entityLinks: Map<string, EntityLink> = new Map();
  private pendingSuggestions: Map<string, MergeSuggestion> = new Map();
  private storageFilePath: string;

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
  }

  private saveToDisk() {
    try {
      const state: DatabaseState = {
        rawRecords: Array.from(this.rawRecords.values()),
        canonicalEntities: Array.from(this.canonicalEntities.values()),
        entityLinks: Array.from(this.entityLinks.values()),
        pendingSuggestions: Array.from(this.pendingSuggestions.values()),
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
        console.log(`Loaded store with ${this.canonicalEntities.size} canonical entities and ${this.rawRecords.size} raw records.`);
      }
    } catch (err) {
      console.warn('Could not load existing store from disk, starting fresh', err);
    }
  }

  public clearAll() {
    this.rawRecords.clear();
    this.canonicalEntities.clear();
    this.entityLinks.clear();
    this.pendingSuggestions.clear();
    this.saveToDisk();
  }

  // --- Layer 1: Raw Records (Immutable) ---

  public addRawRecord(record: RawSourceRecord): void {
    this.rawRecords.set(record.id, record);
    this.saveToDisk();
  }

  public getRawRecord(id: string): RawSourceRecord | undefined {
    return this.rawRecords.get(id);
  }

  public getAllRawRecords(): RawSourceRecord[] {
    return Array.from(this.rawRecords.values());
  }

  // --- Layer 2: Canonical Entities (Authoritative Derived Views) ---

  public createCanonicalEntity(data: {
    entityType: 'person' | 'organization';
    canonicalName: string;
    canonicalOrg?: string;
    canonicalRole?: string;
    canonicalEmail?: string;
    canonicalPhone?: string;
    orgId?: string;
  }): CanonicalEntity {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    const entity: CanonicalEntity = {
      id,
      entityType: data.entityType,
      canonicalName: data.canonicalName.trim(),
      canonicalOrg: (data.canonicalOrg || '').trim(),
      canonicalRole: (data.canonicalRole || '').trim(),
      canonicalEmail: (data.canonicalEmail || '').trim(),
      canonicalPhone: (data.canonicalPhone || '').trim(),
      aliases: [data.canonicalName.trim()],
      alternateEmails: data.canonicalEmail ? [data.canonicalEmail.trim()] : [],
      alternateOrgs: data.canonicalOrg ? [data.canonicalOrg.trim()] : [],
      eventAppearancesCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      sourceFilesCount: 1,
      confidenceScore: 1.0,
      orgId: data.orgId || 'org_default',
      createdAt: now,
      updatedAt: now,
    };
    this.canonicalEntities.set(id, entity);
    this.saveToDisk();
    return entity;
  }

  public getCanonicalEntity(id: string): CanonicalEntity | undefined {
    return this.canonicalEntities.get(id);
  }

  public getAllCanonicalEntities(): CanonicalEntity[] {
    return Array.from(this.canonicalEntities.values());
  }

  public updateCanonicalEntity(entity: CanonicalEntity): void {
    entity.updatedAt = new Date().toISOString();
    this.canonicalEntities.set(entity.id, entity);
    this.saveToDisk();
  }

  // --- Layer 3: Link/Merge Records ---

  public addEntityLink(link: EntityLink): void {
    this.entityLinks.set(link.id, link);
    this.saveToDisk();
  }

  public getEntityLinksForCanonical(canonicalId: string): EntityLink[] {
    return Array.from(this.entityLinks.values()).filter(
      (link) => link.canonicalEntityId === canonicalId && link.status === 'approved'
    );
  }

  public isPairRejected(rawRecordId: string, canonicalEntityId: string): boolean {
    return Array.from(this.entityLinks.values()).some(
      (link) =>
        link.rawRecordId === rawRecordId &&
        link.canonicalEntityId === canonicalEntityId &&
        link.status === 'rejected'
    );
  }

  // --- Stage 1 Vector Similarity Search (Top-N Candidate Retrieval) ---

  public findTopCandidatesByVector(
    queryEmbedding: number[],
    topN: number = 5,
    minSimilarity: number = 0.65
  ): { entity: CanonicalEntity; similarity: number }[] {
    const results: { entity: CanonicalEntity; similarity: number }[] = [];

    for (const entity of this.canonicalEntities.values()) {
      // Find all approved raw records linked to this canonical entity that have embeddings
      const links = this.getEntityLinksForCanonical(entity.id);
      let bestSim = 0;

      for (const link of links) {
        const rawRec = this.rawRecords.get(link.rawRecordId);
        if (rawRec?.embedding) {
          const sim = cosineSimilarity(queryEmbedding, rawRec.embedding);
          if (sim > bestSim) {
            bestSim = sim;
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

  public addPendingSuggestion(suggestion: MergeSuggestion): void {
    this.pendingSuggestions.set(suggestion.id, suggestion);
    this.saveToDisk();
  }

  public getPendingSuggestions(): MergeSuggestion[] {
    return Array.from(this.pendingSuggestions.values());
  }

  public removePendingSuggestion(id: string): void {
    this.pendingSuggestions.delete(id);
    this.saveToDisk();
  }

  public approveMerge(
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy: 'user' | 'system_initial' = 'user'
  ): { success: boolean; canonicalEntity: CanonicalEntity } {
    const raw = this.rawRecords.get(rawRecordId);
    const canonical = this.canonicalEntities.get(canonicalEntityId);

    if (!raw || !canonical) {
      throw new Error('Raw record or canonical entity not found');
    }

    // 1. Create or update the link record
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const link: EntityLink = {
      id: linkId,
      rawRecordId,
      canonicalEntityId,
      status: 'approved',
      stage1SimilarityScore: 0.9,
      stage2Confidence: 0.95,
      adjudicationReason: 'Approved by user during review',
      decidedBy,
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
    this.updateCanonicalEntity(canonical);

    // 3. Remove suggestion from pending queue
    this.pendingSuggestions.delete(suggestionId);
    this.saveToDisk();

    return { success: true, canonicalEntity: canonical };
  }

  public rejectMerge(
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason: string = 'User rejected merge suggestion'
  ): void {
    // Record rejection in entityLinks as a negative signal to prevent repeated suggestions
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const link: EntityLink = {
      id: linkId,
      rawRecordId,
      canonicalEntityId,
      status: 'rejected',
      stage1SimilarityScore: 0.7,
      stage2Confidence: 0.2,
      adjudicationReason: reason,
      decidedBy: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.entityLinks.set(linkId, link);

    // If this raw record doesn't belong to any canonical entity yet, create its own distinct canonical entity!
    const existingApprovedLinks = Array.from(this.entityLinks.values()).filter(
      (l) => l.rawRecordId === rawRecordId && l.status === 'approved'
    );

    if (existingApprovedLinks.length === 0) {
      const raw = this.rawRecords.get(rawRecordId);
      if (raw) {
        const newEntity = this.createCanonicalEntity({
          entityType: 'person',
          canonicalName: raw.parsedFields.fullName || 'Khách không tên',
          canonicalOrg: raw.parsedFields.organization,
          canonicalRole: raw.parsedFields.role,
          canonicalEmail: raw.parsedFields.email,
          canonicalPhone: raw.parsedFields.phone,
        });

        // Link to its own new entity
        const selfLinkId = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        this.addEntityLink({
          id: selfLinkId,
          rawRecordId: raw.id,
          canonicalEntityId: newEntity.id,
          status: 'approved',
          stage1SimilarityScore: 1.0,
          stage2Confidence: 1.0,
          adjudicationReason: 'Self-isolated canonical entity after rejected candidate merge',
          decidedBy: 'user',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    this.pendingSuggestions.delete(suggestionId);
    this.saveToDisk();
  }

  // --- Aggregate Stats & Multi-Field Filtered Querying ---

  public getStats(): IngestionStats {
    const totalCanonical = this.canonicalEntities.size;
    const totalRaw = this.rawRecords.size;
    const pendingCount = this.pendingSuggestions.size;

    const sourceFileIds = new Set<string>();
    const breakdown = {
      drive_sheets: 0,
      local_xlsx: 0,
      seed: 0,
    };

    for (const r of this.rawRecords.values()) {
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

  public queryEntities(params: FilterParams): {
    items: CanonicalEntity[];
    total: number;
    page: number;
    limit: number;
  } {
    let entities = Array.from(this.canonicalEntities.values());

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

  public getEntityDetails(entityId: string): {
    canonicalEntity: CanonicalEntity;
    rawRecords: {
      rawRecord: RawSourceRecord;
      link: EntityLink;
      fieldDifferences: Record<string, string>;
    }[];
  } | null {
    const canonical = this.canonicalEntities.get(entityId);
    if (!canonical) return null;

    const links = this.getEntityLinksForCanonical(entityId);
    const rawDetails = links.map((link) => {
      const raw = this.rawRecords.get(link.rawRecordId)!;
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
        rawRecord: raw,
        link,
        fieldDifferences,
      };
    }).filter((item) => item.rawRecord !== undefined);

    return {
      canonicalEntity: canonical,
      rawRecords: rawDetails,
    };
  }
}

export const db = new EventDataStore();
