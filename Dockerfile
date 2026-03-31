# --- Stage 1: Base ---
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- Stage 2: Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Install ALL dependencies (including devDeps)
RUN pnpm install --frozen-lockfile --ignore-scripts

# --- Stage 3: Builder ---
FROM base AS builder
# Use ARG for build-time environment variables
ARG DATABASE_URL="postgresql://postgres:password@localhost:5432/db"
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client and build NestJS app
RUN pnpm prisma generate
RUN pnpm build
# Re-install only production dependencies
RUN pnpm install --prod --frozen-lockfile --ignore-scripts

# --- Stage 4: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only the necessary files for runtime
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy Prisma schema for runtime migrations (optional but recommended)
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Healthcheck to ensure the app is running
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/src/main.js"]
