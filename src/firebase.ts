import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export const UID_PATTERN = /^[a-zA-Z0-9_\-]+$/;
export const DISPLAY_NAME_MAX_LEN = 100;
export const UID_MAX_LEN = 128;

export async function syncCoachProfileToFirestore(xp: number): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const safeUid = user.uid.slice(0, UID_MAX_LEN);
  if (!UID_PATTERN.test(safeUid)) return;

  const rawName = (user.displayName || user.email?.split('@')[0] || 'Joueur Kill Tilt').trim();
  const safeDisplayName = (rawName || 'Joueur Kill Tilt').slice(0, DISPLAY_NAME_MAX_LEN);
  const safeXp = Math.min(1000000, Math.max(0, Math.round(Number(xp) || 0)));
  const path = `coachProfiles/${safeUid}`;
  const profileRef = doc(db, 'coachProfiles', safeUid);

  try {
    const snap = await getDoc(profileRef);
    if (!snap.exists()) {
      try {
        await setDoc(profileRef, {
          uid: safeUid,
          displayName: safeDisplayName,
          xp: safeXp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (createErr) {
        handleFirestoreError(createErr, OperationType.CREATE, path);
      }
    } else {
      try {
        await updateDoc(profileRef, {
          displayName: safeDisplayName,
          xp: safeXp,
          updatedAt: serverTimestamp(),
        });
      } catch (updateErr) {
        handleFirestoreError(updateErr, OperationType.UPDATE, path);
      }
    }
  } catch (getErr) {
    if (getErr instanceof Error && getErr.message.startsWith('{"error":')) {
      throw getErr;
    }
    handleFirestoreError(getErr, OperationType.GET, path);
  }
}

export async function signInWithGoogleCoach() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutCoach() {
  return signOut(auth);
}
