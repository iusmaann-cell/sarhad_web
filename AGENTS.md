# Working in this repo

- pnpm + Turborepo monorepo. Apps in `apps/*`, shared code in `packages/*`, database in `supabase/`.
- Next.js 16 (`apps/web`, `apps/admin`) has breaking changes from older versions: route guards live in `src/proxy.ts` (not `middleware.ts`), and `PageProps`/`LayoutProps` types come from `next typegen`. Read `node_modules/next/dist/docs/` before using an API you are unsure of. See each app's `AGENTS.md`.
- Expo SDK 58 (`apps/mobile`): check the versioned Expo docs before using an Expo API. Install native packages at the version listed in `node_modules/expo/bundledNativeModules.json`.
- All user-facing text goes in `packages/i18n/src/messages/{ar,en}.json` (same keys in both, a test enforces it). Arabic is the default and is right to left: use logical classes (`ms-`, `pe-`, `text-start`, `border-e`) not `ml-`/`text-left`.
- Every table has Row Level Security. Add a migration in `supabase/migrations/` and pgTAP tests in `supabase/tests/database/` for any new table or policy, then update `packages/core/src/database.types.ts` (`pnpm db:types`).
- Design for many branches: anything operational (menu availability, zones, orders) belongs to a branch and is checked with `can_access_branch()` / `can_manage_branch()`.
- Money is stored as integer fils (1 KWD = 1000 fils) and shown with 3 decimals.
- Before finishing: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
