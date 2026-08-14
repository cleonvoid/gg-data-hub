import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.FIREBASE_PROJECT_ID || 'light-broker-x8gvj';
let firestoreDatabaseId =
  process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-eventdatahub-50743d01-7c2c-4c9b-8521-419982eee455';

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

const app =
  getApps().length === 0
    ? initializeApp({
        projectId,
      })
    : getApp();

export const adminDb = getFirestore(app, firestoreDatabaseId);
export const adminAuth = getAuth(app);
export { FieldValue };
