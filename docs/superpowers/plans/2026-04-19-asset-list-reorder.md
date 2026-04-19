# Asset List Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent drag-and-drop ordering to the homepage asset table without changing ordering behavior for other views.

**Architecture:** Store a dedicated `sortOrder` on `assets`, expose a batch reorder endpoint, and keep homepage ordering isolated in route-local state. The server owns persistence while the homepage table owns drag interaction and optimistic rollback.

**Tech Stack:** Fastify, Sequelize, SQLite, Svelte, Flowbite-Svelte, TypeScript, Node `node:test`

---

### Task 1: Add sort-order helper tests

**Files:**
- Create: `server/src/helper/assetsOrder.ts`
- Create: `server/src/helper/assetsOrder.test.ts`
- Create: `client/src/helper/assetOrder.ts`
- Create: `client/src/helper/assetOrder.test.ts`

- [ ] Write failing helper tests for next-order calculation, reorder payload generation, homepage sorting, and drag-drop array movement.
- [ ] Run the targeted tests and confirm they fail for the missing helpers.
- [ ] Implement the minimal helper functions.
- [ ] Re-run the targeted tests and confirm they pass.

### Task 2: Persist asset order on the server

**Files:**
- Modify: `server/src/models/assets.ts`
- Modify: `server/src/controllers/assets.ts`
- Modify: `server/src/routes/assets.ts`
- Modify: `server/src/index.ts`

- [ ] Add `sortOrder` to the model.
- [ ] Add startup normalization for legacy databases.
- [ ] Assign the next order during asset creation.
- [ ] Add a dedicated reorder endpoint that updates `sortOrder` transactionally.

### Task 3: Wire homepage-only ordering on the client

**Files:**
- Modify: `client/src/routes/Index.svelte`
- Modify: `client/src/components/ChartWidget/TableWidget.svelte`
- Modify: `client/src/helper/apis.ts`
- Modify: `client/src/typings/index.d.ts`

- [ ] Add the reorder API helper and `sortOrder` typing.
- [ ] Keep a homepage-only ordered table list in `Index.svelte`.
- [ ] Add drag-and-drop row behavior in `TableWidget.svelte`.
- [ ] Optimistically update the homepage list, persist the new order, and roll back on failure.

### Task 4: Verify the change

**Files:**
- Modify: none

- [ ] Run targeted helper tests.
- [ ] Run `cd server && npm run build`.
- [ ] Run `cd client && npm run check`.
- [ ] Review the final diff for homepage-only scope and no generated-file changes.
