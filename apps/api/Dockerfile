FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production=false

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build
RUN npm run build

# ── Production stage ──
FROM node:20-alpine

WORKDIR /app

# Copy built files and dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE ${PORT:-3001}

# Run migrations and start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed || true && node dist/main.js"]
