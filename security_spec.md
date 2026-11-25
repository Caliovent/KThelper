# Security Specification — Kill Tilt Poker Suite (`firestore.rules`)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied for both read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Owner-Only Profile Access**: A `CoachProfile` document at `/coachProfiles/{userId}` can only be read, created, updated, or deleted by the authenticated, email-verified user whose `request.auth.uid == userId`.
3. **Strict Identity & Schema Integrity**:
   - `uid` must equal `userId` and `request.auth.uid`, match `^[a-zA-Z0-9_\-]+$`, and be `<= 128` characters.
   - `displayName` must be a non-empty string with `size() >= 1 && size() <= 100`.
   - `xp` must be an integer or float `>= 0` and `<= 1000000`.
   - `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` and `uid` are immutable on update, and `updatedAt` must equal `request.time`.
   - Only the exact keys `['uid', 'displayName', 'xp', 'createdAt', 'updatedAt']` are permitted (`hasAll` + `hasOnly`).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Create**: `auth = null`, payload `{ uid: 'u1', displayName: 'Alice', xp: 100, createdAt: request.time, updatedAt: request.time }` -> `PERMISSION_DENIED`.
2. **Unverified Email Create**: `auth = { uid: 'u1', token: { email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Spoofed UID Path Mismatch**: `auth.uid = 'u1'`, path `/coachProfiles/u2`, payload `uid: 'u2'` -> `PERMISSION_DENIED`.
4. **Spoofed UID Field Mismatch**: `auth.uid = 'u1'`, path `/coachProfiles/u1`, payload `uid: 'u2'` -> `PERMISSION_DENIED`.
5. **Shadow / Ghost Field Injection**: payload includes `isAdmin: true` -> `PERMISSION_DENIED`.
6. **Oversized DisplayName (> 100 chars)**: `displayName: 'A'.repeat(101)` -> `PERMISSION_DENIED`.
7. **Empty DisplayName**: `displayName: ''` -> `PERMISSION_DENIED`.
8. **Negative XP Value**: `xp: -50` -> `PERMISSION_DENIED`.
9. **Forged Past `createdAt` Timestamp**: `createdAt: timestamp.date(2020, 1, 1)` -> `PERMISSION_DENIED`.
10. **Immutable `createdAt` Mutation on Update**: changing `createdAt` during update -> `PERMISSION_DENIED`.
11. **Immutable `uid` Mutation on Update**: changing `uid` during update -> `PERMISSION_DENIED`.
12. **Cross-User Read (`get`)**: `auth.uid = 'u2'` reading `/coachProfiles/u1` -> `PERMISSION_DENIED`.
