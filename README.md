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

## Phase 4 (Website ordering) delivers

- **Cart**: add dishes from the menu with their add-ons, quantity and a note for the kitchen. The cart is kept in the browser, belongs to one branch, and is re-priced against the live menu whenever it is opened (sold-out dishes are removed).
- **Checkout**: delivery or pickup, Kuwaiti address (area, block, street, avenue, building, floor, apartment) with a pin on the map, saved addresses, name and mobile, order notes, and cash payment. The delivery area, fee and minimum order show as soon as the pin is placed. Closed branches cannot take orders.
- **`place_order()`** checks everything again on the server: sign-in, branch open and taking orders, dishes available, add-on rules, prices, delivery area, fee and minimum. Sending the same order twice creates it only once.
- **Order page** with a live status tracker (refreshes every 15 seconds), items, totals, address, call the branch, and cancel while the branch has not accepted. **My orders** lists past orders.
- **Branches** can pause online orders (`accepting_orders`), used by the back office in Phase 6.
- **Tests**: 23 more database tests (88 in total) and unit tests for the cart, checkout validation and order statuses.

## Phase 5 (Mobile app ordering) delivers

- **Cart** in the app, kept on the phone, one branch at a time, re-priced against the live menu when opened.
- **Menu**: an Add button on each dish; dishes with add-ons open a sheet to pick options, quantity and a note.
- **Checkout**: delivery or pickup, saved addresses, Kuwaiti address fields, the phone's location as the delivery pin, live delivery area check with fee and minimum, cash payment. Orders go through the same `place_order()` as the website.
- **My orders** and an **order screen** with status steps (refreshes every 15 seconds) and cancel while pending.
- Not yet: choosing the pin on a map inside the app (it uses the phone's location for now). Tested in the Expo web preview; test on real phones with Expo Go.

## Phase 6 (Order operations) delivers

- **Live orders board** in the back office (`/orders`): New, In the kitchen, and Ready columns per branch, refreshed every 10 seconds. New orders show a count in the browser tab and can play a chime (turn on sound once per session). Orders waiting more than 5 minutes are highlighted.
- **One-tap status changes**: Accept, Start preparing, Mark ready, Out for delivery (delivery only), Complete. Cash is marked as collected when an order is completed.
- **Cancel with a reason** (quick reasons or your own words). The customer sees the reason on the website and in the app.
- **Pause online orders** for a branch, for example when the kitchen is too busy. Customers cannot order from a paused branch.
- **Order page** with items, add-ons, notes, customer phone, address with a map link, a status history (who and when), and a print button for kitchen tickets.
- **Order history** with search (order number, phone or name), status, branch and date filters.
- **Dashboard** shows open orders, orders today, sales today and cancellations.
- **`update_order_status()`** and **`set_accepting_orders()`** check on the server that the staff member works at the branch and that the step is allowed.
- **Tests**: 18 more database tests (106 in total).

## Phase 7 (Payments and promotions) delivers

- **Online payments** next to cash. Admins add a gateway in the back office (**Settings**): **MyFatoorah** or **Tap Payments** (both take KNET, cards and Apple Pay in Kuwait), each in sandbox or live mode. The API key is stored in a table no app user can read, not even admins; the back office only shows its last 4 characters.
- **Checkout** on the website and in the app offers cash or the active gateways. Online orders go to the gateway's payment page and reach the kitchen only after the gateway confirms the payment. The result is always checked with the gateway itself, never taken from the return link. Unpaid online orders are cancelled after 30 minutes, and customers can retry with **Pay now**.
- **Built-in test gateway** to try the whole flow without a merchant account. It works only where the website allows it (`ALLOW_TEST_GATEWAY=true`, never in production by default).
- **Promo codes** (**Promo codes** in the back office): percent off (with an optional cap), fixed amount off, or free delivery; minimum order, start and last day, total and per-customer limits, first order only, one branch or all. Branch managers can make codes for their own branch. Customers type the code at checkout; `place_order()` checks it again and records each use.
- **Back office**: orders show _Paid online_ or _Cash to collect_, unpaid online orders are kept off the board, and paid orders that get cancelled show a refund reminder.
- **Tests**: 30 more database tests (136 in total), unit tests for the gateway connectors and promo rules.

Going live with a gateway: sign a merchant agreement with MyFatoorah or Tap, paste the **sandbox** key in Settings, place a test order with their test cards, then switch to the live key and turn on _Live mode_. The website server needs `SUPABASE_SECRET_KEY` (Supabase: Project settings > API > secret/service role key) to talk to gateways. Keep it secret: never put it in the mobile app or any `NEXT_PUBLIC_` variable.

## Phase 8 (Launch) delivers

- **Delete my account** on the website and in the app (required by Apple and Google). Login, profile and saved addresses are deleted; past orders stay for the restaurant's records with the name, phone and street address removed. Not allowed while an order is in progress or for staff accounts.
- **Privacy policy** (`/privacy`) and **terms of use** (`/terms`) in Arabic and English, linked from the footer and the app. Have them reviewed by a lawyer before launch.
- **Production hardening**: security headers on both apps, back office hidden from search engines, `robots.txt`, `sitemap.xml` and Restaurant data for Google on the website, and `/api/health` on both apps for uptime checks.
- **Deployment**: one `Dockerfile` for the website and the back office (`--build-arg APP=web|admin`), standalone Node output that runs on any host. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **App stores**: version 1.0.0, EAS build profiles (`apps/mobile/eas.json`), export-compliance flag, and the store listing text and privacy answers in [docs/STORE.md](docs/STORE.md).
- **Tests**: 10 more database tests for account deletion.

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

## Going live

Step by step in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (Supabase, hosting, domains, first owner, payments, backups) and [docs/STORE.md](docs/STORE.md) (App Store and Google Play).

## Roadmap

1. Foundations (done)
2. Menu and branches (done)
3. Delivery zones (done)
4. Website ordering (done)
5. Mobile apps (ordering done; store release in Launch)
6. Order operations (done)
7. Payments and promotions (done)
8. Launch (code done; hosting, domains and store submission need the owner's accounts)
