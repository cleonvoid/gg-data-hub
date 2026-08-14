import { DataStore } from './types.js';
import { JsonDataStore } from './jsonStore.js';
import { FirestoreDataStore } from './firestoreStore.js';

class ResilientDataStore implements DataStore {
  private jsonStore: JsonDataStore;
  private firestoreStore: FirestoreDataStore | null = null;
  private firestoreDisabled = false;

  constructor() {
    this.jsonStore = new JsonDataStore();
    if (process.env.DATA_STORE === 'firestore') {
      try {
        this.firestoreStore = new FirestoreDataStore();
      } catch (err: any) {
        console.warn('[Database] Firestore initialization error, defaulting to JsonDataStore:', err.message);
        this.firestoreDisabled = true;
      }
    } else {
      this.firestoreDisabled = true;
    }
  }

  private handleFirestoreError(err: any): void {
    if (!this.firestoreDisabled) {
      console.warn(
        '[Database] Firestore access error (e.g. Missing service account permissions or offline). Seamlessly falling back to JsonDataStore:',
        err?.message || err
      );
      this.firestoreDisabled = true;
    }
  }

  private async execute<T>(
    firestoreFn: (store: FirestoreDataStore) => Promise<T>,
    jsonFn: (store: JsonDataStore) => Promise<T>
  ): Promise<T> {
    if (!this.firestoreDisabled && this.firestoreStore) {
      try {
        return await firestoreFn(this.firestoreStore);
      } catch (err: any) {
        this.handleFirestoreError(err);
        return await jsonFn(this.jsonStore);
      }
    }
    return await jsonFn(this.jsonStore);
  }

  public async getAllCanonicalEntities(orgId: string) {
    return this.execute(
      (s) => s.getAllCanonicalEntities(orgId),
      (s) => s.getAllCanonicalEntities(orgId)
    );
  }

  public async getStats(orgId: string) {
    return this.execute(
      (s) => s.getStats(orgId),
      (s) => s.getStats(orgId)
    );
  }

  public async queryEntities(orgId: string, params: any) {
    return this.execute(
      (s) => s.queryEntities(orgId, params),
      (s) => s.queryEntities(orgId, params)
    );
  }

  public async getEntityDetails(orgId: string, canonicalId: string) {
    return this.execute(
      (s) => s.getEntityDetails(orgId, canonicalId),
      (s) => s.getEntityDetails(orgId, canonicalId)
    );
  }

  public async addRawRecord(raw: any) {
    return this.execute(
      (s) => s.addRawRecord(raw),
      (s) => s.addRawRecord(raw)
    );
  }

  public async createCanonicalEntity(orgId: string, payload: any) {
    return this.execute(
      (s) => s.createCanonicalEntity(orgId, payload),
      (s) => s.createCanonicalEntity(orgId, payload)
    );
  }

  public async updateCanonicalEntity(orgId: string, id: string, payload: any) {
    return this.execute(
      (s) => s.updateCanonicalEntity(orgId, id, payload),
      (s) => s.updateCanonicalEntity(orgId, id, payload)
    );
  }

  public async addEntityLink(link: any) {
    return this.execute(
      (s) => s.addEntityLink(link),
      (s) => s.addEntityLink(link)
    );
  }

  public async addPendingSuggestion(suggestion: any) {
    return this.execute(
      (s) => s.addPendingSuggestion(suggestion),
      (s) => s.addPendingSuggestion(suggestion)
    );
  }

  public async getPendingSuggestions(orgId: string) {
    return this.execute(
      (s) => s.getPendingSuggestions(orgId),
      (s) => s.getPendingSuggestions(orgId)
    );
  }

  public async approveMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy?: 'user' | 'system_initial' | 'auto_merge'
  ) {
    return this.execute(
      (s) => s.approveMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, decidedBy),
      (s) => s.approveMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, decidedBy)
    );
  }

  public async rejectMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason?: string
  ) {
    return this.execute(
      (s) => s.rejectMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, reason),
      (s) => s.rejectMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, reason)
    );
  }

  public async findTopCandidatesByVector(
    orgId: string,
    queryEmbedding: number[],
    topN?: number,
    minSimilarity?: number
  ) {
    return this.execute(
      (s) => s.findTopCandidatesByVector(orgId, queryEmbedding, topN, minSimilarity),
      (s) => s.findTopCandidatesByVector(orgId, queryEmbedding, topN, minSimilarity)
    );
  }

  public async isPairRejected(orgId: string, identityKeyOrRecordId: string, canonicalEntityId: string) {
    return this.execute(
      (s) => s.isPairRejected(orgId, identityKeyOrRecordId, canonicalEntityId),
      (s) => s.isPairRejected(orgId, identityKeyOrRecordId, canonicalEntityId)
    );
  }

  public async recordRejection(orgId: string, identityKey: string, canonicalEntityId: string) {
    return this.execute(
      (s) => s.recordRejection(orgId, identityKey, canonicalEntityId),
      (s) => s.recordRejection(orgId, identityKey, canonicalEntityId)
    );
  }

  public async clearAll(orgId: string) {
    return this.execute(
      (s) => s.clearAll(orgId),
      (s) => s.clearAll(orgId)
    );
  }
}

export const db: DataStore = new ResilientDataStore();

console.log(
  `[Database] Initialized ResilientDataStore (Mode: ${
    process.env.DATA_STORE === 'firestore' ? 'Firestore with JSON fallback' : 'JSON persistence'
  })`
);

export * from './types.js';
