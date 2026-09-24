# RosterDesk

RosterDesk is a small hospital shift-roster tool for nurse managers. It supports weekly staffing, shift assignment, swap requests, safety review, and publishing.

## Run locally

```bash
npm install
npm run dev
```

Checks:

```bash
npm run typecheck
npm test
npm run build
npm run lint
```

## Included workflows

- Roster board with ward, week, role, and staff-search filters stored in URL search parameters.
- Shift drawer using React Hook Form and Zod.
- Domain validation for duplicate shifts, rest time, weekly hours, ICU certification, leave, night streaks, and coverage.
- Swap request approval and rejection.
- Publish review with error blocking and warning acknowledgement.
- Development controls for offline/write failure simulation.
- Fake API with 15 seeded nurses across three wards, latency, abortable search, write failures, version conflicts, and idempotent writes.

## Architecture

- `src/feature/domain`: pure entities, rules, and use-case orchestration.
- `src/core/handlers.ts`: in-memory API and seed data.
- `src/App.tsx`: presentation workflow and TanStack Query integration.
- `src/main.tsx`: React Router data-router and Query providers.

The domain layer does not depend on React or the API. The UI reads server state through TanStack Query and keeps view filters in the URL.

## Trade-offs and next steps

This is intentionally a compact assignment implementation. The remaining production-hardening work would be extracting feature-level presentation/data modules, adding a dedicated conflict dialog, bulk swap actions, BroadcastChannel multi-tab refresh, route-level lazy loading, and component/integration tests.

AI assistance was used for implementation and review; all generated code was checked with TypeScript, ESLint, Vitest, and the production build.
