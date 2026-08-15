import { DataStore } from './types.js';
import { JsonDataStore } from './jsonStore.js';
import { FirestoreDataStore } from './firestoreStore.js';

/**
 * The driver is chosen once at startup and never changes at runtime. An automatic
 * mid-flight switch would split writes across two backends with no way to reconcile
 * them, so Firestore errors propagate to the caller and surface as HTTP 503 in
 * handleRouteError(). A visible error beats invisible wrong data.
 */
function createStore(): DataStore {
  const driver = process.env.DATA_STORE === 'firestore' ? 'firestore' : 'json';
  console.log(`[Database] Driver: ${driver}`);
  return driver === 'firestore' ? new FirestoreDataStore() : new JsonDataStore();
}

export const db: DataStore = createStore();
export type { DataStore } from './types.js';
