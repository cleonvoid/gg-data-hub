import { DataStore } from './types.js';
import { JsonDataStore } from './jsonStore.js';
import { FirestoreDataStore } from './firestoreStore.js';

class ResilientDataStore implements DataStore {
  private firestoreStore: FirestoreDataStore;
  private jsonStore: JsonDataStore;
  private useFallback: boolean = false;
  private hasWarned: boolean = false;

  constructor() {
    this.firestoreStore = new FirestoreDataStore();
    this.jsonStore = new JsonDataStore();
  }

  private isFirestoreError(err: any): boolean {
    if (!err) return false;
    const msg = String(err?.message || err);
    return (
      err?.code === 7 ||
      err?.code === 14 ||
      err?.code === 'unavailable' ||
      err?.code === 'permission-denied' ||
      /PERMISSION_DENIED|UNAVAILABLE|permission denied|insufficient permissions|offline/i.test(msg)
    );
  }

  private async execute<T>(fnName: string, op: (store: DataStore) => Promise<T>): Promise<T> {
    if (this.useFallback) {
      return op(this.jsonStore);
    }
    try {
      return await op(this.firestoreStore);
    } catch (err: any) {
      if (this.isFirestoreError(err)) {
        if (!this.hasWarned) {
          console.warn(
            `[Database] Firestore Admin credentials not available in environment (${err?.message || err?.code}). Seamlessly switching to persistent JsonDataStore.`
          );
          this.hasWarned = true;
        }
        this.useFallback = true;
        return op(this.jsonStore);
      }
      throw err;
    }
  }

  async getAllCanonicalEntities(orgId: string) {
    return this.execute('getAllCanonicalEntities', (s) => s.getAllCanonicalEntities(orgId));
  }

  async getStats(orgId: string) {
    return this.execute('getStats', (s) => s.getStats(orgId));
  }

  async queryEntities(orgId: string, params: any) {
    return this.execute('queryEntities', (s) => s.queryEntities(orgId, params));
  }

  async getEntityDetails(orgId: string, canonicalId: string) {
    return this.execute('getEntityDetails', (s) => s.getEntityDetails(orgId, canonicalId));
  }

  async addRawRecord(raw: any) {
    return this.execute('addRawRecord', (s) => s.addRawRecord(raw));
  }

  async createCanonicalEntity(orgId: string, payload: any) {
    return this.execute('createCanonicalEntity', (s) => s.createCanonicalEntity(orgId, payload));
  }

  async updateCanonicalEntity(orgId: string, id: string, payload: any) {
    return this.execute('updateCanonicalEntity', (s) => s.updateCanonicalEntity(orgId, id, payload));
  }

  async addEntityLink(link: any) {
    return this.execute('addEntityLink', (s) => s.addEntityLink(link));
  }

  async addPendingSuggestion(suggestion: any) {
    return this.execute('addPendingSuggestion', (s) => s.addPendingSuggestion(suggestion));
  }

  async getPendingSuggestions(orgId: string) {
    return this.execute('getPendingSuggestions', (s) => s.getPendingSuggestions(orgId));
  }

  async approveMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    decidedBy?: 'user' | 'system_initial' | 'auto_merge'
  ) {
    return this.execute('approveMerge', (s) =>
      s.approveMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, decidedBy)
    );
  }

  async rejectMerge(
    orgId: string,
    suggestionId: string,
    rawRecordId: string,
    canonicalEntityId: string,
    reason?: string
  ) {
    return this.execute('rejectMerge', (s) =>
      s.rejectMerge(orgId, suggestionId, rawRecordId, canonicalEntityId, reason)
    );
  }

  async findTopCandidatesByVector(
    orgId: string,
    queryEmbedding: number[],
    topN?: number,
    minSimilarity?: number
  ) {
    return this.execute('findTopCandidatesByVector', (s) =>
      s.findTopCandidatesByVector(orgId, queryEmbedding, topN, minSimilarity)
    );
  }

  async isPairRejected(orgId: string, identityKeyOrRecordId: string, canonicalEntityId: string) {
    return this.execute('isPairRejected', (s) =>
      s.isPairRejected(orgId, identityKeyOrRecordId, canonicalEntityId)
    );
  }

  async recordRejection(orgId: string, identityKey: string, canonicalEntityId: string) {
    return this.execute('recordRejection', (s) =>
      s.recordRejection(orgId, identityKey, canonicalEntityId)
    );
  }

  async clearAll(orgId: string) {
    return this.execute('clearAll', (s) => s.clearAll(orgId));
  }
}

function createStore(): DataStore {
  const driver = process.env.DATA_STORE === 'firestore' ? 'firestore' : 'json';
  console.log(`[Database] Driver configured: ${driver}`);
  if (driver === 'firestore') {
    return new ResilientDataStore();
  }
  return new JsonDataStore();
}

export const db: DataStore = createStore();
export type { DataStore } from './types.js';
