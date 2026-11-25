/**
 * Firestore Security Rules Specification — Dirty Dozen Payload Verification
 */
export interface DirtyDozenCase {
  id: number;
  name: string;
  authUid: string | null;
  emailVerified: boolean;
  path: string;
  operation: 'get' | 'create' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated create attempt',
    authUid: null,
    emailVerified: false,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Hero', xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email create attempt',
    authUid: 'user_1',
    emailVerified: false,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Hero', xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Path UID mismatch',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_2',
    operation: 'create',
    payload: { uid: 'user_2', displayName: 'Hero', xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Payload UID mismatch',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_2', displayName: 'Hero', xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Shadow field injection (isAdmin)',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Hero', xp: 0, isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized displayName (>100 chars)',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'X'.repeat(105), xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Empty displayName',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: '', xp: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Negative XP value',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Hero', xp: -10 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Client-forged createdAt timestamp',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'create',
    payload: { uid: 'user_1', displayName: 'Hero', xp: 0, createdAt: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Mutating immutable createdAt on update',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'update',
    payload: { uid: 'user_1', displayName: 'Hero', xp: 50, createdAt: 999 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Mutating immutable uid on update',
    authUid: 'user_1',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'update',
    payload: { uid: 'user_2', displayName: 'Hero', xp: 50 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-user profile read attempt',
    authUid: 'user_2',
    emailVerified: true,
    path: '/coachProfiles/user_1',
    operation: 'get',
    expected: 'PERMISSION_DENIED',
  },
];
