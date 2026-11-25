# One image recipe for both Next.js apps. Build from the repository root:
#   docker build --build-arg APP=web   -t sarhad-web   .
#   docker build --build-arg APP=admin -t sarhad-admin .
# NEXT_PUBLIC_* values are baked in at build time, so pass them as build args.
# Server-only secrets (SUPABASE_SECRET_KEY) are passed at run time with -e.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP=web
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile --filter "@sarhad/${APP}..."
RUN pnpm turbo run build --filter="@sarhad/${APP}"
# Put the static files where the standalone server looks for them.
RUN mkdir -p /out && cp -r apps/${APP}/.next/standalone/. /out/ \
 && cp -r apps/${APP}/.next/static /out/apps/${APP}/.next/static \
 && if [ -d apps/${APP}/public ]; then cp -r apps/${APP}/public /out/apps/${APP}/public; fi

FROM node:22-alpine AS run
ARG APP=web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP=${APP}
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=6s --start-period=20s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" >/dev/null || exit 1
CMD ["sh", "-c", "exec node apps/${APP}/server.js"]
