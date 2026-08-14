import {
  CanonicalEntity,
  RawSourceRecord,
  EntityLink,
  MergeSuggestion,
  IngestionStats,
  FilterParams,
} from '../../src/types/index.js';

export interface DataStore {
  getAllCanonicalEntities(orgId: string): Promise<CanonicalEntity[]>;
  getStats(orgId: string): Promise<IngestionStats>;
  queryEntities(
    orgId: string,
    params: FilterParams
  ): Promise<{ items: CanonicalEntity[]; total: number; page: number; limit: number }>;
  getEntityDetails(
    orgId: string,
    canonicalId: string
  ): Promise<{
    canonicalEntity: CanonicalEntity;
    rawRecords: {
      rawRecord: RawSourceRecord;
      link: EntityLink;
      fieldDifferences: Record<string, string>;
    }[];
  } | null>;
  addRawRecord(raw: RawSourceRecord): Promise<RawSourceRecord>;
  createCanonicalEntity(orgId: string, payload: Partial<CanonicalEntity>): Promise<CanonicalEntity>;
  updateCanonicalEntity(orgId: string, id: string, payload: Partial<CanonicalEntity>): Promise<CanonicalEntity>;
  addEntityLink(link: EntityLink): Promise<EntityLink>;
  addPendingSuggestion(suggestion: MergeSuggestion): Promise<MergeSuggestion>;
  getPendingSuggestions(orgId: string): Promise<MergeSuggestion[]>;
  approveMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy?: 'user' | 'system_initial' | 'auto_merge'
  ): Promise<{ success: boolean; canonicalEntity: CanonicalEntity }>;
  rejectMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason?: string
  ): Promise<{ success: boolean }>;
  findTopCandidatesByVector(
    orgId: string,
    queryEmbedding: number[],
    topN?: number,
    minSimilarity?: number
  ): Promise<{ entity: CanonicalEntity; similarity: number }[]>;
  isPairRejected(orgId: string, identityKeyOrRecordId: string, canonicalEntityId: string): Promise<boolean>;
  recordRejection(orgId: string, identityKey: string, canonicalEntityId: string): Promise<void>;
  clearAll(orgId: string): Promise<void>;
}
