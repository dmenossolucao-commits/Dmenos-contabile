import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import defaultConfig from '../firebase-applet-config.json';

// Support VITE_ environment variables with fallback to firebase-applet-config.json
const firebaseConfig = {
  ...defaultConfig,
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID ? { projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID ? { appId: import.meta.env.VITE_FIREBASE_APP_ID } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY ? { apiKey: import.meta.env.VITE_FIREBASE_API_KEY } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ? { authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_ID ? { firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ? { storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET } : {}),
  ...(typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID ? { messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID } : {}),
};

// Initialize Firebase App safely (prevents duplicate app initialization error)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with firestoreDatabaseId (CRITICAL: preserves existing database)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    username?: string | null;
  };
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return null as any;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore) as any;
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      username: null,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

// Connection test on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or starting up.');
      return false;
    }
    return true;
  }
}
