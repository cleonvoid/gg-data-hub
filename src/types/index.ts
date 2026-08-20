export interface CanonicalSchema {
  fullName: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  eventName: string;
  eventDate: string;
  notes: string;
}

export type CanonicalFieldKey = keyof CanonicalSchema;

export interface ColumnMappingItem {
  sourceColumn: string;
  /** Zero-based index of this column in the source sheet. Row cells are read by
   *  this value, never by array position — the mapping array order is not
   *  guaranteed to match column order. */
  sourceIndex: number;
  targetField: CanonicalFieldKey | 'ignore';
  confidence: number;
  reasoning: string;
  sampleValues: string[];
}

export interface SchemaMappingProposal {
  headerRowIndex: number;
  detectedHeaders: string[];
  mappings: ColumnMappingItem[];
  suggestedEventName?: string;
  suggestedEventDate?: string;
  overallConfidence: number;
  confidenceExplanation?: string;
}

export interface RawSourceRecord {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceType: 'drive_sheets' | 'local_xlsx' | 'seed';
  rowIndex: number;
  rawJson: Record<string, any>;
  parsedFields: Partial<CanonicalSchema>;
  normalizedIdentityKey: string;
  identityKey?: string;
  embedding?: number[];
  embeddingSource?: 'gemini' | 'fallback';
  /** Identifier of the space this vector lives in. Vectors from different models are
   *  not comparable; cosine similarity across them is meaningless. */
  embeddingModel?: string;
  importedAt: string;
  orgId: string;
}

export interface CanonicalEntity {
  id: string;
  entityType: 'person' | 'organization';
  canonicalName: string;
  canonicalOrg: string;
  canonicalRole: string;
  canonicalEmail: string;
  canonicalPhone: string;
  aliases: string[];
  alternateEmails: string[];
  alternateOrgs: string[];
  /** Distinct event names this person has appeared in, deduplicated. Enables event
   *  search and makes eventAppearancesCount mean distinct events rather than rows. */
  eventNames: string[];
  eventAppearancesCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sourceFilesCount: number;
  confidenceScore: number;
  embedding?: number[];
  /** Identifier of the space this vector lives in. Vectors from different models are
   *  not comparable; cosine similarity across them is meaningless. */
  embeddingModel?: string;
  orgId: string;
  createdAt: string;
  updatedAt: string;
}

export type MergeDecisionStatus = 'approved' | 'rejected' | 'pending' | 'auto_initial';

export interface EntityLink {
  id: string;
  rawRecordId: string;
  canonicalEntityId: string;
  status: MergeDecisionStatus;
  stage1SimilarityScore: number | null;
  stage2Confidence: number | null;
  adjudicationReason: string;
  decidedBy: 'user' | 'system_initial' | 'auto_merge';
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeSuggestion {
  id: string;
  rawRecord: RawSourceRecord;
  targetCanonicalEntity: CanonicalEntity;
  vectorSimilarity: number;
  llmConfidence: number;
  llmReasoning: string;
  keyDifferences: {
    field: string;
    rawValue: string;
    canonicalValue: string;
  }[];
  createdAt: string;
}

export interface IngestionStats {
  totalCanonicalEntities: number;
  totalRawRecords: number;
  totalPendingMerges: number;
  totalSourceFiles: number;
  dedupRatio: number; // % reduction
  sourcesBreakdown: {
    drive_sheets: number;
    local_xlsx: number;
    seed: number;
  };
  vectorSearchDegraded?: boolean;
}

export interface FilterParams {
  search?: string;
  entityType?: string;
  organization?: string;
  eventName?: string;
  minAppearances?: number;
  dateFrom?: string;
  dateTo?: string;
  structuredFilters?: StructuredQueryFilter[];
  page?: number;
  limit?: number;
}

export interface StructuredQueryFilter {
  field: 'canonicalName' | 'canonicalOrg' | 'canonicalRole' | 'canonicalEmail' | 'canonicalPhone' | 'eventAppearancesCount' | 'eventNames' | 'eventDate';
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'in';
  value: string | number;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  thumbnailLink?: string;
}

export interface NLSearchTranslationResponse {
  interpretedQuery: string;
  filters: StructuredQueryFilter[];
  explanationVi: string;
  explanationEn: string;
}
