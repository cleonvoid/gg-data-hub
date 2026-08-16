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
import { adminDb, FieldValue } from '../firebaseAdmin.js';

/**
 * Firestore returns embeddings as VectorValue, not number[]. Every read path must
 * convert back or `Array.isArray(x.embedding)` is false everywhere downstream and
 * candidate retrieval silently yields nothing. Centralized here so no read site
 * can forget it.
 */
function fromDoc<T>(
  snap: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot
): T {
  const data = snap.data() as any;
  if (data && data.embedding && typeof data.embedding.toArray === 'function') {
    data.embedding = data.embedding.toArray();
  }
  return data as T;
}

export class FirestoreDataStore implements DataStore {
  private rawRecordsCol = adminDb.collection('rawRecords');
  private canonicalEntitiesCol = adminDb.collection('canonicalEntities');
  private entityLinksCol = adminDb.collection('entityLinks');
  private pendingSuggestionsCol = adminDb.collection('pendingSuggestions');
  private rejectionsCol = adminDb.collection('rejections');
  private vectorSearchDegraded = false;

  public async clearAll(orgId: string): Promise<void> {
    const collections = [
      this.rawRecordsCol,
      this.canonicalEntitiesCol,
      this.entityLinksCol,
      this.pendingSuggestionsCol,
      this.rejectionsCol,
    ];

    for (const col of collections) {
      let query: FirebaseFirestore.Query = col;
      if (orgId) {
        query = query.where('orgId', '==', orgId);
      }
      const snapshot = await query.get();
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
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

    const docData: any = { ...record };
    if (record.embedding && Array.isArray(record.embedding)) {
      docData.embedding = FieldValue.vector(record.embedding);
    }

    await this.rawRecordsCol.doc(record.id).set(docData);
    return record;
  }

  public async getRawRecord(id: string): Promise<RawSourceRecord | undefined> {
    const snap = await this.rawRecordsCol.doc(id).get();
    if (!snap.exists) return undefined;
    return fromDoc<RawSourceRecord>(snap);
  }

  public async getAllRawRecords(orgId?: string): Promise<RawSourceRecord[]> {
    let q: FirebaseFirestore.Query = this.rawRecordsCol;
    if (orgId) q = q.where('orgId', '==', orgId);
    const snap = await q.get();
    return snap.docs.map((d) => fromDoc<RawSourceRecord>(d));
  }

  // --- Layer 2: Canonical Entities ---

  public async createCanonicalEntity(
    orgId: string,
    data: Partial<CanonicalEntity>
  ): Promise<CanonicalEntity> {
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

    const docData: any = { ...entity };
    if (entity.embedding && Array.isArray(entity.embedding)) {
      docData.embedding = FieldValue.vector(entity.embedding);
    }

    await this.canonicalEntitiesCol.doc(id).set(docData);
    return entity;
  }

  public async getCanonicalEntity(id: string): Promise<CanonicalEntity | undefined> {
    const snap = await this.canonicalEntitiesCol.doc(id).get();
    if (!snap.exists) return undefined;
    return fromDoc<CanonicalEntity>(snap);
  }

  public async getAllCanonicalEntities(orgId: string): Promise<CanonicalEntity[]> {
    let q: FirebaseFirestore.Query = this.canonicalEntitiesCol;
    if (orgId) q = q.where('orgId', '==', orgId);
    const snap = await q.get();
    return snap.docs.map((d) => fromDoc<CanonicalEntity>(d));
  }

  public async updateCanonicalEntity(
    orgId: string,
    id: string,
    payload: Partial<CanonicalEntity>
  ): Promise<CanonicalEntity> {
    const docRef = this.canonicalEntitiesCol.doc(id);
    const existingSnap = await docRef.get();
    if (!existingSnap.exists) throw new Error(`Canonical entity not found: ${id}`);
    const existing = fromDoc<CanonicalEntity>(existingSnap);

    const updated: CanonicalEntity = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    const docData: any = { ...updated };
    if (updated.embedding && Array.isArray(updated.embedding)) {
      docData.embedding = FieldValue.vector(updated.embedding);
    }

    await docRef.set(docData, { merge: true });
    return updated;
  }

  // --- Layer 3: Link Records ---

  public async addEntityLink(link: EntityLink): Promise<EntityLink> {
    await this.entityLinksCol.doc(link.id).set(link);
    return link;
  }

  public async isPairRejected(
    orgId: string,
    identityKeyOrRecordId: string,
    canonicalEntityId: string
  ): Promise<boolean> {
    // 1. Check in rejections table
    const safeKey = `${orgId}_${encodeURIComponent(identityKeyOrRecordId)}_${canonicalEntityId}`;
    const snap = await this.rejectionsCol.doc(safeKey).get();
    if (snap.exists) return true;

    // Check if identityKey is stored on a raw record
    const rawSnap = await this.rawRecordsCol.doc(identityKeyOrRecordId).get();
    if (rawSnap.exists) {
      const raw = fromDoc<RawSourceRecord>(rawSnap);
      if (raw.identityKey) {
        const rawSafeKey = `${orgId}_${encodeURIComponent(raw.identityKey)}_${canonicalEntityId}`;
        const rawRejSnap = await this.rejectionsCol.doc(rawSafeKey).get();
        if (rawRejSnap.exists) return true;
      }
    }

    // 2. Check in entityLinks
    const linkQuery = await this.entityLinksCol
      .where('canonicalEntityId', '==', canonicalEntityId)
      .where('status', '==', 'rejected')
      .get();

    return linkQuery.docs.some((d) => {
      const l = fromDoc<EntityLink>(d);
      return l.rawRecordId === identityKeyOrRecordId;
    });
  }

  public async recordRejection(
    orgId: string,
    identityKey: string,
    canonicalEntityId: string
  ): Promise<void> {
    const safeKey = `${orgId}_${encodeURIComponent(identityKey)}_${canonicalEntityId}`;
    await this.rejectionsCol.doc(safeKey).set({
      identityKey,
      canonicalEntityId,
      orgId,
      rejectedAt: new Date().toISOString(),
    });
  }

  // --- Stage 1 Vector Similarity Search ---

  public async findTopCandidatesByVector(
    orgId: string,
    queryEmbedding: number[],
    topN: number = 5,
    minSimilarity: number = 0.65
  ): Promise<{ entity: CanonicalEntity; similarity: number }[]> {
    // Try native Firestore findNearest vector search if index exists
    try {
      if (typeof (this.canonicalEntitiesCol as any).findNearest === 'function') {
        const vectorObj = FieldValue.vector(queryEmbedding);
        let q: any = this.canonicalEntitiesCol;
        if (orgId) q = q.where('orgId', '==', orgId);

        const snap = await q
          .findNearest('embedding', vectorObj, {
            limit: topN * 2,
            distanceMeasure: 'COSINE',
            distanceResultField: '_distance',
          })
          .get();

        const results: { entity: CanonicalEntity; similarity: number }[] = [];
        for (const doc of snap.docs) {
          const entity = fromDoc<CanonicalEntity>(doc);
          const dist = doc.get('_distance') ?? 1;
          const similarity = Math.max(0, 1 - dist);
          if (similarity >= minSimilarity) {
            results.push({ entity, similarity });
          }
        }
        return results.slice(0, topN);
      }
    } catch (err: any) {
      // FAILED_PRECONDITION means the KNN index is missing — actionable, so name it explicitly.
      const missingIndex = err?.code === 9 || /FAILED_PRECONDITION|requires an index/i.test(err?.message || '');
      console.error(
        missingIndex
          ? '[Firestore] Vector index missing on canonicalEntities.embedding. Create it with the gcloud command in README.md. Falling back to in-memory scan (slow, does not scale).'
          : '[Firestore] findNearest failed, falling back to in-memory scan:',
        err
      );
      this.vectorSearchDegraded = true;
    }

    // In-memory fallback over canonical entities in org
    const allEntities = await this.getAllCanonicalEntities(orgId);
    const results: { entity: CanonicalEntity; similarity: number }[] = [];

    for (const entity of allEntities) {
      let bestSim = 0;
      if (entity.embedding && Array.isArray(entity.embedding) && entity.embedding.length > 0) {
        bestSim = cosineSimilarity(queryEmbedding, entity.embedding);
      } else {
        // Find approved links and check raw records
        const linksSnap = await this.entityLinksCol
          .where('canonicalEntityId', '==', entity.id)
          .where('status', '==', 'approved')
          .get();

        for (const linkDoc of linksSnap.docs) {
          const l = fromDoc<EntityLink>(linkDoc);
          const raw = await this.getRawRecord(l.rawRecordId);
          if (raw?.embedding && Array.isArray(raw.embedding)) {
            const sim = cosineSimilarity(queryEmbedding, raw.embedding);
            if (sim > bestSim) bestSim = sim;
          }
        }
      }

      if (bestSim >= minSimilarity) {
        results.push({ entity, similarity: bestSim });
      }
    }

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
    await this.pendingSuggestionsCol.doc(suggestion.id).set(suggestion);
    return suggestion;
  }

  public async getPendingSuggestions(orgId: string): Promise<MergeSuggestion[]> {
    let q: FirebaseFirestore.Query = this.pendingSuggestionsCol;
    if (orgId) q = q.where('rawRecord.orgId', '==', orgId);
    const snap = await q.get();
    return snap.docs.map((d) => fromDoc<MergeSuggestion>(d));
  }

  public async approveMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy: 'user' | 'system_initial' | 'auto_merge' = 'user'
  ): Promise<{ success: boolean; canonicalEntity: CanonicalEntity }> {
    // Task 3: Look up pending suggestion before deleting
    let suggestion: MergeSuggestion | undefined;
    const suggSnap = await this.pendingSuggestionsCol.doc(suggestionId).get();
    if (suggSnap.exists) {
      suggestion = fromDoc<MergeSuggestion>(suggSnap);
    }
    if (suggestion) {
      this.assertInOrg(orgId, suggestion.rawRecord, 'Gợi ý gộp');
    }

    const raw = await this.getRawRecord(rawRecordId);
    const canonical = await this.getCanonicalEntity(canonicalEntityId);

    this.assertInOrg(orgId, raw, 'Bản ghi nguồn');
    this.assertInOrg(orgId, canonical, 'Thực thể chuẩn hóa');

    // 1. Create link record with real audit data
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
    await this.addEntityLink(link);

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

    // Count appearances
    const linksSnap = await this.entityLinksCol
      .where('canonicalEntityId', '==', canonical.id)
      .where('status', '==', 'approved')
      .get();

    canonical.eventAppearancesCount = linksSnap.size;
    canonical.lastSeenAt = new Date().toISOString();

    if (!canonical.embedding && raw.embedding) {
      canonical.embedding = raw.embedding;
    }

    await this.updateCanonicalEntity(orgId, canonical.id, canonical);

    // 3. Remove suggestion
    await this.pendingSuggestionsCol.doc(suggestionId).delete();

    return { success: true, canonicalEntity: canonical };
  }

  public async rejectMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason: string = 'Người dùng từ chối gợi ý gộp'
  ): Promise<{ success: boolean }> {
    let suggestion: MergeSuggestion | undefined;
    const suggSnap = await this.pendingSuggestionsCol.doc(suggestionId).get();
    if (suggSnap.exists) {
      suggestion = fromDoc<MergeSuggestion>(suggSnap);
    }
    if (suggestion) {
      this.assertInOrg(orgId, suggestion.rawRecord, 'Gợi ý gộp');
    }

    const raw = await this.getRawRecord(rawRecordId);
    const canonical = await this.getCanonicalEntity(canonicalEntityId);

    this.assertInOrg(orgId, raw, 'Bản ghi nguồn');
    this.assertInOrg(orgId, canonical, 'Thực thể chuẩn hóa');

    // Task 4: Store rejection by identityKey
    const identityKey =
      raw?.identityKey ||
      (raw
        ? buildIdentityKey({
            fullName: raw.parsedFields.fullName,
            organization: raw.parsedFields.organization,
            email: raw.parsedFields.email,
          })
        : rawRecordId);

    await this.recordRejection(orgId, identityKey, canonicalEntityId);

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
    await this.addEntityLink(link);

    // Check if raw record already has approved link
    const existingLinks = await this.entityLinksCol
      .where('rawRecordId', '==', rawRecordId)
      .where('status', '==', 'approved')
      .get();

    if (existingLinks.empty && raw) {
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

    await this.pendingSuggestionsCol.doc(suggestionId).delete();
    return { success: true };
  }

  // --- Aggregate Stats & Multi-Field Filtered Querying ---

  public async getStats(orgId: string): Promise<IngestionStats> {
    const [entities, rawRecords, pending] = await Promise.all([
      this.getAllCanonicalEntities(orgId),
      this.getAllRawRecords(orgId),
      this.getPendingSuggestions(orgId),
    ]);

    const totalCanonical = entities.length;
    const totalRaw = rawRecords.length;
    const pendingCount = pending.length;

    const sourceFileIds = new Set<string>();
    const breakdown = {
      drive_sheets: 0,
      local_xlsx: 0,
      seed: 0,
    };

    for (const r of rawRecords) {
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
      vectorSearchDegraded: this.vectorSearchDegraded,
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
    let entities = await this.getAllCanonicalEntities(orgId);

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
        const aliasMatch = (e.aliases || []).some((a) =>
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
    const canonical = await this.getCanonicalEntity(entityId);
    if (!canonical || (orgId && canonical.orgId !== orgId)) return null;

    const linksSnap = await this.entityLinksCol
      .where('canonicalEntityId', '==', entityId)
      .get();

    const links = linksSnap.docs
      .map((d) => fromDoc<EntityLink>(d))
      .filter((l) => l.status === 'approved');

    const rawRecordsDetails = await Promise.all(
      links.map(async (link) => {
        const raw = await this.getRawRecord(link.rawRecordId);
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
    );

    return {
      canonicalEntity: canonical,
      rawRecords: rawRecordsDetails.filter((r) => r.rawRecord !== undefined),
    };
  }
}
