# Firestore to MongoDB Migration Plan

## Overview

This document outlines the migration from Firebase Firestore to MongoDB, replacing real-time listeners with polling-based endpoints. Firebase Auth will be **retained** for admin authentication only.

---

## Phase 1: MongoDB Setup & Infrastructure

### 1.1 Install Dependencies
```bash
pnpm add mongoose
pnpm add -D @types/mongoose
```

### 1.2 Create MongoDB Connection
**New file:** `lib/mongodb.ts`
- Singleton connection pattern for Next.js (handle hot reload)
- Environment variable: `MONGODB_URI`
- Connection options for serverless environment

### 1.3 Environment Variables
Add to `.env.local`:
```
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority
```

---

## Phase 2: Define Mongoose Schemas

### 2.1 Schema Files to Create

| Firestore Collection | New File | Schema Name |
|---------------------|----------|-------------|
| `admins` | `lib/models/admin.ts` | `AdminModel` |
| `children` | `lib/models/child.ts` | `ChildModel` |
| `childProgress/{childId}/sections` | `lib/models/child-progress.ts` | `ChildProgressModel` |
| `gameCues` | `lib/models/game-cue.ts` | `GameCueModel` |
| `gardenPhases` | `lib/models/garden-phase.ts` | `GardenPhaseModel` |
| `gardenLevels` | `lib/models/garden-level.ts` | `GardenLevelModel` |
| `jailbreakThemes` | `lib/models/jailbreak-theme.ts` | `JailbreakThemeModel` |
| `jailbreakMatches` | `lib/models/jailbreak-match.ts` | `JailbreakMatchModel` |
| `jailbreakMatches/{matchId}/turns` | Embedded in match OR `lib/models/jailbreak-turn.ts` | `JailbreakTurnModel` |
| `agentStages` | `lib/models/agent-stage.ts` | `AgentStageModel` |
| `agentLevels` | `lib/models/agent-level.ts` | `AgentLevelModel` |
| `agentKnowledgeDocs` | `lib/models/agent-knowledge-doc.ts` | `AgentKnowledgeDocModel` |
| `agentRuns` | `lib/models/agent-run.ts` | `AgentRunModel` |
| `childAgentProgress` | `lib/models/child-agent-progress.ts` | `ChildAgentProgressModel` |

### 2.2 Schema Design Considerations

**Flatten nested collections:**
- `childProgress/{childId}/sections/{sectionId}` → Single document per child with sections as subdocument map
- `jailbreakMatches/{matchId}/turns` → Either embed turns array in match (if small) OR separate collection with `matchId` reference

**Index strategy:**
- `children`: Index on `seatNumber` (unique)
- `jailbreakMatches`: Compound index on `attackerChildId + updatedAt`, `defenderChildId + updatedAt`
- `agentRuns`: Index on `childId`, `levelId`, `passed`
- `gameCues`: Index on `active`, `updatedAt`

---

## Phase 3: Create Polling API Endpoints

Replace each `onSnapshot` real-time listener with a polling endpoint.

### 3.1 New API Routes

| Current Real-time Hook | New API Endpoint | Polling Interval |
|------------------------|------------------|------------------|
| `use-children.ts` → `onSnapshot(childrenCollection)` | `GET /api/admin/children` | 5s |
| `use-jailbreak.ts` → `onSnapshot(jailbreakThemesCollection)` | `GET /api/admin/jailbreak/themes` | 10s |
| `use-jailbreak.ts` → `onSnapshot(jailbreakMatchesCollection)` | `GET /api/admin/jailbreak/matches` | 3s |
| `use-child-progress.ts` → `onSnapshot(sectionProgressCollection)` | `GET /api/game/progress` | 5s |
| `use-garden.ts` → `onSnapshot(gardenPhasesCollection)` | `GET /api/admin/garden/phases` | 10s |
| `use-garden.ts` → `onSnapshot(gardenLevelsCollection)` | `GET /api/admin/garden/levels` | 10s |
| `use-cues.ts` → `onSnapshot(gameCuesCollection)` | `GET /api/admin/cues` | 3s |

### 3.2 Polling Hook Pattern

**New file:** `hooks/use-polling.ts`
```typescript
// Generic polling hook with:
// - Configurable interval
// - Automatic refetch on focus
// - Error handling with retry
// - Loading/error states
// - Optional SWR-like stale-while-revalidate
```

### 3.3 Refactor Existing Hooks

| Current Hook | Action |
|--------------|--------|
| `hooks/use-children.ts` | Replace `onSnapshot` with `usePolling('/api/admin/children', 5000)` |
| `hooks/use-jailbreak.ts` | Replace both snapshots with polling hooks |
| `hooks/use-child-progress.ts` | Replace with polling + manual refetch after saves |
| `hooks/use-garden.ts` | Replace with polling hooks |
| `hooks/use-cues.ts` | Replace with polling hook |

---

## Phase 4: Migrate Server-Side Operations

### 4.1 Files to Update

| File | Changes |
|------|---------|
| `lib/server/progress.ts` | Replace Firestore queries with Mongoose |
| `lib/server/agent-store.ts` | Replace Firestore queries with Mongoose |
| `lib/server/agent-progress.ts` | Replace Firestore queries with Mongoose |
| `lib/server/cues.ts` | Replace Firestore queries with Mongoose |
| `lib/server/scoreboard.ts` | Replace Firestore aggregation with Mongoose |
| `lib/server/jailbreak-scoreboard.ts` | Replace Firestore queries with Mongoose |
| `lib/server/agent-scoreboard.ts` | Replace Firestore queries with Mongoose |
| `lib/server/jailbreak.ts` | Replace Firestore queries with Mongoose |

### 4.2 Query Translation Examples

**Firestore → MongoDB:**
```typescript
// Before (Firestore)
db.collection("agentLevels")
  .where("stageType", "==", stageType)
  .where("isActive", "==", true)
  .orderBy("order", "asc")
  .get()

// After (Mongoose)
await AgentLevelModel.find({ stageType, isActive: true }).sort({ order: 1 })
```

```typescript
// Before (Firestore batch)
const batch = db.batch()
batch.update(ref1, data1)
batch.update(ref2, data2)
await batch.commit()

// After (Mongoose transaction)
const session = await mongoose.startSession()
await session.withTransaction(async () => {
  await Model1.updateOne({ _id: id1 }, data1, { session })
  await Model2.updateOne({ _id: id2 }, data2, { session })
})
```

---

## Phase 5: Migrate Client-Side Operations

### 5.1 Files to Update

| File | Changes |
|------|---------|
| `lib/child-accounts.ts` | Convert to API calls instead of direct Firestore |
| `lib/jailbreak-admin.ts` | Convert to API calls |
| `lib/garden-admin.ts` | Convert to API calls |
| `lib/child-progress.ts` | Convert to API calls |
| `lib/cues-client.ts` | Convert to API calls |

### 5.2 New Admin API Endpoints Needed

**Children management:**
- `POST /api/admin/children` - Create child
- `PATCH /api/admin/children/[childId]` - Update child
- `DELETE /api/admin/children/[childId]` - Delete child

**Jailbreak themes:**
- `POST /api/admin/jailbreak/themes` - Create theme
- `PATCH /api/admin/jailbreak/themes/[themeId]` - Update theme
- `DELETE /api/admin/jailbreak/themes/[themeId]` - Delete theme
- `POST /api/admin/jailbreak/themes/reset` - Reset to seed themes

**Jailbreak matches:**
- `POST /api/admin/jailbreak/matches` - Create match
- `PATCH /api/admin/jailbreak/matches/[matchId]` - Update match
- `DELETE /api/admin/jailbreak/matches/[matchId]` - Delete match
- `POST /api/admin/jailbreak/matches/[matchId]/reset` - Reset match

**Garden content:**
- `POST /api/admin/garden/phases` - Create phase
- `PATCH /api/admin/garden/phases/[phaseId]` - Update phase
- `DELETE /api/admin/garden/phases/[phaseId]` - Delete phase
- `POST /api/admin/garden/levels` - Create level
- `PATCH /api/admin/garden/levels/[levelId]` - Update level
- `DELETE /api/admin/garden/levels/[levelId]` - Delete level
- `POST /api/admin/garden/reset` - Reset to seed content

**Cues:**
- `PATCH /api/admin/cues/[cueId]` - Update cue state

---

## Phase 6: Authentication Updates

### 6.1 Keep Firebase Auth for Admins
- `lib/firebase.ts` - Keep only Auth initialization, remove Firestore
- `lib/auth.ts` - Keep as-is for admin login/logout
- Admin middleware continues verifying Firebase ID tokens

### 6.2 Update Admin Verification
```typescript
// Before: Check Firestore admins collection
const adminDoc = await db.collection("admins").doc(uid).get()

// After: Check MongoDB admins collection
const admin = await AdminModel.findOne({ firebaseUid: uid })
```

### 6.3 Child Authentication (No Change)
- Child login already uses server-side session tokens
- Just update backend to query MongoDB instead of Firestore

---

## Phase 7: Data Migration Script

### 7.1 Create Migration Script
**New file:** `scripts/migrate-firestore-to-mongodb.ts`

```typescript
// 1. Connect to both Firestore and MongoDB
// 2. For each collection:
//    a. Fetch all documents from Firestore
//    b. Transform to MongoDB schema
//    c. Insert into MongoDB
// 3. Verify counts match
// 4. Log any migration errors
```

### 7.2 Migration Order (respecting references)
1. `admins`
2. `children`
3. `gameCues`
4. `gardenPhases`
5. `gardenLevels`
6. `jailbreakThemes`
7. `jailbreakMatches` + embedded/referenced turns
8. `childProgress` (flatten nested structure)
9. `agentStages`
10. `agentLevels`
11. `agentKnowledgeDocs`
12. `agentRuns`
13. `childAgentProgress`

---

## Phase 8: Cleanup

### 8.1 Files to Delete
- `lib/firebase-admin.ts` (after migration complete)
- `lib/collections.ts` (Firestore collection references)
- `firestore.rules`
- `firestore.indexes.json` (if exists)

### 8.2 Files to Update
- `lib/firebase.ts` - Remove Firestore initialization, keep Auth only
- Remove all `firebase/firestore` imports throughout codebase
- Remove `firebase-admin` imports (keep `firebase-admin/auth` if needed for token verification)

### 8.3 Dependencies to Remove
```bash
# After migration complete and verified
pnpm remove firebase-admin
# Keep 'firebase' for Auth
```

---

## Implementation Checklist

### Week 1: Foundation
- [ ] Set up MongoDB Atlas cluster
- [ ] Create `lib/mongodb.ts` connection
- [ ] Define all Mongoose schemas (Phase 2)
- [ ] Create indexes

### Week 2: API Layer
- [ ] Create polling utility hook
- [ ] Implement GET endpoints for all collections (Phase 3)
- [ ] Implement admin mutation endpoints (Phase 5.2)
- [ ] Update existing hooks to use polling

### Week 3: Server Migration
- [ ] Migrate `lib/server/*.ts` files to use Mongoose (Phase 4)
- [ ] Update existing API routes to use MongoDB
- [ ] Update authentication verification

### Week 4: Client & Cleanup
- [ ] Migrate client-side admin functions to API calls
- [ ] Run data migration script
- [ ] Test all functionality
- [ ] Remove Firestore dependencies
- [ ] Update environment documentation

---

## Rollback Plan

1. Keep Firestore data intact during migration
2. Use feature flag to switch between Firestore and MongoDB
3. If issues found, revert to Firestore by toggling flag
4. Only delete Firestore data after 1 week of stable MongoDB operation

---

## Performance Considerations

### Polling Optimization
- Use `If-Modified-Since` / `ETag` headers to reduce bandwidth
- Implement server-side caching for frequently accessed data
- Consider WebSocket fallback for truly real-time needs (jailbreak matches)

### MongoDB Optimization
- Use projection to limit returned fields
- Implement pagination for large collections
- Use `lean()` for read-only queries
- Connection pooling configured for serverless

---

## Security Notes

- All admin endpoints require Firebase Auth token verification
- All child endpoints require session token verification
- MongoDB connection string must use TLS
- Enable MongoDB Atlas IP allowlist
- Use MongoDB Atlas database user with minimal required permissions
