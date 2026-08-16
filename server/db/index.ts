import dotenv from 'dotenv';
import { DataStore } from './types.js';
import { JsonDataStore } from './jsonStore.js';
import { FirestoreDataStore } from './firestoreStore.js';

dotenv.config();

/**
 * The driver is chosen once at startup and never changes at runtime. An automatic
 * mid-flight switch would split writes across two backends with no way to reconcile
 * them, so Firestore errors propagate to the caller and surface as HTTP 503 in
 * handleRouteError(). A visible error beats invisible wrong data.
 */
let currentStore: DataStore = createStore();

function createStore(): DataStore {
  const driver = process.env.DATA_STORE === 'firestore' ? 'firestore' : 'json';
  console.log(`[Database] Driver: ${driver}`);
  return driver === 'firestore' ? new FirestoreDataStore() : new JsonDataStore();
}

export function setStore(store: DataStore): void {
  currentStore = store;
}

export const db: DataStore = new Proxy({} as DataStore, {
  get(_target, prop: string | symbol) {
    const value = (currentStore as any)[prop];
    if (typeof value === 'function') {
      return value.bind(currentStore);
    }
    return value;
  },
});

export type { DataStore } from './types.js';
