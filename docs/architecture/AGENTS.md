# Repository Guidelines

## Project Structure & Module Organization
- `apps/api/` Node.js backend with layered `src/controllers`, `services`, `workflows`, `queues`, `workers`.
- `apps/web/` Vite + React admin; UI lives in `src/pages`, `components`, `layouts`.
- `packages/api-gateway/` and `packages/service-registry/` provide shared gateway/discovery code (`@mst-platform/*`).
- `services/` contains Python microservices (geometry-detection, vector-service, etc.) each entrypointed by `app.py`.
- `infrastructure/` hosts docker/k8s scripts; root `start.sh` orchestrates local dependencies.
- `tests/` stores shared fixtures; each app/service keeps runnable specs in its own `/tests`.

## Build, Test, and Development Commands
- Backend: `cd apps/api && npm install && npm run dev`; lint via `npm run lint`, migrate with `npm run migrate`, verify using `npm run test[:unit|:integration|:coverage]`.
- Frontend: `cd apps/web && npm install && npm run dev`; `npm run build` emits the Vite bundle and `npm run lint` enforces TSX rules.
- Packages: `cd packages/api-gateway && npm install && npm run dev`; run `npm test` before linking downstream.
- Python services: `cd services/<service> && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt`; many ship `./start.sh`.
- Full stack: run `./start.sh` to boot PostgreSQL, Redis, Neo4j, Milvus, and MinIO before starting apps.

## Coding Style & Naming Conventions
- JavaScript/TypeScript relies on ESLint + Prettier; use two-space indents, single quotes server-side, semicolons in TS/TSX, camelCase functions, PascalCase classes (e.g. `AuthController.js`).
- Keep backend flows controller → service → repository and colocate routes in `src/routes`.
- React components belong under `src/components` or `src/pages`; prefer `.tsx` files with typed props in `src/types`.
- Python modules follow PEP 8 (snake_case files, 4-space indents); keep entrypoints named `app.py` with clear init routines.

## Testing Guidelines
- `apps/api` uses Jest (`jest.config.js`) with 60% global coverage; store specs under `apps/api/tests/**` ending in `.test.js` or `.spec.js`, and run `npm run test` or targeted scripts.
- UI and e2e harnesses live in `apps/api/tests/e2e` and `apps/web/test-*.mjs`; invoke `node test-kb-quick.mjs` and archive screenshots in `apps/web/test-screenshots/`.
- Share fixtures from `tests/fixtures`; reset Redis/Postgres containers when running integration suites.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `refactor:`, `chore:`); avoid bundling unrelated changes.
- PRs should note affected services, commands executed, and schema/config impacts; attach UI screenshots or API samples when behavior changes.
- Ensure linting and tests pass for every touched package/service, and document migration steps when editing `infrastructure/database` or `apps/api/knexfile.js`.
