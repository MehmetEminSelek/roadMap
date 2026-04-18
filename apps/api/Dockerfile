FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL for Prisma
RUN apk add --no-cache openssl

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

# ── Production stage ──
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Start: try migration, then always start server
CMD sh -c "npx prisma migrate deploy 2>&1 || echo 'Migration skipped'; node dist/main.js"
