# Going live

This is the checklist for putting Sarhad online: the database, the website, the back office and the mobile apps. Steps marked **(owner)** need an account, a payment or a decision from the restaurant.

Order of work:

1. Supabase project (database, sign-in, images)
2. Website and back office on a host
3. Domains and email links
4. First owner account and real menu
5. Payment gateway (optional, cash works from day one)
6. Mobile apps in the stores (see [STORE.md](./STORE.md))

---

## 1. Supabase **(owner: create the account)**

1. Create a project at supabase.com. Pick the region closest to Kuwait (Frankfurt or Mumbai at the time of writing). Save the database password in a password manager.
2. From this repository:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push        # applies every file in supabase/migrations
   ```
   Do **not** run `supabase/seed.sql` in production: it creates test accounts.
3. **Authentication > URL configuration**
   - Site URL: the website, e.g. `https://sarhad.com.kw`
   - Redirect URLs: `https://sarhad.com.kw/**`, `https://admin.sarhad.com.kw/**`, `sarhad://**`
4. **Authentication > Emails**: paste `supabase/templates/confirmation.html` into _Confirm signup_ and `supabase/templates/recovery.html` into _Reset password_.
5. **Authentication > SMTP**: connect an email sender. Supabase's built-in sender is limited to a few emails per hour and is meant for testing only. Free tiers that are enough to start: Resend, Brevo or Amazon SES. Use an address on the restaurant's own domain (e.g. `no-reply@sarhad.com.kw`) and add the SPF/DKIM records the provider gives you.
6. **Authentication > Sign in / Providers > Email**: keep _Confirm email_ on; set minimum password length 8, letters and digits.
7. **Project settings > API**: copy the project URL, the publishable (anon) key and the secret (service role) key for the next step.

Free plan note: Supabase pauses free projects after a week with no activity and keeps daily backups for a short time only. A live restaurant gets activity every day, but move to the Pro plan once orders are flowing if you want point-in-time backups and no pausing risk.

## 2. Website and back office

Both are Next.js apps. Each is one Node server, so any host that runs Node 22 or Docker works. The choice is yours; the code does not depend on any host.

| Option                                                   | Good for                                      | Notes                                                                                    |
| -------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A small VPS (Hetzner, DigitalOcean, Contabo) with Docker | Lowest monthly cost, both apps on one machine | You keep the machine updated. Put Caddy or Nginx in front for HTTPS.                     |
| Railway or Render                                        | Little setup, deploy from GitHub              | Pay per use; both apps as two services from the same `Dockerfile`.                       |
| Vercel                                                   | Easiest for Next.js                           | The free Hobby plan is for non-commercial use only, so a restaurant needs the paid plan. |
| Cloudflare (OpenNext)                                    | Cheap at scale                                | Needs an extra adapter; not set up in this repo.                                         |

Check current prices before choosing; they change often.

### Environment variables

Website (`apps/web`):

| Variable                               | Value                                               | When                  |
| -------------------------------------- | --------------------------------------------------- | --------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                | build time            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable (anon) key                              | build time            |
| `NEXT_PUBLIC_SITE_URL`                 | `https://sarhad.com.kw`                             | build time            |
| `NEXT_PUBLIC_MAP_STYLE_URL`            | optional map style, defaults to free OpenFreeMap    | build time            |
| `SUPABASE_SECRET_KEY`                  | secret (service role) key, only for online payments | run time, keep secret |

Back office (`apps/admin`): the same `NEXT_PUBLIC_SUPABASE_*`, plus `NEXT_PUBLIC_SITE_URL=https://admin.sarhad.com.kw` (it is used for email links from the back office) and `NEXT_PUBLIC_ADMIN_URL` with the same value. The back office never needs the secret key.

Never set `ALLOW_TEST_GATEWAY` in production.

### With Docker

```bash
docker build --build-arg APP=web \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://sarhad.com.kw \
  -t sarhad-web .
docker run -d --restart unless-stopped -p 3000:3000 -e SUPABASE_SECRET_KEY=... sarhad-web

docker build --build-arg APP=admin ... -t sarhad-admin .
docker run -d --restart unless-stopped -p 3001:3000 sarhad-admin
```

Each container answers `GET /api/health` with `200 {"ok":true,"supabase":"ok"}` when it can reach Supabase. Point the host's health check or a free uptime monitor (UptimeRobot, Better Stack) at it.

### Without Docker

```bash
pnpm install --frozen-lockfile
pnpm turbo run build --filter=@sarhad/web
node apps/web/.next/standalone/apps/web/server.js   # copy .next/static and public next to it first
```

## 3. Domains **(owner: buy the domain)**

- Website: `sarhad.com.kw` (and `www.` redirecting to it)
- Back office: `admin.sarhad.com.kw`

Both apps send security headers (no framing, HSTS, no sniffing) and the back office tells search engines not to index it. The website serves `/robots.txt` and `/sitemap.xml` built from `NEXT_PUBLIC_SITE_URL`.

## 4. First owner and real data **(owner)**

1. Sign up on the website with the owner's email and confirm it.
2. In the Supabase SQL editor:
   ```sql
   select public.bootstrap_owner('owner@example.com');
   ```
3. Sign in to the back office. Then: create the branch (address, map pin, opening hours, phone), draw the delivery zones with their fees, add the menu with photos, and invite staff from **Staff**.
4. Place a test order on the website and in the app, move it through the board, and cancel one to check the flow.

## 5. Online payments (optional) **(owner: merchant agreement)**

1. Sign up with MyFatoorah or Tap Payments as a Kuwaiti business (they need the commercial licence and a bank account).
2. In the back office **Settings**, add the gateway with the **sandbox** key, mark it active, and pay a test order with the gateway's test cards.
3. Replace the key with the **live** key and turn on _Live mode_.
4. Make sure the website has `SUPABASE_SECRET_KEY` set; without it online payment options are hidden.

Refunds are made in the gateway's own dashboard; the back office reminds staff when a paid order is cancelled.

## 6. Legal pages

The website has a privacy policy (`/privacy`) and terms of use (`/terms`) in Arabic and English, written from how the system actually works. **Have a lawyer in Kuwait review them before launch** and edit the text in `packages/i18n/src/messages/{ar,en}.json` under `legal`. Update `LEGAL_UPDATED` in `apps/web/src/components/legal/legal-page.tsx` when the text changes.

## Backups and upkeep

- Supabase keeps automatic daily backups (longer on paid plans). For an extra copy, run weekly: `npx supabase db dump --linked -f backup-$(date +%F).sql` and store it off-site.
- Menu photos live in Supabase Storage (bucket `menu-images`).
- New database changes are new files in `supabase/migrations`; apply them with `npx supabase db push` before deploying the apps that need them.
- Update dependencies monthly (`pnpm update -r`), run `pnpm lint typecheck test build`, and redeploy.
