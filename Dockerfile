# syntax=docker/dockerfile:1

# ===========================================
# Frontend (Next.js)
# ===========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY client/package.json client/package-lock.json* ./
RUN npm ci

# Copy source
COPY client/ ./

# Build
RUN npm run build

# Production
FROM node:20-alpine AS frontend-runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
