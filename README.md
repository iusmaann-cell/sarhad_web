# Sarhad

Ordering platform for Sarhad restaurant (Kuwait): a customer website, iOS and Android apps, and a back office that runs the business. Arabic first, English second, built for many branches from day one.

## What is in this repo

| Path            | What it is                                                             | Stack                                                         |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `apps/web`      | Customer website (`/` Arabic, `/en` English)                           | Next.js 16, Tailwind 4, shadcn/ui style components, next-intl |
| `apps/admin`    | Back office for owner, admins and branch staff                         | Next.js 16, same UI kit                                       |
| `apps/mobile`   | Customer app for iOS and Android                                       | Expo SDK 58, Expo Router                                      |
| `packages/core` | Database types, role rules, validation (zod) shared by all apps        | TypeScript                                                    |
| `packages/i18n` | Arabic and English text shared by all apps                             | JSON + helpers                                                |
| `packages/ui`   | Shared web components and the brand theme                              | React + Tailwind                                              |
| `supabase/`     | Database migrations, security rules, seed data, email templates, tests | Supabase (Postgres + PostGIS, Auth)                           |

Hosting is decided at the end of the project, so nothing here is tied to a host. The Next.js apps run anywhere Node runs, and Supabase can be the hosted free tier or self-hosted.

## Phase 1 (Foundations) delivers

- **Multi-branch database**: `branches`, `profiles`, `staff_roles`, `settings`, `audit_log`, with Row Level Security on every table.
- **Roles**: `owner`, `admin` (all branches), `branch_manager`, `staff` (one branch each). Only owners can add or remove owners, and the last owner can never be removed. Every change to branches, roles and settings is written to the audit log.
- **Login**: email and password only (no OTP). Sign up with email confirmation, sign in, forgot password and reset by email, in all three apps. Password rule: 8+ characters with letters and numbers.
- **Arabic and English** everywhere, with right-to-left layout for Arabic.
- **Back office shell**: dashboard, branches list, staff management (add a role by email, remove a role). Orders, menu, delivery zones and settings show as "coming soon".
- **Tests**: 22 database security tests (pgTAP), unit tests for roles, validation and translations, and CI on every pull request.

## Phase 2 (Menu and branches) delivers

- **Menu**: categories, items (Arabic and English names and descriptions, price in KWD, photo, calories, "popular" flag) and add-ons such as Size (choose 1, required) or Extras (choose up to 3). Saved in one step by `save_menu_item()`, so an item and its add-ons never get out of sync.
- **Per-branch control**: any branch staff member can mark an item sold out in their branch. Only branch managers and admins can set a branch-specific price. Each branch keeps the base price unless it sets its own.
- **Branches in the back office**: add and edit branches with names, address, phone, WhatsApp, map pin (latitude and longitude), delivery or pickup, visibility and weekly opening hours, including hours past midnight.
- **Menu photos** go to the public `menu-images` storage bucket. Only admins can upload.
- **Website**: `/menu` (switch branch, jump to category, sold-out and add-on details) and `/branches` (open now, hours, call, WhatsApp, directions). The home page shows popular dishes.
- **Mobile app**: Menu and Branches screens.
- **Tests**: 24 more database tests (46 in total) and unit tests for prices, add-on rules, opening hours and the forms.

## Phase 3 (Delivery zones) delivers

- **Delivery areas per branch**: branch managers (their branch) and admins (all branches) draw areas on a map in the back office. Each area has its own delivery fee, minimum order, delivery time and colour, and can be paused. An area can be made of several shapes, and shapes that cross themselves are repaired automatically.
- **Lookup**: `find_delivery_zone(lat, lng)` returns the areas that cover a point, cheapest first, only for active branches that offer delivery. Checkout (Phase 4) uses it to pick the branch and the fee.
- **Website**: `/delivery` ("Do we deliver to you?"): tap the map or use your location to see the fee, minimum order and time. The pin is remembered for checkout.
- **Mobile app**: Delivery screen that checks the phone's location.
- **Maps** use MapLibre with the free OpenFreeMap style (no API key, no cost). Set `NEXT_PUBLIC_MAP_STYLE_URL` to use another style. If the map style cannot load, a plain background is shown and drawing still works.
- **Tests**: 19 more database tests (65 in total) and unit tests for area shapes and the zone form.

## Run it locally

Requirements: Node 22, pnpm 10, Docker (for the local Supabase).

```bash
pnpm install
pnpm db:start            # starts Supabase locally and prints the API URL and keys
cp .env.example apps/web/.env.local
cp .env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env
# paste the API URL and publishable (anon) key into the three files
pnpm db:reset            # applies migrations and loads seed data

pnpm dev:web             # http://localhost:3000
pnpm dev:admin           # http://localhost:3001
pnpm dev:mobile          # Expo: scan the QR code with Expo Go
```

Local emails (sign-up confirmation, password reset) are caught by Mailpit at http://localhost:54324.

Seeded accounts (local only, password `Sarhad1234`):

| Email                  | Role                        |
| ---------------------- | --------------------------- |
| `owner@sarhad.test`    | Owner                       |
| `manager@sarhad.test`  | Branch manager, main branch |
| `customer@sarhad.test` | Customer                    |

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test        # unit tests
pnpm db:test     # database security tests (needs pnpm db:start)
pnpm build
```

## Going live with Supabase (when ready)

1. Create a free project at supabase.com (region closest to Kuwait).
2. `npx supabase link --project-ref <ref>` then `npx supabase db push` to apply migrations. Do not run `seed.sql` in production.
3. In Auth settings: set Site URL to the website, add the website and back office `/auth/confirm` URLs to Redirect URLs, paste the two templates from `supabase/templates/`, set minimum password length 8 with letters and digits, and connect an email sender (SMTP) so emails are not rate limited.
4. Sign up on the website with the owner's email, confirm it, then run in the SQL editor: `select public.bootstrap_owner('owner@example.com');`
5. Put the project URL and publishable key in each app's environment.

## Roadmap

1. Foundations (done)
2. Menu and branches (done)
3. Delivery zones (done)
4. Website ordering
5. Mobile apps
6. Order operations
7. Payments and promotions (cash first, then pluggable gateways)
8. Launch
