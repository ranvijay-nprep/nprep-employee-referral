# Production image for the employee referral portal.
#
# Two things drive the shape of this file:
#   1. `npm start` runs the custom `server.ts` through tsx (see server.ts for
#      why it isn't `next start`), so the runtime needs the TypeScript sources
#      and tsx present - we can't ship only `.next`.
#   2. better-sqlite3 is a native module, so the install stage needs a C++
#      toolchain. It's compiled in `deps` and the built node_modules are then
#      copied forward, keeping the toolchain out of the final image.

# ---- deps: install and compile native modules -------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# node-gyp needs these to build better-sqlite3's bindings.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# ---- build: produce .next ---------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so this
# one must be present here and not only at runtime.
ARG NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=nprep.in
ENV NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=$NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN

RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# curl is used by the compose healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/.next        ./.next
COPY package.json next.config.ts tsconfig.json server.ts ./
COPY src ./src

# The SQLite file lives on a bind-mounted volume (see docker-compose.yml).
# node:22 images ship a `node` user at UID 1000, which is what the host-side
# ./data directory is chowned to.
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3000
CMD ["npm", "start"]
