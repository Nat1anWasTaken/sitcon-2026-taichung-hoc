# Firestore to MongoDB Migration Plan (COMPLETED)

## Status: COMPLETED
All phases of this plan have been executed. Firestore has been removed and the application is fully running on MongoDB. This document is kept for historical reference.

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

### 2.2 Schema Design Considerations

**Flatten nested collections:**
- `childProgress/{childId}/sections/{sectionId}` → Single document per child with sections as subdocument map
- `jailbreakMatches/{matchId}/turns` → Either embed turns array in match (if small) OR separate collection with `matchId` reference

**Index strategy:**
- `children`: Index on `seatNumber` (unique)
- `jailbreakMatches`: Compound index on `attackerChildId + updatedAt`, `defenderChildId + updatedAt`
- `gameCues`: Index on `active`, `updatedAt`

---

## Phase 3: Create Polling API Endpoints

Replace each `onSnapshot` real-time listener with a polling endpoint.

### 3.1 New API Routes

| Current Real-time Hook | New API Endpoint | Polling Interval |
|------------------------|------------------|------------------|
| `use-children.ts` → `onSnapshot(childrenCollection)` | `GET /api/admin/children` | 2s |
| `use-jailbreak.ts` → `onSnapshot(jailbreakThemesCollection)` | `GET /api/admin/jailbreak/themes` | 2s |
| `use-jailbreak.ts` → `onSnapshot(jailbreakMatchesCollection)` | `GET /api/admin/jailbreak/matches` | 2s |
| `use-child-progress.ts` → `onSnapshot(sectionProgressCollection)` | `GET /api/game/progress` | 2s |
| `use-garden.ts` → `onSnapshot(gardenPhasesCollection)` | `GET /api/admin/garden/phases` | 5s |
| `use-garden.ts` → `onSnapshot(gardenLevelsCollection)` | `GET /api/admin/garden/levels` | 5s |
| `use-cues.ts` → `onSnapshot(gameCuesCollection)` | `GET /api/admin/cues` | 2.5s |

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
| `lib/server/cues.ts` | Replace Firestore queries with Mongoose |
| `lib/server/scoreboard.ts` | Replace Firestore aggregation with Mongoose |
| `lib/server/jailbreak-scoreboard.ts` | Replace Firestore queries with Mongoose |
| `lib/server/jailbreak.ts` | Replace Firestore queries with Mongoose |

### 4.2 Query Translation Examples

**Firestore → MongoDB:**
```typescript
// Before (Firestore)
  .where("stageType", "==", stageType)
  .where("isActive", "==", true)
  .orderBy("order", "asc")
  .get()

// After (Mongoose)
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

---

## ⚠️ Things to Care About (Detailed)

This section covers critical gotchas, edge cases, and important considerations during migration.

---

### 1. Document ID Differences

#### Problem
Firestore uses string document IDs (often auto-generated like `abc123xyz`), while MongoDB uses `ObjectId` by default.

#### Current Usage in Codebase
```typescript
// Firestore pattern - IDs are strings
const childDoc = doc(childrenCollection, childId)  // childId = "seat-42"
const themeDoc = doc(jailbreakThemesCollection, themeId)  // themeId = auto-generated string
```

#### Solution
**Option A: Use string `_id` in MongoDB (Recommended)**
```typescript
// In Mongoose schema
const ChildSchema = new Schema({
  _id: { type: String, required: true },  // Use string ID, not ObjectId
  seatNumber: Number,
  // ...
})
```

**Option B: Add separate `id` field**
```typescript
const ChildSchema = new Schema({
  id: { type: String, required: true, unique: true },  // Keep Firestore ID
  // MongoDB generates _id as ObjectId
})
```

#### Files Affected
- All files in `lib/models/*.ts` - schema definitions
- All queries that reference documents by ID
- `lib/child-accounts.ts` - uses `childDoc(childId)`
- `lib/jailbreak-admin.ts` - uses `jailbreakThemeDoc(themeId)`
- All API routes with `[childId]`, `[themeId]`, etc.

#### Action Items
- [ ] Decide on ID strategy before creating schemas
- [ ] If using string `_id`, disable auto ObjectId: `{ _id: false }` in schema options
- [ ] Update all `.findById()` calls if using custom string IDs
- [ ] Ensure migration script preserves original Firestore IDs

---

### 2. Timestamp Handling

#### Problem
Firestore uses `Timestamp` objects with `.toDate()`, `.seconds`, `.nanoseconds`. MongoDB/Mongoose uses native JavaScript `Date` objects.

#### Current Usage
```typescript
// Firestore - reading
const createdAt = doc.data().createdAt.toDate()

// Firestore - writing
import { serverTimestamp } from 'firebase/firestore'
await setDoc(ref, { createdAt: serverTimestamp() })

// Firestore Admin - writing
import { FieldValue } from 'firebase-admin/firestore'
await ref.set({ updatedAt: FieldValue.serverTimestamp() })
```

#### Solution
```typescript
// Mongoose schema - use Date type
const Schema = new mongoose.Schema({
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Or use timestamps option
const Schema = new mongoose.Schema({...}, { timestamps: true })

// Writing - just use new Date()
await Model.create({ createdAt: new Date() })

// Or let Mongoose handle it with timestamps: true
```

#### Critical Files to Update
- `lib/types.ts` - `Timestamp` type references
- `lib/game-types.ts` - `updatedAt: Timestamp`
- `lib/jailbreak-types.ts` - `createdAt`, `updatedAt`, `phaseExpiresAt`
- `lib/server/jailbreak.ts` - `Timestamp.fromMillis()` usage for phase expiration

#### Jailbreak Phase Expiration (Special Case)
```typescript
// Current Firestore code
import { Timestamp } from 'firebase-admin/firestore'
const expiresAt = Timestamp.fromMillis(Date.now() + PHASE_DURATION_MS)

// MongoDB equivalent
const expiresAt = new Date(Date.now() + PHASE_DURATION_MS)
```

#### Migration Script Consideration
```typescript
// Transform Firestore Timestamp to Date during migration
function transformTimestamp(firestoreTimestamp: FirebaseFirestore.Timestamp): Date {
  return firestoreTimestamp.toDate()
}
```

#### Action Items
- [ ] Update all type definitions to use `Date` instead of `Timestamp`
- [ ] Search for all `serverTimestamp()` calls and replace with `new Date()`
- [ ] Search for all `Timestamp.fromMillis()` and replace with `new Date()`
- [ ] Update frontend code that calls `.toDate()` on timestamps
- [ ] Handle timezone consistency (store in UTC, display in local)

---

### 3. Nested Collection Flattening

#### Problem
Firestore supports subcollections (nested collections). MongoDB does not have the same concept.

#### Current Nested Collections
1. `childProgress/{childId}/sections/{sectionId}` - Section progress per child
2. `jailbreakMatches/{matchId}/turns/{turnId}` - Turns within matches

#### Solution for `childProgress`

**Before (Firestore):**
```
childProgress/
  └── child-1/
        └── sections/
              ├── section-1 { phase: 2, ... }
              └── section-2 { phase: 1, ... }
```

**After (MongoDB) - Option A: Embedded Document**
```typescript
// Single document per child with sections map
const ChildProgressSchema = new Schema({
  _id: String,  // childId
  sections: {
    type: Map,
    of: new Schema({
      currentPhase: Number,
      currentLevel: Number,
      // ... other section fields
    })
  }
})

// Query: Get section progress
const progress = await ChildProgressModel.findById(childId)
const section1 = progress.sections.get('section-1')
```

**After (MongoDB) - Option B: Separate Collection with Compound Key**
```typescript
const SectionProgressSchema = new Schema({
  childId: { type: String, required: true },
  sectionId: { type: String, required: true },
  currentPhase: Number,
  // ...
})
SectionProgressSchema.index({ childId: 1, sectionId: 1 }, { unique: true })

// Query
const progress = await SectionProgressModel.findOne({ childId, sectionId })
```

#### Solution for `jailbreakMatches/turns`

**Recommendation:** Separate collection (turns can grow large)

```typescript
const JailbreakTurnSchema = new Schema({
  matchId: { type: String, required: true, index: true },
  attackerPrompt: String,
  aiResponse: String,
  breach: Boolean,
  // ...
  createdAt: { type: Date, default: Date.now }
})

// Query turns for match
const turns = await JailbreakTurnModel.find({ matchId }).sort({ createdAt: -1 }).limit(10)
```

#### Files Affected
- `lib/collections.ts` - `sectionProgressCollection(childId)`, `jailbreakTurnsCollection(matchId)`
- `lib/server/progress.ts` - nested collection queries
- `lib/server/jailbreak.ts` - turn queries
- `hooks/use-child-progress.ts` - snapshot on nested collection

#### Action Items
- [ ] Decide embedding vs. separate collection for each nested structure
- [ ] Update all queries that traverse subcollections
- [ ] Update migration script to flatten/transform nested data
- [ ] Consider query patterns when deciding (reads vs. writes ratio)

---

### 4. Query Operator Differences

#### Problem
Firestore and MongoDB have different query syntax and capabilities.

#### Common Translations

| Firestore | MongoDB/Mongoose |
|-----------|------------------|
| `.where("field", "==", value)` | `.find({ field: value })` |
| `.where("field", "in", [a, b])` | `.find({ field: { $in: [a, b] } })` |
| `.where("field", "array-contains", val)` | `.find({ field: val })` (if field is array) |
| `.orderBy("field", "asc")` | `.sort({ field: 1 })` |
| `.orderBy("field", "desc")` | `.sort({ field: -1 })` |
| `.limit(10)` | `.limit(10)` |
| `.startAfter(doc)` | `.skip(n)` or cursor-based |

#### Compound Queries (Watch Out!)
```typescript
// Firestore - requires composite index
db.collection("matches")
  .where("attackerChildId", "==", childId)
  .orderBy("updatedAt", "desc")

// MongoDB - just works, but add compound index for performance
MatchModel.find({ attackerChildId: childId }).sort({ updatedAt: -1 })

// Create index
MatchSchema.index({ attackerChildId: 1, updatedAt: -1 })
```

#### Inequality + OrderBy (Firestore Limitation)
```typescript
// Firestore FAILS: inequality filter on different field than orderBy
db.collection("items")
  .where("price", ">", 100)
  .orderBy("createdAt", "desc")  // ERROR!

// MongoDB: No problem
ItemModel.find({ price: { $gt: 100 } }).sort({ createdAt: -1 })
```

#### Files with Complex Queries
- `lib/server/jailbreak.ts` - Multiple where clauses with orderBy
- `lib/server/scoreboard.ts` - Aggregation queries

#### Action Items
- [ ] Audit all Firestore queries and translate syntax
- [ ] Identify queries that need compound indexes
- [ ] Create indexes before going live (prevent slow queries)
- [ ] Test query performance with realistic data volumes

---

### 5. Transaction and Batch Differences

#### Problem
Firestore batch writes and transactions work differently from MongoDB transactions.

#### Firestore Batch (Current)
```typescript
const batch = writeBatch(firestoreDb)
batch.set(doc1Ref, data1)
batch.update(doc2Ref, data2)
batch.delete(doc3Ref)
await batch.commit()  // Atomic
```

#### MongoDB Transaction
```typescript
const session = await mongoose.startSession()
try {
  await session.withTransaction(async () => {
    await Model1.create([data1], { session })
    await Model2.updateOne({ _id: id2 }, data2, { session })
    await Model3.deleteOne({ _id: id3 }, { session })
  })
} finally {
  session.endSession()
}
```

#### Key Differences
| Aspect | Firestore | MongoDB |
|--------|-----------|---------|
| Max operations | 500 per batch | No limit (but memory) |
| Requires replica set | No | Yes (for transactions) |
| Read in transaction | Yes | Yes |
| Cross-collection | Yes | Yes |
| Automatic retry | No | Configurable |

#### MongoDB Atlas Note
MongoDB Atlas clusters (M10+) support transactions. Free tier (M0) does NOT support multi-document transactions.

#### Files Using Batches
- `lib/jailbreak-admin.ts` - `writeBatch()` for reset operations
- `lib/garden-admin.ts` - `writeBatch()` for cascade deletes

#### Action Items
- [ ] Ensure MongoDB Atlas tier supports transactions (M10+ or M0 with single-doc operations)
- [ ] Replace `writeBatch()` with `session.withTransaction()`
- [ ] Add proper error handling and session cleanup
- [ ] Consider if some batches can be converted to bulk operations (non-transactional)

---

### 6. Real-Time to Polling UX Implications

#### Problem
Replacing `onSnapshot` with polling introduces latency and potential stale data issues.

#### User Experience Impacts

| Scenario | With Real-time | With Polling (5s) |
|----------|---------------|-------------------|
| Admin creates child | Instant appear | Up to 5s delay |
| Match status update | Instant | Up to 3s delay |
| Cue activation | Instant | Up to 3s delay |
| Score update | Instant | Up to 5s delay |

#### Mitigation Strategies

**1. Optimistic Updates**
```typescript
// Update local state immediately, then sync with server
const createChild = async (data) => {
  // Optimistic: add to local state
  setChildren(prev => [...prev, { ...data, _optimistic: true }])

  // API call
  const result = await fetch('/api/admin/children', { method: 'POST', body: data })

  // Replace optimistic with real data on next poll
  // Or handle error and rollback
}
```

**2. Manual Refetch After Mutations**
```typescript
const { data, refetch } = usePolling('/api/admin/children', 5000)

const createChild = async (data) => {
  await fetch('/api/admin/children', { method: 'POST', body: data })
  refetch()  // Immediately fetch fresh data
}
```

**3. Shorter Polling for Critical Data**
- Jailbreak matches during active play: 1-2s polling
- Admin dashboard: 5s polling
- Static content (garden levels): 30s polling

**4. Visual Feedback**
- Show "last updated" timestamp
- Show loading spinner during refetch
- Show "syncing..." indicator

#### Jailbreak Game Specific Concerns
The jailbreak game has time-sensitive phases (`phaseExpiresAt`). With polling:
- Phase transitions may appear delayed
- Timer display may drift from server time
- Multiple clients may see different states briefly

**Solution for Jailbreak:**
```typescript
// Client-side timer based on known expiration
const [timeLeft, setTimeLeft] = useState(0)

useEffect(() => {
  if (match?.phaseExpiresAt) {
    const interval = setInterval(() => {
      const remaining = new Date(match.phaseExpiresAt).getTime() - Date.now()
      setTimeLeft(Math.max(0, remaining))

      if (remaining <= 0) {
        refetch()  // Immediately check for phase transition
      }
    }, 1000)
    return () => clearInterval(interval)
  }
}, [match?.phaseExpiresAt])
```

#### Action Items
- [ ] Implement `usePolling` hook with refetch capability
- [ ] Add optimistic updates for critical mutations
- [ ] Add "last synced" indicator in admin UI
- [ ] Implement client-side timers for jailbreak phase countdowns
- [ ] Test UX with realistic network latency
- [ ] Consider WebSocket for jailbreak matches if polling UX is unacceptable

---

### 7. Connection Handling in Next.js Serverless

#### Problem
Each API route invocation in serverless may create new database connections, exhausting connection pool.

#### Mongoose Singleton Pattern (Required)
```typescript
// lib/mongodb.ts
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI!

if (!MONGODB_URI) {
  throw new Error('Please define MONGODB_URI environment variable')
}

// Cache connection in global to survive hot reloads
let cached = global.mongoose

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null }
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,  // Limit connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    throw e
  }

  return cached.conn
}

// Type declaration for global
declare global {
  var mongoose: {
    conn: typeof mongoose | null
    promise: Promise<typeof mongoose> | null
  }
}
```

#### Usage in API Routes
```typescript
// app/api/admin/children/route.ts
import { connectToDatabase } from '@/lib/mongodb'
import { ChildModel } from '@/lib/models/child'

export async function GET() {
  await connectToDatabase()  // Ensures connection before query
  const children = await ChildModel.find().sort({ seatNumber: 1 })
  return Response.json(children)
}
```

#### Connection Pool Sizing
- MongoDB Atlas M0 (free): 500 connections max
- Vercel serverless: Can spawn many concurrent functions
- **Recommendation:** Set `maxPoolSize: 10` and monitor

#### Action Items
- [ ] Implement singleton connection pattern
- [ ] Add global type declaration for TypeScript
- [ ] Set appropriate `maxPoolSize` based on expected concurrency
- [ ] Add connection error handling and logging
- [ ] Monitor connection count in MongoDB Atlas dashboard

---

### 8. Type Safety with Mongoose

#### Problem
Mongoose typing is complex. Must ensure TypeScript types match schema definitions.

#### Pattern: Separate Interface and Schema
```typescript
// lib/models/child.ts
import mongoose, { Schema, Document, Model } from 'mongoose'

// 1. Define interface for the document
export interface IChild {
  seatNumber: number
  childId: string
  name: string
  passwordHash: string
  passwordSalt: string
  status: 'active' | 'inactive'
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
}

// 2. Define interface for document methods (if any)
export interface IChildMethods {
  verifyPassword(password: string): Promise<boolean>
}

// 3. Define the model type
export type ChildModel = Model<IChild, {}, IChildMethods>

// 4. Create schema with types
const childSchema = new Schema<IChild, ChildModel, IChildMethods>({
  seatNumber: { type: Number, required: true, unique: true },
  childId: { type: String, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  passwordSalt: { type: String, required: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  lastLoginAt: Date,
}, {
  timestamps: true,  // Adds createdAt and updatedAt
})

// 5. Add methods
childSchema.methods.verifyPassword = async function(password: string) {
  // ... verification logic
}

// 6. Export model (handle hot reload)
export const ChildModel = mongoose.models.Child as ChildModel ||
  mongoose.model<IChild, ChildModel>('Child', childSchema)
```

#### Common Typing Gotchas

**1. `_id` type:**
```typescript
// If using string _id
interface IChild {
  _id: string  // Not ObjectId
  // ...
}

// In schema
const schema = new Schema({
  _id: { type: String, required: true },
  // ...
}, { _id: false })  // Disable auto ObjectId
```

**2. Lean queries return plain objects:**
```typescript
// With lean(), result is plain object, not Document
const child = await ChildModel.findById(id).lean()
// child is IChild, not IChild & Document

// Without lean(), result has Mongoose methods
const child = await ChildModel.findById(id)
// child is (IChild & Document) | null
```

**3. Optional fields vs undefined:**
```typescript
// Mongoose returns undefined for missing optional fields
// But TypeScript may expect null
interface IChild {
  lastLoginAt?: Date  // Optional field
}

// When reading
const lastLogin = child.lastLoginAt  // Date | undefined
```

#### Action Items
- [ ] Create interface for each model matching existing `lib/types.ts`
- [ ] Ensure schema validators match interface types
- [ ] Use `lean()` for read-only queries (better performance)
- [ ] Handle `null` vs `undefined` consistently
- [ ] Add JSDoc comments for complex fields

---

### 9. Null/Undefined Handling Differences

#### Problem
Firestore and MongoDB handle missing fields differently.

#### Firestore Behavior
```typescript
// Firestore: missing field = undefined
const doc = await getDoc(ref)
const data = doc.data()
data.missingField  // undefined

// Firestore: explicit null is stored as null
await setDoc(ref, { field: null })
```

#### MongoDB Behavior
```typescript
// MongoDB: missing field = undefined (not in document at all)
// MongoDB: explicit null is stored as null

// Query for missing field
Model.find({ field: { $exists: false } })

// Query for null
Model.find({ field: null })  // Matches both null AND missing!

// Query for explicitly null only
Model.find({ field: { $type: 'null' } })
```

#### Current Code That May Break
```typescript
// This Firestore pattern
if (doc.data().optionalField !== undefined) {
  // Field exists
}

// May need adjustment for MongoDB
if (doc.optionalField !== undefined && doc.optionalField !== null) {
  // Field exists and has value
}
```

#### Schema Default Values
```typescript
// Set defaults to avoid undefined
const schema = new Schema({
  score: { type: Number, default: 0 },
  items: { type: [String], default: [] },
  metadata: { type: Object, default: {} },
})
```

#### Action Items
- [ ] Audit code for undefined checks on optional fields
- [ ] Decide on null vs undefined convention
- [ ] Add schema defaults where appropriate
- [ ] Update queries that check for field existence

---

### 10. Array Operations Differences

#### Problem
Firestore has special array operators (`arrayUnion`, `arrayRemove`). MongoDB uses different syntax.

#### Current Firestore Usage (if any)
```typescript
import { arrayUnion, arrayRemove } from 'firebase/firestore'

// Add to array
await updateDoc(ref, {
  completedThemeIds: arrayUnion(themeId)
})

// Remove from array
await updateDoc(ref, {
  completedThemeIds: arrayRemove(themeId)
})
```

#### MongoDB Equivalent
```typescript
// Add to array (if not exists)
await Model.updateOne(
  { _id: id },
  { $addToSet: { completedThemeIds: themeId } }
)

// Remove from array
await Model.updateOne(
  { _id: id },
  { $pull: { completedThemeIds: themeId } }
)

// Push (allows duplicates)
await Model.updateOne(
  { _id: id },
  { $push: { items: newItem } }
)
```

#### Files to Check
- `lib/jailbreak-admin.ts` - `completedThemeIds` array in matches
- Any file using `arrayUnion` or `arrayRemove`

#### Action Items
- [ ] Search codebase for `arrayUnion` and `arrayRemove` usage
- [ ] Replace with MongoDB `$addToSet` and `$pull` operators
- [ ] Test array operations maintain expected behavior

---

### 11. Race Conditions with Polling

#### Problem
Without real-time sync, concurrent updates can cause race conditions.

#### Scenario: Two Admins Editing Same Match
```
Time 0: Admin A fetches match (version 1)
Time 1: Admin B fetches match (version 1)
Time 2: Admin A updates match → version 2
Time 3: Admin B updates match → overwrites Admin A's changes!
```

#### Solutions

**1. Optimistic Locking (Recommended)**
```typescript
// Add version field to schema
const MatchSchema = new Schema({
  // ...
  __v: Number,  // Mongoose adds this by default
})

// Check version on update
const result = await MatchModel.findOneAndUpdate(
  { _id: matchId, __v: expectedVersion },
  { $set: updates, $inc: { __v: 1 } },
  { new: true }
)

if (!result) {
  throw new Error('Conflict: match was modified by another user')
}
```

**2. Last-Write-Wins with Conflict Detection**
```typescript
// Include updatedAt in response
// Client checks if their base version matches before submitting
```

**3. Field-Level Updates**
```typescript
// Instead of replacing entire document, update specific fields
await MatchModel.updateOne(
  { _id: matchId },
  { $set: { status: 'completed' } }  // Only update status
)
```

#### Action Items
- [ ] Identify documents with concurrent edit risk
- [ ] Implement optimistic locking for critical documents
- [ ] Add conflict resolution UI (show error, offer refresh)
- [ ] Consider field-level updates to reduce conflicts

---

### 12. Server Timestamp Consistency

#### Problem
Firestore's `serverTimestamp()` guarantees server-side time. Must replicate in MongoDB.

#### Firestore Pattern
```typescript
// Client-side - placeholder replaced by server
import { serverTimestamp } from 'firebase/firestore'
await setDoc(ref, { createdAt: serverTimestamp() })

// Server-side
import { FieldValue } from 'firebase-admin/firestore'
await ref.set({ createdAt: FieldValue.serverTimestamp() })
```

#### MongoDB Pattern
```typescript
// API route (server-side) - use server's Date.now()
await Model.create({
  createdAt: new Date(),  // Server time
})

// Or use Mongoose timestamps option
const schema = new Schema({...}, { timestamps: true })
// Automatically adds createdAt and updatedAt with server time
```

#### Client-Side Consideration
```typescript
// DON'T trust client time for important timestamps
// Bad: Client sends { createdAt: new Date() }
// Good: Server sets timestamp in API route

// API route
export async function POST(req: Request) {
  const body = await req.json()
  await Model.create({
    ...body,
    createdAt: new Date(),  // Server sets this, ignore client value
  })
}
```

#### Files Affected
- All files using `serverTimestamp()` or `FieldValue.serverTimestamp()`
- `lib/child-accounts.ts`
- `lib/jailbreak-admin.ts`
- `lib/server/progress.ts`
- `lib/server/jailbreak.ts`

#### Action Items
- [ ] Move all timestamp setting to server-side API routes
- [ ] Use Mongoose `timestamps: true` option where appropriate
- [ ] Remove `serverTimestamp()` imports from client code
- [ ] Ensure time-sensitive operations (phase expiration) use server time

---

### 13. Data Migration Edge Cases

#### Problem
Migration script must handle various edge cases in data transformation.

#### Edge Cases to Handle

**1. Missing Optional Fields**
```typescript
// Firestore doc may not have all fields
const firestoreDoc = { name: 'John' }  // Missing createdAt

// Migration must provide defaults
const mongoDoc = {
  ...firestoreDoc,
  createdAt: firestoreDoc.createdAt?.toDate() || new Date(),
}
```

**2. Nested Subcollection References**
```typescript
// childProgress/{childId}/sections/{sectionId}
// Must query each child's sections subcollection
for (const child of children) {
  const sectionsSnap = await db
    .collection('childProgress')
    .doc(child.id)
    .collection('sections')
    .get()
  // Transform and insert
}
```

**3. Document ID Preservation**
```typescript
// Preserve Firestore document IDs
const mongoDoc = {
  _id: firestoreDoc.id,  // Use Firestore ID as MongoDB _id
  ...firestoreDoc.data(),
}
```

**4. Reference Fields**
```typescript
// If any field references another document
// Firestore: DocumentReference object
// MongoDB: Just store the ID string

const mongoDoc = {
  ...data,
  themeRef: data.themeRef?.id || data.themeId,  // Extract ID from reference
}
```

**5. Timestamp Arrays**
```typescript
// Array of timestamps
const mongoDoc = {
  ...data,
  loginHistory: data.loginHistory?.map(ts => ts.toDate()) || [],
}
```

**6. GeoPoint (if used)**
```typescript
// Firestore GeoPoint → MongoDB Point
// Firestore: { latitude: 40.7, longitude: -74.0 }
// MongoDB: { type: 'Point', coordinates: [-74.0, 40.7] }  // Note: [lng, lat]
```

#### Migration Script Structure
```typescript
// scripts/migrate-firestore-to-mongodb.ts

async function migrateCollection(
  collectionName: string,
  transform: (doc: FirestoreDoc) => MongoDoc
) {
  const snapshot = await firestoreDb.collection(collectionName).get()

  const mongoDocs = []
  const errors = []

  for (const doc of snapshot.docs) {
    try {
      const transformed = transform({ id: doc.id, ...doc.data() })
      mongoDocs.push(transformed)
    } catch (error) {
      errors.push({ docId: doc.id, error: error.message })
    }
  }

  if (mongoDocs.length > 0) {
    await MongoModel.insertMany(mongoDocs, { ordered: false })
  }

  console.log(`Migrated ${mongoDocs.length}/${snapshot.size} docs`)
  if (errors.length > 0) {
    console.error('Errors:', errors)
  }
}
```

#### Action Items
- [ ] Create transform function for each collection
- [ ] Handle all optional fields with defaults
- [ ] Test migration with production data snapshot
- [ ] Log all migration errors for review
- [ ] Validate document counts match after migration
- [ ] Run migration in dry-run mode first

---

### 14. Index Creation Before Go-Live

#### Problem
Missing indexes cause slow queries and can timeout in production.

#### Required Indexes

```typescript
// lib/models/indexes.ts - Run once during setup

// Children
ChildModel.collection.createIndex({ seatNumber: 1 }, { unique: true })

// Jailbreak Matches
JailbreakMatchModel.collection.createIndex({ attackerChildId: 1, updatedAt: -1 })
JailbreakMatchModel.collection.createIndex({ defenderChildId: 1, updatedAt: -1 })
JailbreakMatchModel.collection.createIndex({ status: 1, updatedAt: -1 })

// Jailbreak Turns
JailbreakTurnModel.collection.createIndex({ matchId: 1, createdAt: -1 })



// Game Cues
GameCueModel.collection.createIndex({ active: 1, updatedAt: -1 })

// Garden Levels
GardenLevelModel.collection.createIndex({ phaseId: 1, levelNumber: 1 })
```

#### Index in Schema Definition
```typescript
const ChildSchema = new Schema({
  seatNumber: { type: Number, required: true, unique: true, index: true },
  // ...
})

// Or compound index
ChildSchema.index({ status: 1, createdAt: -1 })
```

#### Action Items
- [ ] Define all indexes in schema files
- [ ] Create index setup script for initial deployment
- [ ] Run `Model.syncIndexes()` during app startup (development only)
- [ ] Verify indexes in MongoDB Atlas after deployment
- [ ] Monitor slow query log for missing indexes

---

### 15. Error Handling Pattern Differences

#### Problem
Firestore and Mongoose throw different error types.

#### Firestore Errors
```typescript
import { FirestoreError } from 'firebase/firestore'

try {
  await getDoc(ref)
} catch (error) {
  if (error instanceof FirestoreError) {
    if (error.code === 'permission-denied') { ... }
    if (error.code === 'not-found') { ... }
  }
}
```

#### Mongoose Errors
```typescript
import mongoose from 'mongoose'

try {
  await Model.create(data)
} catch (error) {
  if (error instanceof mongoose.Error.ValidationError) {
    // Schema validation failed
    console.log(error.errors)  // Field-level errors
  }

  if (error instanceof mongoose.Error.CastError) {
    // Type casting failed (e.g., invalid ObjectId)
  }

  if (error.code === 11000) {
    // Duplicate key error (unique constraint violation)
    const field = Object.keys(error.keyPattern)[0]
    console.log(`Duplicate ${field}`)
  }
}
```

#### API Route Error Handling Pattern
```typescript
export async function POST(req: Request) {
  try {
    await connectToDatabase()
    const body = await req.json()
    const result = await Model.create(body)
    return Response.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return Response.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }
    if ((error as any).code === 11000) {
      return Response.json(
        { error: 'Duplicate entry' },
        { status: 409 }
      )
    }
    console.error('Database error:', error)
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Action Items
- [ ] Update all try/catch blocks with Mongoose error types
- [ ] Create shared error handling utility
- [ ] Map error types to appropriate HTTP status codes
- [ ] Ensure client receives meaningful error messages

---

### 16. Environment Variable Updates

#### Current Firebase Variables
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY=...
```

#### After Migration
```
# Keep for Firebase Auth
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Remove (no longer needed)
# FIREBASE_ADMIN_PROJECT_ID
# FIREBASE_ADMIN_CLIENT_EMAIL
# FIREBASE_ADMIN_PRIVATE_KEY

# Add for MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Optional: Keep admin SDK if using for auth token verification
FIREBASE_ADMIN_PROJECT_ID=...  # Only if verifying tokens server-side
```

#### Action Items
- [ ] Add `MONGODB_URI` to all environments (dev, staging, prod)
- [ ] Update `.env.example` with new variables
- [ ] Update deployment platform (Vercel) environment variables
- [ ] Remove unused Firebase admin variables after migration
- [ ] Document required environment variables in README

---

### 17. Testing Strategy

#### Unit Tests
```typescript
// Use mongodb-memory-server for unit tests
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongoServer: MongoMemoryServer

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections
  for (const key in collections) {
    await collections[key].deleteMany({})
  }
})
```

#### Integration Tests
- Test each API endpoint with real MongoDB (staging)
- Test polling behavior with multiple clients
- Test error scenarios (network failure, invalid data)

#### Migration Tests
- Run migration script against copy of production data
- Verify document counts match
- Spot-check random documents for data integrity
- Test application functionality with migrated data

#### Action Items
- [ ] Add `mongodb-memory-server` to dev dependencies
- [ ] Create test utilities for database setup/teardown
- [ ] Write tests for critical operations
- [ ] Test migration script with production data snapshot
- [ ] Perform load testing on polling endpoints

---

### 18. Monitoring and Observability

#### MongoDB Atlas Monitoring
- Connection count
- Query performance (slow queries)
- Index usage
- Storage size

#### Application Monitoring
```typescript
// Log slow queries
mongoose.set('debug', (collectionName, method, query, doc) => {
  console.log(`${collectionName}.${method}`, JSON.stringify(query))
})

// Or with timing
const start = Date.now()
const result = await Model.find(query)
const duration = Date.now() - start
if (duration > 100) {
  console.warn(`Slow query (${duration}ms):`, query)
}
```

#### Metrics to Track
- API response times (p50, p95, p99)
- Database query times
- Connection pool utilization
- Error rates by type
- Polling endpoint hit rates

#### Action Items
- [ ] Set up MongoDB Atlas monitoring alerts
- [ ] Add query timing logs for slow queries
- [ ] Track API response times
- [ ] Set up error alerting (Sentry, etc.)
- [ ] Create dashboard for key metrics

---

### 19. Deployment Strategy

#### Recommended: Blue-Green with Feature Flag

**Phase 1: Deploy MongoDB Code (Flag Off)**
- Deploy new code with both Firestore and MongoDB support
- Feature flag defaults to Firestore
- MongoDB is connected but not used

**Phase 2: Run Migration**
- Execute migration script
- Verify data integrity
- Keep Firestore as source of truth

**Phase 3: Switch Flag to MongoDB**
- Toggle feature flag
- Monitor for errors
- Firestore still has data for rollback

**Phase 4: Monitor and Stabilize**
- Run for 1+ week on MongoDB
- Fix any issues discovered
- Firestore remains as backup

**Phase 5: Cleanup**
- Remove Firestore code and dependencies
- Delete Firestore data (optional, keep for archive)
- Remove feature flag code

#### Feature Flag Implementation
```typescript
// lib/config.ts
export const USE_MONGODB = process.env.USE_MONGODB === 'true'

// Usage
import { USE_MONGODB } from '@/lib/config'
import { getChildFromFirestore } from '@/lib/firestore/child'
import { getChildFromMongo } from '@/lib/mongo/child'

export const getChild = USE_MONGODB ? getChildFromMongo : getChildFromFirestore
```

#### Action Items
- [ ] Implement feature flag system
- [ ] Create parallel implementations during transition
- [ ] Plan migration window (low-traffic period)
- [ ] Prepare rollback procedure
- [ ] Communicate maintenance window to stakeholders

---

### 20. Documentation Updates

#### Files to Update
- `README.md` - Environment setup, database requirements
- `CLAUDE.md` - Update Firebase-specific instructions
- `.env.example` - Add MongoDB variables, mark deprecated ones
- API documentation (if exists)

#### New Documentation Needed
- MongoDB schema documentation
- API endpoint documentation (new polling endpoints)
- Migration runbook
- Troubleshooting guide

#### Action Items
- [ ] Update README with MongoDB setup instructions
- [ ] Update CLAUDE.md to remove Firestore-specific rules
- [ ] Document new API endpoints
- [ ] Create migration runbook
- [ ] Document rollback procedure
