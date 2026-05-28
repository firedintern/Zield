# syntax=docker/dockerfile:1

# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build 2>/dev/null || true

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S zield -u 1001

# Copy only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built code + source (tsx can run TS directly)
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Copy production runtime files
COPY ecosystem.config.js ./

ENV NODE_ENV=production
ENV PORT=3001

USER zield

# Health check endpoint (uses the health-server)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Default command uses PM2 for production
CMD ["npx", "pm2-runtime", "ecosystem.config.js"]
