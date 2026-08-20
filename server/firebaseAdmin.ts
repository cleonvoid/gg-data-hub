import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = 'light-broker-x8gvj';
let firestoreDatabaseId = 'ai-studio-eventdatahub-50743d01-7c2c-4c9b-8521-419982eee455';

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.projectId) projectId = parsed.projectId;
    if (parsed.firestoreDatabaseId) firestoreDatabaseId = parsed.firestoreDatabaseId;
  }
} catch (e) {
  console.warn('[FirebaseAdmin] Failed reading config file, falling back to defaults:', e);
}

// Environment variables take highest priority if explicitly configured
if (process.env.FIREBASE_PROJECT_ID) {
  projectId = process.env.FIREBASE_PROJECT_ID;
}

if (process.env.FIRESTORE_DATABASE_ID) {
  firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID;
}

const app =
  getApps().length === 0
    ? initializeApp({
        projectId,
      })
    : getApp();

export const adminDb = getFirestore(app, firestoreDatabaseId);
export const adminAuth = getAuth(app);
export { FieldValue };
