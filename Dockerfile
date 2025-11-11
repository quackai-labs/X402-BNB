# Multi-stage Dockerfile for q402

# Stage 1: Dependencies
FROM node:18-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json ./packages/core/
COPY packages/middleware-express/package.json ./packages/middleware-express/
COPY packages/middleware-hono/package.json ./packages/middleware-hono/
COPY packages/facilitator/package.json ./packages/facilitator/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Build all packages
RUN pnpm build

# Stage 3: Runner (Facilitator)
FROM node:18-alpine AS facilitator
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm@8

# Copy built packages and dependencies
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/facilitator/dist ./packages/facilitator/dist
COPY --from=builder /app/packages/facilitator/package.json ./packages/facilitator/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Create data directory
RUN mkdir -p /app/data /app/logs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "packages/facilitator/dist/index.js"]

# Stage 4: Runner (Example Server)
FROM node:18-alpine AS example-server
WORKDIR /app

ENV NODE_ENV=production

# Install pnpm
RUN npm install -g pnpm@8

# Copy built packages and dependencies
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/middleware-express/dist ./packages/middleware-express/dist
COPY --from=builder /app/packages/middleware-express/package.json ./packages/middleware-express/
COPY --from=builder /app/examples/bsc-testnet ./examples/bsc-testnet
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

CMD ["pnpm", "--filter", "q402-bsc-testnet-example", "run", "server:express"]


