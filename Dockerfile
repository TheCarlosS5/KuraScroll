# ==============================================================================
# Multi-Stage Dockerfile for KuraScroll Platform
# Combines React 19 Vite Frontend + Fastify 5 Backend into a single production container
# ==============================================================================

# --- Stage 1: Build Frontend ---
FROM node:22-bookworm-slim AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Build Backend ---
FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Copy schema.sql to dist/backend/db/
RUN cp src/backend/db/schema.sql dist/backend/db/schema.sql

# --- Stage 3: Production Runtime ---
FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV STORAGE_ROOT=/app/data/storage

# Install dependencies required by runtime
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend
COPY --from=backend-builder /app/dist ./dist
# Copy compiled frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Ensure persistent data directories exist and assign to non-root 'node' user
RUN mkdir -p /app/data/storage /app/data/reports && \
    chown -R node:node /app/data

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

VOLUME ["/app/data"]

CMD ["node", "dist/backend/server.js"]
