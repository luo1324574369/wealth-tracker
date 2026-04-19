# Asset List Reorder Design

## Goal

Add persistent drag-and-drop ordering for the homepage "记录资产" table only. The saved order should survive refreshes and app restarts without changing ordering behavior for detail pages or charts.

## Scope

- Add persistent ordering storage to `assets`
- Support drag-and-drop reordering in the homepage asset table
- Save reordered positions through a dedicated API
- Keep detail pages and charts on their current behavior

## Design

### Data model

Add an integer `sortOrder` column to `assets`. Existing databases are upgraded on server startup. Legacy rows are normalized into a stable `0..n-1` sequence so upgraded users keep a predictable initial order.

### Server flow

- Asset creation assigns the next `sortOrder`
- Reordering uses a dedicated batch endpoint instead of overloading the existing asset update route
- The reorder endpoint accepts an ordered list of asset `type` values and rewrites `sortOrder` in a transaction

### Client flow

- The homepage route keeps a dedicated table list derived from fetched assets and sorted by `sortOrder`
- Drag-and-drop only affects the homepage table state
- On drop, the client immediately updates the table, sends the new ordered `type` list to the server, and rolls back on failure
- Temporary A-Z / Z-A sorting remains available, but drag reordering is only enabled in the default custom-order mode

### Error handling

- Invalid reorder payloads return `400`
- Missing asset types during reorder abort the transaction
- Failed saves restore the previous homepage table order and surface the error through the existing alert store

### Verification

- Add focused tests for sort-order helper logic
- Run server build, client type checks, and targeted helper tests
