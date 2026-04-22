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

# openssl:   Prisma
# chromium + font/render libs: Shell fetcher'ın Playwright headless tarayıcısı
RUN apk add --no-cache \
    openssl \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# playwright-core paket içinden indirmesini istemesin, apk'nın chromium'unu kullan
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Start: migration MUST succeed before server starts, aksi halde tablo eksik
# kalıp P2021 hatasıyla runtime'da patlıyor.
CMD sh -c "npx prisma migrate deploy && node dist/main.js"
