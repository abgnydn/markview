# ── Build ─────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json* ./

# Copy all packages and apps
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install monorepo root deps
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Build core package first (web depends on it)
WORKDIR /app/packages/core
RUN npm install && npm run build

# Build web app
WORKDIR /app/apps/web
RUN npm install && npm run build

# ── Runtime ───────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Install a lightweight static file server
RUN npm install -g serve@14

# Copy the static export
COPY --from=builder /app/apps/web/out ./out

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost:3000 || exit 1

CMD ["serve", "-s", "out", "-l", "3000"]
