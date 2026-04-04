# AGENTS.md

Guidance for coding agents working in this repo.

## Non-Negotiables
- DO NOT edit generated output in `server/public/**` or `client/dist/**`.
- DO NOT hardcode secrets, tokens, or passwords.
- Keep diffs minimal and consistent with existing patterns.

## Workflow
- Locate relevant files first (use `rg` and `rg --files`).
- Follow existing architecture and naming conventions.
- If you add or change an API, update both server route/controller and client API helpers.
- Note any commands you ran. If you did not run tests or checks, say so.

## Project Structure
- Monorepo: `client/` (Svelte + Vite) and `server/` (Fastify + Sequelize + SQLite).
- Client routes in `client/src/routes`. Server routes in `server/src/routes`.
- DB models in `server/src/models` and must be imported in `server/src/index.ts`.
- Desktop work should live in `desktop/` if/when Electron is added; keep the shell separate from `client/` and `server/`.

## Desktop App Notes
- Prefer Electron for the desktop shell in this repo unless the user explicitly asks for a different runtime.
- Reuse the existing Fastify server and Svelte build; do not rewrite APIs just for desktop.
- Desktop-specific runtime data must live in the OS user-data directory, not under `server/data/**` or the install directory.
- Desktop-embedded server should listen on `127.0.0.1` and use a configurable port and SQLite path.
- Keep front-end API calls relative (`/api/*`) so web and desktop builds can share the same client code.
- Treat native Node modules such as `sqlite3` as packaging-sensitive; document any `asarUnpack` or rebuild requirements when touching desktop packaging.

## Common Commands
- Install: `pnpm i` (preferred). Root scripts call `yarn`.
- Dev: `cd server && npm run dev`; `cd client && npm run dev`.
- Build: `yarn build`.
- Format: `yarn prettier` or `cd client && npm run prettier`.
