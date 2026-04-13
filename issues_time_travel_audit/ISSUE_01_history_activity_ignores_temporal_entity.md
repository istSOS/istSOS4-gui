# ISSUE 01 — History activity API ignores temporal/entity context

## Priority
P0 (High)

## Proposal Relevance
Directly impacts the Time-Travel proposal goal: temporal query propagation and coherent temporal UX across history workflows.

## Issue Description
`/api/history/activity` currently returns synthetic buckets based only on `period`, with a fixed anchor date and computed counts. It does not use selected entity type, `$as_of`, or `$from_to`.

## Evidence
- `ui/app/api/history/activity/route.ts`
  - Reads only `period`
  - Uses fixed date `2024-08-20T00:00:00Z`
  - Generates counts with deterministic formula, not dataset-derived data

## Validation Status
- Static validation: Confirmed from implementation path.
- Runtime validation: 11 unit tests added and passing covering all filter combinations.
- Full test suite: 18/18 tests passing across 4 suites.
- Browser verification: API responses and History page UI confirmed correct.

## Reproduction
1. Open `/history`.
2. Change temporal mode between `current`, `as_of`, `from_to`.
3. Switch entity tabs.
4. Observe activity graph pattern stays synthetic and detached from query context.

## Expected vs Actual
- Expected: Activity buckets derived from filtered history/commit data for selected entity + temporal scope.
- Actual: Synthetic buckets independent from temporal/entity filters.

## Fix Applied
1. Extracted shared `COMMITS`, `SNAPSHOTS`, `ENTITY_TYPES`, `parseEntityType` into `ui/app/api/history/data.ts`.
2. Added `buildActivityBuckets()` pure function that filters commits by `entityType`, `$as_of`, `$from_to` and builds date-bucketed activity counts.
3. Simplified `activity/route.ts` to delegate to `buildActivityBuckets()`.
4. Refactored `history/route.ts` to import from shared module (no logic change).
5. Updated `page.tsx` to pass temporal params to the activity endpoint URL via `appendTemporalParams`.
6. Kept deterministic zero-count fallback for empty filter results.

## Files Changed
- `ui/app/api/history/data.ts` — **NEW** shared data + `buildActivityBuckets()` logic
- `ui/app/api/history/activity/route.ts` — **MODIFIED** uses shared function
- `ui/app/api/history/route.ts` — **MODIFIED** imports from shared module
- `ui/app/history/page.tsx` — **MODIFIED** activity URL includes temporal params
- `ui/__tests__/history-activity.test.ts` — **NEW** 11 unit tests

## Draft GitHub Issue
### Title
History activity endpoint ignores selected entity and temporal scope

### Problem
The activity graph is currently backed by synthetic data not linked to selected entity or temporal mode, creating a mismatch with the history query preview and user expectations.

### Steps to Reproduce
1. Go to `/history`.
2. Switch entity tab and temporal mode.
3. Observe activity graph output.

### Expected
Activity data changes according to entity and temporal filters.

### Actual
Activity data remains formula-generated and detached.

### Acceptance Criteria
- Activity API accepts and applies `entityType`, `$as_of`, `$from_to`.
- Buckets are computed from filtered commits.
- Graph output changes when temporal/entity filters change.

## Draft PR Description
### Summary
Wire activity endpoint to temporal-aware history data instead of synthetic buckets.

### Root Cause
Mock activity generator bypasses temporal/entity query context.

### Changes
- Extract shared data and filtering logic into `data.ts` with a pure `buildActivityBuckets()` function.
- Activity route delegates to `buildActivityBuckets()` with parsed query params.
- History route refactored to import from shared module (zero logic change).
- Frontend `page.tsx` passes temporal params to the activity endpoint via `appendTemporalParams`.
- Zero-count fallback preserved for empty filter results.

### Test Plan
- 11 unit tests covering: default entity, per-entity filtering, `$as_of` inclusion/exclusion, `$from_to` range filtering, empty result fallback, structural validation, cross-entity differentiation.
- Full test suite: 18/18 passing.
- Browser verification: API JSON responses and History page UI confirmed correct.

### Risks
- Slight behavior change in demo data shape (activity buckets now reflect real commit dates instead of formula-generated patterns).
- Zero-count fallback ensures empty states still render a valid 28-day grid.